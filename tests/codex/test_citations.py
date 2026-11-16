"""Named provenance must resolve to a recognized source, not merely a heading."""

import contextlib
import io
import runpy
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VERIFIER = runpy.run_path(str(ROOT / "scripts/verify-citations.py"))


class CitationTests(unittest.TestCase):
    def check_fixture(self, text: str, *, skill: str | None = None) -> int:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            target = root / (f"skills/{skill}/SKILL.md" if skill else "agents/seat.md")
            target.parent.mkdir(parents=True)
            target.write_text(
                text + "\nLocal decision guidance.\n" * 12, encoding="utf-8"
            )
            with (
                contextlib.redirect_stdout(io.StringIO()),
                contextlib.redirect_stderr(io.StringIO()),
            ):
                return VERIFIER["check"](root)

    def test_recognized_firsthand_name_and_url(self) -> None:
        self.assertEqual(
            self.check_fixture(
                "[Default Alive or Default Dead?](https://paulgraham.com/aord.html)"
            ),
            0,
        )

    def test_known_title_at_an_unrecognized_host_is_refused(self) -> None:
        self.assertEqual(
            self.check_fixture(
                "[Default Alive or Default Dead?](https://example.com/aord.html)"
            ),
            1,
        )

    def test_name_alone_and_arbitrary_sources_are_refused(self) -> None:
        for text in (
            "## Sources\nDefault Alive or Default Dead?",
            "[Some interview](https://example.com/source)",
        ):
            with self.subTest(text=text):
                self.assertEqual(self.check_fixture(text), 1)

    def test_internal_debate_utility_has_explicit_scope_exemption(self) -> None:
        self.assertEqual(
            self.check_fixture("Internal orchestration", skill="council-debate"), 0
        )
        self.assertEqual(
            self.check_fixture("Internal orchestration", skill="new-utility"), 1
        )

    def test_linked_local_provenance_is_checked(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            skill = root / "skills/example"
            skill.mkdir(parents=True)
            entry = skill / "SKILL.md"
            entry.write_text("[Provenance](source.md)", encoding="utf-8")
            source = skill / "source.md"
            source.write_text(
                "[Wikipedia:Signs of AI writing]"
                "(https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)",
                encoding="utf-8",
            )
            self.assertTrue(
                VERIFIER["has_named_source"](VERIFIER["citation_text"](entry, root))
            )
            source.unlink()
            self.assertFalse(
                VERIFIER["has_named_source"](VERIFIER["citation_text"](entry, root))
            )


if __name__ == "__main__":
    unittest.main()
