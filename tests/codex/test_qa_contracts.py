"""Instruction mutations and isolated process checks for QA guidance contracts."""

import json
import os
import re
import shutil
import subprocess
import tempfile
import unittest
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
WRAPPER = ROOT / "skills/verification-loop/references/run-check.sh"
ARTIFACT = "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a"
NODE = shutil.which("node") or ""
BASH = shutil.which("bash") or ""


@dataclass(frozen=True, slots=True)
class InstructionContract:
    """Decision clauses and unsafe regressions for one source surface."""

    path: str
    required: tuple[str, ...]
    forbidden: tuple[str, ...] = ()


CONTRACTS = (
    InstructionContract(
        "skills/verification-loop/SKILL.md",
        (
            "run-check.sh",
            "returns the producer status",
            "SKIPPED is not PASS",
            "RUNNING has no completed exit status",
            "A text search for keys is not a secret-scan PASS",
            "command, revision",
            "acceptance boundary",
        ),
        (r"2>&1\s*\|\s*(?:head|tail)", r"Target: 70% minimum"),
    ),
    InstructionContract(
        "skills/eval-harness/SKILL.md",
        (
            'bash "$check"',
            "producer's nonzero exit on failure",
            "completed exit status and acceptance boundary",
            "suppress an error or lose a write",
        ),
        (r'&& echo "PASS" \|\| echo "FAIL"',),
    ),
    InstructionContract(
        "commands/verify.md",
        (
            "run-check.sh",
            "never print Secrets OK without a completed scan",
            "a quick-mode pass covers build/types only",
            "Unsupported coverage metrics are UNAVAILABLE",
            "Required failed, unavailable, interrupted, running or skipped checks",
        ),
        (r"Secrets:\s*\[OK",),
    ),
    InstructionContract(
        "rules-library/common/testing.md",
        (
            "Repository and explicit user requirements take precedence",
            "Touched-file, project and critical-path denominators are separate gates",
            "UNAVAILABLE, not inferred from statement coverage",
            "does not measure branch coverage or short-circuit `&&`/`||` outcomes",
            "choose by changed risk and failure boundary",
            "independently read committed state",
            "an error is suppressed or a write is lost",
            "Follow explicit user and repository requirements",
            "prose, configuration and reversible low-impact edits "
            "need proportionate checks",
        ),
        (
            r"Test types \(ALL required",
            r"overrides may not relax",
            r"Auto-fires on every file",
            r"Test-Driven Development \(mandatory workflow\)",
        ),
    ),
    InstructionContract(
        "skills/e2e-testing/references/procedure.md",
        (
            "locator actions and web-first assertions",
            "background polling",
            "delayed hydration",
            "register a specific response wait before the triggering action",
            "even for pages without JavaScript",
            ARTIFACT,
            "retention-days: 30",
            "if-no-files-found: error",
            "v4+ is unsupported on GHES",
        ),
        (
            r"waitForLoadState\(['\"]networkidle['\"]\)",
            r"networkidle.{0,10}is a hard requirement",
            r"5-15%",
            r"actions/upload-artifact@v[34]\b",
        ),
    ),
    InstructionContract(
        "commands/e2e.md",
        (
            "background polling and delayed hydration",
            "static HTML still needs browser tests",
            ARTIFACT,
            "retention-days: 30",
            "if-no-files-found: error",
            "v4+ is unsupported on GHES",
        ),
        (r"waitForLoadState\(['\"]networkidle['\"]\)",),
    ),
    InstructionContract(
        "skills/tdd-workflow/references/procedure.md",
        (
            "listMarkets.mockRejectedValueOnce",
            "const response = await GET(request)",
            "expect(response.status).toBe(503)",
            "expect(data.error_code).toBe('MARKETS_UNAVAILABLE')",
            "independently read committed state",
            "suppressing the error or losing the write makes the tests fail",
            "below-threshold fixture fails",
            "Unsupported metrics remain UNAVAILABLE",
            "coverageThreshold",
        ),
        (r"Minimum 70% coverage", r'"coverageThresholds"'),
    ),
    InstructionContract(
        ".github/workflows/ci.yml",
        (
            "working-directory: tests/test-tools",
            "npm ci --ignore-scripts --no-audit --no-fund",
            'COUNCIL_REQUIRE_EDIT_TOOLS: "1"',
            "COUNCIL_TEST_NODE_MODULES: ${{ github.workspace }}"
            "/tests/test-tools/node_modules",
            "actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f",
        ),
    ),
)


