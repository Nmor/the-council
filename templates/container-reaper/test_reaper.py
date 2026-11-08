"""What the reaper may touch, and that one failure doesn't end a run.

Each case fails if the decision or the run breaks. Run:
  /usr/bin/python3 ~/.config/container-reaper/test_reaper.py
"""
import json
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

from reaper import Reaper, container_action, read_allowlist, volume_due, when

NOW = datetime(2026, 11, 8, 17, 0, tzinfo=timezone.utc)
ALLOW = {"app", "app-db", "billing", "media-local", "kms-dev", "buildx_buildkit_*"}
HEX = "a" * 64
cases = 0


def check(condition, what):
    global cases
    assert condition, what
    cases += 1


def stamp(hours_ago: float) -> str:
    return (NOW - timedelta(hours=hours_ago)).strftime("%Y-%m-%dT%H:%M:%S.123456789Z")


def container(status="exited", project="", policy="no", started: float = 1, finished: float = 1, name="c", cid="c1", mounts=()):
    return {
        "Id": cid, "Name": f"/{name}",
        "Config": {"Labels": {"com.docker.compose.project": project} if project else None},
        "HostConfig": {"RestartPolicy": {"Name": policy}},
        "State": {"Status": status, "StartedAt": stamp(started),
                  "FinishedAt": "0001-01-01T00:00:00Z" if status in ("running", "paused", "restarting") else stamp(finished)},
        "Created": stamp(max(started, finished) + 1),
        "Mounts": [{"Type": "volume", "Name": m} for m in mounts],
    }


act = lambda c: container_action(c, NOW, ALLOW)

# Allowlisted by project, name or pattern: never touched, running or stopped, however old.
check(act(container("running", "app", started=500)) is None, "allowlisted running stack stopped")
check(act(container("exited", "billing", finished=500)) is None, "allowlisted stopped stack removed")
check(act(container("running", started=30, name="kms-dev")) is None, "allowlisted name stopped")
check(act(container("exited", finished=100, name="buildx_buildkit_default0")) is None, "pattern not honoured")
check(act(container("exited", finished=100, name="tidy_torvalds"))[0] == "rm", "an unlisted name was kept")

# A plain test container: stopped past 6 h, removed 24 h after it stopped.
check(act(container("running", "e2e-run9", started=7))[0] == "stop", "long runner not stopped")
check(act(container("running", "e2e-run9", started=5)) is None, "runner under 6 h stopped")
check(act(container("exited", "api-tests", finished=25))[0] == "rm", "old exited container kept")
check(act(container("exited", "api-tests", finished=23)) is None, "exited under 24 h removed")
check(act(container("dead", finished=30))[0] == "rm", "dead container kept")
check(act(container("running", policy="", started=7))[0] == "stop", "empty restart policy not treated as no")

# Never started: its creation time counts.
created = container("created", "x"); created["State"]["FinishedAt"] = "0001-01-01T00:00:00Z"; created["Created"] = stamp(30)
check(act(created)[0] == "rm", "created-only container kept")

# A service (any restart policy) is kept in every state: a stopped one was stopped on purpose.
check(act(container("running", policy="unless-stopped", started=500)) is None, "running service stopped")
check(act(container("exited", policy="unless-stopped", finished=500)) is None, "stopped service removed with its data")
check(act(container("exited", policy="always", finished=500)) is None, "stopped service removed with its data")

# Paused or restarting: still running, never stopped or removed.
check(act(container("paused", started=500)) is None, "paused container acted on")
check(act(container("restarting", started=500)) is None, "restarting container acted on")

# Docker's timestamps: 0-9 fraction digits, Z, an offset or none.
for value in ("2026-11-08T10:00:00Z", "2026-11-08T10:00:00.1Z", "2026-11-08T10:00:00.12345Z",
              "2026-11-08T10:00:00.123456789Z", "2026-11-08T11:00:00.5+01:00", "2026-11-08T10:00:00"):
    parsed = when(value)
    check(parsed.tzinfo is not None and abs(parsed - datetime(2026, 11, 8, 10, tzinfo=timezone.utc)) < timedelta(seconds=1),
          f"timestamp {value} misread")
check(when("0001-01-01T00:00:00Z") is None, "zero time not treated as unset")

# Allowlist: comments go, inline or indented; patterns stay.
allow = read_allowlist("# header\nmy-project  # its database\n   # indented comment\n\nbuildx_buildkit_*\n")
check(allow == {"my-project", "buildx_buildkit_*"}, f"allowlist misread: {allow}")
check(container_action(container("exited", "my-project", finished=100), NOW, allow) is None, "commented entry lost its protection")

# Volumes: only an unattached, unmounted, anonymous one older than a day, not labelled allowlisted.
vol = lambda **kw: {"Name": HEX, "CreatedAt": stamp(25), "Labels": None, **kw}
check(volume_due(vol(), {HEX}, set(), NOW, ALLOW), "old anonymous volume kept")
check(not volume_due(vol(CreatedAt=stamp(23)), {HEX}, set(), NOW, ALLOW), "young volume removed")
check(not volume_due(vol(), set(), set(), NOW, ALLOW), "attached volume removed")
check(not volume_due(vol(), {HEX}, {HEX}, NOW, ALLOW), "volume a container mounts removed")
check(not volume_due(vol(Labels={"com.docker.compose.project": "billing"}), {HEX}, set(), NOW, ALLOW), "allowlisted volume removed")
check(not volume_due({"Name": "go-build-cache", "CreatedAt": stamp(500)}, {"go-build-cache"}, set(), NOW, ALLOW), "named volume removed")


