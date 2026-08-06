// Cross-reference engine: hover/tap on .xref spans shows a mono definition
// card with links to every section that mentions the term.
// Data: content/glossary.json  { terms: { slug: {term, definition, related, mentions:[{href,label}]} } }
(function () {
  "use strict";
  const card = document.getElementById("xref-card");
  if (!card) return;

  let glossary = null;
  async function ensure() {
    if (glossary) return glossary;
    try { glossary = await BB.fetchJSON("content/glossary.json"); }
    catch { glossary = { terms: {} }; }
    return glossary;
  }

  let hideTimer = null;

  async function show(span) {
    const slug = span.dataset.term;
    const g = await ensure();
    const entry = g.terms[slug];
    if (!entry) return;

    let links = "";
    const mentions = (entry.mentions || []).slice(0, 6);
    if (mentions.length) {
      links = mentions.map((m) => `<a href="${BB.esc(m.href)}">${BB.esc(m.label)}</a>`).join("");
    }
    const related = (entry.related || [])
      .filter((r) => g.terms[r])
      .slice(0, 4)
      .map((r) => `<a href="glossary.html#${BB.esc(r)}">↔ ${BB.esc(g.terms[r].term)}</a>`)
      .join("");

    card.innerHTML = `
      <div class="xc-term">${BB.esc(entry.term)}</div>
      <div class="xc-def">${BB.esc(entry.definition)}</div>
      ${links || related ? `<div class="xc-links">${links}${related}</div>` : ""}
    `;
    const rect = span.getBoundingClientRect();
    card.classList.add("open");
    const cw = card.offsetWidth;
    let left = rect.left + window.scrollX;
    if (left + cw > window.scrollX + window.innerWidth - 16) {
      left = window.scrollX + window.innerWidth - cw - 16;
    }
    card.style.left = left + "px";
    card.style.top = rect.bottom + window.scrollY + 8 + "px";
  }

  function hideSoon() {
    hideTimer = setTimeout(() => card.classList.remove("open"), 220);
  }

  document.addEventListener("mouseover", (e) => {
    const span = e.target.closest(".xref");
    if (span) { clearTimeout(hideTimer); show(span); }
  });
  document.addEventListener("mouseout", (e) => {
    if (e.target.closest(".xref")) hideSoon();
  });
  card.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  card.addEventListener("mouseleave", hideSoon);
  // tap on mobile
  document.addEventListener("click", (e) => {
    const span = e.target.closest(".xref");
    if (span) { e.preventDefault(); clearTimeout(hideTimer); show(span); }
    else if (!card.contains(e.target)) card.classList.remove("open");
  });
})();
