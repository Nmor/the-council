#!/usr/bin/env python3
"""UserPromptSubmit: switch on Council default mode for real requests.

The previous version injected ~960 tokens of mode scripting on EVERY prompt,
including task notifications and one-word replies, so a migration de-registered
it — which also silently removed the only per-request Council trigger: the
owner then had to NAME the Council to get Council behavior. This version
injects one bounded activation block on real prompts and stays silent on
everything else. A prompt hook must never block a prompt: every path exits 0.
"""
import json
import re as _re
import sys

# Slash commands, memorize notes and the explicit '*' opt-out pass untouched.
BYPASS_PREFIXES = ('/', '#', '*')
# System-generated turns are not user requests; re-activating on them is noise.
SYSTEM_MARKERS = ('<task-notification>', '<system-reminder>', '[Request interrupted',
                  '<agent-message', '[Subagent hand-back]')
# A bare acknowledgement ("ok", "yes", "do it") continues the mode already set.
ACK_LIMIT = 12


# Domain detection: most Council domain skills are model-invisible
# (disable-model-invocation), so conversations in their areas never reach them.
# Deterministic keyword routing surfaces the right bench per prompt at zero cost
# on unrelated prompts. Keep sets tight: a false hit injects one wasted line.
DOMAINS = (
    ('business/venture', ('startup', 'business idea', 'venture', 'founder', 'mvp',
      'product-market', 'market fit', 'monetiz*', 'revenue model', 'business model'),
     'entrepreneur, lean-startup, app-market-intel skills; Founder Board seats (council-graham, council-bezos)'),
    ('pricing/offer', ('pricing', 'price point', 'offer', 'upsell', 'conversion rate',
      'churn', 'ltv', 'cac', 'subscription tier'),
     'entrepreneur + finance skills; Founder Board seats (council-hormozi, council-buffett)'),
    ('marketing', ('marketing', 'go-to-market', 'gtm', 'campaign', 'audience',
      'content strategy', 'seo strategy', 'brand voice', 'launch plan'),
     'marketing-strategy, content-campaigns, seo, brand-creative-direction skills; seat council-garyvee'),
    ('hiring/people', ('hiring', 'recruit', 'recruits', 'recruited', 'recruiting',
      'recruitment', 'recruiter', 'recruiters', 'interview process', 'onboarding plan',
      'performance review', 'org design', 'team structure', 'firing someone', 'fire an employee'),
     'hiring-process, performance-management, org-design skills; seats council-leila, council-martell'),
    ('finance/investing', ('valuation', 'investment', 'portfolio', 'cash flow',
      'runway', 'fundraise', 'fundraises', 'fundraised', 'fundraising', 'fundraiser',
      'fundraisers', 'cap table', 'unit economics', 'financial model'),
     'financial-analyst, investment-research, valuation-models, fp-and-a skills; seat council-buffett'),
    ('negotiation', ('negotiate', 'negotiates', 'negotiated', 'negotiating',
      'negotiation', 'negotiations', 'negotiator', 'negotiators',
      'counteroffer', 'term sheet', 'contract terms', 'batna'),
     'negotiation-patterns skill'),
    ('seo/search', ('seo', 'search ranking', 'search traffic', 'organic traffic', 'serp',
      'sitemap', 'search console', 'core web vitals'),
     'seo skill (crawl/index/architecture evidence first); marketing-strategy for the channel strategy'),
    ('writing/comms', ('blog post', 'article', 'announcement', 'press release', 'newsletter copy',
      'documentation page', 'readme', 'release notes', 'email to', 'write a post', 'essay',
      'technical writing', 'copywriting'),
     'writing-quality skill (anti-AI-prose), communication-patterns; comms-reviewer agent for public artifacts'),
    ('ops/manufacturing', ('supply chain', 'manufacture', 'manufactures', 'manufactured',
      'manufacturing', 'manufacturer', 'manufacturers', 'inventory', 'logistics',
      'lean process', 'six sigma'),
     'supply-chain-patterns, lean-manufacturing, six-sigma skills; seat council-wickman'),
)


def _kw_hit(low: str, k: str) -> bool:
    # review M7 (2026-11-15): substring matching misfired ("cache" -> cac,
    # "firing" -> hiring). Single words match on word boundaries; phrases
    # may match as substrings since spaces already bound them.
    if ' ' in k:
        return k in low
    if k.endswith('*'):  # stem: left boundary only ("negotiat*" matches negotiate/negotiation)
        return _re.search(r'\b' + _re.escape(k[:-1]), low) is not None
    return _re.search(r'\b' + _re.escape(k) + r'\b', low) is not None


def domain_hint(text: str) -> str:
    low = text.lower()
    hits = [(name, bench) for name, keys, bench in DOMAINS
            if any(_kw_hit(low, k) for k in keys)]
    if not hits:
        return ''
    lines = '; '.join(f'{name}: load {bench}' for name, bench in hits[:2])
    return (' Domain bench for this request - these are model-invisible, load them '
            'explicitly via the Skill/Agent tools: ' + lines + '.')


ACTIVATION = (
    'Council default mode is ON for this request - it applies to every project '
    'and never needs to be named. Proportionate intake first (trivial: a '
    'sentence; vague: invoke prompt-improver; non-trivial: intake and plan '
    'before the first file mutation). Load the Council skills matching the '
    'files and domains touched; weigh architecture, implementation, quality, '
    'security and testing where they bear; close with the verification gates. '
    'Scale to the task - no division ceremony. Touching a changed external '
    'contract, a platform behavior unverified at its pinned version (CI '
    'runners, OS text defaults, workflow/hook schemas), or an unfamiliar '
    'error: read the current primary docs first and cite what you read '
    '(official-docs-first). An explicit Council mention asks for the deep '
    'protocol (council-protocol skill).'
)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0
    prompt = payload.get('prompt', '') if isinstance(payload, dict) else ''
    if not isinstance(prompt, str):
        return 0
    text = prompt.strip()
    if not text or len(text) <= ACK_LIMIT or text.startswith(BYPASS_PREFIXES):
        return 0
    if any(marker in text for marker in SYSTEM_MARKERS):
        return 0
    print(json.dumps({'hookSpecificOutput': {
        'hookEventName': 'UserPromptSubmit',
        'additionalContext': ACTIVATION + domain_hint(text),
    }}))
    return 0


if __name__ == '__main__':
    sys.exit(main())
