# Visible failures

> Size budget: 2 KB.

Return or record actionable failure context, preserve error causes, and do not silently drop failed work or malformed data. Handle expected missing optional inputs explicitly. Tests and shell pipelines must retain their real exit status; filtering output must not convert failure into success.

Handle every returned value and error, including in tests. Blank assignments such
as `_, err :=`, `value, _ :=` and `_ =` are forbidden; assert, use, log or propagate
the result. Go's `for _, value := range` is allowed. Read the applicable language
guidance and [common coding rules](../../rules-library/common/coding-style.md)
before editing code. Strict repository lint is required; a hook is not a quality certificate.

For relevant detailed procedures and examples, read
[the reference](../../rules-library/council-detail/no-silent-failures.md).
Do not preload it for unrelated work.
