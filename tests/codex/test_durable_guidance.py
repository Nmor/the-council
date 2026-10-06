"""Check extracted payment orchestration and outbox protocols with durable SQLite adapters.

These fixtures prove local retry/transaction invariants, not AWS or gateway guarantees.
"""

import re
import sqlite3
import tempfile
import unittest
from collections.abc import Generator
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing, contextmanager
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "skills/django-patterns/references/service-layer.md"
BLOCK = re.findall(r"```python\n(.*?)\n```", SOURCE.read_text(), re.DOTALL)[0]
PAYMENT: dict[str, Any] = {"__name__": __name__}
exec(compile(BLOCK, str(SOURCE), "exec"), PAYMENT)


def write_sql(
    connection: sqlite3.Connection, query: str, parameters: tuple[Any, ...] = ()
) -> None:
    """Execute a write and close its cursor; never silently discard a result set."""
    with closing(connection.execute(query, parameters)) as cursor:
        if cursor.description is not None:
            raise ValueError("Write fixture unexpectedly returned rows")


@contextmanager
def transaction(path: Path) -> Generator[sqlite3.Connection]:
    connection = sqlite3.connect(path, timeout=5)
    try:
        write_sql(connection, "BEGIN IMMEDIATE")
        yield connection
        connection.commit()
    except BaseException:
        connection.rollback()
        raise
    finally:
        connection.close()


def rows(path: Path, query: str) -> list[tuple[Any, ...]]:
    with transaction(path) as connection:
        return connection.execute(query).fetchall()


class Store:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.fail_reserve = False
        self.fail_settle = False
        with transaction(path) as connection:
            write_sql(
                connection,
                "CREATE TABLE IF NOT EXISTS intents(key TEXT PRIMARY KEY, amount INTEGER, currency TEXT, status TEXT, receipt TEXT)",
            )
            write_sql(
                connection,
                "CREATE TABLE IF NOT EXISTS notices(key TEXT PRIMARY KEY, delivered INTEGER DEFAULT 0)",
            )

    def reserve(self, order_id: str) -> Any:
        with transaction(self.path) as connection:
            write_sql(
                connection,
                "INSERT OR IGNORE INTO intents VALUES(?,6300,'NGN','pending',NULL)",
                (order_id,),
            )
            if self.fail_reserve:
                self.fail_reserve = False
                raise OSError("Intent commit failed")
            value = connection.execute(
                "SELECT key,amount,currency,status FROM intents WHERE key=?",
                (order_id,),
            ).fetchone()
            if value is None:
                raise RuntimeError("Missing reserved intent")
            return PAYMENT["PaymentIntent"](*value)

    def settle(self, key: str, result: Any) -> None:
        with transaction(self.path) as connection:
            previous = connection.execute(
                "SELECT receipt,status FROM intents WHERE key=?", (key,)
            ).fetchone()
            if previous is None:
                raise ValueError("Unreserved intent")
            status = "paid" if result.success else "declined"
            if previous[0] is not None and previous != (result.receipt_id, status):
                raise ValueError("Conflicting provider receipt")
            write_sql(
                connection,
                "UPDATE intents SET status=?, receipt=? WHERE key=?",
                (status, result.receipt_id, key),
            )
            if result.success:
                write_sql(
                    connection, "INSERT OR IGNORE INTO notices(key) VALUES(?)", (key,)
                )
            if self.fail_settle:
                self.fail_settle = False
                raise OSError("Settlement commit failed")

    def notify(self, *, fails: bool) -> None:
        with transaction(self.path) as connection:
            write_sql(connection, "UPDATE notices SET delivered=1")
            if fails:
                raise OSError("Notification acknowledgment failed")


