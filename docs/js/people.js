(async function () {
  "use strict";

  // movement feed
  try {
    const data = await BB.fetchJSON("content/live/moves.json");
    document.getElementById("move-feed").innerHTML = data.moves.map((m) => `<li>
      <div class="m-head">
        <span class="m-date">${BB.esc(m.date)}</span>
        <span class="m-person">${BB.esc(m.person)}</span>
        <span class="m-route">${BB.esc(m.role)} · ${BB.esc(m.from)} <span class="arr">→</span> ${BB.esc(m.to)}</span>
      </div>
      <p class="m-signal">${BB.esc(m.signal)}</p>
      ${m.source && m.source.url ? `<div class="m-src"><a href="${BB.esc(m.source.url)}" target="_blank" rel="noopener">↗ ${BB.esc(m.source.title || "source")}</a></div>` : ""}
    </li>`).join("");
  } catch {
    document.getElementById("move-feed").innerHTML = "<li>moves.json missing — data build pending.</li>";
  }

  // roster
  try {
    const data = await BB.fetchJSON("content/live/people.json");
    document.getElementById("ppl-asat").textContent = data.asAt;
    document.getElementById("org-grid").innerHTML = data.institutions.map((inst) => `
      <div class="org-card">
        <h3><span class="dot ${BB.esc(inst.colour || "violet")}"></span>${BB.esc(inst.name)}</h3>
        ${inst.people.map((p) => `<div class="person">
          <div class="p-role">${BB.esc(p.role)}${p.since ? " · since " + BB.esc(p.since) : ""}</div>
          <div class="p-name">${
            p.source && p.source.url
              ? `<a href="${BB.esc(p.source.url)}" target="_blank" rel="noopener">${BB.esc(p.name)}</a>`
              : BB.esc(p.name)
          }</div>
          ${p.note ? `<div class="p-note">${BB.esc(p.note)}</div>` : ""}
        </div>`).join("")}
      </div>`).join("");
  } catch {
    document.getElementById("org-grid").innerHTML = "<p style='padding:2rem'>people.json missing — data build pending.</p>";
  }
})();
