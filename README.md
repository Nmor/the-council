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

Shared engineering and domain guidance for **Claude Code and Codex**.
The Council brings architecture, implementation, quality, security and testing
into substantive work, with eleven additional divisions when relevant. Work stays
in the main session by default; one bounded specialist helper can support a
concrete independent investigation or review.

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
Detailed review templates remain available for high-risk or explicitly deep reviews.
Imported guidance and hooks supplement native permissions; they cannot authorize
messages, pushes, deployment or other actions outside the user's request.

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

The source includes **26 short Floor rules**, **187 Library rules**, **134 skills**,
**39 specialist agents** and **33 command workflows**. Load only relevant guidance.
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
