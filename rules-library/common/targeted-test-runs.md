# Running one test, in every stack we review

> Referenced from `review-dimensions.md` § "Mutate, but scope the run". Read it for WHY; this
> file is only the invocation per stack.
>
> **Size budget: 3 KB** — `token-budget.mjs --check`.

A mutation is only worth what the run that checks it costs. Running a whole suite to learn
whether one test fails is the difference between a review that lands in minutes and one that
lands in half an hour: measured on the BFREE comms stack, a DB-backed Go package runs in 500s
and one of its tests in 8s.

Narrow by test FIRST, and by file or package second. A file-scoped run is already most of the
saving when a framework cannot select a single case.

| Stack | One test |
| --- | --- |
| Go | `go test -count=1 -run '^TestName$' ./pkg/` |
| TypeScript / JS (Jest) | `npx jest -t 'test name' path/to/file.test.ts` |
| TypeScript / JS (Vitest) | `npx vitest run -t 'test name' path/to/file.test.ts` |
| Python (pytest) | `pytest 'path/to/test_file.py::TestClass::test_name'` |
| Ruby (RSpec) | `bundle exec rspec path/to/spec.rb -e 'example name'` |
| Ruby (Minitest) | `bundle exec ruby -Itest path/to/test.rb -n test_name` |
| PHP (PHPUnit) | `vendor/bin/phpunit --filter 'testName' path/to/Test.php` |
| PHP (Pest) | `vendor/bin/pest --filter 'test name'` |
| Rust | `cargo test --package pkg test_name -- --exact --nocapture` |
| .NET | `dotnet test --filter 'FullyQualifiedName~Namespace.Class.Method'` |
| Java / Kotlin (Maven) | `mvn test -Dtest='ClassName#methodName'` |
| Java / Kotlin (Gradle) | `./gradlew test --tests 'com.pkg.ClassName.methodName'` |
| Swift (SwiftPM) | `swift test --filter 'TargetTests.ClassName/testMethod'` |
| Dart / Flutter | `flutter test --plain-name 'test name' test/file_test.dart` |
| Elixir | `mix test path/to/test.exs:42` |

## Two things that waste the saving

**A `-run`/`--filter` pattern that matches nothing passes.** Go prints `ok` for a package where
no test matched; several others exit 0 on an empty selection. So the FIRST run of any targeted
command must be against unmutated code, to see it actually run and pass. A green run you never
saw go green proves nothing about the mutation that follows.

**Anchor the pattern.** `-run TestImport` also runs `TestImportBoundary` and twenty others;
`-run '^TestImport$'` runs one. Jest's `-t` and PHPUnit's `--filter` are substring matches by
default too. An unanchored pattern quietly buys back the cost you were avoiding.

## Where a single test genuinely is not enough

Contract, migration and wiring checks often have to run a file or a package: a schema is applied
once per suite, a DI container is built once, a route table is asserted whole. Narrow to the file
and say in the report that you did, rather than running the module and not mentioning it.
