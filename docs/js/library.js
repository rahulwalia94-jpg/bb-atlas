(async function () {
  "use strict";
  const grid = document.getElementById("lib-grid");
  const chipBar = document.getElementById("chip-bar");
  let data;
  try { data = await BB.fetchJSON("content/live/library.json"); }
  catch { grid.innerHTML = "<p style='padding:2rem'>library.json missing — data build pending.</p>"; return; }

  document.getElementById("lib-asat").textContent = data.asAt;
  document.getElementById("lib-count").textContent = data.items.length;

  const TYPES = ["all", "podcast", "video", "document", "newsletter", "data"];
  let active = "all";

  chipBar.innerHTML = TYPES.map(
    (t) => `<button class="chip${t === "all" ? " on" : ""}" data-t="${t}">${t}${t === "all" ? ` (${data.items.length})` : ` (${data.items.filter((i) => i.type === t).length})`}</button>`
  ).join("");

  chipBar.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    active = chip.dataset.t;
    chipBar.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === chip));
    render();
  });

  function render() {
    const items = data.items.filter((i) => active === "all" || i.type === active);
    grid.innerHTML = items.map((i) => `
      <a class="lib-card" href="${BB.esc(i.url)}" target="_blank" rel="noopener">
        <span class="l-type ${BB.esc(i.type)}">◈ ${BB.esc(i.type)}</span>
        <h3>${BB.esc(i.title)}</h3>
        <span class="l-creator">${BB.esc(i.creator || "")}</span>
        <span class="l-why">${BB.esc(i.why || "")}</span>
        <span class="l-meta">${BB.esc(i.cadence || "")}${
          i.moduleIds && i.moduleIds.length
            ? " · feeds " + i.moduleIds.map((m) => "M" + String(m).padStart(2, "0")).join(" ")
            : ""
        }</span>
      </a>`).join("");
  }
  render();
})();
