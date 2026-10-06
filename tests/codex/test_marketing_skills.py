"""Marketing procedures retain their content in both runtime payloads."""

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from test_sdlc_skills import ROOT, context, installer

SKILLS = (
    "marketing-strategy",
    "seo",
    "content-campaigns",
    "brand-creative-direction",
)


class MarketingInstallTests(unittest.TestCase):
    """Build isolated candidate payloads without touching the real Git index."""

    def test_both_profiles_include_candidate_skills(self) -> None:
        """Both payload profiles preserve the four candidate procedures."""
        with tempfile.TemporaryDirectory() as directory:
            git = shutil.which("git")
            if git is None:
                self.fail("Git is required for candidate payload fixtures")
            home = Path(directory) / "codex"
            index = Path(directory) / "candidate-index"
            with patch.dict(os.environ, {"GIT_INDEX_FILE": str(index)}):
                for arguments in (
                    ["read-tree", "HEAD"],
                    ["add", "--", *(f"skills/{skill}" for skill in SKILLS)],
                ):
                    result = subprocess.run(
                        [str(git), "-C", str(ROOT), *arguments],
                        check=True,
                        capture_output=True,
                        text=True,
                        timeout=10,
                    )
                    self.assertEqual(result.returncode, 0)
                for profile in ("compact", "full"):
                    with self.subTest(profile=profile):
                        payload = installer.build_payload(
                            ROOT, home, {"files": {}}, [], None, profile
                        )
                        catalog = payload["council/catalog.md"].decode("utf-8")
                        for skill in SKILLS:
                            source = ROOT / "skills" / skill / "SKILL.md"
                            resource = f"council/resources/skills/{skill}/SKILL.md"
                            expected = installer.adapt_reference(
                                source.read_text(encoding="utf-8"), home
                            ).encode("utf-8")
                            self.assertEqual(payload[resource], expected)
                            self.assertIn(f"resources/skills/{skill}/SKILL.md", catalog)
                            wrapper = f"skills/council-{skill}/SKILL.md"
                            self.assertEqual(wrapper in payload, profile == "full")
                        if profile == "compact":
                            discovery = [
                                name for name in payload if name.startswith("skills/")
                            ]
                            self.assertEqual(discovery, ["skills/council/SKILL.md"])

    def test_claude_transform_preserves_procedures(self) -> None:
        """Compact Claude discovery preserves procedure text and metadata."""
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

    def test_scenarios_cover_every_new_procedure(self) -> None:
        """Each new procedure has a distinct bounded scenario."""
        source = ROOT / "tests/skills/marketing-scenarios.json"
        scenarios = json.loads(source.read_text(encoding="utf-8"))
        cases = scenarios["cases"]
        self.assertEqual({case["skill"] for case in cases}, set(SKILLS))
        self.assertEqual(len({case["id"] for case in cases}), len(SKILLS))
        for case in cases:
            self.assertTrue(case["request"].strip())
            self.assertTrue(case["artifacts"])
            self.assertNotIn("expected_answer", case)


if __name__ == "__main__":
    unittest.main()
