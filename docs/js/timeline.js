(async function () {
  "use strict";
  const track = document.getElementById("tl-track");
  const legend = document.getElementById("tl-legend");
  let data;
  try { data = await BB.fetchJSON("content/timeline.json"); }
  catch { track.innerHTML = "<p style='padding:2rem'>timeline.json missing.</p>"; return; }

  const dots = { regulation: "violet", crisis: "red", competition: "gold", technology: "green" };
  legend.innerHTML = Object.entries(data.themes)
    .map(([k, label]) => `<span><span class="dot ${dots[k] === "red" ? "" : dots[k]}" style="${dots[k] === "red" ? "background:var(--red)" : ""}"></span>${BB.esc(label)}</span>`)
    .join("");

  const events = [...data.events].sort((a, b) => a.year - b.year);
  track.innerHTML = events
    .map(
      (e) => `<a class="tl-event ${BB.esc(e.theme)}" href="module.html?id=${e.moduleId}">
        <div class="yr">${BB.esc(e.date || String(e.year))}</div>
        <div class="theme">${BB.esc(data.themes[e.theme] || e.theme)}</div>
        <h3>${BB.esc(e.title)}</h3>
        <p>${BB.esc(e.text)}</p>
      </a>`
    )
    .join("");
})();
