(async function () {
  "use strict";
  const grid = document.getElementById("gloss-grid");
  let g;
  try { g = await BB.fetchJSON("content/glossary.json"); }
  catch { grid.innerHTML = "<p>glossary.json missing — run the build script.</p>"; return; }

  const entries = Object.entries(g.terms).sort((a, b) => a[1].term.localeCompare(b[1].term));
  document.getElementById("gloss-count").textContent = entries.length;

  grid.innerHTML = entries
    .map(([slug, e]) => {
      const mentions = (e.mentions || [])
        .slice(0, 4)
        .map((m) => `<a href="${BB.esc(m.href)}">↳ ${BB.esc(m.label)}</a>`)
        .join("");
      return `<div class="gloss-item" id="${BB.esc(slug)}">
        <dt>${BB.esc(e.term)}</dt>
        <dd>${BB.esc(e.definition)}</dd>
        ${mentions ? `<div class="g-links">${mentions}</div>` : ""}
      </div>`;
    })
    .join("");

  if (location.hash) {
    const el = document.getElementById(location.hash.slice(1));
    if (el) { el.scrollIntoView(); el.style.borderTopColor = "var(--gold)"; }
  }
})();
