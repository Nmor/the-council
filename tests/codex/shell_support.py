"""Run shell integration fixtures with the native home and Git Bash on Windows."""

import os
from pathlib import Path
import shutil
import sys


def bash_path() -> str:
    if sys.platform == "win32":
        git = shutil.which("git")
        if git:
            for root in list(Path(git).resolve().parents)[1:3]:
                if not ((root / "cmd/git.exe").is_file() or
                        (root / "mingw64/bin/git.exe").is_file()):
                    continue
                for relative in ("bin/bash.exe", "usr/bin/bash.exe"):
                    candidate = root / relative
                    if candidate.is_file():
                        return str(candidate)
        raise FileNotFoundError("Git for Windows Bash is required; WSL Bash is not interchangeable")
    bash = shutil.which("bash")
    if bash is None:
        raise FileNotFoundError("Bash is required for Council shell integration")
    return bash


def shell_environment(home: Path) -> dict[str, str]:
    return {
        **os.environ,
        "HOME": home.as_posix(),
        "USERPROFILE": str(home),
        "COUNCIL_PYTHON": Path(sys.executable).as_posix(),
        "PATH": str(Path(sys.executable).parent) + os.pathsep + os.environ["PATH"],
    }
