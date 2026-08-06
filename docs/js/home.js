// Homepage: module cards + readiness ring.
(async function () {
  "use strict";
  const grid = document.getElementById("module-grid");
  let index;
  try {
    index = await BB.fetchJSON("content/modules-index.json");
  } catch {
    grid.innerHTML = "<p style='padding:2rem;color:var(--ink-dim)'>Module index not built yet — run <code>node scripts/build-indexes.js</code>.</p>";
    return;
  }

  grid.innerHTML = index.modules
    .map((m) => {
      const read = BBProgress.isRead(m.id);
      const q = BBProgress.quizScore(m.id);
      return `<a class="mod-card" href="module.html?id=${m.id}">
        <span class="num">${String(m.id).padStart(2, "0")}</span>
        <h3>${BB.esc(m.title)}</h3>
        <p>${BB.esc(m.summary)}</p>
        <span class="meta">
          <span>${m.readingTime} min</span>
          ${read ? '<span class="done">✓ read</span>' : ""}
          ${q ? `<span class="score">quiz ${q.score}/${q.total}</span>` : ""}
        </span>
      </a>`;
    })
    .join("");

  // readiness ring
  const total = index.modules.length;
  const pct = BBProgress.readiness(total);
  const arc = document.getElementById("ring-arc");
  const C = 2 * Math.PI * 64;
  arc.setAttribute("stroke-dasharray", C);
  requestAnimationFrame(() => {
    arc.style.transition = "stroke-dashoffset 900ms ease";
    arc.setAttribute("stroke-dashoffset", C * (1 - pct / 100));
  });
  document.getElementById("ring-num").textContent = pct + "%";
  document.getElementById("modules-read").textContent = BBProgress.readCount();
  document.getElementById("streak").textContent = `${BBProgress.streak}-day streak`;
})();
