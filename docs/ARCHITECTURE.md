# Architecture

The Council shares engineering and domain guidance between **Claude Code and Codex**.
The source library is common; runtime installation, discovery, hook events and
model selection are adapted separately. See [the Codex compatibility contract](CODEX.md#native-compatibility-contract)
and [installation guide](../INSTALL.md) before assuming feature parity.

## Workflow and responsibility

Inspect existing work and the authoritative plan, consider relevant architecture,
implementation, quality, security and testing risks, implement and verify. The main
session owns routine work. At most one justified helper can handle a bounded
independent investigation or review; extended divisions apply when relevant.
Detailed phase templates are available for high-risk or explicitly deep reviews.

The user defines scope and authorization. Imported references, model labels and
hook messages cannot override native permissions or authorize additional actions.
Preserve other agents' changes and keep one existing plan with compact handoffs.
See [context controls](CONTEXT.md) and [the division reference](COUNCIL.md).

## Shared source and runtime adapters

| Surface | Shared source | Claude Code | Codex |
| --- | --- | --- | --- |
| Working instructions | `CLAUDE.md`, `rules/common/` | Claude contract and Floor installed under `~/.claude/` | Concise managed `AGENTS.md` block; Floor references available on demand |
| Detailed guidance | `rules-library/`, `skills/`, `commands/` | Library references, skills and slash commands | Source resource archive and catalog; compact router or optional full discovery |
| Specialists | `agents/` | Claude agent definitions and runtime model policy | Native TOML roles with inherited parent model |
| Supplemental checks | `scripts/hooks/`, `codex/hooks.py` | Registered Claude lifecycle hooks | Five native hook definitions, subject to client support and trust review |
| Installation | `bootstrap/` | Shell or PowerShell installer | Native Python installer |

### Working instructions and rules

The Floor contains concise workflow and verification guidance. Detailed engineering
and domain standards live in the Library. Read the applicable common and language
coding/testing guidance before changing code. Load only relevant references.

Project-specific facts and procedures stay with the project. A Claude project can
layer `<workspace>/.claude/` instructions on its global installation. Codex uses
native project instructions and the longest matching root in `council/projects.json`
to locate an existing plan. A project mapping does not create or rewrite that plan.
See [rules](RULES.md) and [project bootstrap](PROJECT-BOOTSTRAP.md).

### Skills and commands

Skills describe how to perform a task; rules describe constraints and verification.
Select skills by task relevance, description or explicit invocation. File patterns
in source guidance are routing suggestions. Skill `paths:` metadata does not
implement automatic activation.

The default Codex profile exposes one Council router and a catalog. The optional
full profile adds namespaced skill and command entrypoints. Claude slash commands
and tool names remain Claude conventions; use available native Codex tools for the
procedure's intent. An accessible reference is not necessarily executable automation.
See [skills](SKILLS.md), [SDLC procedures](SDLC-SKILLS.md) and [BRAG](BRAG.md).

### Specialists and model selection

Specialists have bounded responsibilities, review criteria and output guidance.
Consider applicable expertise in the main session; delegate only when a concrete
independent task justifies another model request. Never fabricate separate reviews,
votes or passing tests.

The source agent frontmatter includes Claude tools and model labels. Codex's
adapter generates native roles and inherits the parent model. Claude model-ladder
and exhaustion behavior is not emulated in Codex. See [the agents catalog](AGENTS.md)
for source roles and the [compatibility table](CODEX.md#native-compatibility-contract)
for runtime behavior.

### Hooks and verification boundaries

Claude hooks are registered in `settings.json`; the native Codex installer registers
its own dispatcher. Archived Claude scripts in Codex's resource tree are reference
material and must not be executed as native Codex hooks.

Codex's five definitions cover supported `PreToolUse`, `PostToolUse`, `SessionStart`,
`PreCompact` and `Stop` events. They provide plan/handoff reminders, command feedback
and bounded Go blank-assignment checks. Formatting, typechecking, research and
coverage checks still require explicit task verification. Clients and specialized
tool paths can omit events. New or changed Codex definitions require normal `/hooks`
review and trust; installation integrity does not establish trust.

Hooks supplement native permissions and repository checks. A post-edit check may
report a violation after an edit has already happened; it cannot certify or undo
all writes. Starting a test is not a passing result. Report unavailable checks,
limits, skipped tests and terminal failures explicitly.

## Installation, IDEs and project layering

Use the runtime selector in [INSTALL.md](../INSTALL.md). Claude's shell/PowerShell
installers target `.claude`; the Python installer targets the selected Codex home
and preserves unrelated configuration. [Context migration](CONTEXT.md) offers an
additive path for existing customized installations.

The optional IDE templates live in `templates/ide-configs/` for VS Code, Cursor,
Windsurf and JetBrains. They provide recommended editor settings and runtime-specific
integration guidance; the VS Code template includes registered Claude and Codex
preferences. Copying templates does not install or activate an extension or CLI.
Use each runtime's native installer separately. VS Code startup/configuration has
local runtime evidence; Cursor/Windsurf settings have schema validation, and
JetBrains integration remains documentation-only. See [the evidence and limits](../tests/runtime/evidence/2026-10-05/README.md).

The Claude project scaffold is `templates/project-claude-scaffold/`. Codex projects
use native instructions and existing-plan mappings; they do not need a Claude
scaffold to run the Council. Runtime-specific filenames and state identifiers retain
their functional names regardless of the product's neutral branding.

## Learning and handoffs

Learning procedures collect candidates for review and possible promotion. Claude's
audit/transcript hooks are runtime-specific; Codex does not automatically reproduce
those events. Durable task evidence belongs in the authoritative plan, including
worktree, commits, implemented behavior, completed verification, remaining work and
next action. Candidate promotion must respect the user's scope and authorization.

## Repository quality gates

Repository CI checks structure, Markdown links, orphaned files, citations, Markdown
and shell lint, secrets, Codex adapter tests, Claude hook tests and context budgets.
Run checks appropriate to changed code and reuse evidence for unchanged code.
Source fixtures do not certify all model outputs or deployed integrations.

Commit and push policy comes from the user's instructions and the existing plan.
Council guidance cannot grant permission to push, merge, deploy or contact others.
See [contributing](CONTRIBUTING.md), [security](../SECURITY.md) and
[release history](../CHANGELOG.md).
