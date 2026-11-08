#!/usr/bin/env python3
"""Daily clean-up of test-container residue (The Council, templates/container-reaper).

Never touches a container whose compose project or name matches allowlist.txt (one
per line, `*` patterns, `#` comments), a container with a restart policy (a service,
running or stopped), a named volume, or a volume any container mounts. Otherwise:
  - stops a plain running container once it has run 6 h;
  - removes an exited, created or dead container 24 h after it stopped, with its
    anonymous volumes;
  - removes an unattached anonymous volume 24 h after it was made;
  - prunes build cache unused for 24 h.
Times come from the container runtime's clock. Dry run unless live.flag exists beside
this file. One failed item is logged and skipped; the run goes on and always logs a
summary. REAPER_TEST_SCOPE=<pattern>[,<pattern>...] narrows a run to the containers and
volumes whose names match, with no age limits and no cache prune: a supervised live test.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from fnmatch import fnmatch
from pathlib import Path
from typing import Callable, Iterable, Optional

HERE = Path(__file__).resolve().parent
DOCKER = os.environ.get("REAPER_DOCKER") or shutil.which("docker") or str(Path.home() / ".kiri/bin/docker")
LOG = (Path.home() / "Library/Logs" if sys.platform == "darwin" else Path.home() / ".local/state") / "container-reaper.log"
RUN_LIMIT = timedelta(hours=6)
STOPPED_LIMIT = timedelta(hours=24)
ANONYMOUS = re.compile(r"[0-9a-f]{64}")
NOT_RESTARTING = ("", "no")
REMOVABLE = ("exited", "created", "dead")
COMPOSE = "com.docker.compose.project"
FAILURES = (RuntimeError, OSError, subprocess.TimeoutExpired)


def read_allowlist(text: str) -> set:
    """Patterns from allowlist.txt: anything after `#` is a comment; blank lines go."""
    return {line.split("#", 1)[0].strip() for line in text.splitlines()} - {""}


def allowed(name: str, project: str, allow: Iterable) -> bool:
    return any(fnmatch(name, a) or (project and fnmatch(project, a)) for a in allow)


def when(value: str) -> Optional[datetime]:
    """Docker's RFC 3339 times (0-9 fraction digits, Z or an offset); None for its zero time."""
    if not value or value.startswith("0001-"):
        return None
    m = re.fullmatch(r"(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d+))?(Z|[+-]\d\d:\d\d)?", value.strip())
    if not m:
        raise ValueError(f"not a timestamp: {value!r}")
    base, fraction, zone = m.groups()
    stamp = f"{base}.{(fraction or '0')[:6].ljust(6, '0')}{'+00:00' if zone in (None, 'Z') else zone}"
    return datetime.fromisoformat(stamp)


def container_action(c: dict, now: datetime, allow: set, run_limit: timedelta = RUN_LIMIT,
                     stopped_limit: timedelta = STOPPED_LIMIT) -> Optional[tuple]:
    """("stop" | "rm", reason) for one `docker container inspect` record, or None to leave it."""
    project = (c["Config"].get("Labels") or {}).get(COMPOSE, "")
    if allowed(c["Name"].lstrip("/"), project, allow):
        return None
    if c["HostConfig"]["RestartPolicy"].get("Name", "") not in NOT_RESTARTING:
        return None  # a service, kept in every state: stopping it was someone's choice
    state = c["State"]
    status = state.get("Status", "")
    if status == "running":
        started = when(state.get("StartedAt", ""))
        if started and now - started > run_limit:
            return ("stop", f"running {now - started}, project '{project}'")
        return None
    if status not in REMOVABLE:
        return None  # paused, restarting, removing: not ours to decide
    finished = when(state.get("FinishedAt", "")) or when(c.get("Created", ""))
    if finished and now - finished > stopped_limit:
        return ("rm", f"{status} {now - finished}, project '{project}'")
    return None


def volume_due(v: dict, dangling: set, mounted: set, now: datetime, allow: set,
               limit: timedelta = STOPPED_LIMIT) -> bool:
    """An unattached anonymous volume older than `limit`; never a named, mounted or allowlisted one."""
    name = v["Name"]
    if name not in dangling or name in mounted or not ANONYMOUS.fullmatch(name):
        return False
    if allowed("", (v.get("Labels") or {}).get(COMPOSE, ""), allow):
        return False
    made = when(v.get("CreatedAt", ""))
    return bool(made and now - made > limit)


def run_docker(*args: str) -> str:
    done = subprocess.run([DOCKER, *args], capture_output=True, text=True, timeout=600)
    if done.returncode != 0:
        raise RuntimeError(f"docker {' '.join(args[:2])} failed: {done.stderr.strip()[:300]}")
    return done.stdout