def validate_contract(contract: InstructionContract, source: str) -> None:
    """Reject removed decision guards and reintroduced unsafe execution examples."""
    normalized = " ".join(source.split())
    for clause in contract.required:
        if " ".join(clause.split()) not in normalized:
            message = f"{contract.path}: missing {clause}"
            raise ValueError(message)
    for pattern in contract.forbidden:
        if re.search(pattern, normalized):
            message = f"{contract.path}: unsafe {pattern}"
            raise ValueError(message)


class QaInstructionTests(unittest.TestCase):
    """Test source decisions with positive and removed-guard negative controls."""

    def test_contracts_and_removed_guard_mutations(self) -> None:
        """All decisions survive wrapping, while deleting a guard invalidates them."""
        for contract in CONTRACTS:
            source = (ROOT / contract.path).read_text()
            normalized = " ".join(source.split())
            with self.subTest(path=contract.path, mutation="none"):
                validate_contract(contract, source)
                validate_contract(contract, normalized)
            for clause in contract.required:
                with self.subTest(path=contract.path, mutation=clause):
                    mutated = normalized.replace(" ".join(clause.split()), "REMOVED")
                    with self.assertRaises(ValueError):
                        validate_contract(contract, mutated)

    def test_unsafe_directive_mutations_are_rejected(self) -> None:
        """Negative controls reintroduce former exit, browser and report defects."""
        mutations = {
            "skills/verification-loop/SKILL.md": "npm test 2>&1 | tail -20",
            "skills/eval-harness/SKILL.md": 'npm test && echo "PASS" || echo "FAIL"',
            "commands/verify.md": "Secrets: [OK]",
            "rules-library/common/testing.md": "Test types (ALL required",
            "skills/e2e-testing/references/procedure.md": (
                "await page.waitForLoadState('networkidle')"
            ),
            "commands/e2e.md": "await page.waitForLoadState('networkidle')",
            "skills/tdd-workflow/references/procedure.md": '"coverageThresholds"',
        }
        for contract in CONTRACTS:
            if contract.path in mutations:
                with self.subTest(path=contract.path):
                    source = (ROOT / contract.path).read_text()
                    with self.assertRaises(ValueError):
                        validate_contract(
                            contract,
                            source + "\n" + mutations[contract.path],
                        )

    def test_coverage_scopes_do_not_substitute_for_each_other(self) -> None:
        """Reject below-floor and unavailable metrics despite passing aggregate."""
        source = (ROOT / "rules-library/common/testing.md").read_text()
        expected = {"Touched files": 90, "Project total": 80, "Critical paths": 95}
        for scope, floor in expected.items():
            match = re.search(rf"\*\*{scope}\*\*.*?≥ \*\*(\d+)%\*\*", source, re.DOTALL)
            self.assertIsNotNone(match)
            if match is None:
                message = f"coverage scope missing: {scope}"
                raise ValueError(message)
            self.assertEqual(int(match.group(1)), floor)
        # Instruction-model fixtures: no tool-generated coverage is claimed here.
        measured = {"Touched files": 89, "Project total": 99, "Critical paths": None}
        outcomes = {
            scope: "UNAVAILABLE"
            if measured[scope] is None
            else "PASS"
            if int(measured[scope] or 0) >= floor
            else "FAIL"
            for scope, floor in expected.items()
        }
        self.assertEqual(
            outcomes,
            {
                "Touched files": "FAIL",
                "Project total": "PASS",
                "Critical paths": "UNAVAILABLE",
            },
        )
        migrated = (
            ROOT / "skills/coding-quality-rules/references/testing-requirements.md"
        )
        self.assertEqual(migrated.read_text(), source)

    def test_fixture_lock_has_exact_versions_and_integrity(self) -> None:
        """Require exact formatter/compiler versions and their lock entries."""
        directory = ROOT / "tests/test-tools"
        package = json.loads((directory / "package.json").read_text())
        lock = json.loads((directory / "package-lock.json").read_text())
        self.assertTrue(package["private"])
        self.assertEqual(
            package["devDependencies"],
            {"prettier": "3.6.2", "typescript": "5.9.3"},
        )
        self.assertEqual(
            lock["packages"][""]["devDependencies"],
            package["devDependencies"],
        )
        for name, version in package["devDependencies"].items():
            entry = lock["packages"][f"node_modules/{name}"]
            self.assertEqual(entry["version"], version)
            self.assertTrue(entry["integrity"].startswith("sha512-"))

    @unittest.skipUnless(
        NODE,
        "Node is required for fixture-guard probe",
    )
    def test_required_fixture_guard_rejects_absence(self) -> None:
        """Mandatory CI fixtures cannot degrade to a successful skipped-tool run."""
        with tempfile.TemporaryDirectory() as directory:
            environment = {
                **os.environ,
                "COUNCIL_REQUIRE_EDIT_TOOLS": "1",
                "COUNCIL_TEST_NODE_MODULES": str(Path(directory) / "missing"),
                "TMPDIR": directory,
                "TMP": directory,
                "TEMP": directory,
            }
            result = subprocess.run(
                [
                    NODE,
                    "--input-type=module",
                    "-e",
                    "await import('./scripts/hooks/__tests__/post-edit-tools.mjs')",
                ],
                cwd=ROOT,
                env=environment,
                capture_output=True,
                text=True,
                check=False,
                timeout=15,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(
                "Required formatter/compiler fixtures unavailable",
                result.stderr,
            )


@unittest.skipUnless(
    os.name != "nt" and BASH,
    "POSIX Bash process contract",
)
class VerificationWrapperTests(unittest.TestCase):
    """Exercise completion and cancellation against isolated local processes."""

    def run_wrapper(
        self,
        directory: str,
        *command: str,
        wrapper: Path = WRAPPER,
    ) -> subprocess.CompletedProcess[str]:
        """Run the public CLI against a private evidence log."""
        return subprocess.run(
            [
                BASH,
                str(wrapper),
                "-l",
                str(Path(directory) / "check.log"),
                "-n",
                "3",
                "--",
                *command,
            ],
            cwd=directory,
            capture_output=True,
            text=True,
            check=False,
            timeout=15,
        )

    def test_complete_logs_and_producer_status(self) -> None:
        """Preserve failure and stderr evidence while bounding log presentation."""
        for exit_code, status in (
            (0, "PASS"),
            (7, "FAIL"),
            (130, "INTERRUPTED"),
            (143, "INTERRUPTED"),
        ):
            with (
                self.subTest(exit_code=exit_code),
                tempfile.TemporaryDirectory() as directory,
            ):
                result = self.run_wrapper(
                    directory,
                    "bash",
                    "-c",
                    "printf '%s\\n' {1..200}; printf 'stderr evidence\\n' >&2; "
                    f"exit {exit_code}",
                )
                self.assertEqual(result.returncode, exit_code)
                self.assertIn(f"{status} exit={exit_code}", result.stdout)
                self.assertIn("RUNNING exit=unknown", result.stdout)
                self.assertLessEqual(len(result.stdout.splitlines()), 5)
                lines = (Path(directory) / "check.log").read_text().splitlines()
                self.assertEqual(len(lines), 201)
                self.assertEqual(lines[0], "1")
                self.assertEqual(lines[-1], "stderr evidence")

    def test_absent_command_and_invalid_arguments(self) -> None:
        """Unavailable execution and malformed invocation cannot PASS."""
        with tempfile.TemporaryDirectory() as directory:
            result = self.run_wrapper(directory, "/council-no-such-check-tool")
            self.assertEqual(result.returncode, 127)
            self.assertIn("UNAVAILABLE exit=127", result.stdout)
            invalid = subprocess.run(
                [BASH, str(WRAPPER), "-n", "0"],
                capture_output=True,
                text=True,
                check=False,
                timeout=15,
            )
            self.assertEqual(invalid.returncode, 64)
            self.assertIn("UNAVAILABLE", invalid.stderr)

    def test_running_is_not_pass_and_term_is_interrupted(self) -> None:
        """An actual running producer has no completed exit; cancellation is nonzero."""
        with (
            tempfile.TemporaryDirectory() as directory,
            subprocess.Popen(
                [
                    BASH,
                    str(WRAPPER),
                    "-l",
                    str(Path(directory) / "check.log"),
                    "--",
                    "bash",
                    "-c",
                    "exec sleep 30",
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            ) as process,
        ):
            if process.stdout is None:
                message = "running check stdout pipe unavailable"
                raise ValueError(message)
            initial = process.stdout.readline()
            self.assertIn("RUNNING exit=unknown", initial)
            self.assertIsNone(process.poll())
            process.terminate()
            output, errors = process.communicate(timeout=15)
            self.assertEqual(process.returncode, 143, errors)
            self.assertIn("INTERRUPTED exit=143", output)
            self.assertNotIn("PASS exit=0", output)

    def test_masked_exit_mutation_is_detected(self) -> None:
        """Reject a wrapper mutated to return successful display status."""
        with tempfile.TemporaryDirectory() as directory:
            mutated = Path(directory) / "masked.sh"
            source = WRAPPER.read_text()
            self.assertIn('exit "${producer_exit}"', source)
            written = mutated.write_text(
                source.replace('exit "${producer_exit}"', "exit 0"),
            )
            self.assertGreater(written, 0)
            result = self.run_wrapper(
                directory,
                "bash",
                "-c",
                "exit 7",
                wrapper=mutated,
            )
            with self.assertRaises(AssertionError):
                self.assertEqual(result.returncode, 7)


if __name__ == "__main__":
    unittest.main()
