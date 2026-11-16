"""Shell fixtures recognize supported Git layouts without selecting WSL."""

from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import shell_support


class ShellSupportTests(unittest.TestCase):
    def test_windows_git_layouts(self) -> None:
        for git_relative in ("cmd/git.exe", "bin/git.exe", "mingw64/bin/git.exe"):
            for bash_relative in ("bin/bash.exe", "usr/bin/bash.exe"):
                with self.subTest(git=git_relative, bash=bash_relative), tempfile.TemporaryDirectory() as directory:
                    root = Path(directory) / "Git with spaces"
                    git = root / git_relative
                    git.parent.mkdir(parents=True)
                    git.touch()
                    # A real Git installation includes its cmd entry point.
                    entry = root / "cmd/git.exe"
                    entry.parent.mkdir(parents=True, exist_ok=True)
                    entry.touch()
                    bash = root / bash_relative
                    bash.parent.mkdir(parents=True, exist_ok=True)
                    bash.touch()
                    with patch.object(shell_support.sys, "platform", "win32"), \
                         patch.object(shell_support.shutil, "which", return_value=str(git)):
                        self.assertEqual(Path(shell_support.bash_path()).resolve(), bash.resolve())

    def test_windows_refuses_unavailable_git_shell(self) -> None:
        with patch.object(shell_support.sys, "platform", "win32"), \
             patch.object(shell_support.shutil, "which", return_value=None):
            with self.assertRaisesRegex(FileNotFoundError, "WSL"):
                shell_support.bash_path()

    def test_temporary_home_is_native_and_posix(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            environment = shell_support.shell_environment(home)
            self.assertEqual(environment["HOME"], home.as_posix())
            self.assertEqual(environment["USERPROFILE"], str(home))
            self.assertEqual(environment["COUNCIL_PYTHON"], Path(shell_support.sys.executable).as_posix())


if __name__ == "__main__":
    unittest.main()
