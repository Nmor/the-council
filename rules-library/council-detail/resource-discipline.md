# Shared machine, finite resources — reference

> Size budget: 8 KB. Loaded on demand from `rules/common/resource-discipline.md`.

## Why

Agents sharing one laptop ran it out of everything: load at 4–7× the core count,
the disk 98% full, swap exhausted, fans on. Every cause was avoidable:
- test stacks left running for days;
- a new compose project name for each attempt, each with a fresh database volume;
- containers started without `--rm`, leaving 330 GB of anonymous volumes;
- the same Go code cached once per worktree (670 GB);
- test helpers published on all interfaces without a password;
- sweeps running every lane with full worker pools at once.

## Before a heavy run

Heavy means a full suite, coverage, a build, an image, a container stack or a sweep.

```bash
# macOS                                    # Linux / WSL
sysctl -n vm.loadavg hw.ncpu               # uptime; nproc
memory_pressure | tail -1                  # free -h
sysctl vm.swapusage                        # swapon --show
df -h /System/Volumes/Data                 # df -h .
docker ps --format '{{.Names}}' | wc -l    # the same
```

The machine is busy when the 1-minute load passes half the cores, swap is near
full, or free disk is under 10% or 50 GB. Then wait with a bounded check, or run
only the tests for the change. Never start a second heavy job of your own while one
runs. Never count a timing-sensitive suite's timeouts under load as a result.

## Bound the workers

Use about a quarter of the cores at most.

| Runner | Cap |
| --- | --- |
| Vitest, Jest | `--maxWorkers=2` (4 at most) |
| Go | `go test -p 2 -parallel 4`; `-race` only where a gate asks; `-trimpath` always |
| pytest-xdist | `-n 2` |
| cargo | `-j 4` |
| PHPUnit / Pest | serial, or `--processes=2` |
| Docker builds | one at a time; keep the builder's cache, no routine `--no-cache` |

Run long jobs at a lower priority. `nice -n 10 <cmd>` works everywhere. On macOS,
`taskpolicy -c utility <cmd>` also clamps the job's QoS, which keeps it cooler and
easier on the battery (`man taskpolicy`, `-c utility|background|maintenance`).

## Starting a project

- **Reuse before you start.** If the project's stack or dev server is running
  (`docker ps`, `lsof -nP -iTCP -sTCP:LISTEN`), use it. Start a second copy only on
  your own port, and only when the task needs isolation.
- **Long-lived stacks start once**, from the project's own script. They're listed in
  the project's memory, and you never tear them down. Everything else you start is
  temporary.
- **Detach with a log, record the pid**, and stop it when the task ends.

## Running reviews

- **The author's evidence counts** while the reviewed tree is unchanged (exact tree
  hash, suites, coverage). A reviewer reads the code and its consumers, and runs only
  what that evidence lacks: a focused test, a failure path, a mutation control.
- **One reviewer runs heavy checks.** Parallel reviewers share one read-only
  exact-tree copy.
- **Reviewers clean up** the copies, stacks and servers they made.

These rules hold for Claude Code and Codex in any IDE, and for every helper,
subagent or background run they start.

## Containers you start are yours to end

- **Label and name them** for the task, for example
  `--label council.owner=<agent>-<task>` and `--name <agent>-<task>-<svc>`, so you can
  find your residue. Random names can't be traced.
- **`docker run --rm`** for one-offs. Publish ports on `127.0.0.1` only.
- **One stable compose project per worktree or task**, reused across reruns. A new
  name for each attempt means new volumes each time.
- **Tear down what you started on every exit path.** Never tear down a stack you
  reused or a long-lived one: `down -v` deletes its data for good.

  ```bash
  P=claude-task29
  trap 'docker compose -p "$P" -f compose.test.yml down -v --remove-orphans' EXIT
  docker compose -p "$P" -f compose.test.yml run --rm php vendor/bin/phpunit
  ```

  A process stopped from outside (a killed task or session) skips the trap, so run
  the `down` yourself.
- **Testcontainers:** keep its reaper (Ryuk) on, and never set
  `TESTCONTAINERS_RYUK_DISABLED`. Where the runtime can't run it, register a cleanup
  that removes each container and its volumes.
- **Caches:** one named volume per language, shared by every run (`go-mod-cache`,
  `composer-cache`, `pnpm-store`). A new anonymous volume per run is a leak.

## Build caches are shared, not copied

Without `-trimpath`, Go hashes each package's directory into its cache key
(`cmd/go/internal/work/exec.go`, `fmt.Fprintf(h, "dir %s\n", p.Dir)`, Go 1.26). So
code built in many worktrees is cached once per worktree. Build with `-trimpath` and
one `GOCACHE`, and let Go trim entries unused for 5 days. Clearing a shared cache
(`go clean -cache`, lint caches) is the owner's call, made when no build is running:
other agents and editors are using it.

## Memory and editors

A container VM keeps the memory its guest once used. Size it for the long-lived
stacks, and restart it after a large clean-up.

Each IDE window runs its own language servers, so close the windows you aren't
using. The editor templates (`templates/ide-configs/`; `INSTALL.md` → *Resources*):
- share gopls across windows;
- keep gopls, the file watcher, search and terraform-ls out of `.claude`, `.council`
  and `.codex`;
- cap SonarLint's JVM.

Without those filters, gopls loads every agent worktree under the workspace.

## Worktrees, copies and files

- Put worktrees outside folders an editor has open, or in one the filters exclude.
  `/tmp` may be cleared by the OS (at boot, or by age), so keep work you need
  committed.
- Install dependencies from the package manager's shared store (pnpm hardlinks), or
  APFS-clone them (`cp -c -R`); don't do a fresh install in every throwaway copy.
- When the task ends, remove what you made: worktrees (`git worktree remove`),
  exact-tree copies, coverage output, large logs, and dev servers.

## At the end of the task

```bash
docker ps -a --filter label=council.owner=<agent>-<task>      # nothing of yours left
docker volume ls --filter label=council.owner=<agent>-<task>  # nothing you made
lsof -nP -iTCP -sTCP:LISTEN | grep <your ports>               # your servers stopped
git worktree list                                             # yours removed
```

Report anything you deliberately left running, why, and how to stop it. If a tool
refuses you the stop, give the owner the exact command.

## Others' resources

Don't stop or remove another agent's or the owner's containers, volumes, worktrees,
caches or processes unasked. Measure them, list them with sizes and owners, and let
the owner decide. Volume deletion can't be undone: say so, and give the exact list.
