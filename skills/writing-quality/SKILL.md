---
name: writing-quality
description: "Anti-AI-prose discipline for technical and non-technical writing — docs, READMEs, release notes, blog posts, announcements, emails, essays, commit messages. The prose counterpart to frontend-design: kill significance inflation, copula avoidance, weasel attribution, formula endings and AI vocabulary; write with named facts, plain verbs and earned claims. Use when writing or reviewing any prose a human will read."
---

# Writing quality

> Size budget: 8 KB. Production rules for writing, adapted from Wikipedia's
> "Signs of AI writing" field guide (WikiProject AI Cleanup; see
> [references/ai-writing-signs.md](references/ai-writing-signs.md) for the
> full catalog with caveats). These are rules for what to write, not a
> detector: the underlying defect is always the same — generic positivity
> replacing specific fact. Fix the fact, not the surface marker.

## The core rule

Every sentence either states a specific fact, makes an arguable claim with its
evidence, or moves the reader to the next one. A sentence that inflates,
hedges without cause, or restates the previous one gets cut. When in doubt:
what would this sentence say if it had to name a number, a date, a person, or
a concrete behavior?

## Bans (rewrite on sight)

1. **Significance inflation**: "stands as a testament", "pivotal", "marked a
   turning point", "underscores the importance", "indelible mark", "setting
   the stage for". State what happened; let the reader judge weight.
2. **Copula avoidance**: "serves as", "boasts", "features", "represents",
   "refers to" where *is/has* is meant. "The gallery is LAAA's exhibition
   arm", not "serves as LAAA's exhibition space".
3. **Trailing -ing analysis**: "...​, highlighting the team's commitment",
   "...​, reflecting broader trends". Either make the claim a sentence with
   evidence or delete the clause.
4. **Negative parallelism as a crutch**: "not just X, but Y", "it's not X —
   it's Y", habitual "Y rather than X". One per document at most, and only
   when the contrast is the actual point.
5. **Rule-of-three padding**: triads of adjectives or clauses deployed for
   rhythm instead of content ("powerful, flexible, and intuitive").
6. **Weasel attribution**: "experts argue", "observers note", "industry
   reports", "widely regarded". Name the source or drop the claim.
7. **Vague association**: "associated with", "in connection with" when the
   actual role is known. "CTO of ExampleCorp", not "associated with the
   leadership of ExampleCorp".
8. **Formula endings**: the "Despite these challenges... the future looks"
   paragraph; "In summary" restatements; a Challenges/Future Outlook section
   that analysis didn't earn.
9. **Causeless hedging**: "details are scarce", "not widely documented",
   "based on available information", "it's important to note". Hedge only a
   genuinely uncertain claim, and say why it's uncertain.
10. **AI vocabulary clusters**: one of these is a word; several together are a
    tell — delve, tapestry, landscape (abstract), robust, vibrant, crucial,
    meticulous, interplay, fostering, showcasing, leverage, multifaceted,
    prioritize, garner, bolster, enduring, intricate, "quietly". Prefer the
    plain word: use, mix, area, solid, busy, important, careful.
11. **Chat leakage**: "I hope this helps", "Certainly!", "Let me know if...",
    placeholders ("[Add URL here]"), instructions to the reader meant for the
    author. Never in a deliverable.

## Technical writing (docs, READMEs, release notes, commit messages)

- Precision beats enthusiasm: numbers with units, exact versions, exact
  commands, exact error text. "Reduces p99 latency from 240ms to 90ms", never
  "dramatically improves performance".
- Sentence-case headings; bold for UI labels and defined terms only; no emoji
  in headings; code in code spans with the language tagged (markdown-style
  skill governs mechanics).
- Structure follows the reader's task (install → configure → verify), not the
  author's chronology. Lead with what changed and who is affected.
- A limitation stated plainly builds more trust than a strength inflated:
  "does not support Windows" beats "currently optimized for Unix platforms".
- Citations and links: never cite a page you haven't opened; include page
  numbers for books; strip tracking tails (`utm_source=...`) from URLs.

## Non-technical writing (posts, announcements, essays, emails)

- Voice is specificity: a detail only this author would know beats any
  adjective. The taste-skill copy rule applies to prose generally — plain
  words in a voice of their own, no interchangeable marketing register.
- Vary sentence length deliberately; a uniform 8-20-word cadence with only
  commas and periods reads machine-made. Short sentences land points.
- Human markers are allowed and good: plain synonyms ("wrote", not
  "authored"), honest qualifiers ("perhaps", "mostly"), definite judgments.
  Em dashes are fine when they do work — not as the default connector.
- One idea per paragraph; the last sentence of a piece does work (a fact, an
  ask, a date) instead of summarizing what the reader just read.

## Review protocol

Reviewing prose (yours or anyone's): mark every ban-list hit with the rewrite,
not just the objection. Two named-source checks: every attribution resolves to
a real, opened source saying that thing; every list of coverage/awards serves
the reader, not the subject's notability. For public artifacts route through
comms-reviewer; for UI copy, ux-reviewer owns microcopy and this skill owns
the prose register.
