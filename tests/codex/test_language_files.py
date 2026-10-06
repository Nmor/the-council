"""Compile extracted guidance and exercise failures against private filesystem state."""

import os
import re
import shutil
import subprocess
import tempfile
import textwrap
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def fenced(relative: str, language: str) -> list[str]:
    text = (ROOT / relative).read_text(encoding="utf-8")
    return re.findall(r"```" + re.escape(language) + r"\n(.*?)\n```", text, re.DOTALL)


def execute(arguments: list[str], directory: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        arguments,
        cwd=directory,
        text=True,
        capture_output=True,
        check=False,
        timeout=90,
    )


class LanguageFilesTests(unittest.TestCase):
    def tool(self, name: str) -> str:
        result = shutil.which(name)
        if not result:
            if os.environ.get("COUNCIL_REQUIRE_LANGUAGE_TOOLS") == "1":
                self.fail(f"Required compiler unavailable: {name}")
            self.skipTest(f"Compiler unavailable: {name}")
        assert result is not None
        return result

    def successful(self, arguments: list[str], directory: Path) -> str:
        result = execute(arguments, directory)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return result.stdout

    def test_cpp_containment_and_insecure_negative_control(self) -> None:
        compiler = self.tool("clang++")
        snippet = next(
            value
            for value in fenced("rules-library/cpp/security.md", "cpp")
            if "compare path components" in value
        ).split("// CORRECT — compare path components in a trusted, immutable tree", 1)[
            1
        ]
        with tempfile.TemporaryDirectory(prefix="council-cpp-") as scratch:
            directory = Path(scratch)
            base, sibling = directory / "vault", directory / "vault-sibling"
            base.mkdir()
            sibling.mkdir()
            self.assertGreater((base / "allowed").write_text("inside\n", encoding="utf-8"), 0)
            self.assertGreater((sibling / "outside").write_text("outside\n", encoding="utf-8"), 0)
            (base / "link").symlink_to(sibling / "outside")
            prefix = """
#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
int main(int argc, char* argv[]) {
    if (argc != 3) return 2;
    std::filesystem::path base_dir(argv[1]), user_input(argv[2]);
    try {
"""
            suffix = """
        std::string value;
        if (!std::getline(f, value)) return 3;
        std::cout << value << "\n";
        return 0;
    } catch (const std::exception&) { return 1; }
}
""".replace('<< "\n"', '<< "\\n"')
            source, binary = directory / "containment.cpp", directory / "containment"
            self.assertGreater(source.write_text(prefix + snippet + suffix, encoding="utf-8"), 0)
            self.successful(
                [
                    compiler,
                    "-std=c++20",
                    "-Wall",
                    "-Wextra",
                    "-Werror",
                    str(source),
                    "-o",
                    str(binary),
                ],
                directory,
            )
            self.assertEqual(
                self.successful([str(binary), str(base), "allowed"], directory),
                "inside\n",
            )
            for name in (
                "../vault-sibling/outside",
                "link",
                str(sibling / "outside"),
                "missing",
            ):
                with self.subTest(path=name):
                    result = execute([str(binary), str(base), name], directory)
                    self.assertEqual(
                        result.returncode, 1, result.stdout + result.stderr
                    )
                    self.assertEqual(result.stdout, "")
            insecure = """
const auto base = std::filesystem::canonical(base_dir);
const auto requested = std::filesystem::canonical(base / user_input);
if (requested.string().find(base.string()) != 0) throw std::runtime_error("outside");
std::ifstream f(requested);
if (!f) throw std::runtime_error("open failed");
"""
            self.assertGreater(
                source.write_text(
                    prefix + textwrap.indent(insecure, "        ") + suffix
                , encoding="utf-8"),
                0,
            )
            self.successful(
                [
                    compiler,
                    "-std=c++20",
                    "-Wall",
                    "-Wextra",
                    "-Werror",
                    str(source),
                    "-o",
                    str(binary),
                ],
                directory,
            )
            result = execute(
                [str(binary), str(base), "../vault-sibling/outside"], directory
            )
            self.assertEqual(result.returncode, 0)
            self.assertEqual(result.stdout, "outside\n")

    def test_swift_failed_writes_preserve_cache_and_corruption(self) -> None:
        compiler = self.tool("swiftc")
        actor = fenced(
            "skills/swift-actor-persistence/references/actor-repository.md", "swift"
        )[0]
        fixture = r"""
struct Item: Codable, Identifiable, Sendable { let id: String; let value: String }
enum FixtureError: Error { case invariant }
@main struct Fixture {
    static func require(_ condition: Bool) throws {
        if !condition { throw FixtureError.invariant }
    }
    static func main() async throws {
        let root = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
        let missing = root.appendingPathComponent("missing", isDirectory: true)
        let failing = try LocalRepository<Item>(directory: missing)
        var failed = false
        do { try await failing.save(Item(id: "new", value: "undurable")) }
        catch { failed = true }
        try require(failed)
        try require(await failing.find(by: "new") == nil)
        let healthy = try LocalRepository<Item>(directory: root, filename: "healthy.json")
        try await healthy.save(Item(id: "control", value: "durable"))
        let reloaded = try LocalRepository<Item>(directory: root, filename: "healthy.json")
        try require(await reloaded.find(by: "control")?.value == "durable")
        let file = root.appendingPathComponent("healthy.json")
        try FileManager.default.removeItem(at: file)
        try FileManager.default.createDirectory(at: file, withIntermediateDirectories: false)
        failed = false
        do { try await healthy.delete("control") } catch { failed = true }
        try require(failed)
        try require(await healthy.find(by: "control")?.value == "durable")
        for (name, contents) in [("corrupt.json", "bad-json"),
                                 ("duplicate.json", "[{\"id\":\"same\",\"value\":\"1\"},{\"id\":\"same\",\"value\":\"2\"}]")] {
            let url = root.appendingPathComponent(name)
            let before = Data(contents.utf8)
            try before.write(to: url)
            failed = false
            do { let repository = try LocalRepository<Item>(directory: root, filename: name)
                 let unexpectedCount = await repository.loadAll().count
                 print("Unexpected repository initialized with \(unexpectedCount) items")
            } catch { failed = true }
            try require(failed)
            let after = try Data(contentsOf: url)
            try require(after == before)
        }
        failed = false
        do { let repository = try LocalRepository<Item>(directory: root, filename: "../escape")
             let unexpectedCount = await repository.loadAll().count
                 print("Unexpected repository initialized with \(unexpectedCount) items")
        } catch { failed = true }
        try require(failed)
        print("durability-controls-passed")
    }
}
"""
        with tempfile.TemporaryDirectory(prefix="council-swift-") as scratch:
            directory = Path(scratch)
            source, binary = directory / "repository.swift", directory / "repository"
            self.assertGreater(
                source.write_text("import Foundation\n" + actor + fixture, encoding="utf-8"), 0
            )
            options = [
                compiler,
                "-swift-version",
                "6",
                "-strict-concurrency=complete",
                "-warnings-as-errors",
                "-parse-as-library",
                str(source),
                "-o",
                str(binary),
            ]
            self.successful(options, directory)
            self.assertIn(
                "durability-controls-passed",
                self.successful([str(binary), str(directory)], directory),
            )
            mutant = actor.replace(
                "try persistToFile(candidate)\n        cache = candidate",
                "cache = candidate\n        try persistToFile(candidate)",
            )
            self.assertNotEqual(mutant, actor)
            self.assertGreater(
                source.write_text("import Foundation\n" + mutant + fixture, encoding="utf-8"), 0
            )
            self.successful(options, directory)
            result = execute([str(binary), str(directory)], directory)
            self.assertNotEqual(
                result.returncode, 0, "Failed-write mutation escaped the invariant"
            )

    def test_rpc_rejects_application_and_transport_failures(self) -> None:
        node = self.tool("node")
        snippet = next(
            value
            for value in fenced(
                "skills/backend-patterns/references/database.md", "typescript"
            )
            if "createMarketWithPosition" in value
        )
        tools = Path(
            os.environ.get(
                "COUNCIL_TEST_NODE_MODULES", ROOT / "tests/test-tools/node_modules"
            )
        )
        compiler = tools / "typescript/bin/tsc"
        if not compiler.is_file():
            if os.environ.get("COUNCIL_REQUIRE_LANGUAGE_TOOLS") == "1":
                self.fail("Required TypeScript compiler fixture unavailable")
            self.skipTest("TypeScript compiler fixture unavailable")
        prefix = """
type CreateMarketDto = Record<string, unknown>;
type CreatePositionDto = Record<string, unknown>;
let response: {data: {success?: unknown} | null; error: unknown};
const supabase = {rpc: async (_name: string, _payload: unknown) => response};
"""
        fixture = """
async function verify() {
  response = {data: {success: true}, error: null};
  if ((await createMarketWithPosition({}, {})).success !== true) throw new Error('success control');
  for (const failure of [
    {data: null, error: null}, {data: {}, error: null},
    {data: {success: false}, error: null}, {data: {success: 'true'}, error: null},
    {data: null, error: {message: 'transport'}},
  ]) {
    response = failure;
    let rejected = false;
    try { await createMarketWithPosition({}, {}); } catch { rejected = true; }
    if (!rejected) throw new Error('Failure resolved as success');
  }
  console.log('rpc-controls-passed');
}
verify().catch(error => { console.error(error); throw error; });
"""
        with tempfile.TemporaryDirectory(prefix="council-rpc-") as scratch:
            directory = Path(scratch)
            source = directory / "rpc.ts"
            self.assertGreater(source.write_text(prefix + snippet + fixture, encoding="utf-8"), 0)
            options = [
                node,
                str(compiler),
                "--strict",
                "--target",
                "ES2022",
                "--module",
                "commonjs",
                str(source),
            ]
            self.successful(options, directory)
            self.assertIn(
                "rpc-controls-passed",
                self.successful([node, str(directory / "rpc.js")], directory),
            )
            mutant = snippet.replace(
                "error || !data || data.success !== true", "error || !data"
            )
            self.assertNotEqual(snippet, mutant)
            self.assertGreater(source.write_text(prefix + mutant + fixture, encoding="utf-8"), 0)
            self.successful(options, directory)
            result = execute([node, str(directory / "rpc.js")], directory)
            self.assertNotEqual(
                result.returncode,
                0,
                "Application-failure mutation escaped the invariant",
            )


if __name__ == "__main__":
    unittest.main()
