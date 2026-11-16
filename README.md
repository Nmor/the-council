# The Council

```text
████████╗██╗  ██╗███████╗
╚══██╔══╝██║  ██║██╔════╝
   ██║   ███████║█████╗
   ██║   ██╔══██║██╔══╝
   ██║   ██║  ██║███████╗
   ╚═╝   ╚═╝  ╚═╝╚══════╝

 ██████╗ ██████╗ ██╗   ██╗███╗   ██╗ ██████╗██╗██╗
██╔════╝██╔═══██╗██║   ██║████╗  ██║██╔════╝██║██║
██║     ██║   ██║██║   ██║██╔██╗ ██║██║     ██║██║
██║     ██║   ██║██║   ██║██║╚██╗██║██║     ██║██║
╚██████╗╚██████╔╝╚██████╔╝██║ ╚████║╚██████╗██║███████╗
 ╚═════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝╚═╝╚══════╝
```

Shared engineering and domain guidance for **Claude Code, Codex, Copilot, Grok
and any `~/.agents`-reading CLI**.
The Council brings architecture, implementation, quality, security and testing
into substantive work, with eleven additional divisions when relevant. Specialist-owned work routes to that
specialist; independent deliverables dispatch as parallel subagents with tight
briefs, bounded by machine load and context budgets (see the resource gate).

