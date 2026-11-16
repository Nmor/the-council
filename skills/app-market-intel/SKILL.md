---
name: app-market-intel
description: Research app markets with free public sources — estimate app revenue and downloads as labeled ranges, map competitors, read Meta Ad Library creatives, find under-served niches and audit store listings (ASO).
disable-model-invocation: true
---

# App market intelligence

> Size budget: 6 KB. Use for mobile/app market research, competitor analysis,
> niche validation and store-listing (ASO) work. Uses only free public sources;
> no paid intelligence API. Do not load for ordinary coding tasks.

## Sources (all free)

- **App Store / Play Store listing pages** (web): title, subtitle, description,
  screenshots, category, price/IAP tiers, rating average and count, "last updated",
  developer's other apps. Play additionally shows an install bracket (e.g. "1M+").
- **Meta Ad Library** (facebook.com/ads/library, public, no login): every active
  ad an advertiser runs, start dates, versions, and EU/UK reach. It never shows spend.
- **Web search**: press, developer interviews, public investor decks, category
  benchmark reports, top-chart snapshots.
- **User-supplied data**: their own App Store Connect / Play Console exports are
  the only ground truth available; prefer them when offered.

## Estimate revenue and downloads

There is no public per-app revenue feed. Model it, label it, give a range:

1. Anchor downloads: Play install bracket; rating count × a review rate of roughly
   0.5–2 % of downloads; chart position vs. known category benchmarks.
2. Anchor revenue: price × download estimate for paid apps; for IAP/subscription,
   downloads × category conversion norms (commonly 1–5 % to paying) × visible price
   tiers. Note ad-supported revenue separately and more loosely.
3. Report a **range with a stated confidence and the anchors used**, e.g.
   "~50–150k downloads/mo (medium confidence: 4.2k new ratings/mo at 0.5–2 % review
   rate)". Never present a modeled figure as a reported one (no-overclaim).

## Competitor mapping

Search both stores for the problem keywords, not the app name. Collect the top
~10 results plus apps the target's own ads and description compare against.
For each: positioning one-liner, price model, rating count (proxy for scale),
last-updated date (proxy for maintenance), and differentiators visible in the
first three screenshots.

## Ad intelligence

In Meta Ad Library, look up the developer/brand page. Long-running ads (90+ days,
many versions) are the ones that work — summarize their hook, offer, format and
landing destination into an "ad model" the user can brief creatives from.
State only what is shown: counts, durations, reach where published; never spend.

## Niche discovery

Signals of an opening: rising search interest with top apps that are stale
(old last-updated), low rating averages with high rating counts (demand plus
dissatisfaction — mine the 1–2★ reviews for the unmet need), or Play brackets
jumping a tier. Validate a candidate niche with at least two independent signals
before recommending a build; route build-vs-buy framing to `strategy-reviewer`.

## ASO audit

Audit a listing in this order: title/subtitle keyword use and clarity; first
three screenshots (do they state the value proposition without being read
zoomed-in? first one must stand alone); description's first two lines; rating
response hygiene; recent-review themes; whether ad traffic lands on a matching
custom product page. Report concrete rewrites, not scores. For copy and visual
quality, pair with `ux-reviewer`; this skill does not do in-app UI/UX or
revenue optimization — route those to `ux-reviewer` and `finance-reviewer`.

## Discipline

- Every number is an estimate unless it came from the store page or the user's
  own console; always carry the anchor and confidence with it.
- Scraping: read public pages politely (no bulk crawling), respect robots.txt,
  and keep competitor data out of commit history and public repos.
- Record findings in the existing plan with dates — market snapshots go stale;
  reuse a snapshot only while its date still supports the decision.
