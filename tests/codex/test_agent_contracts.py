"""Regression and mutation checks for reviewer instructions, without live services."""

import re
import unittest
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
SEVERITY_LINK = "code-reviewer.md#severity-and-merge-contract"


@dataclass(frozen=True, slots=True)
class Contract:
    """Required decisions and legacy unsafe directives for one instruction contract."""

    agent: str
    required: tuple[str, ...]
    unsafe: tuple[str, ...]


CONTRACTS = (
    Contract(
        "database-reviewer",
        (
            "Default to plain `EXPLAIN`",
            "authorized isolated target after explicit side-effect analysis",
            "never execute a write-query review against production data",
            "Even a SELECT can call side-effecting functions",
            "Rollback is not a safety guarantee",
            "sequence changes and external effects may survive ROLLBACK",
            "retain plain EXPLAIN and report execution profiling as unavailable",
        ),
        ("Run `EXPLAIN ANALYZE` on complex queries",),
    ),
    Contract(
        "performance-reviewer",
        (
            "Default to plain `EXPLAIN`",
            "database-reviewer.md#execution-profiling-boundary",
            "authorized isolated target, explicit side-effect analysis",
            "Never execute a write-query review against production data",
            "report unavailable profiling when safe execution is outside scope",
        ),
        ("Query without `EXPLAIN ANALYZE` evidence",),
    ),
    Contract(
        "ai-ethics-reviewer",
        (
            "every finding has verified remediation with evaluation evidence",
            "specifically authorized and legally permitted residual-risk exception",
            "risk, accountable owner, mitigation, deadline, approving authority "
            "and legal basis",
            "Prohibited uses cannot be excepted",
            "does not independently clear a failed or inconclusive fairness evaluation",
            "Required transparency, human-review and evaluation obligations "
            "remain cumulative",
        ),
        ("Model card + datasheet are published, OR",),
    ),
    Contract(
        "payments-reviewer",
        (
            "Stripe: preserve raw bytes for `constructEvent`",
            "Adyen standard: bounded schema parsing",
            "`additionalData.hmacSignature`",
            "each item's selected signed fields",
            "`eventDate` is not signed and must not authorize a freshness gate",
            "Adyen header-signature variants: preserve raw body bytes",
            "Square: verify the notification URL plus raw body",
            "Bound body size, parsing depth and item count",
            "Signature verification precedes business actions "
            "and trusted event storage",
            "only against supported authenticated timestamps",
            "legitimate delayed retries for each supported variant",
            "jurisdiction, tax year, payment rail, reporting entity and exemptions",
            "over $20,000 AND more than 200 transactions",
            "payment-card reporting has no minimum amount or transaction count",
            "31 CFR §1010.380 exempts U.S.-created companies",
            "assess foreign-created entities registered "
            "in a U.S. state/Tribal jurisdiction",
            "final rule effective August 14, 2026",
            "§1010.230 is CDD, not BOI reporting",
        ),
        (
            "signature verified against PROVIDER signing key BEFORE deserialisation",
            "Webhook timestamp within ±5 minutes",
            "IRS 1099-K (≥$600 since 2024 ARP)",
            "31 CFR §1010.230 BOI Rule",
        ),
    ),
    Contract(
        "health-reviewer",
        (
            "HIPAA does not prescribe medical-record retention periods",
            "record category, jurisdiction, applicable state/federal program law",
            "contractual duties and legal holds",
            "documentation has a six-year rule under "
            "45 CFR §164.530(j) / §164.316(b)(2)(i)",
            "creation or last effective date, whichever is later",
            "not a universal patient-record or audit-log period",
            "45 CFR §170.315(b)(11) is a health IT certification criterion, "
            "not an FDA device rule",
            "AI use or ONC certification alone does not establish FDA device status",
        ),
        (
            "patient records 6 years minimum federal",
            "FDA CDS guidance + 21 CFR §170.315(b)(11)",
        ),
    ),
    Contract(
        "education-reviewer",
        (
            "Ordinary examination proctoring does not establish "
            "medical-device intended use",
            "Determine actual education, privacy, accessibility "
            "and discrimination applicability",
            "invoke FDA/SaMD authority or clinical sign-off only when "
            "a documented medical intended use",
            "publication April 22, 2025, effective June 23, 2025",
            "general compliance April 22, 2026",
            "exceptions for §§312.11(d)(1), (d)(4), (g)",
        ),
        (
            "FDA + state proctoring-bias BLOCKER",
            "(for AI / SaMD-equivalent decisions) clinical / educational-safety lead",
            "COPPA Final Rule (effective April 22, 2025)",
        ),
    ),
    Contract(
        "security-reviewer",
        (
            "npm audit --audit-level=moderate",
            "Moderate-only, high and critical reports block merge",
            "a clean completed audit passes this dependency gate",
            "Missing tool, missing lockfile, registry/network failure",
            "unparseable report means verification unavailable and blocks the gate",
            "Capture the terminal exit status and report",
            "VETO on unresolved CRITICAL or HIGH technical exploit findings",
        ),
        (
            "npm audit --audit-level=high",
            "VETO on unresolved BLOCKER-class technical exploit findings",
        ),
    ),
    Contract(
        "code-reviewer",
        (
            "Preserve the source label alongside normalized severity and action",
            "domain vetoes may add restrictions but must not weaken it",
            "the same unresolved exploit has the same action",
            "Unknown severity or unavailable required verification "
            "yields CHANGES_REQUIRED",
            "Only unresolved MEDIUM findings; required verification passed",
            "Any unresolved CRITICAL/HIGH finding",
        ),
        (
            "HIGH issues only (can merge with caution)",
            "MAJOR should fix before merge",
        ),
    ),
)

