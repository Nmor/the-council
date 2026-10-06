#!/usr/bin/env python3
"""Check named citation presence, not source correctness or legal compliance."""

# Size budget: 8 KB.
import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUTHORITY = re.compile(
    "|".join(
        (
            "RFC [0-9]+",
            "ISO/?IEC [0-9]+",
            "ISO [0-9]+",
            "NIST (SP",
            "AI RMF",
            "CSF",
            "Privacy)",
            "OWASP (ASVS",
            "Top 10",
            "A0[1-9]",
            "A10)",
            "WCAG [0-9]\\.[0-9]",
            "W3C (HTML",
            "CSS",
            "Web",
            "DOM",
            "WAI)",
            "ARIA [0-9]",
            "PEP [0-9]+",
            "IFRS [0-9]+",
            "ASC [0-9]+",
            "IAS [0-9]+",
            "ITIL [0-9]",
            "Semantic Versioning [0-9]+\\.[0-9]+",
            "Conventional Commits [0-9]+\\.[0-9]+",
            "Keep a Changelog [0-9]+\\.[0-9]+",
            "CommonMark",
            "Di[áa]taxis",
            "arc42",
            "C4 Model",
            "OpenAPI [0-9]+\\.[0-9]+",
            "GraphQL Spec",
            "AsyncAPI [0-9]+\\.[0-9]+",
            "Protocol Buffers",
            "GDPR (Article",
            "Art\\.?) [0-9]+",
            "GDPR Regulation",
            "CCPA",
            "CPRA",
            "HIPAA",
            "PCI-?DSS",
            "SOC ?2",
            "LGPD",
            "POPIA",
            "PIPEDA",
            "APPI",
            "PDPA",
            "HITECH",
            "SOX",
            "FERPA",
            "COPPA",
            "MiFID",
            "GLBA",
            "Regulation \\(EU\\) [0-9]+",
            "Regulation 20[0-9]{2}/[0-9]+",
            "Cal\\.? ?Civ\\.? ?Code",
            "IEEE [0-9]+",
            "ECMA-?[0-9]+",
            "ECMAScript [0-9]+",
            "ECMAScript Internationalization",
            "ADA Title",
            "Section 508",
            "EAA",
            "EN 301 ?549",
            "FedRAMP",
            "FIPS [0-9]+",
            "SLSA",
            "CIS Controls",
            "CWE-[0-9]+",
            "CWE Top 25",
            "FAPI [0-9]",
            "OAuth ?2",
            "OpenID Connect",
            "CC BY",
            "MIT License",
            "Apache-?2",
            "BSD-?[0-9]",
            "SPDX",
        )
    ),
    re.IGNORECASE,
)
DOCUMENTATION = re.compile(
    "|".join(
        (
            "PostgreSQL documentation",
            "Playwright documentation",
            "TypeScript documentation",
            "Microsoft \\.NET documentation",
            "Java compiler documentation",
            "Go diagnostics documentation",
            "Ruby documentation",
            "Rust documentation",
            "Swift documentation",
            "Google SRE",
            "Google Search Central",
        )
    ),
    re.IGNORECASE,
)
LINK = re.compile(r"\[[^\]]+\]\((?:<([^>]+)>|([^ )]+))\)")
UTILITIES = {
    "configure-ecc",
    "project-guidelines-example",
    "iterative-retrieval",
    "eval-harness",
    "learned",
    "search-first",
    "security-scan",
    "nutrient-document-processing",
    "council",
    "council-workflow",
}


def citation_text(path: Path, root: Path) -> str:
    """Inspect explicitly linked local Markdown resources, without accepting bare sections."""
    text = path.read_text(encoding="utf-8")
    pieces = [text]
    for match in LINK.finditer(text):
        link = (match.group(1) or match.group(2)).split("#", 1)[0]
        if not link or ":" in link:
            continue
        reference = (path.parent / link).resolve()
        if (
            root.resolve() in reference.parents
            and reference.suffix == ".md"
            and reference.is_file()
        ):
            pieces.append(reference.read_text(encoding="utf-8"))
    return "\n".join(pieces)


def check(root: Path) -> int:
    targets = sorted([*root.glob("skills/*/SKILL.md"), *root.glob("agents/*.md")])
    flagged: list[str] = []
    skipped = 0
    for path in targets:
        if path.stat().st_size < 200 or (
            path.parent.parent.name == "skills" and path.parent.name in UTILITIES
        ):
            skipped += 1
            continue
        text = citation_text(path, root)
        if not AUTHORITY.search(text) and not DOCUMENTATION.search(text):
            flagged.append(path.relative_to(root).as_posix())
    print(
        f"Named citation presence: {len(targets) - skipped - len(flagged)} passed; "
        f"{skipped} utility/redirect exemptions; {len(flagged)} failed."
    )
    for name in flagged:
        print(f"  MISSING named authority: {name}", file=sys.stderr)
    print(
        "Scope: skill entrypoints, their explicitly linked local references, and agents. "
        "Rules are not certified by this gate."
    )
    print(
        "This does not validate a citation's existence, version, interpretation, "
        "applicability or compliance; review primary sources separately."
    )
    return 1 if flagged else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    if not args.root.is_dir():
        parser.error("--root must be an existing directory")
    return check(args.root)


if __name__ == "__main__":
    sys.exit(main())
