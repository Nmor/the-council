# frontend-patterns: Visual design quality

> Size budget: 8 KB. Detailed guidance loads on demand from the reference map.

## Design from the brief

Before changing UI, understand its purpose, audience, existing brand, task hierarchy
and constraints. Choose a direction that serves them. Distinctiveness matters when it
supports the product; familiarity and density can be valuable for operational tools.
Use [brand creative direction](../../brand-creative-direction/SKILL.md) for a broader
identity or campaign brief. An existing design does not need a redesign on every task.

## Typography and color

Use established type and color tokens where available. Common fonts such as Inter,
Roboto, Arial and system fonts are valid when they fit the brief, language coverage,
licensing, readability and performance needs. Add distinctive display typography only
when it improves hierarchy and identity. Check real content and intended device sizes.

Use a coherent semantic palette and verify contrast for text, controls and states.
Brand colors and gradients are acceptable when appropriate. Define raw values at the
project's token layer when it has one; respect repository conventions. Implement only
the themes required by the product. Do not claim a palette performs better without data.

## Composition, motion and detail

Prioritize clear reading order, useful hierarchy, spacing and responsive behavior.
Conventional grids and layouts can fit a task well. Use asymmetry, overlap, decoration
or dense composition only when they preserve understanding and operation. Visual effects
are optional; avoid adding dependencies or costly effects merely to appear distinctive.

Motion should clarify changes, feedback or transitions. Respect reduced motion and
keyboard/touch behavior; preserve a usable static state. Choose CSS or an existing
library based on actual needs. Avoid decorative delay and hover-only information.

## Inspect the result

Review representative content, small/large layouts, required themes, loading/empty/error
states, focus and accessibility. Inspect the rendered artifact using available tools;
source inspection is not visual verification. Match implementation effort to the brief.
Report unverified cases. Reject fabricated testimonials or metrics, unreadable type,
inconsistent tokens, inaccessible interactions and design choices unsupported by context.
