# Finite machine

> Size budget: 1 KB.

The machine is shared and finite, for every agent in every IDE. Starting a project,
running tests and running reviews: check load, memory, swap and disk first; reuse a
running stack rather than start another; one heavy run at a time, workers bounded,
lower priority; reviewers reuse the author's evidence for the same tree. Containers
you start are yours to end: `--rm`, ports on 127.0.0.1, one reused compose project
torn down with `down -v --remove-orphans` on every exit. Never tear down a stack you
reused or a long-lived one. At the task's end remove what you started, confirm none
remains, and list others' leftovers for the owner.
[Reference](../../rules-library/council-detail/resource-discipline.md).
