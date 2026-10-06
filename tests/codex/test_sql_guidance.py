"""Run extracted SQL in a private socket-only PostgreSQL cluster, never an ambient DB."""

import os
import re
import shutil
import subprocess
import tempfile
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def snippet(path: str, needle: str) -> str:
    blocks = re.findall(r"```sql\n(.*?)\n```", (ROOT / path).read_text(), re.DOTALL)
    return next(block for block in blocks if needle in block)


class SqlGuidanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        candidate = os.environ.get("COUNCIL_TEST_PG_BIN")
        found = shutil.which("postgres")
        cls.bin = Path(
            candidate
            or (Path(found).parent if found else "/opt/homebrew/opt/postgresql@17/bin")
        )
        if not all((cls.bin / name).is_file() for name in ("initdb", "pg_ctl", "psql")):
            if os.environ.get("COUNCIL_REQUIRE_LANGUAGE_TOOLS") == "1":
                raise RuntimeError("Required private PostgreSQL test tools unavailable")
            raise unittest.SkipTest("Private PostgreSQL tools unavailable")
        cls.environment = {
            key: value for key, value in os.environ.items() if not key.startswith("PG")
        }
        cls.temporary = tempfile.TemporaryDirectory(prefix="council-pg-test-")
        cls.directory = Path(cls.temporary.name)
        cls.directory.chmod(0o700)
        cls.data, cls.socket = cls.directory / "data", cls.directory / "socket"
        cls.socket.mkdir(mode=0o700)
        initialized = subprocess.run(
            [
                str(cls.bin / "initdb"),
                "-D",
                str(cls.data),
                "-A",
                "trust",
                "-U",
                "council_fixture",
                "--no-locale",
            ],
            env=cls.environment,
            capture_output=True,
            text=True,
            check=False,
            timeout=45,
        )
        if initialized.returncode:
            cls.temporary.cleanup()
            raise RuntimeError(initialized.stderr)
        started = subprocess.run(
            [
                str(cls.bin / "pg_ctl"),
                "-D",
                str(cls.data),
                "-l",
                str(cls.directory / "server.log"),
                "-o",
                f"-c listen_addresses='' -c unix_socket_directories={cls.socket} -c port=55435",
                "-w",
                "start",
            ],
            env=cls.environment,
            capture_output=True,
            text=True,
            check=False,
            timeout=45,
        )
        if started.returncode:
            cls.temporary.cleanup()
            raise RuntimeError(started.stderr)

    @classmethod
    def tearDownClass(cls) -> None:
        stopped = subprocess.run(
            [
                str(cls.bin / "pg_ctl"),
                "-D",
                str(cls.data),
                "-m",
                "immediate",
                "-w",
                "stop",
            ],
            env=cls.environment,
            capture_output=True,
            text=True,
            check=False,
            timeout=45,
        )
        cls.temporary.cleanup()
        if stopped.returncode:
            raise RuntimeError(stopped.stderr)

    def arguments(self) -> list[str]:
        return [
            str(self.bin / "psql"),
            "-X",
            "-h",
            str(self.socket),
            "-p",
            "55435",
            "-U",
            "council_fixture",
            "-d",
            "postgres",
            "-v",
            "ON_ERROR_STOP=1",
            "-Atq",
        ]

    def sql(self, text: str, succeeds: bool = True) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(
            self.arguments(),
            input="\\set VERBOSITY verbose\n" + text,
            env=self.environment,
            capture_output=True,
            text=True,
            check=False,
            timeout=15,
        )
        if succeeds:
            self.assertEqual(result.returncode, 0, result.stderr)
        else:
            self.assertNotEqual(
                result.returncode, 0, "Expected SQL fault resolved successfully"
            )
        return result

    def test_rls_context_reuse_writes_owner_and_bypass_controls(self) -> None:
        policy = snippet(
            "rules-library/sql/security.md", "orders_tenant_isolation"
        ).split("-- Validated", 1)[0]
        setup = """
CREATE ROLE fixture_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE fixture_client NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE fixture_bypass NOLOGIN BYPASSRLS;
CREATE TABLE orders (id int, tenant_id bigint);
INSERT INTO orders VALUES (1,42),(2,84);
ALTER TABLE orders OWNER TO fixture_owner;
GRANT SELECT, INSERT ON orders TO fixture_client, fixture_bypass;
"""
        self.assertEqual(self.sql(setup + policy).returncode, 0)
        result = self.sql("""
SET ROLE fixture_client;
SELECT 'missing=' || count(*) FROM orders;
BEGIN; SET LOCAL app.tenant_id='42'; SELECT 'first=' || string_agg(id::text,',') FROM orders; COMMIT;
BEGIN; SELECT 'reused=' || count(*) FROM orders; COMMIT;
BEGIN; SET LOCAL app.tenant_id='84'; SELECT 'second=' || string_agg(id::text,',') FROM orders; COMMIT;
RESET ROLE; SET ROLE fixture_owner; SELECT 'forced_owner=' || count(*) FROM orders;
ALTER TABLE orders NO FORCE ROW LEVEL SECURITY;
SELECT 'unforced_owner=' || count(*) FROM orders;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
RESET ROLE; SET ROLE fixture_bypass; SELECT 'bypass=' || count(*) FROM orders;
RESET ROLE;
""")
        self.assertEqual(
            result.stdout.splitlines(),
            [
                "missing=0",
                "first=1",
                "reused=0",
                "second=2",
                "forced_owner=0",
                "unforced_owner=2",
                "bypass=2",
            ],
        )
        for context in ("", "SET LOCAL app.tenant_id='42';"):
            result = self.sql(
                "SET ROLE fixture_client; BEGIN;"
                + context
                + "INSERT INTO orders VALUES (3,84); COMMIT;",
                succeeds=False,
            )
            self.assertIn("42501", result.stderr)
        self.assertEqual(self.sql("SELECT count(*) FROM orders;").stdout.strip(), "2")

    def test_function_public_privilege_revoked_and_invoker(self) -> None:
        example = snippet(
            "rules-library/sql/security.md", "create function notify_admin"
        )
        self.assertEqual(
            self.sql(
                "CREATE ROLE app_notifier NOLOGIN; CREATE ROLE unrelated NOLOGIN;"
                + example
            ).returncode,
            0,
        )
        self.assertEqual(
            self.sql(
                "SELECT prosecdef FROM pg_proc WHERE proname='notify_admin';"
            ).stdout.strip(),
            "f",
        )
        denied = self.sql(
            "SET ROLE unrelated; SELECT notify_admin('fixture');", succeeds=False
        )
        self.assertIn("42501", denied.stderr)
        self.assertEqual(
            self.sql(
                "SET ROLE app_notifier; SET search_path=pg_temp,public; SELECT notify_admin('fixture');"
            ).returncode,
            0,
        )
        self.assertEqual(
            self.sql(
                "SELECT has_function_privilege('unrelated','notify_admin(text)','EXECUTE');"
            ).stdout.strip(),
            "f",
        )

    def test_rpc_failed_second_insert_rolls_back_first(self) -> None:
        function = snippet(
            "skills/backend-patterns/references/database.md",
            "create_market_with_position",
        )
        self.assertEqual(
            self.sql(
                "CREATE TABLE markets(payload jsonb); CREATE TABLE positions(payload jsonb CHECK(payload->>'valid'='yes'));"
                + function
            ).returncode,
            0,
        )
        self.assertEqual(
            self.sql(
                "SELECT create_market_with_position('{}','{\"valid\":\"yes\"}')->>'success';"
            ).stdout.strip(),
            "true",
        )
        failed = self.sql(
            'SELECT create_market_with_position(\'{"fault":true}\',\'{"valid":"no"}\');',
            succeeds=False,
        )
        self.assertIn("23514", failed.stderr)
        self.assertEqual(
            self.sql(
                "SELECT count(*) FROM markets; SELECT count(*) FROM positions;"
            ).stdout.splitlines(),
            ["1", "1"],
        )

    def test_ddl_lock_timeout_constant_default_and_dual_write(self) -> None:
        example = snippet(
            "skills/database-migrations/SKILL.md", "ADD COLUMN avatar_url"
        )
        addition = (
            example.split("COMMIT;", 1)[0]
            + "SELECT count(*) FROM pg_locks WHERE relation='users'::regclass AND mode='AccessExclusiveLock' AND granted; COMMIT;"
        )
        self.assertEqual(
            self.sql(
                "CREATE TABLE users(id int primary key, username text); INSERT INTO users VALUES(1,'first');"
            ).returncode,
            0,
        )
        self.assertEqual(self.sql(addition).stdout.strip(), "1")
        before = self.sql(
            "SELECT relfilenode FROM pg_class WHERE oid='users'::regclass;"
        ).stdout.strip()
        self.assertEqual(
            self.sql(
                "ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;"
            ).returncode,
            0,
        )
        self.assertEqual(
            self.sql(
                "SELECT relfilenode FROM pg_class WHERE oid='users'::regclass;"
            ).stdout.strip(),
            before,
        )
        invalid = self.sql(
            "ALTER TABLE users ADD COLUMN role TEXT NOT NULL;", succeeds=False
        )
        self.assertIn("23502", invalid.stderr)
        holder = subprocess.Popen(
            self.arguments(),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=self.environment,
        )
        try:
            if holder.stdin is None:
                self.fail("Missing private lock-holder stdin")
            self.assertGreater(
                holder.stdin.write(
                    "BEGIN; LOCK TABLE users IN ACCESS SHARE MODE; SELECT pg_sleep(3); COMMIT;\n"
                ),
                0,
            )
            holder.stdin.flush()
            deadline = time.monotonic() + 2
            while (
                self.sql(
                    "SELECT count(*) FROM pg_locks WHERE relation='users'::regclass AND mode='AccessShareLock' AND granted;"
                ).stdout.strip()
                == "0"
            ):
                if time.monotonic() >= deadline:
                    self.fail("Lock holder failed to acquire its fixture lock")
                time.sleep(0.02)
            failed = self.sql(
                "BEGIN; SET LOCAL lock_timeout='100ms'; ALTER TABLE users ADD COLUMN blocked TEXT; COMMIT;",
                succeeds=False,
            )
            self.assertIn("55P03", failed.stderr)
        finally:
            output, errors = holder.communicate(timeout=8)
            self.assertEqual(holder.returncode, 0, output + errors)
        self.assertEqual(
            self.sql("""
ALTER TABLE users ADD COLUMN display_name text;
CREATE FUNCTION fixture_dual_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.display_name=NEW.username; RETURN NEW; END $$;
CREATE TRIGGER fixture_dual_write BEFORE INSERT OR UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fixture_dual_write();
UPDATE users SET username='during-backfill';
UPDATE users SET display_name=username WHERE display_name IS NULL;
INSERT INTO users(id,username) VALUES(2,'new-writer');
""").returncode,
            0,
        )
        self.assertEqual(
            self.sql(
                "SELECT count(*) FROM users WHERE display_name IS DISTINCT FROM username;"
            ).stdout.strip(),
            "0",
        )
        self.assertEqual(
            self.sql(
                "DROP TRIGGER fixture_dual_write ON users; UPDATE users SET username='uncovered-writer' WHERE id=1;"
            ).returncode,
            0,
        )
        self.assertEqual(
            self.sql(
                "SELECT count(*) FROM users WHERE display_name IS DISTINCT FROM username;"
            ).stdout.strip(),
            "1",
        )


if __name__ == "__main__":
    unittest.main()