class FakeDocker:
    """The runtime as the reaper sees it; records every call and can fail chosen ones."""

    def __init__(self, containers, volumes=(), gone=(), refuse=(), clock=None):
        self.containers = {c["Id"]: c for c in containers}
        self.volumes = {v["Name"]: v for v in volumes}
        self.gone = set(gone)      # listed, but gone by the time it is inspected
        self.refuse = set(refuse)  # inspected fine, but the action on it fails
        self.clock = clock
        self.calls = []

    def __call__(self, *args):
        self.calls.append(args)
        if args[:1] == ("info",):
            if self.clock is None:
                raise RuntimeError("no SystemTime")
            return json.dumps(self.clock)
        if args[:1] == ("ps",):
            return "\n".join(self.containers)
        if args[:2] in (("container", "inspect"), ("volume", "inspect")):
            pool = self.containers if args[0] == "container" else self.volumes
            ids = args[2:]
            if any(i in self.gone for i in ids):
                if len(ids) == 1:
                    raise RuntimeError(f"no such object: {ids[0]}")
                raise RuntimeError("one of the batch is gone")
            return json.dumps([pool[i] for i in ids])
        if args[:2] == ("volume", "ls"):
            return "\n".join(self.volumes)
        if args[-1] in self.refuse:
            raise RuntimeError(f"cannot act on {args[-1]}")
        return ""


def reap(fake, live=True):
    log = Path(tempfile.mkdtemp()) / "reaper.log"
    r = Reaper(live=live, docker=fake, log_path=log)
    r.now = NOW
    r.run(ALLOW)
    return r, log.read_text()


old = [container("exited", finished=30, name=f"old{i}", cid=f"id{i}") for i in range(3)]

# One container that can't be removed doesn't stop the others, the volumes or the summary.
r, text = reap(FakeDocker(old, [vol()], refuse={"id1"}))
removed = [a[-1] for a in r.docker.calls if a[:1] == ("rm",)]
check(removed == ["id0", "id1", "id2"], f"run stopped at a failure: {removed}")
check(("volume", "rm", HEX) in r.docker.calls, "volumes skipped after a container failed")
check("done: 0 stopped, 2 containers and 1 volumes removed, 1 failed" in text, f"summary wrong:\n{text}")

# A container gone between `ps` and `inspect` costs only itself, not its batch: inspecting
# id1 fails, the batch is read one by one, and id0 and id2 are still removed.
r, text = reap(FakeDocker(old, gone={"id1"}))
removed = [a[-1] for a in r.docker.calls if a[:1] == ("rm",)]
check("id0" in removed and "id2" in removed, f"batch lost when one inspect failed: {removed}")
check("skipped container id1" in text, "the vanished container wasn't named")

# The runtime's clock decides ages: a VM clock 20 h behind keeps a 30 h-old container.
r, text = reap(FakeDocker(old[:1], clock=(NOW - timedelta(hours=20)).strftime("%Y-%m-%dT%H:%M:%SZ")))
check(not any(a[:1] == ("rm",) for a in r.docker.calls), "ages measured on the wrong clock")

# Work that was skipped counts as failed: a volume pass that never ran must not look clean.
class NoVolumeList(FakeDocker):
    def __call__(self, *args):
        if args[:2] == ("volume", "ls"):
            self.calls.append(args)
            raise RuntimeError("volume ls refused")
        return super().__call__(*args)


r, text = reap(NoVolumeList(old[:1]))
check(r.failed == 1 and "1 failed" in text, f"a failed volume pass logged as clean:\n{text}")
broken = container("exited", finished=30, name="broken", cid="bad1"); del broken["State"]
r, text = reap(FakeDocker([broken]))
check(r.failed == 1 and "unreadable record" in text, f"an unreadable container record logged as clean:\n{text}")

# A supervised test scope acts only on matching names, ignores ages, and never prunes cache.
young = container("exited", finished=0.1, name="reaper-livetest-1", cid="live1")
log = Path(tempfile.mkdtemp()) / "reaper.log"
r = Reaper(live=True, docker=FakeDocker(old + [young]), log_path=log, scope="reaper-livetest-*")
r.now = NOW
r.run(ALLOW)
check([a[-1] for a in r.docker.calls if a[:1] == ("rm",)] == ["live1"], "scope acted outside its names or kept a young match")
check(not any(a[:2] == ("builder", "prune") for a in r.docker.calls), "scoped test run pruned the build cache")

# A dry run acts on nothing.
r, text = reap(FakeDocker(old, [vol()]), live=False)
check(not any(a[:1] in (("rm",), ("stop",)) or a[:2] in (("volume", "rm"), ("builder", "prune")) for a in r.docker.calls), "dry run acted")
check("[dry] removed container old0" in text, "dry run didn't log what it would do")

print(f"reaper: all {cases} cases pass")
