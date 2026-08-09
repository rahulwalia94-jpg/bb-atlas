# BB Atlas

A personal mastery platform for **UK Business Banking, the competitive landscape, and SME impairment mechanics** — written through the impairment lens for a Barclays Business Banking Impairment analyst with a deep retail-credit background.

- **Frontend:** static site (vanilla HTML/CSS/JS), served from `/docs` via GitHub Pages. Works fully offline: all ten modules, quizzes, domino chains, timeline, competitor matrix, glossary and search are baked-in JSON.
- **AI Tutor:** minimal Node/Express proxy in `/server` for Render, exposing `POST /api/ask` against the Anthropic Messages API (`claude-sonnet-4-6`, live web search enabled). The only network feature — everything else degrades gracefully without it.

---

## 1 · Deploy the site (GitHub Pages)

```bash
cd bb-atlas
git init
git add .
git commit -m "BB Atlas v1"
gh repo create bb-atlas --public --source=. --push
```

Then in the repo on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions.**
The included workflow (`.github/workflows/pages.yml`) runs the content QA gate and publishes `/docs` on every push to `main`.

Your site will be at `https://<your-username>.github.io/bb-atlas/`.

> No `gh`? Create an empty repo named `bb-atlas` on github.com, then:
> `git remote add origin https://github.com/<you>/bb-atlas.git && git push -u origin main`

## 2 · Deploy the AI tutor (Render)

1. Sign in at [render.com](https://render.com) → **New → Web Service** → connect the `bb-atlas` repo.
2. Render reads `render.yaml` automatically (root dir `server`, `npm install`, `npm start`, free plan). If configuring manually: **Root Directory** `server`, **Build** `npm install`, **Start** `npm start`.
3. Set two environment variables:
   - `ANTHROPIC_API_KEY` — your key from [platform.claude.com](https://platform.claude.com)
   - `ALLOWED_ORIGIN` — your Pages origin, e.g. `https://<your-username>.github.io` (origin only — no path, no trailing slash)
4. Deploy. Note the service URL, e.g. `https://bb-atlas-tutor.onrender.com`.
5. **Paste that URL into [`docs/js/config.js`](docs/js/config.js):**

```js
window.BB_CONFIG = {
  API_URL: "https://bb-atlas-tutor.onrender.com",
};
```

6. Commit and push — Pages redeploys, and the "Ask deeper" drawer goes live.

> Free-tier Render services sleep after inactivity; the first question after a quiet spell takes ~30s while the service wakes. The tutor panel says so when it happens.

## 2b · Live data & the refresh engine

The **Desk** (`desk.html`), **People** (`people.html`) and **Library** (`library.html`) pages read from `docs/content/live/*.json`:

| File | What it is |
|---|---|
| `live/metrics.json` | Key BB metrics with as-at dates, sources, and value history |
| `live/deltas.json` | The "what changed" log, newest first |
| `live/pipeline.json` | Regulatory pipeline with ECL-impact notes |
| `live/calendar.json` | Results dates, stats releases, MPC dates |
| `live/people.json` / `live/moves.json` | Key people roster + movement feed |
| `live/library.json` | Podcasts, videos, documents, newsletters, data sources |

Two refresh paths:

1. **"Refresh now" button** (Desk page) → calls the Render backend `POST /api/refresh`, which re-verifies metrics via live web search and shows the result immediately (kept in localStorage until baked).
2. **Weekly bake** — `.github/workflows/refresh.yml` runs every Monday 06:00 UTC (or manually via Actions → "Weekly live-data refresh" → Run workflow). It updates `metrics.json`, appends value history, writes the delta log, and commits — Pages redeploys automatically. **Requires a repo secret:** Settings → Secrets and variables → Actions → New repository secret → `ANTHROPIC_API_KEY`. Without the secret the job skips harmlessly.

## 3 · Updating content

All content lives in `docs/content/`:

| File | What it is |
|---|---|
| `modules/module-0.json` … `module-9.json` | The ten modules — sections (HTML), Impairment Lens asides, 10-question quiz, domino chain, glossary terms, sources |
| `master-domino.json` | The hand-curated Master Domino Map connecting all modules |
| `timeline.json` | 1690→2026 timeline events |
| `competitors.json` | The sortable competitor matrix |

After editing any module JSON, rebuild the derived indexes:

```bash
node scripts/build-indexes.mjs
```

This regenerates `modules-index.json`, `glossary.json` (with cross-module mention links), `sources.json`, and `search-index.json`, and runs the QA pass (JSON validity, quiz shape, domino integrity, dangling xref slugs). The CI workflow runs the same script, so a broken edit fails the deploy instead of shipping.

Content conventions are documented in [`content/SPEC.md`](content/SPEC.md).

## 4 · Local preview

Static servers only — `fetch()` needs http, not `file://`:

```bash
cd bb-atlas/docs
python -m http.server 8000
```

Then open http://localhost:8000.

## 5 · Repo layout

```
bb-atlas/
├── docs/                 ← GitHub Pages root
│   ├── index.html        ← module covers + readiness ring
│   ├── module.html       ← module reader (essay, lens boxes, domino, quiz)
│   ├── timeline.html     ← horizontal 1690→2026 timeline
│   ├── compare.html      ← sortable competitor matrix
│   ├── map.html          ← Master Domino Map + per-module chains
│   ├── glossary.html     ← 100+ term glossary
│   ├── sources.html      ← per-module citations
│   ├── css/style.css     ← the design system
│   ├── js/               ← config, chrome, search, tutor, quiz, domino, xref
│   └── content/          ← all lesson JSON (static, offline-first)
├── server/               ← Render backend (Express + Anthropic SDK)
├── scripts/build-indexes.mjs  ← index builder + QA gate
├── content/SPEC.md       ← content schema
├── render.yaml           ← Render blueprint
└── .github/workflows/pages.yml
```

## 6 · Notes

- Time-sensitive figures (scheme stats, market shares, insolvency data, Barclays results) were verified by web search at build time — August 2026 — and cited per module in `sources.json` / the Sources page. Re-verify before quoting in anything that matters.
- Progress (modules read, quiz bests, streak) is `localStorage` only — it never leaves the browser.
- The tutor keeps the last 10 exchanges in `localStorage` and sends them as conversation history with each request.
