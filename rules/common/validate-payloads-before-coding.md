# Contract validation

> Size budget: 2 KB.

For a changed integration, inspect the real producer/consumer schema and representative fixtures
before implementing its boundary. Validate required fields, error cases and version assumptions.
Reuse unchanged verified contracts and keep secrets/customer data out of fixtures. A mocked happy
path alone is not integration proof.

[Reference](../../rules-library/council-detail/validate-payloads-before-coding.md).
