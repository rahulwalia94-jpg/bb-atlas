# BB Atlas — Module Content Specification (v1)

Every module is ONE JSON file at:
`C:\Users\Rahul\BB Barclays\bb-atlas\docs\content\modules\module-<N>.json`

The file MUST be valid JSON (UTF-8, no BOM, no trailing commas) with EXACTLY this shape:

```json
{
  "id": 0,
  "slug": "orientation",
  "title": "What Business Banking Actually Is",
  "kicker": "Module 00 · Orientation",
  "summary": "Two to three sentences. Editorial voice. What this module covers and why it matters to a BB impairment analyst.",
  "readingTime": 14,
  "sections": [
    { "id": "s1", "heading": "Section heading", "html": "<p>...</p><p>...</p>" }
  ],
  "quiz": [
    {
      "q": "Question text?",
      "options": ["A", "B", "C", "D"],
      "answer": 2,
      "explain": "Why the correct option is correct and the trap options are wrong. 1–3 sentences."
    }
  ],
  "domino": {
    "title": "Short chain title",
    "nodes": [
      { "id": "n1", "label": "Base rate ↑", "sectionId": "s2" }
    ],
    "edges": [ ["n1", "n2"] ]
  },
  "glossaryTerms": [
    {
      "term": "Bounce Back Loan Scheme",
      "slug": "bbls",
      "definition": "≤60 words, mono-card style: crisp, factual, standalone.",
      "related": ["cbils", "pay-as-you-grow"]
    }
  ],
  "sources": [
    { "title": "Source name", "url": "https://...", "note": "what it supports" }
  ]
}
```

## Hard rules

1. **Length**: total prose across all `sections[].html` = 1,500–3,000 words. 5–9 sections. No filler, no beginner tone — written for a senior credit-risk analyst with 12+ years in retail (mortgages IFRS 9, cards PD/LGD/EAD, collections, model governance) but ZERO business-banking knowledge.
2. **Impairment Lens**: at least 3 `<aside class="lens"><h4>Impairment Lens</h4><p>...</p></aside>` blocks spread through the module. Every major concept must be tied to its ECL consequence — staging, PD/LGD/EAD, coverage, PMAs, P&L charge.
3. **Allowed HTML inside `html`**: `<p> <ul> <ol> <li> <em> <strong> <aside class="lens"> <h4> <blockquote> <span class="xref">` only. NO inline styles, NO scripts, NO headings other than the `<h4>` inside lens asides (section headings come from the `heading` field).
4. **Xrefs**: wrap the FIRST occurrence of each key term in each section as `<span class="xref" data-term="slug">Visible Text</span>`. Use the canonical slugs below for shared terms; invent kebab-case slugs for module-specific terms and define them in `glossaryTerms`.
5. **Quiz**: exactly 10 questions, 4 options each, `answer` = 0-based index, correct answers spread across positions. Test understanding and cause-effect, not trivia recall.
6. **Domino chain**: 7–12 nodes forming a cause→effect graph ending in an ECL/P&L consequence. Node labels ≤ 5 words. Every node's `sectionId` must exist in `sections`. Edges reference existing node ids. Mostly a spine with 1–3 branches.
7. **Glossary**: 8–15 terms per module. Definitions ≤ 60 words, self-contained. You OWN the definitions for terms whose home module is yours (see canonical list); for other modules' terms you may reference the slug in xrefs/related WITHOUT defining it.
8. **Accuracy**: anything time-sensitive (market shares, scheme status, insolvency stats, Barclays results, competitor figures) MUST be verified via WebSearch (load it via ToolSearch `select:WebSearch,WebFetch` first) and cited in `sources` (5–12 sources). Today is August 2026 — "current" means 2025–2026 data. If a figure cannot be verified, phrase it as approximate and say as-at date.
9. **Voice**: dark-editorial magazine prose. Confident, precise, occasionally wry. Cause-and-effect chains spelled out ("what changed → what it did to SME credit supply → what losses followed").
10. Use `£` and UK terminology throughout. Em dashes fine. No markdown inside `html` — real HTML only.

## Canonical shared slugs (home module in brackets — define the term ONLY if it's your module)

bca [0], sme [0], sole-trader [0], asset-finance [0], invoice-finance [0], merchant-acquiring [0], commercial-mortgage [0], overdraft [0],
clearing-banks [1], cruickshank-report [1], competition-commission-2002 [1], big-bang [1], ccc-1971 [1],
project-merlin [2], fls [2], grg [2], irhp [2], cma-2016 [2], bcr [2], incentivised-switching [2], williams-and-glyn [2],
bbls [3], cbils [3], clbils [3], rls [3], growth-guarantee-scheme [3], pay-as-you-grow [3], british-business-bank [3], guarantee-claim [3], self-certification [3],
barclays-uk [4], eagle-labs [4], barclaycard-payments [4], coverage-ratio [4], ara [4],
starling [5], tide [5], allica [5], oaknorth [5], funding-circle [5], iwoca [5], mettle [5], tyl [5], kinetic [5], shawbrook [5], aldermore [5],
relationship-lending [6], transactional-data-lending [6], companies-house [6], sic-code [6], personal-guarantee [6], debenture [6], fixed-charge [6], floating-charge [6], behavioural-scoring [6], open-banking [6], working-capital-cycle [6],
sicr [7], staging [7], stage-2 [7], stage-3 [7], individually-assessed [7], collective-assessment [7], pma [7], overlay [7], low-default-portfolio [7], integral-guarantee [7], watchlist [7], covenant-breach [7], dcf-workout [7], forward-looking-economics [7],
cvl [8], administration [8], cva [8], part-26a [8], moratorium [8], hmrc-preferential [8], business-support-unit [8], insolvency-service [8],
basel-3-1 [9], sme-supporting-factor [9], bank-referral-scheme [9], open-finance [9], app-fraud [9], private-credit [9], bnpl [9],
ecl [7], pd [7], lgd [7], ead [7], ifrs9 [7]

(`ecl`, `pd`, `lgd`, `ead`, `ifrs9` are defined in module 7 with a BB slant — everyone else just xrefs them.)

## Return value

When done, verify your JSON parses (`node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" <file>`), then return one line:
`OK module <N> — <words> words, <sections> sections, <terms> terms, <sources> sources`
