// Shared chrome: tutor drawer + xref hover card containers are injected here
// so every page gets them without duplicating markup.
(function () {
  "use strict";

  // --- tutor drawer + fab ---
  const fab = document.createElement("button");
  fab.id = "tutor-fab";
  fab.textContent = "Ask deeper ↗";
  document.body.appendChild(fab);

  const drawer = document.createElement("aside");
  drawer.id = "tutor-drawer";
  drawer.innerHTML = `
    <div class="tutor-head">
      <span class="kicker">◈ AI Tutor</span>
      <button id="tutor-close" aria-label="Close">×</button>
    </div>
    <div id="tutor-log"></div>
    <div class="tutor-input">
      <textarea id="tutor-q" rows="1" placeholder="Ask anything — it can search the web…"></textarea>
      <button id="tutor-send">Ask</button>
    </div>
    <p class="tutor-note" id="tutor-note"></p>
  `;
  document.body.appendChild(drawer);

  fab.addEventListener("click", () => drawer.classList.add("open"));
  drawer.querySelector("#tutor-close").addEventListener("click", () => drawer.classList.remove("open"));

  // --- xref card ---
  const card = document.createElement("div");
  card.id = "xref-card";
  document.body.appendChild(card);

  // tiny helpers used by page scripts
  window.BB = window.BB || {};
  window.BB.esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  window.BB.fetchJSON = async (path) => {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return res.json();
  };
})();
