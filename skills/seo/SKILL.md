---
name: seo
description: Audit and improve technical SEO, search intent, site architecture, content, metadata and search measurement using crawl and search evidence.
---

# SEO

> Size budget: 6 KB. Use for search visibility work; do not load for every UI edit.

## Inspect before prescribing

Identify the site, intended public/private sections, target audience, geography,
languages, conversion goal and access to crawl logs or Search Console. Inspect the
requested pages and relevant routing, rendering, robots, sitemaps and metadata code.
Use actual evidence; do not claim to have crawled, inspected Search Console or measured
Core Web Vitals without access. Preserve the established plan and site conventions.

## Diagnose in order

1. **Access and indexability:** HTTP status, redirects, crawl permissions, noindex,
   canonical targets, sitemap URLs and rendered content. robots.txt controls crawling;
   it is not authentication or a reliable way to remove an indexed page. A crawler
   must be allowed to read noindex. Protect private content with access controls.
2. **Site architecture:** reachable pages, descriptive internal links, useful hierarchy,
   duplicate/faceted routes, pagination and retired URLs. Preserve relevant link equity
   with appropriate redirects; do not redirect unrelated pages merely to hide errors.
3. **Intent and content:** identify the task behind each query, evidence for the page's
   purpose, helpful original content, descriptive titles/headings and accurate snippets.
   Prefer maintaining useful pages over mass-generated thin location/keyword pages.
4. **Presentation:** mobile behavior, accessibility, image alternatives, performance
   and Core Web Vitals. Separate lab diagnostics from field data and establish a baseline.
5. **Enhancements:** use supported structured data only for content actually present;
   validate it. Add hreflang when real locale variants need it, with consistent canonical
   and reciprocal references. Do not invent reviews, ratings or business details.

## Make a bounded change plan

For each finding provide the affected URL/template, observed evidence, consequence,
recommended fix, priority, verification and rollback where relevant. Map queries to
useful pages rather than forcing keyword repetition. Explain uncertainty in search
intent if no research is available. Coordinate message claims with
[marketing-strategy](../marketing-strategy/SKILL.md) and public copy with
[content-campaigns](../content-campaigns/SKILL.md).

## Verify and monitor

After authorized changes check response/redirect behavior, raw and rendered metadata,
links, crawl directives and structured data as applicable. Distinguish local checks,
publication, crawling and indexing. Record a Search Console baseline and compare query,
page, country and device segments over appropriate windows; account for seasonality
and other releases. Neither a local test nor sitemap submission proves indexing or
ranking. Do not guarantee position, traffic or a fixed time to improvement.

Use Google Search Central primary guidance for current search behavior:
[SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide),
[robots.txt introduction](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
and [spam policies](https://developers.google.com/search/docs/essentials/spam-policies).
Drafting recommendations does not authorize publishing, buying links or connecting
external tools. Reject deceptive cloaking and scaled content made to manipulate search.
