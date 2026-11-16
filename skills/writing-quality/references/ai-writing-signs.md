# Signs of AI writing — full catalog (reference)

> Adapted 2026-11-15 from Wikipedia's essay "Wikipedia:Signs of AI writing"
> (WikiProject AI Cleanup; CC-BY-SA 4.0; descriptive, not prescriptive).
> Production rules live in ../SKILL.md. This reference keeps the fuller
> detection catalog and its false-positive caveats for review work.

## Content-level signs

- Significance inflation: "stands/serves as", "testament", "pivotal",
  "turning point", "setting the stage", "indelible mark".
- Influence claims: "has shaped conversations/debates about".
- Notability padding: outlet lists ("featured in Vogue, Wired, ...");
  "identified/listed as" framings from primary profiles.
- Superficial analysis: trailing "-ing" clauses ("highlighting",
  "underscoring", "reflecting") attached to facts, or to named sources that
  never said it (RAG misattribution).
- Vague association: "associated with", "in connection with".
- Weasel attribution: "experts argue", "observers have cited", "industry
  reports", "widely interpreted as".
- Formula conclusions: "Despite its..., faces challenges..."; "Future
  Outlook" sections; "In summary" restatements.
- "Awards and recognition" as a near-ubiquitous section title.

## Language signs

- AI vocabulary clusters (several together, not one): delve, tapestry,
  landscape, robust, vibrant, crucial, meticulous, interplay, fostering,
  showcasing, boasts, bolstered, garner, pivotal, underscore, enduring,
  intricate, enhance, highlight, valuable, align with, additionally; newer
  cohorts add challenge, leverage, multifaceted, prioritize, quietly,
  universally; Grok favors causal, empirical, correlate.
- Copula avoidance: "serves as / stands as / marks / represents / features /
  boasts / offers / refers to" in place of is/has.
- Negative parallelisms: "not just X, but Y"; "not X, but Y"; habitual
  "Y rather than X".
- Leads defining generic titles as proper nouns ("X refers to the...").
- Rule of three everywhere, including edit summaries.
- Uniform 8-20-word sentences punctuated only with commas and periods.

## Style and markup signs

- Title Case headings; bold abuse; emoji in headings; curly quotes where
  straight belong; Markdown syntax leaking into non-Markdown contexts;
  exposed internals like "contentReference[oaicite:...]" (unambiguous).

## Chat leakage and placeholders

- "I hope this helps", "Certainly!", "Would you like...", "let me know",
  "delete this section before submission".
- Placeholders: "[Add your URL here]", "2025-XX-XX", "INSERT_SOURCE_URL",
  example.com stand-ins left in deliverables.
- Hedging disclaimers: "details are scarce/not widely documented", "based on
  available information", "it's important to note", "does not by itself
  establish", "should not be confused with" (unprompted).

## Citation signs

- Dead links absent from archives; invalid DOIs/ISBNs; DOIs resolving to
  unrelated papers; book cites without page numbers; declared-but-unused
  references; `utm_source=chatgpt.com|openai|copilot.com`, `referrer=grok.com`
  (proves tool use, not authorship).

## Signs of human writing (affirmative)

- Pre-2022-11-30 text rules out LLM authorship.
- Plain is/has syntax, plain synonyms, definite superlatives, honest
  qualifiers ("perhaps", "very"), wordy-but-human phrases.
- Ability to explain one's own editorial choices, including mistakes.

## False-positive caveats (do not over-read)

- One or two tell-words are coincidence; the signal is density.
- Humans write negative parallelisms and triads (myth-busting listicles).
- Perfect grammar, formal prose, transition words, em dashes, bland prose:
  all ineffective indicators on their own.
- Detectors (GPTZero etc.) have non-trivial error rates; a percentage is not
  evidence. Human judgment averages near chance without training.
- Broken links rot naturally; placeholder dates can be human templates;
  "has been featured" (present perfect) is not a copula sign.
- These patterns are *more common* in LLM output — never always-AI, never
  never-human. Address the underlying content defect, not the marker.
