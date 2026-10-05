"""New procedures survive both install profiles without expanding eager discovery."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from types import ModuleType

ROOT = Path(__file__).resolve().parents[2]
SKILLS = (
    "requirements-acceptance",
    "incident-investigation",
    "release-integration",
    "test-strategy",
    "council-workflow",
    "data-reconciliation",
    "resilience-drills",
    "entrepreneur",
    "pentester",
    "cisa-audit",
)


def load_module(name: str, path: Path) -> ModuleType:
    """Load a source installer without executing its CLI entrypoint."""
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        message = f"Unable to load {path}"
        raise ImportError(message)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


installer = load_module("sdlc_installer", ROOT / "bootstrap/codex.py")
context = load_module("sdlc_context", ROOT / "bootstrap/context.py")


class SdlcInstallTests(unittest.TestCase):
    """Exercise actual installer payloads and compact-discovery preservation."""

    def test_both_profiles_retain_procedures_and_conditional_references(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory) / "codex"
            for profile in ("compact", "full"):
                with self.subTest(profile=profile):
                    payload = installer.build_payload(
                        ROOT, home, {"files": {}}, [], None, profile
                    )
                    catalog = payload["council/catalog.md"].decode("utf-8")
                    for skill in SKILLS:
                        for source in (ROOT / "skills" / skill).rglob("*"):
                            if source.is_file():
                                relative = source.relative_to(ROOT).as_posix()
                                actual = payload[f"council/resources/{relative}"]
                                expected = installer.adapt_reference(
                                    source.read_text(encoding="utf-8"), home
                                ).encode("utf-8")
                                self.assertEqual(actual, expected, relative)
                        self.assertIn(f"resources/skills/{skill}/SKILL.md", catalog)
                        entrypoint = f"skills/council-{skill}/SKILL.md"
                        self.assertEqual(entrypoint in payload, profile == "full")
                    if profile == "compact":
                        discovered = [
                            name for name in payload if name.startswith("skills/")
                        ]
                        self.assertEqual(discovered, ["skills/council/SKILL.md"])
                    agents = [name for name in payload if name.startswith("agents/")]
                    self.assertFalse(
                        any(
                            f"agents/council-{skill}.toml" in agents for skill in SKILLS
                        )
                    )

    def test_full_entrypoints_route_to_the_correct_installed_procedure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory) / "codex"
            payload = installer.build_payload(
                ROOT, home, {"files": {}}, [], None, "full"
            )
            for skill in SKILLS:
                with self.subTest(skill=skill):
                    wrapper = payload[f"skills/council-{skill}/SKILL.md"].decode(
                        "utf-8"
                    )
                    self.assertIn(
                        str(home / "council/resources/skills" / skill / "SKILL.md"),
                        wrapper,
                    )
                    source_name, description, body = installer.metadata(
                        (ROOT / "skills" / skill / "SKILL.md").read_text(
                            encoding="utf-8"
                        )
                    )
                    self.assertEqual(source_name, skill)
                    self.assertIn(description, wrapper)
                    self.assertTrue(body.strip())

    def test_claude_compact_transform_preserves_procedure_and_metadata(self) -> None:
        for skill in SKILLS:
            with self.subTest(skill=skill):
                source = (ROOT / "skills" / skill / "SKILL.md").read_text(
                    encoding="utf-8"
                )
                compact = context.compact_entrypoint(source)
                self.assertEqual(
                    installer.metadata(compact), installer.metadata(source)
                )
                self.assertEqual(compact.count("disable-model-invocation: true"), 1)
                self.assertEqual(context.compact_entrypoint(compact), compact)

    def test_scenarios_cover_installed_skills_and_are_bounded(self) -> None:
        scenario_path = ROOT / "tests/skills/sdlc-scenarios.json"
        scenarios = json.loads(scenario_path.read_text(encoding="utf-8"))
        self.assertEqual({case["skill"] for case in scenarios["cases"]}, set(SKILLS))
        self.assertEqual(len({case["id"] for case in scenarios["cases"]}), len(SKILLS))
        for case in scenarios["cases"]:
            with self.subTest(case=case["id"]):
                self.assertTrue(case["request"].strip())
                self.assertTrue(case["artifacts"])
                self.assertNotIn("expected_answer", case)
        self.assertTrue(scenarios["execution"].strip())
        self.assertEqual(len(scenarios["routing_controls"]), 3)


if __name__ == "__main__":
    unittest.main()
