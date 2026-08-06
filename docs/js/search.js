// Client-side search over content/search-index.json (built by scripts/build-indexes.js).
(function () {
  "use strict";
  const input = document.getElementById("nav-search");
  const pop = document.getElementById("search-pop");
  if (!input || !pop) return;

  let index = null;
  async function ensureIndex() {
    if (index) return index;
    try {
      const base = location.pathname.includes("/") ? "" : "";
      index = await BB.fetchJSON("content/search-index.json");
    } catch { index = { docs: [] }; }
    return index;
  }

  function score(doc, terms) {
    let s = 0;
    const title = doc.title.toLowerCase();
    const text = doc.text.toLowerCase();
    for (const t of terms) {
      if (title.includes(t)) s += 8;
      if (text.includes(t)) s += 2;
      if (title.startsWith(t)) s += 4;
    }
    return s;
  }

  function snippet(text, terms) {
    const lower = text.toLowerCase();
    let pos = -1;
    for (const t of terms) { const i = lower.indexOf(t); if (i >= 0) { pos = i; break; } }
    if (pos < 0) return BB.esc(text.slice(0, 130)) + "…";
    const start = Math.max(0, pos - 50);
    let snip = text.slice(start, start + 160);
    let safe = BB.esc((start > 0 ? "…" : "") + snip + "…");
    for (const t of terms) {
      safe = safe.replace(new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>");
    }
    return safe;
  }

  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(run, 120);
  });
  input.addEventListener("focus", () => { if (pop.innerHTML) pop.classList.add("open"); });
  document.addEventListener("click", (e) => {
    if (!pop.contains(e.target) && e.target !== input) pop.classList.remove("open");
  });

  async function run() {
    const raw = input.value.trim().toLowerCase();
    if (raw.length < 2) { pop.classList.remove("open"); pop.innerHTML = ""; return; }
    const terms = raw.split(/\s+/).filter(Boolean);
    const { docs } = await ensureIndex();
    const hits = docs
      .map((d) => ({ d, s: score(d, terms) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12);
    if (!hits.length) {
      pop.innerHTML = `<a><span class="sr-title" style="color:var(--ink-dim)">No results for “${BB.esc(raw)}”</span></a>`;
    } else {
      pop.innerHTML = hits
        .map(({ d }) => `<a href="${BB.esc(d.href)}">
            <div class="sr-title">${BB.esc(d.title)}</div>
            <div class="sr-meta">${BB.esc(d.where)}</div>
            <div class="sr-snip">${snippet(d.text, terms)}</div>
          </a>`)
        .join("");
    }
    pop.classList.add("open");
  }
})();
