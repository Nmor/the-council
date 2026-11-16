---
name: character-design
description: Design mascots, illustrated characters and avatar systems — concept, silhouette, model sheets, expression sets, consistency rules across sizes and scenes, and production specs (SVG/raster, animation-ready rigs). Use for a mascot, character, avatar, sticker set, or illustrated brand persona.
---

# Character design

> Size budget: 6 KB. Use for mascots, characters, avatars and sticker sets;
> route logos/icons to `ui-ux-pro-max:design`, posters to `canvas-design`,
> brand voice to `brand-creative-direction`.

## Concept before pixels

Interview the brand first: what one trait must the character carry (competent,
playful, calm, mischievous)? Who meets it, where (app empty states, onboarding,
error pages, docs, social), and at what sizes (16 px favicon to hero
illustration)? A character that must shrink to 24 px needs a readable
silhouette, not costume detail. Write a one-line character bio and three
personality adjectives; every later choice is tested against them.

## Silhouette first

Block the character as a flat black shape. It must be recognizable at 32 px
from silhouette alone — distinct head-to-body ratio, one memorable contour
(ears, antenna, tail, hat). If two candidates read the same in silhouette,
they are the same character. Only then add interior construction: simple
geometric volumes (circles/capsules) so other artists — or later sessions —
can redraw it on model.

## Model sheet (the consistency contract)

Produce a model sheet before any scene art:

- **Turnaround**: front, 3/4, side (back if the character animates).
- **Construction**: the underlying shapes with proportions as ratios
  (head = 1 unit; body = 1.5; eyes at 40 % of head height), not pixels.
- **Palette**: 3–5 fills + 1 line color, named tokens tied to the brand
  palette; one dark-mode variant checked on both backgrounds.
- **Expression set**: minimum six — neutral, happy, thinking, error/sad,
  celebrating, asleep/empty — because product surfaces need states, and
  bolting expressions on later breaks the face construction.
- **Do/don't row**: three common off-model mistakes drawn and crossed out.

The model sheet is the deliverable that makes every future generation
consistent; store it with the brand assets and cite it in prompts or vector
edits that produce new poses.

## Production specs

- Master in SVG (flat shapes, no strokes that break when scaled; expand
  strokes before export) or layered source; export sizes the product actually
  uses. Name layers/groups by body part for animation (head, eye-L, arm-R).
- Keep poses on a consistent grid and baseline so characters align in UI slots.
- Sticker/emote sets: constant canvas, constant scale, safe margin ≥ 8 %.
- Accessibility: the character never carries meaning alone — pair state
  expressions with text; respect `prefers-reduced-motion` for animated poses.

## Working with generation models

When generating (image models) rather than drawing (SVG): generate the model
sheet first, then feed it back as the reference for every scene; lock seed and
style descriptors in a reusable prompt block; reject off-model outputs against
the do/don't row rather than accepting drift. Record the final prompt block
beside the model sheet. Original characters only — never derivatives of
existing IP (no "like Clippy/Pikachu but...").

## Quality bar

A character passes when: silhouette reads at 32 px; it is on-model across the
expression set; palette holds in light and dark; it serves a named product
surface (not decoration for its own sake); and a stranger can describe its
personality in the three adjectives you chose without being told.

## Source boundary

[WCAG 2.2](https://www.w3.org/TR/WCAG22/) informs text equivalents and motion
accessibility. Silhouette sizes, expression counts and palette limits above are
Council production heuristics, not requirements from that standard.
