# Container reaper (optional)

> Size budget: 4 KB.

A daily clean-up of the container residue that test runs leave behind. It backs
up [`rules/common/resource-discipline.md`](../../rules/common/resource-discipline.md):
agents clean up after themselves, and this catches what they miss.

It never touches:
- a compose project or container name in `allowlist.txt` (`*` patterns, `#` comments);
- a container with a restart policy (`unless-stopped`, `always`, `on-failure`),
  running or stopped: it's a service, and someone may have stopped it on purpose;
- a paused or restarting container;
- a named volume, a volume any container mounts, or a volume labelled with an
  allowlisted project.

Otherwise it:
- stops a plain container that has run 6 hours;
- removes an exited, created or dead one 24 hours after it stopped, with its
  anonymous volumes;
- removes unattached anonymous volumes older than a day;
- prunes build cache unused for a day.

Ages come from the container runtime's clock, so a VM clock that fell behind
during sleep can't make containers look older than they are. If one item fails,
it's logged and skipped, and the run carries on and always logs a summary.

It logs every action to `~/Library/Logs/container-reaper.log` (macOS) or
`~/.local/state/container-reaper.log` (Linux). **Until `live.flag` exists beside the
script, it only logs what it would do.**

## Install

```bash
mkdir -p ~/.config/container-reaper
cp reaper.py test_reaper.py ~/.config/container-reaper/
cp allowlist.txt.example ~/.config/container-reaper/allowlist.txt   # list your long-lived stacks
python3 ~/.config/container-reaper/test_reaper.py                   # 44 cases
python3 ~/.config/container-reaper/reaper.py                        # a dry run: read the log
```

The Docker CLI comes from `REAPER_DOCKER`, then `docker` on `PATH`, then
`~/.kiri/bin/docker`.

**macOS (launchd, daily at 17:00):**

```bash
sed "s#__HOME__#$HOME#g" council.container-reaper.plist > ~/Library/LaunchAgents/council.container-reaper.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/council.container-reaper.plist
```

**Linux (cron, daily at 17:00):**

```bash
( crontab -l 2>/dev/null; echo "0 17 * * * nice -n 10 python3 $HOME/.config/container-reaper/reaper.py" ) | crontab -
```

To try it live on throwaway residue only, run it with
`REAPER_TEST_SCOPE="<name pattern>[,<volume name>]"`. That run acts on the matching
names alone, ignores the age limits, and doesn't prune cache.

Go live after you've read a dry run's log: `touch ~/.config/container-reaper/live.flag`.
Remove the file to go back to dry runs.

## Giving the space back

Removing volumes frees space inside a container VM (Kiri, Docker Desktop,
OrbStack, Colima), but its disk image only shrinks after a trim. Restarting the VM
also returns the memory its guest kept.