class Gateway:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.lose_ack = False
        self.decline = False
        with transaction(path) as connection:
            write_sql(
                connection,
                "CREATE TABLE IF NOT EXISTS charges(key TEXT PRIMARY KEY, amount INTEGER, currency TEXT, success INTEGER)",
            )

    def charge(
        self, *, amount: int, currency: str, token: str, idempotency_key: str
    ) -> Any:
        if token != "fixture-token":
            raise ValueError("Invalid fixture token")
        with transaction(self.path) as connection:
            write_sql(
                connection,
                "INSERT OR IGNORE INTO charges VALUES(?,?,?,?)",
                (idempotency_key, amount, currency, not self.decline),
            )
            previous = connection.execute(
                "SELECT amount,currency,success FROM charges WHERE key=?",
                (idempotency_key,),
            ).fetchone()
            if previous is None or previous[:2] != (amount, currency):
                raise ValueError("Frozen payload mismatch")
            result = PAYMENT["PaymentResult"](
                bool(previous[2]), "receipt-" + idempotency_key
            )
        if self.lose_ack:
            self.lose_ack = False
            raise TimeoutError("Provider accepted but acknowledgment lost")
        return result


class DurableGuidanceTests(unittest.TestCase):
    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory(prefix="council-durable-")
        self.addCleanup(temporary.cleanup)
        self.database = Path(temporary.name) / "store.sqlite"
        self.provider = Path(temporary.name) / "provider.sqlite"
        self.store, self.gateway = Store(self.database), Gateway(self.provider)

    def service(self) -> Any:
        return PAYMENT["OrderService"](self.store, self.gateway)

    def pay(self) -> bool:
        return self.service().process_payment("order", "fixture-token")

    def test_intent_failure_prevents_charge(self) -> None:
        self.store.fail_reserve = True
        with self.assertRaises(OSError):
            self.pay()
        self.assertEqual(rows(self.database, "SELECT * FROM intents"), [])
        self.assertEqual(rows(self.provider, "SELECT * FROM charges"), [])

    def test_settlement_failure_retry_restart_one_charge(self) -> None:
        self.store.fail_settle = True
        with self.assertRaises(OSError):
            self.pay()
        self.assertEqual(
            rows(self.database, "SELECT status FROM intents"), [("pending",)]
        )
        self.assertEqual(rows(self.database, "SELECT * FROM notices"), [])
        self.store, self.gateway = Store(self.database), Gateway(self.provider)
        self.assertTrue(self.pay())
        self.assertTrue(self.pay())
        self.assertEqual(
            rows(self.provider, "SELECT amount,currency FROM charges"), [(6300, "NGN")]
        )
        self.assertEqual(rows(self.database, "SELECT status FROM intents"), [("paid",)])
        self.assertEqual(rows(self.database, "SELECT count(*) FROM notices"), [(1,)])

    def test_lost_provider_ack_and_concurrent_retries(self) -> None:
        self.gateway.lose_ack = True
        with self.assertRaises(TimeoutError):
            self.pay()
        with ThreadPoolExecutor(max_workers=2) as workers:
            futures = [workers.submit(attempt) for attempt in (self.pay, self.pay)]
            self.assertEqual(
                [future.result(timeout=10) for future in futures], [True, True]
            )
        self.assertEqual(rows(self.provider, "SELECT count(*) FROM charges"), [(1,)])
        self.assertEqual(rows(self.database, "SELECT count(*) FROM notices"), [(1,)])

    def test_decline_and_notification_failure_are_not_success(self) -> None:
        self.gateway.decline = True
        self.assertFalse(self.pay())
        self.assertEqual(
            rows(self.database, "SELECT status FROM intents"), [("declined",)]
        )
        self.assertEqual(rows(self.database, "SELECT * FROM notices"), [])
        self.assertFalse(self.pay())
        self.assertEqual(rows(self.provider, "SELECT count(*) FROM charges"), [(1,)])
        self.assertTrue(
            self.service().process_payment("second", "fixture-token") is False
        )
        self.gateway.decline = False
        self.assertTrue(self.service().process_payment("third", "fixture-token"))
        with self.assertRaises(OSError):
            self.store.notify(fails=True)
        self.assertEqual(rows(self.database, "SELECT delivered FROM notices"), [(0,)])
        Store(self.database).notify(fails=False)
        self.assertEqual(rows(self.database, "SELECT delivered FROM notices"), [(1,)])

    def test_conflicting_receipt_and_payload_roll_back(self) -> None:
        self.assertTrue(self.pay())
        with self.assertRaises(ValueError):
            self.store.settle(
                "order", PAYMENT["PaymentResult"](True, "different-receipt")
            )
        with self.assertRaises(ValueError):
            self.gateway.charge(
                amount=5000,
                currency="NGN",
                token="fixture-token",
                idempotency_key="order",
            )
        self.assertEqual(
            rows(self.database, "SELECT receipt FROM intents"), [("receipt-order",)]
        )
        self.assertEqual(rows(self.provider, "SELECT amount FROM charges"), [(6300,)])

    def test_outbox_commit_publish_ambiguity_reconciliation_and_dedup(self) -> None:
        guidance = (ROOT / "skills/aws-serverless-patterns/SKILL.md").read_text()
        for invariant in (
            "Persist payload and publish intent atomically",
            "scheduled reconciliation",
            "consumers deduplicate",
        ):
            self.assertIn(invariant, guidance)
        with transaction(self.database) as connection:
            write_sql(
                connection,
                "CREATE TABLE events(key TEXT PRIMARY KEY,payload TEXT,status TEXT)",
            )
            write_sql(
                connection, "CREATE TABLE effects(key TEXT PRIMARY KEY,payload TEXT)"
            )
        with transaction(self.provider) as connection:
            write_sql(connection, "CREATE TABLE queue(key TEXT,payload TEXT)")

        def accept(key: str, payload: str, *, fails: bool = False) -> None:
            with transaction(self.database) as connection:
                write_sql(
                    connection,
                    "INSERT OR IGNORE INTO events VALUES(?,?,'pending')",
                    (key, payload),
                )
                actual = connection.execute(
                    "SELECT payload FROM events WHERE key=?", (key,)
                ).fetchone()
                if actual != (payload,):
                    raise ValueError("Duplicate key payload mismatch")
                if fails:
                    raise OSError("Acceptance commit failed")

        def publish(*, lose_ack: bool) -> None:
            for key, payload in rows(
                self.database, "SELECT key,payload FROM events WHERE status='pending'"
            ):
                with transaction(self.provider) as connection:
                    write_sql(
                        connection, "INSERT INTO queue VALUES(?,?)", (key, payload)
                    )
                if lose_ack:
                    raise TimeoutError("Queue accepted; sender missed acknowledgment")
                with transaction(self.database) as connection:
                    write_sql(
                        connection,
                        "UPDATE events SET status='sent' WHERE key=?",
                        (key,),
                    )

        with self.assertRaises(OSError):
            accept("lost", "payload", fails=True)
        self.assertEqual(rows(self.database, "SELECT * FROM events"), [])
        accept("event", "payload")
        with self.assertRaises(TimeoutError):
            publish(lose_ack=True)
        self.assertEqual(
            rows(self.database, "SELECT status FROM events"), [("pending",)]
        )
        accept("event", "payload")
        with self.assertRaises(ValueError):
            accept("event", "changed")
        publish(lose_ack=False)
        self.assertEqual(rows(self.provider, "SELECT count(*) FROM queue"), [(2,)])
        deliveries = rows(self.provider, "SELECT key,payload FROM queue")
        with self.assertRaises(OSError), transaction(self.database) as connection:
            write_sql(connection, "INSERT INTO effects VALUES(?,?)", deliveries[0])
            raise OSError("Consumer effect commit failed")
        self.assertEqual(rows(self.database, "SELECT * FROM effects"), [])
        for delivery in deliveries:
            with transaction(self.database) as connection:
                write_sql(
                    connection, "INSERT OR IGNORE INTO effects VALUES(?,?)", delivery
                )
        self.assertEqual(
            rows(self.database, "SELECT * FROM effects"), [("event", "payload")]
        )


if __name__ == "__main__":
    unittest.main()
