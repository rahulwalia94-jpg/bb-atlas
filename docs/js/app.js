// Shared chrome: tutor drawer + xref hover card containers are injected here
// so every page gets them without duplicating markup.
(function () {
  "use strict";

  // --- theme engine ---
  const THEMES = [
    { id: "editorial", label: "2026 · Editorial" },
    { id: "holo", label: "2236 · Hologram" },
    { id: "void", label: "2236 · Minimal" },
  ];
  let theme = "holo"; // prototype default — the 2236 look
  let hudTimer = null;
  try { theme = localStorage.getItem("bb-atlas:theme") || theme; } catch {}
  applyTheme(theme);

  function applyTheme(id) {
    if (id === "editorial") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = id;
    holoFX(id === "holo");
  }

  // --- hologram stage: grid floor, aurora, particles, HUD, live readout ---
  function holoFX(on) {
    let stage = document.getElementById("holo-stage");
    let hud = document.getElementById("holo-hud");
    if (!on) {
      if (stage) stage.remove();
      if (hud) hud.remove();
      if (hudTimer) { clearInterval(hudTimer); hudTimer = null; }
      return;
    }
    if (stage) return; // already on

    stage = document.createElement("div");
    stage.id = "holo-stage";
    stage.innerHTML =
      '<div class="aurora a1"></div><div class="aurora a2"></div><div class="aurora a3"></div>' +
      '<div class="grid-floor"></div><div class="horizon"></div><div class="boot"></div>';
    for (let i = 0; i < 16; i++) {
      const p = document.createElement("span");
      p.className = "p";
      p.style.left = Math.random() * 100 + "vw";
      p.style.bottom = "-5vh";
      p.style.animationDuration = 9 + Math.random() * 14 + "s";
      p.style.animationDelay = -Math.random() * 20 + "s";
      p.style.opacity = "";
      stage.appendChild(p);
    }
    document.body.prepend(stage);

    hud = document.createElement("div");
    hud.id = "holo-hud";
    hud.innerHTML =
      '<div class="corner c-tl"></div><div class="corner c-tr"></div>' +
      '<div class="corner c-bl"></div><div class="corner c-br"></div>' +
      '<div class="readout"><span class="ok">● LINK STABLE</span><br>' +
      '<span id="hud-clock"></span><br>BB·ATLAS // TERMINAL 2236</div>';
    document.body.appendChild(hud);

    const clock = () => {
      const el = document.getElementById("hud-clock");
      if (!el) return;
      const d = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      el.textContent =
        "T+" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) +
        " · GRID LDN-" + (100 + (d.getSeconds() % 60));
    };
    clock();
    hudTimer = setInterval(clock, 1000);
  }

  const navInner = document.querySelector(".nav-inner");
  if (navInner) {
    const pick = document.createElement("select");
    pick.id = "theme-pick";
    pick.title = "Colour theme";
    pick.innerHTML = THEMES.map(
      (t) => `<option value="${t.id}"${t.id === theme ? " selected" : ""}>${t.label}</option>`
    ).join("");
    pick.addEventListener("change", () => {
      theme = pick.value;
      applyTheme(theme);
      try { localStorage.setItem("bb-atlas:theme", theme); } catch {}
    });
    navInner.appendChild(pick);
  }

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
