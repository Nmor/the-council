# swift-actor-persistence: Core Pattern

> Covers the actor-backed local repository: the core pattern, its usage, the `@Observable` ViewModel
> wiring, key design decisions, best practices, anti-patterns to avoid, and when to use it. Pointed
> at by the SKILL.md routing row **Actor-based repository — the core pattern**.
>
> **Size budget: 8 KB** — `token-budget.mjs --check`.

## Core Pattern

### Actor-Based Repository

The actor model guarantees serialized access — no data races, enforced by the compiler.

```swift
public actor LocalRepository<T: Codable & Identifiable & Sendable> where T.ID == String {
    public enum RepositoryError: Error {
        case invalidFilename
        case duplicateID(String)
    }
    private var cache: [String: T] = [:]
    private let fileURL: URL

    public init(directory: URL, filename: String = "data.json") throws {
        guard !filename.isEmpty, filename != ".", filename != "..",
              !filename.contains("/"), !filename.contains("\\") else {
            throw RepositoryError.invalidFilename
        }
        self.fileURL = directory.appendingPathComponent(filename)
        // Synchronous load during init (actor isolation not yet active)
        self.cache = try Self.loadSynchronously(from: fileURL)
    }

    // MARK: - Public API

    public func save(_ item: T) throws {
        var candidate = cache
        candidate[item.id] = item
        try persistToFile(candidate)
        cache = candidate
    }

    public func delete(_ id: String) throws {
        var candidate = cache
        candidate[id] = nil
        try persistToFile(candidate)
        cache = candidate
    }

    public func find(by id: String) -> T? {
        cache[id]
    }

    public func loadAll() -> [T] {
        Array(cache.values)
    }

    // MARK: - Private

    private func persistToFile(_ candidate: [String: T]) throws {
        let data = try JSONEncoder().encode(Array(candidate.values))
        try data.write(to: fileURL, options: .atomic)
    }

    private static func loadSynchronously(from url: URL) throws -> [String: T] {
        let data: Data
        do {
            data = try Data(contentsOf: url)
        } catch CocoaError.fileReadNoSuchFile {
            return [:]
        }
        let items = try JSONDecoder().decode([T].self, from: data)
        var result: [String: T] = [:]
        for item in items {
            guard result[item.id] == nil else {
                throw RepositoryError.duplicateID(item.id)
            }
            result[item.id] = item
        }
        return result
    }
}
```

### Usage

All calls are automatically async due to actor isolation:

```swift
let repository = try LocalRepository<Question>(directory: .documentsDirectory)

// Read — fast O(1) lookup from in-memory cache
let question = await repository.find(by: "q-001")
let allQuestions = await repository.loadAll()

// Write — updates cache and persists to file atomically
try await repository.save(newQuestion)
try await repository.delete("q-001")
```

### Combining with @Observable ViewModel

```swift
@Observable
final class QuestionListViewModel {
    private(set) var questions: [Question] = []
    private let repository: LocalRepository<Question>

    init(repository: LocalRepository<Question>) {
        self.repository = repository
    }

    func load() async {
        questions = await repository.loadAll()
    }

    func add(_ question: Question) async throws {
        try await repository.save(question)
        questions = await repository.loadAll()
    }
}
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Actor (not class + lock) | Compiler-enforced thread safety, no manual synchronization |
| In-memory cache + file persistence | Fast reads from cache, durable writes to disk |
| Synchronous init loading | Avoids async initialization complexity |
| Dictionary keyed by ID | O(1) lookups by identifier |
| Generic over `Codable & Identifiable & Sendable` | Values can safely cross actor boundaries |
| Atomic file writes (`.atomic`) | Prevents partial writes on crash |

## Best Practices

- **Use `Sendable` types** for all data crossing actor boundaries
- **Keep the actor's public API minimal** — only expose domain operations, not persistence details
- **Use `.atomic` writes** to prevent data corruption if the app crashes mid-write
- **Persist candidate state before publishing cache**; a failed write leaves reads unchanged.
- **Propagate read/decode failures**; only a missing file means an empty repository.
  Preserve unreadable/corrupt bytes for explicit recovery; duplicate IDs are errors.
  Atomic replacement is not a cross-process transaction or an fsync durability guarantee.
- **Load synchronously in `init`** — async initializers add complexity with minimal benefit for
  local files
- **Combine with `@Observable`** ViewModels for reactive UI updates

## Anti-Patterns to Avoid

- Using `DispatchQueue` or `NSLock` instead of actors for new Swift concurrency code
- Exposing the internal cache dictionary to external callers
- Making the file URL configurable without validation
- Forgetting that all actor method calls are `await` — callers must handle async context
- Using `nonisolated` to bypass actor isolation (defeats the purpose)

## When to Use

- Local data storage in iOS/macOS apps (user data, settings, cached content)
- Offline-first architectures that sync to a server later
- Any shared mutable state that multiple parts of the app access concurrently
- Replacing legacy `DispatchQueue`-based thread safety with modern Swift concurrency