SEVERITY_ROWS = (
    ("BLOCKER", "CRITICAL", "BLOCK"),
    ("CRITICAL", "CRITICAL", "BLOCK"),
    ("HIGH", "HIGH", "BLOCK"),
    ("MAJOR", "HIGH", "BLOCK"),
    ("MEDIUM", "MEDIUM", "WARN"),
    ("MINOR", "MEDIUM", "WARN"),
    ("LOW", "LOW", "NOTE"),
    ("SUGGESTION", "LOW", "NOTE"),
)
LANGUAGE_REVIEWERS = (
    "java-reviewer",
    "mobile-reviewer",
    "go-reviewer",
    "python-reviewer",
)
LANGUAGE_CONTRACTS = tuple(
    Contract(
        agent,
        (
            SEVERITY_LINK,
            "preserve source severity and report normalized severity plus action",
            "unresolved CRITICAL/HIGH",
            "unavailable required verification",
        ),
        ("HIGH issues only (can merge with caution)",),
    )
    for agent in LANGUAGE_REVIEWERS
)


def normalized(text: str) -> str:
    """Ignore layout and case without ignoring decision-bearing words."""
    return " ".join(text.split()).casefold()


def read_agent(name: str) -> str:
    """Read the source contract rather than an expected-answer fixture."""
    return (ROOT / "agents" / f"{name}.md").read_text(encoding="utf-8")


def failures(contract: Contract, text: str) -> tuple[str, ...]:
    """Find removed safeguards and restored unsafe release/execution directives."""
    document = normalized(text)
    missing = tuple(
        f"missing: {clause}"
        for clause in contract.required
        if normalized(clause) not in document
    )
    unsafe = tuple(
        f"unsafe: {clause}"
        for clause in contract.unsafe
        if normalized(clause) in document
    )
    return missing + unsafe


def severity_rows(text: str) -> tuple[tuple[str, str, str], ...]:
    """Parse the authoritative table, retaining both source and normalized labels."""
    pattern = r"^\| (\w+) \| (\w+) \| (BLOCK|WARN|NOTE) \|$"
    return tuple(
        (match.group(1), match.group(2), match.group(3))
        for match in re.finditer(pattern, text, re.MULTILINE)
    )


