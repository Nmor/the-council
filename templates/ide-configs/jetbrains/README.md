# The Council — JetBrains setup

Use these editor templates with Claude Code or Codex. Install the Council for your
chosen runtime through [INSTALL.md](../../../INSTALL.md); importing a code style
or keymap does not install an agent or enable Council hooks.

## Choose an agent

### Claude Code

Install the separate Claude Code CLI and Anthropic's Claude Code plugin from the
JetBrains Marketplace. Restart the IDE, open the project and run `claude` in its
integrated terminal. If the IDE cannot find the CLI, configure the plugin's
**Claude command** setting. The documented launch shortcut is **Cmd+Esc** on macOS
or **Ctrl+Esc** on Windows/Linux. See [Anthropic's integration guide](https://code.claude.com/docs/en/jetbrains).

### Codex

JetBrains AI Assistant offers Codex as an agent. Complete its agent setup and select
Codex in AI Chat. Follow [JetBrains' Codex guide](https://www.jetbrains.com/help/ai-assistant/codex-agent.html)
for authentication and available commands; these can differ from the terminal CLI.
Keep AI Assistant enabled when using that integration.

JetBrains documents `AGENTS.md` for Codex project instructions and `CLAUDE.md` for
Claude Agent. See [its agent reference](https://www.jetbrains.com/help/ai-assistant/agents.html).
Reuse the project's authoritative implementation plan. Confirm the Council router,
selected home and effective configuration in your actual session before assuming
the IDE uses the same installation as a terminal. See [Council's native compatibility contract](../../../docs/CODEX.md#native-compatibility-contract).

## Shared code styles

Review the XML schemes before importing them through **Settings → Editor → Code
Style → Scheme → Import**. Preserve your existing scheme so it can be restored.

| Scheme | Settings |
| --- | --- |
| [TypeScript / JavaScript](code-style/typescript.xml) | 2-space indent, 100-character margin, single quotes |
| [Python](code-style/python.xml) | 4-space indent, 100-character margin |
| [Go](code-style/go.xml) | Tabs, 120-character visual guide; use gofmt |
| [Java](code-style/java.xml) | 4-space indent, 120-character margin; a Council scheme with deviations from Google Java Style |

Formatting schemes do not enforce test quality, function complexity or security.
Run the repository's strict linters and required tests. Consult the shared
[lint policy](../../../rules-library/common/extreme-lint-policy.md) and applicable
language guidance through your Council catalog; those references are not tied to
a particular user's `~/.claude` directory.

## Optional Claude keymap

[keymap-claude.xml](keymap-claude.xml) is a Claude-specific template. Its action IDs
have not been validated against a local JetBrains plugin. Check each action in the
installed plugin's keymap before importing; restore your previous keymap if it
does not resolve. It is not a Codex keymap.

## Plugin setup

Review the publisher, requested access and compatible IDE versions on the current
Marketplace listing. The repository does not certify every optional plugin vendor.
Choose plugins required by your project; do not disable the integration hosting
your chosen agent.

For automated installation, JetBrains supports `installPlugins` with exact plugin
IDs from each Marketplace listing. Use your product's actual launcher and copy the
**Plugin ID**, rather than guessing an ID from the display name. See [JetBrains' command-line instructions](https://www.jetbrains.com/help/idea/install-plugins-from-the-command-line.html).

Review updates and configure certificate handling, data sharing and Git protections
according to your organization's policy. Editor templates do not grant permission
to push, deploy, send messages or trust hooks.

## Verification limits

Local runtime evidence covers Codex discovery and VS Code extension startup/settings;
Cursor and Windsurf templates received schema checks. No JetBrains instance, plugin
activation, keymap action or Council hook execution was tested in this session.
See [the verification receipts and limits](../../../tests/runtime/evidence/2026-10-05/README.md).