class Reaper:
    def __init__(self, live: bool, docker: Callable[..., str] = run_docker, log_path: Path = LOG, scope: str = ""):
        self.live = live
        self.docker = docker
        self.log_path = log_path
        self.scope = [p.strip() for p in scope.split(",") if p.strip()]
        self.now = datetime.now(timezone.utc)
        self.failed = 0
        self.counts = {"stop": 0, "rm": 0, "volume": 0}

    def log(self, line: str) -> None:
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        if self.log_path.exists() and self.log_path.stat().st_size > 1_000_000:
            self.log_path.replace(self.log_path.with_suffix(".log.1"))
        with self.log_path.open("a") as f:
            f.write(f"{self.now.isoformat(timespec='seconds')} {'' if self.live else '[dry] '}{line}\n")

    def attempt(self, args: list, what: str) -> bool:
        """Do one action (or, in a dry run, only log it); a failure is logged and skipped."""
        try:
            if self.live:
                self.docker(*args)
            self.log(what)
            return True
        except FAILURES as err:
            self.failed += 1
            self.log(f"could not do it: {what}: {err}")
            return False

    def runtime_now(self) -> datetime:
        """The runtime's clock: after a sleep the VM's clock, not the Mac's, dated what it made."""
        try:
            stamp = self.docker("info", "--format", "{{json .SystemTime}}").strip().strip('"')
            return when(stamp) or self.now
        except (*FAILURES, ValueError) as err:
            self.log(f"using this machine's clock: the runtime's isn't readable ({err})")
            return self.now

    def inspect(self, kind: str, ids: list) -> list:
        """`docker <kind> inspect` in batches of 50; a failed batch is retried one by one."""
        records = []
        for i in range(0, len(ids), 50):
            batch = ids[i:i + 50]
            try:
                records += json.loads(self.docker(kind, "inspect", *batch))
                continue
            except (*FAILURES, ValueError):
                pass  # one of the batch went away since it was listed: read the rest one by one
            for one in batch:
                try:
                    records += json.loads(self.docker(kind, "inspect", one))
                except (*FAILURES, ValueError) as err:
                    self.log(f"skipped {kind} {one[:12]}: {err}")
        return records

    def in_scope(self, name: str) -> bool:
        return not self.scope or any(fnmatch(name, p) for p in self.scope)

    def containers(self, ids: list, allow: set, now: datetime, limits: tuple) -> set:
        """Acts on each container; returns the volumes any container mounts."""
        mounted = set()
        for c in self.inspect("container", ids):
            mounted.update(m.get("Name", "") for m in c.get("Mounts") or [] if m.get("Type") == "volume")
            name = c.get("Name", "?").lstrip("/")
            if not self.in_scope(name):
                continue
            try:
                decided = container_action(c, now, allow, *limits)
            except (KeyError, ValueError) as err:
                self.failed += 1
                self.log(f"skipped container {name}: unreadable record ({err})")
                continue
            if decided is None:
                continue
            verb, reason = decided
            if verb == "stop":
                done = self.attempt(["stop", "-t", "10", c["Id"]], f"stopped {name} ({reason})")
            else:
                done = self.attempt(["rm", "-v", c["Id"]], f"removed container {name} ({reason})")
            self.counts[verb] += int(done)
        return mounted

    def volumes(self, allow: set, mounted: set, now: datetime, limit: timedelta) -> None:
        try:
            dangling = set(self.docker("volume", "ls", "-q", "--filter", "dangling=true").split())
        except FAILURES as err:
            self.failed += 1
            self.log(f"skipped volumes: {err}")
            return
        candidates = sorted(v for v in dangling if ANONYMOUS.fullmatch(v) and v not in mounted and self.in_scope(v))
        for v in self.inspect("volume", candidates):
            try:
                due = volume_due(v, dangling, mounted, now, allow, limit)
            except (KeyError, ValueError) as err:
                self.failed += 1
                self.log(f"skipped volume {v.get('Name', '?')[:12]}: unreadable record ({err})")
                continue
            if due:
                self.counts["volume"] += int(self.attempt(["volume", "rm", v["Name"]], f"removed volume {v['Name'][:12]}"))

    def run(self, allow: set) -> None:
        try:
            ids = self.docker("ps", "-aq", "--no-trunc").split()
        except FAILURES as err:
            self.log(f"skipped: the container runtime isn't answering ({err})")
            return
        now = self.runtime_now()
        limits = (timedelta(0), timedelta(0)) if self.scope else (RUN_LIMIT, STOPPED_LIMIT)
        mounted = self.containers(ids, allow, now, limits)
        self.volumes(allow, mounted, now, limits[1])
        if not self.scope:
            self.attempt(["builder", "prune", "-f", "--filter", "until=24h"], "pruned build cache unused for 24 h")
        c = self.counts
        self.log(f"done: {c['stop']} stopped, {c['rm']} containers and {c['volume']} volumes removed, {self.failed} failed")


def main() -> int:
    reaper = Reaper(live=(HERE / "live.flag").exists(), scope=os.environ.get("REAPER_TEST_SCOPE", ""))
    try:
        reaper.run(read_allowlist((HERE / "allowlist.txt").read_text()))
        return 1 if reaper.failed else 0
    except Exception as err:  # the log is the only place a scheduled job can report
        reaper.log(f"failed: {type(err).__name__}: {err}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
