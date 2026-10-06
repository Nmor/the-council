"""Real-process controls for evidence gates, hook feedback and private installs."""

# Size budget: 16 KB.
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NODE = shutil.which("node")
GIT = shutil.which("git")


class RemediationBoundaries(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="council-boundary-")
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.assertIsNotNone(NODE, "Node is required for these boundary tests")
        self.assertIsNotNone(GIT, "Git is required for these boundary tests")

    def write(self, name: str, content: str) -> Path:
        target = self.directory / name
        target.parent.mkdir(parents=True, exist_ok=True)
        self.assertEqual(target.write_text(content, encoding="utf-8"), len(content))
        return target

    def run_process(
        self,
        arguments: list[str],
        *,
        payload: dict[str, object] | None = None,
        environment: dict[str, str] | None = None,
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            arguments,
            cwd=self.directory,
            input=json.dumps(payload) if payload else None,
            text=True,
            capture_output=True,
            check=False,
            timeout=40,
            env=environment if environment is not None else os.environ.copy(),
        )

    def budget(self, *arguments: str) -> subprocess.CompletedProcess[str]:
        assert NODE is not None
        return self.run_process(
            [
                NODE,
                str(ROOT / "scripts/token-budget.mjs"),
                "--root",
                str(self.directory / "source"),
                *arguments,
            ]
        )

    def test_budgets_reach_deep_and_configuration_resources(self) -> None:
        self.write("source/CLAUDE.md", "# Floor\nSize budget: 8 KB\n")
        deep = self.write(
            "source/skills/example/references/a/b/c/d/e/deep.md", "No budget\n"
        )
        config = self.write("source/plugins/installed_plugins.json", "{}\n")
        initial = self.budget("--check")
        self.assertEqual(initial.returncode, 1, initial.stdout + initial.stderr)
        self.assertIn("deep.md", initial.stderr)
        self.assertIn("plugins/installed_plugins.json", initial.stderr)
        self.assertEqual(deep.write_text("Size budget: 8 KB\n", encoding="utf-8"), 18)
        self.write(
            "source/scripts/instruction-budgets.json",
            json.dumps(
                {
                    "scripts/instruction-budgets.json": {"bytes": 8192},
                    "plugins/installed_plugins.json": {"bytes": 1024},
                }
            ),
        )
        healthy = self.budget("--check")
        self.assertEqual(healthy.returncode, 0, healthy.stdout + healthy.stderr)
        self.assertEqual(config.write_text("x" * 1025, encoding="utf-8"), 1025)
        over = self.budget("--check")
        self.assertEqual(over.returncode, 1)
        self.assertIn("OVER  plugins/installed_plugins.json", over.stdout)

    def test_selected_skills_estimate_does_not_claim_references_or_billing(
        self,
    ) -> None:
        self.write("source/CLAUDE.md", "1234")
        self.write("source/skills/a/SKILL.md", "a" * 100)
        self.write("source/skills/b/SKILL.md", "b" * 200)
        self.write("source/skills/b/references/large.md", "z" * 10000)
        measured = self.budget(
            "--json", "--selected-skill", "a", "--selected-skill", "b"
        )
        self.assertEqual(measured.returncode, 0, measured.stderr)
        report = json.loads(measured.stdout)
        self.assertEqual(report["selected"]["bytes"], 304)
        self.assertFalse(report["selected"]["referencesIncluded"])
        self.assertFalse(report["estimate"]["billedTokens"])
        missing = self.budget("--json", "--selected-skill", "unknown")
        self.assertEqual(missing.returncode, 2)

    def test_citations_reject_bare_sections_and_outside_references(self) -> None:
        skill = self.write(
            "source/skills/example/SKILL.md",
            "# Standards §\n" + "Plain guidance.\n" * 30,
        )
        agent = self.write(
            "source/agents/example.md", "# Reviewer\n" + "No authority.\n" * 30
        )
        command = [
            sys.executable,
            str(ROOT / "scripts/verify-citations.py"),
            "--root",
            str(self.directory / "source"),
        ]
        missing = self.run_process(command)
        self.assertEqual(missing.returncode, 1)
        self.assertIn("skills/example/SKILL.md", missing.stderr)
        self.assertIn("agents/example.md", missing.stderr)
        self.write("outside.md", "NIST SP 800-53\n")
        outside_text = skill.read_text(encoding="utf-8") + "[outside](../../../outside.md)\n"
        self.assertEqual(skill.write_text(outside_text, encoding="utf-8"), len(outside_text))
        self.assertEqual(self.run_process(command).returncode, 1)
        self.write("source/skills/example/references/source.md", "NIST SP 800-53\n")
        linked = skill.read_text(encoding="utf-8") + "[authority](references/source.md)\n"
        self.assertEqual(skill.write_text(linked, encoding="utf-8"), len(linked))
        named = agent.read_text(encoding="utf-8") + "PostgreSQL documentation\n"
        self.assertEqual(agent.write_text(named, encoding="utf-8"), len(named))
        healthy = self.run_process(command)
        self.assertEqual(healthy.returncode, 0, healthy.stdout + healthy.stderr)
        self.assertIn("does not validate", healthy.stdout)

    def native(
        self, payload: dict[str, object], path: str | None = None
    ) -> subprocess.CompletedProcess[str]:
        environment = os.environ.copy()
        if path is not None:
            environment["PATH"] = path
        result = self.run_process(
            [
                sys.executable,
                str(ROOT / "codex/hooks.py"),
                "--home",
                str(self.directory / "home"),
            ],
            payload=payload,
            environment=environment,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertLessEqual(len(result.stdout.encode()), 2048)
        return result

    def event(self) -> dict[str, object]:
        return {
            "hook_event_name": "PostToolUse",
            "session_id": "boundary",
            "tool_use_id": "check",
            "cwd": str(self.directory),
            "tool_name": "Bash",
            "tool_input": {"command": "go test ./..."},
            "tool_response": {"exit_code": 1},
        }

    def test_native_failure_feedback_survives_missing_ids_and_node(self) -> None:
        payload = self.event()
        payload.pop("tool_use_id")
        missing_ids = self.native(payload)
        self.assertIn("lacks paired", missing_ids.stdout)
        self.assertIn("exited with code 1", missing_ids.stdout)
        payload["tool_use_id"] = "check"
        missing_node = self.native(payload, str(self.directory / "empty-path"))
        self.assertIn("No check is claimed", missing_node.stdout)
        self.assertIn("exited with code 1", missing_node.stdout)

    @unittest.skipIf(os.name == "nt", "POSIX shebang fixture (fake bin/node sh script)")
    def test_native_whitelist_preserves_block_and_bounds_escaped_output(self) -> None:
        assert NODE is not None
        fake = self.write(
            "bin/node",
            "#!/bin/sh\nprintf '%s' '"
            + json.dumps(
                {
                    "decision": "block",
                    "reason": "🔒" * 5000,
                    "tool_output": "fake-secret-outside-whitelist",
                    "arbitrary": {"secret": "fake-secret"},
                    "hookSpecificOutput": {
                        "permissionDecision": "deny",
                        "additionalContext": "bounded",
                    },
                }
            )
            + "'\n",
        )
        fake.chmod(0o700)
        result = self.native(self.event(), str(fake.parent))
        response = json.loads(result.stdout)
        self.assertEqual(response["decision"], "block")
        self.assertEqual(response["hookSpecificOutput"]["permissionDecision"], "deny")
        self.assertIn("exited with code 1", result.stdout)
        self.assertNotIn("fake-secret", result.stdout)
        self.assertNotIn("arbitrary", response)

    @unittest.skipIf(os.name == "nt", "POSIX shebang fixture (fake bin/node sh script)")
    def test_native_actual_timeout_preserves_failed_command_feedback(self) -> None:
        fake = self.write("bin/node", "#!/bin/sh\nexec /bin/sleep 30\n")
        fake.chmod(0o700)
        started = time.monotonic()
        result = self.native(self.event(), str(fake.parent))
        elapsed = time.monotonic() - started
        self.assertGreaterEqual(elapsed, 14)
        self.assertLess(elapsed, 23)
        self.assertIn("TimeoutExpired", result.stdout)
        self.assertIn("exited with code 1", result.stdout)

    def test_model_switch_uses_task_and_not_directory_name(self) -> None:
        assert NODE is not None
        environment = {
            **os.environ,
            "HOME": str(self.directory / "home"),
            "CLAUDE_MODEL_LADDER": "strict",
        }
        payload: dict[str, object] = {
            "tool_name": "PreModelSwitch",
            "to_model": "fable",
            "cwd": str(self.directory / "security-credentials"),
            "prompt": "Summarize recipe notes",
        }
        command = [NODE, str(ROOT / "scripts/hooks/model-ladder-gate.js")]
        benign = self.run_process(command, payload=payload, environment=environment)
        self.assertEqual(benign.returncode, 0, benign.stderr)
        payload["prompt"] = "Review authentication security"
        sensitive = self.run_process(command, payload=payload, environment=environment)
        self.assertEqual(sensitive.returncode, 2, sensitive.stdout + sensitive.stderr)

    def test_empty_home_installs_full_resources_and_restore_preserves_originals(
        self,
    ) -> None:
        source = subprocess.run(
            [
                str(GIT),
                "ls-files",
                "-z",
                "--cached",
                "--others",
                "--exclude-standard",
                "--",
                "skills",
                "agents",
                "commands",
                "rules-library",
            ],
            cwd=ROOT,
            capture_output=True,
            check=True,
        )
        names = [
            name
            for name in source.stdout.decode().split("\0")
            if name
            and not any(
                part.startswith(".") or part in {"node_modules", "__pycache__"}
                for part in Path(name).parts
            )
        ]
        for kind in ("claude", "codex"):
            with self.subTest(kind=kind):
                home = self.directory / kind
                home.mkdir()
                command = self.install_command(kind, home)
                installed = self.run_process(command)
                self.assertEqual(
                    installed.returncode, 0, installed.stdout + installed.stderr
                )
                resource_root = home if kind == "claude" else home / "council/resources"
                for name in names:
                    self.assertTrue((resource_root / name).is_file(), name)
                self.assertTrue(
                    (
                        resource_root
                        / "skills/verification-loop/references/run-check.sh"
                    ).is_file()
                )
                restored = self.run_process(
                    self.install_command(kind, home, restore=True)
                )
                self.assertEqual(
                    restored.returncode, 0, restored.stdout + restored.stderr
                )
                self.assertEqual([p for p in home.rglob("*") if p.is_file()], [])

    def test_nested_resource_collision_dry_run_and_apply_preserve_files(self) -> None:
        for kind in ("claude", "codex"):
            with self.subTest(kind=kind):
                prefix = kind if kind == "claude" else f"{kind}/council/resources"
                owned = self.write(
                    prefix + "/skills/verification-loop/references/run-check.sh",
                    "Personal procedure\n",
                )
                home = self.directory / kind
                before = {
                    p.relative_to(home): p.read_bytes()
                    for p in home.rglob("*")
                    if p.is_file()
                }
                for extra in (["--dry-run"], []):
                    result = self.run_process(
                        [*self.install_command(kind, home), *extra]
                    )
                    self.assertEqual(
                        result.returncode, 1, result.stdout + result.stderr
                    )
                    self.assertIn("collision", result.stderr)
                    self.assertEqual(owned.read_text(encoding="utf-8"), "Personal procedure\n")
                    self.assertEqual(
                        {
                            p.relative_to(home): p.read_bytes()
                            for p in home.rglob("*")
                            if p.is_file()
                        },
                        before,
                    )

    def install_command(
        self, kind: str, home: Path, *, restore: bool = False
    ) -> list[str]:
        if kind == "codex":
            return [
                sys.executable,
                str(ROOT / "bootstrap/codex.py"),
                "uninstall" if restore else "install",
                "--home",
                str(home),
            ]
        return [
            sys.executable,
            str(ROOT / "bootstrap/context.py"),
            "restore" if restore else "apply",
            "--claude-home",
            str(home),
        ]