class AgentContractTests(unittest.TestCase):
    """Check operative clauses and prove the check rejects unsafe mutations."""

    def test_source_contracts_satisfy_safety_requirements(self) -> None:
        """Current instructions must contain the safeguards and reject legacy rules."""
        for contract in CONTRACTS + LANGUAGE_CONTRACTS:
            with self.subTest(agent=contract.agent):
                self.assertEqual(failures(contract, read_agent(contract.agent)), ())

    def test_each_removed_safeguard_is_detected(self) -> None:
        """Removing any decision-bearing guard must fail, even with headings intact."""
        for contract in CONTRACTS + LANGUAGE_CONTRACTS:
            source = normalized(read_agent(contract.agent))
            for clause in contract.required:
                with self.subTest(agent=contract.agent, removed=clause):
                    mutated = source.replace(normalized(clause), "")
                    self.assertIn(f"missing: {clause}", failures(contract, mutated))

    def test_each_restored_unsafe_directive_is_detected(self) -> None:
        """New safety text cannot mask a contradictory old instruction elsewhere."""
        for contract in CONTRACTS + LANGUAGE_CONTRACTS:
            source = read_agent(contract.agent)
            for clause in contract.unsafe:
                with self.subTest(agent=contract.agent, restored=clause):
                    mutated = f"{source}\n{clause}\n"
                    self.assertIn(f"unsafe: {clause}", failures(contract, mutated))

    def test_layout_only_changes_preserve_contracts(self) -> None:
        """The checks accept equivalent prose after harmless wrapping changes."""
        for contract in CONTRACTS + LANGUAGE_CONTRACTS:
            with self.subTest(agent=contract.agent):
                rewrapped = "\n".join(read_agent(contract.agent).split())
                self.assertEqual(failures(contract, rewrapped), ())

    def test_payment_reporting_scenarios_reject_wrong_applicability(self) -> None:
        """Domestic, foreign, card and TPSO rules require separate scoped decisions."""
        contract = next(item for item in CONTRACTS if item.agent == "payments-reviewer")
        source = normalized(read_agent(contract.agent))
        mutations = (
            (
                "TPSO-only-amount",
                "over $20,000 AND more than 200 transactions",
                "over $20,000 OR more than 200 transactions",
            ),
            (
                "card-threshold",
                "payment-card reporting has no minimum amount or transaction count",
                "payment-card reporting has the TPSO threshold",
            ),
            (
                "domestic-BOI",
                "31 CFR §1010.380 exempts U.S.-created companies",
                "31 CFR §1010.380 covers all U.S.-created companies",
            ),
            (
                "foreign-BOI",
                "assess foreign-created entities registered "
                "in a U.S. state/Tribal jurisdiction",
                "all foreign-created entities are exempt",
            ),
        )
        for scenario, guard, unsafe in mutations:
            with self.subTest(scenario=scenario):
                self.assertIn(normalized(guard), source)
                mutated = source.replace(normalized(guard), normalized(unsafe), 1)
                self.assertIn(f"missing: {guard}", failures(contract, mutated))

    def test_medical_record_and_cds_cases_use_distinct_authorities(self) -> None:
        """Documentation retention and ONC certification do not imply an FDA device."""
        contract = next(item for item in CONTRACTS if item.agent == "health-reviewer")
        source = normalized(read_agent(contract.agent))
        guards = (
            "HIPAA does not prescribe medical-record retention periods",
            "not a universal patient-record or audit-log period",
            "45 CFR §170.315(b)(11) is a health IT certification criterion, "
            "not an FDA device rule",
            "AI use or ONC certification alone does not establish FDA device status",
        )
        for guard in guards:
            with self.subTest(case=guard):
                mutated = source.replace(
                    normalized(guard),
                    "apply a blanket medical rule",
                    1,
                )
                self.assertIn(f"missing: {guard}", failures(contract, mutated))

    def test_audit_outcomes_have_a_canonical_blocking_threshold(self) -> None:
        """Synthetic outcomes check policy; no package registry or npm process runs."""
        source = normalized(read_agent("security-reviewer"))
        threshold = re.search(r"npm audit --audit-level=(\w+)", source)
        self.assertIsNotNone(threshold)
        if threshold is None:
            self.fail("Dependency command is missing")
        self.assertEqual(threshold.group(1), "moderate")
        scenarios = (
            ("moderate-only", "moderate-only, high and critical reports block merge"),
            ("high", "moderate-only, high and critical reports block merge"),
            ("critical", "moderate-only, high and critical reports block merge"),
            ("clean", "a clean completed audit passes this dependency gate"),
            ("unavailable-tool", "verification unavailable and blocks the gate"),
        )
        for outcome, decision in scenarios:
            with self.subTest(outcome=outcome):
                self.assertIn(decision, source)
        contract = next(item for item in CONTRACTS if item.agent == "security-reviewer")
        mutated = source.replace("--audit-level=moderate", "--audit-level=high", 1)
        self.assertIn(
            "unsafe: npm audit --audit-level=high",
            failures(contract, mutated),
        )

    def test_severity_mapping_is_lossless_and_shared(self) -> None:
        """Every supported source label maps explicitly to severity and merge action."""
        source = read_agent("code-reviewer")
        rows = severity_rows(source)
        self.assertEqual(rows, SEVERITY_ROWS)
        self.assertEqual(len({row[0] for row in rows}), len(rows))
        for contract in CONTRACTS:
            if contract.agent != "code-reviewer":
                with self.subTest(agent=contract.agent):
                    self.assertIn(SEVERITY_LINK, read_agent(contract.agent))
        for agent in LANGUAGE_REVIEWERS:
            with self.subTest(agent=agent):
                self.assertIn(SEVERITY_LINK, read_agent(agent))

    def test_same_unresolved_exploit_blocks_every_supported_taxonomy(self) -> None:
        """Aliases cannot make a known exploit mergeable in another reviewer."""
        source = read_agent("code-reviewer")
        rows = severity_rows(source)
        for label in ("BLOCKER", "CRITICAL", "HIGH", "MAJOR"):
            with self.subTest(source_severity=label):
                match = next(row for row in rows if row[0] == label)
                self.assertEqual(match[2], "BLOCK")
                original = f"| {label} | {match[1]} | BLOCK |"
                mutated = source.replace(
                    original,
                    f"| {label} | {match[1]} | WARN |",
                    1,
                )
                self.assertNotEqual(severity_rows(mutated), SEVERITY_ROWS)


if __name__ == "__main__":
    unittest.main()
