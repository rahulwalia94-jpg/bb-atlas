(async function () {
  "use strict";

  // master chain
  try {
    const master = await BB.fetchJSON("content/master-domino.json");
    document.getElementById("master-title").textContent = master.title;
    document.getElementById("master-note").textContent = master.note || "";
    BBDomino.render(document.getElementById("master-host"), master, {
      onNodeClick(n) {
        if (Number.isInteger(n.moduleId)) location.href = `module.html?id=${n.moduleId}`;
      },
    });
  } catch {}

  // per-module chains
  const host = document.getElementById("module-chains");
  let index;
  try { index = await BB.fetchJSON("content/modules-index.json"); }
  catch { return; }

  for (const meta of index.modules) {
    let mod;
    try { mod = await BB.fetchJSON(`content/modules/module-${meta.id}.json`); }
    catch { continue; }
    if (!mod.domino || !mod.domino.nodes || !mod.domino.nodes.length) continue;

    const block = document.createElement("div");
    block.className = "map-mod";
    block.innerHTML = `
      <p class="kicker"><a href="module.html?id=${meta.id}"><span class="tick">◈</span> ${BB.esc(mod.kicker)} — ${BB.esc(mod.domino.title || mod.title)}</a></p>
      <div class="map-scroll"></div>`;
    host.appendChild(block);
    BBDomino.render(block.querySelector(".map-scroll"), mod.domino, {
      onNodeClick(n) {
        location.href = `module.html?id=${meta.id}${n.sectionId ? "#" + n.sectionId : ""}`;
      },
    });
  }
})();