[Install](INSTALL.md) · [Claude Code](#claude-code-installation) ·
[Codex](#codex-installation) · [Architecture](docs/ARCHITECTURE.md) ·
[Skills](docs/SKILLS.md) · [Contributing](docs/CONTRIBUTING.md)

## Choose your runtime

Both runtimes use the same source guidance. Their installers, discovery mechanisms
and hook support differ; installing files does not prove that hooks are active or
that an agent has run. See [the compatibility contract](docs/CODEX.md#native-compatibility-contract).

| Runtime | Installer | Working instructions | Verification |
| --- | --- | --- | --- |
| Claude Code | `bootstrap/install.sh` or `bootstrap/install.ps1` | `~/.claude/CLAUDE.md` and Floor rules | `bootstrap/verify.sh` or `bootstrap/verify.ps1` |
| Codex | `bootstrap/codex.py` | Managed `AGENTS.md` block, Council router and catalog under the selected Codex home | `python3 bootstrap/codex.py verify` |

### Claude Code installation

macOS, Linux or WSL2:

```bash
git clone https://github.com/Nmor/the-council.git
cd the-council
./bootstrap/install.sh --dry-run
./bootstrap/install.sh
./bootstrap/verify.sh
```

Windows PowerShell:

```powershell
git clone https://github.com/Nmor/the-council.git
Set-Location the-council
# Allow local scripts for this session if execution is restricted.
if ((Get-ExecutionPolicy) -eq 'Restricted') {
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
}
.\bootstrap\install.ps1 -DryRun
.\bootstrap\install.ps1
.\bootstrap\verify.ps1
```

The session setting follows [PowerShell's execution-policy guidance](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies)
and does not override an organization-managed policy.

The Claude installer backs up an existing destination before replacing its config
surface. Review the preview and [installer options](INSTALL.md); `--force` / `-Force`
skips that backup. Start a fresh Claude Code session after installing. The optional
IDE templates can be staged by this installer; the VS Code template also includes
Codex preferences. Templates do not install either runtime's extension or CLI.

### Codex installation

Requires Python 3.11+, Node.js 18+ and Git:

```bash
git clone https://github.com/Nmor/the-council.git
cd the-council
python3 bootstrap/codex.py install --dry-run
python3 bootstrap/codex.py install
python3 bootstrap/codex.py verify
```

On Windows, use `py -3.11` or a newer Python. The installer preserves unrelated
Codex configuration and the Claude installation. Start a fresh Codex session, use
`$council` to select guidance, and review new or changed hooks in `/hooks` before
trusting them. `verify` checks installation integrity, not trust or task correctness.
See [the Codex guide](docs/CODEX.md) for existing-plan mappings, supported features
and removal.

For existing installations, use the reversible [context migration](docs/CONTEXT.md)
rather than replacing customized configuration without review.

## How the Council works

1. Inspect the task, existing work and authoritative implementation plan.
2. Consider relevant architecture, implementation, quality, security and testing risks.
   Consult extended domain guidance when the task needs it.
3. Implement within the user's scope and authorization, preserving other work.
4. Verify with appropriate repository checks and review. Distinguish implemented,
   tested, installed, trusted and runtime-verified behavior.
5. Record evidence, remaining work and the next action in the same existing plan.

Routine tasks do not require a series of division speeches or extra model sessions.
Substantive plans, implementation and reviews follow the
[principal quality contract](rules-library/council-detail/principal-level-mandate.md):
explicit invariants, justified tool/design choices, complete wiring and consumer
compatibility, meaningful failure tests, useful comments and PR evidence tied to
the actual change. Strict checks remain required; shortcuts that hide failures or
drop acceptance are prohibited. These instructions support quality; they do not
guarantee every model output or certify a live system from synthetic tests.
Detailed review templates remain available for high-risk or explicitly deep reviews.
Imported guidance and hooks supplement native permissions; they cannot authorize
messages, pushes, deployment or other actions outside the user's request.

### Best idea wins, and it is measured

When two sources of guidance conflict — a Council rule against an installed
methodology, skill against skill, an advisory seat against an engineering
division — neither seniority nor injection order decides. Each side argues
with evidence against the task's constraints; the verdict is recorded in
[settled case law](rules-library/council-detail/settled-debates.md) and cited,
not re-litigated. Injected plugin instructions are demoted to debate positions
by a session hook.

Output quality is measured, not asserted: a UI eval harness (rubric and
protocol shipped with the installation's eval records) scored a five-artifact
baseline at
7.4/14, fed the findings back into the design stack, and re-measured at
9.2/14 one cycle later. The gates — markdown lint, link integrity, a
1,165-test hook suite, a 24,576-byte floor budget — run on every change.

Domain conversations (business, pricing, marketing, hiring, finance,
negotiation, SEO, writing) route through a deterministic intake hook that
names the matching domain skills and advisory seats per prompt, so
model-invisible expertise is loaded exactly when it applies.

### Sixteen divisions

| Core | Extended |
| --- | --- |
| Architecture & Planning | Compliance & Legal; Product, UX & CX |
| Implementation & Build | Operations & Reliability; Data & Analytics |
| Quality & Review | Finance & FinOps; Risk Management |
| Security | Strategy & Innovation; People & Culture |
| Testing & QA | Sustainability & ESG; Ethics & Responsible AI; Communications & Docs |

The [division reference](docs/COUNCIL.md) describes specialist responsibilities and
escalation guidance. Source model labels and Claude tool names are runtime-specific
conventions; Codex uses native roles with the inherited parent model.

### Context and learning

The source includes **29 short Floor rules**, the on-demand Library, **139
skills**, **58 specialist agents** (46 engineering + 12 Founder Board advisory
seats) and **34 command workflows**. Load only relevant guidance.

Founder Board seats inherit the parent model; each is a simulation whose advice
must be grounded in its referenced public-source collection.

| Seat | Lens |
| --- | --- |
| [Bezos](agents/council-bezos.md) | Customer value and long horizons |
| [Blakely](agents/council-blakely.md) | Consumer products and bootstrapping |
| [Buffett](agents/council-buffett.md) | Capital allocation |
| [Garyvee](agents/council-garyvee.md) | Distribution and attention |
| [Graham](agents/council-graham.md) | Early-stage products |
| [Hormozi](agents/council-hormozi.md) | Offers and acquisition |
| [Leila](agents/council-leila.md) | People and execution |
| [Martell](agents/council-martell.md) | Founder time and delegation |
| [Musk](agents/council-musk.md) | First principles |
| [Naval](agents/council-naval.md) | Leverage and incentives |
| [Sanchez](agents/council-sanchez.md) | Business acquisition |
| [Wickman](agents/council-wickman.md) | Operating cadence |
Codex defaults to one discoverable router and a catalog; a full discovery profile
is optional. Claude uses its concise working contract and Floor rules.

Measure instruction size with `node scripts/token-budget.mjs --root . --check`.
The eager Claude source contract is capped at 24,576 bytes; this measures source
instructions, not billed usage or a live session's complete context. Keep a clone
out of a parent `.claude/` directory that Claude would also load as project guidance.

Learning procedures can record candidates and propose improvements. Automatic
Claude audit events are not automatically ported to Codex; keep Codex evidence in
the existing plan. Candidate promotion remains subject to review and authorization.
See [context controls](docs/CONTEXT.md) and [runtime compatibility](docs/CODEX.md).

Claude Code and Codex share an [actionable task contract](rules-library/council-detail/plan-task-breakdown.md):
small verifiable outcomes, stable IDs, separate types/priorities/statuses, explicit
dependencies and bounded context. The planner, planning commands and agent handoffs
use this contract. The full backlog stays in one plan; a compact handoff and a small
active task window support interruption and resume.

## What's included

| Surface | Source | Purpose |
| --- | --- | --- |
| Working contract and Floor | `CLAUDE.md`, `rules/common/` | Concise shared workflow, verification and scope discipline |
| Library | `rules-library/` | Engineering and domain standards read on demand |
| Skills | `skills/` | Task-specific procedures and supporting resources |
| Specialists | `agents/` | Bounded reviews and independent investigations when justified |
| Command workflows | `commands/` | Claude slash commands; Codex catalog routes and optional namespaced entrypoints |
| Hooks | `scripts/hooks/`, `codex/hooks.py` | Runtime-specific supplemental checks; support and trust must be verified separately |
| Bootstrap and templates | `bootstrap/`, `templates/` | Runtime installers, migration, editor templates and Claude project scaffold |
| Tests and CI | `tests/`, `scripts/hooks/__tests__/`, `.github/workflows/` | Structure, references, lint, native adapters, hooks and context budgets |

The [SDLC and business skills](docs/SDLC-SKILLS.md) cover requirements, incidents,
integrated releases, test strategy, data reconciliation, recovery drills,
entrepreneurship, pentesting and CISA-aligned audits. The [skills catalog](docs/SKILLS.md)
also includes marketing strategy, SEO, content campaigns and brand creative
direction, with [evaluation scenarios](docs/MARKETING-CREATIVE-EVALUATION.md).
[BRAG](docs/BRAG.md) supports requested launch videos and creative deliverables
for both runtimes, including local media verification.

## Documentation and verification

| Task | Guide |
| --- | --- |
| Install, update or remove | [INSTALL.md](INSTALL.md), [Codex lifecycle](docs/CODEX.md) |
| Understand runtime behavior | [Architecture](docs/ARCHITECTURE.md), [Codex compatibility](docs/CODEX.md#native-compatibility-contract) |
| Browse guidance | [Rules](docs/RULES.md), [Skills](docs/SKILLS.md), [Agents](docs/AGENTS.md) |
| Set up project instructions | [Project bootstrap](docs/PROJECT-BOOTSTRAP.md) |
| Contribute and run checks | [Contributing](docs/CONTRIBUTING.md), [tests](tests/) |
| Review known improvement work | [Skills and hooks audit](docs/SKILLS-HOOKS-AUDIT-2026-10-05.md) |
| Follow releases | [CHANGELOG.md](CHANGELOG.md) |

Run the verifier for your runtime and the repository checks relevant to your change.
A successful structural check does not certify every procedure, model response,
hook or deployed environment. Report skipped checks and unavailable capabilities.

## Repository name and existing clones

The canonical repository is **[Nmor/the-council](https://github.com/Nmor/the-council)**.
The product name is **The Council**. Use **The Council for Claude Code** or
**The Council for Codex** when referring to a particular runtime integration.

Council commits and pushes use the **Nmor** account and
`Nmor <nmor.moses@gmail.com>` identity. Native Codex installations must be synced
from this checkout: `bash scripts/council-sync.sh` delegates to the native installer
and preserves its rollback records, path adaptations and compact skill profile.
It does not copy raw `~/.claude` files over a native installation.

For an existing clone, update its remote without moving the working directory:

```bash
git remote set-url origin https://github.com/Nmor/the-council.git
```

Fork owners should use their own fork URL. Runtime directories such as `.claude`
and `.codex`, the `CLAUDE.md` filename, and existing internal state identifiers keep
their functional names. Renaming the product does not change those contracts or
rewrite historical release evidence.

## License

[MIT](LICENSE). Review [the security policy](SECURITY.md) for private vulnerability
reporting and [the contribution guide](docs/CONTRIBUTING.md) before proposing changes.
