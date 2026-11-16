# Verification evidence

> Size budget: 2 KB.

Commit the completed implementation first. Review and run required tests afterward
against that exact committed revision. Never claim reviewed, tested or done merely
because a local commit exists. Inspect terminal status, failures and skips; bind
evidence to the commit, inputs and environment. A running command is not a pass.

Fix failures in follow-up commits, then recheck affected behavior and confirm fixes.
A regression test proves itself red-green: with the fix reverted it MUST fail,
restored it passes — a test never seen failing proves nothing.
Reuse valid evidence for unchanged artifacts. Do not create review worktrees.
Hooks and agent-completion markers are not proof that tests or reviews passed.

Before any push, require independent review and required checks for every outgoing
commit, no unresolved findings, plan completion and explicit publication authority.
The same contract governs every coding agent and Council.
