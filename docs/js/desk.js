// The Desk — live metrics, delta log, regulatory pipeline, calendar.
// "Refresh now" asks the Render backend to re-verify metrics via web search;
// the result renders immediately and is kept in localStorage until the weekly
// bake (GitHub Action) writes it into the repo.
(async function () {
  "use strict";
  const API = (window.BB_CONFIG && window.BB_CONFIG.API_URL || "").replace(/\/$/, "");

  const tileGrid = document.getElementById("tile-grid");
  const stamp = document.getElementById("refresh-stamp");
  const btn = document.getElementById("refresh-btn");

  let baked = null;
  try { baked = await BB.fetchJSON("content/live/metrics.json"); }
  catch {
    tileGrid.innerHTML = "<p style='padding:2rem;color:var(--ink-dim)'>metrics.json missing — data build pending.</p>";
  }

  // a live (unbaked) refresh newer than the baked file wins
  let live = null;
  try {
    const cached = JSON.parse(localStorage.getItem("bb-atlas:live-metrics"));
    if (cached && baked && cached.baseAsAt === baked.asAt) live = cached;
  } catch {}

  function trendMark(t) {
    return t === "up" ? '<span class="tr-up">▲</span>' : t === "down" ? '<span class="tr-down">▼</span>' : '<span class="tr-flat">■</span>';
  }

  function renderTiles(data, isLive) {
    if (!data) return;
    document.getElementById("desk-asat").textContent = baked ? baked.asAt : "—";
    stamp.innerHTML = isLive
      ? `<span class="live">● live-refreshed ${BB.esc(data.refreshedAt)}</span> · not yet baked into the site`
      : `showing baked data · as at ${BB.esc(baked.asAt)}`;
    tileGrid.innerHTML = data.metrics.map((m) => `
      <div class="tile">
        <span class="t-label">${BB.esc(m.label)}</span>
        <span class="t-value">${trendMark(m.trend)} ${BB.esc(m.value)}</span>
        <span class="t-detail">${BB.esc(m.detail || "")}</span>
        <span class="t-ecl">◈ ${BB.esc(m.eclNote || "")}</span>
        <span class="t-src">as at ${BB.esc(m.asAt || data.asAt)} · ${
          m.source && m.source.url
            ? `<a href="${BB.esc(m.source.url)}" target="_blank" rel="noopener">↗ ${BB.esc(m.source.title || "source")}</a>`
            : "unsourced"
        }</span>
      </div>`).join("");
  }

  renderTiles(live || baked, !!live);

  // --- refresh ---
  btn.addEventListener("click", async () => {
    if (!API) {
      stamp.innerHTML = "backend not configured — set API_URL in js/config.js to enable live refresh";
      return;
    }
    if (!baked) return;
    btn.disabled = true;
    stamp.innerHTML = "querying live sources — this can take ~30–60s…";
    try {
      const res = await fetch(API + "/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metrics: baked.metrics.map(({ id, label, value, asAt }) => ({ id, label, value, asAt })) }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || res.status);
      // merge: keep baked structure, overlay refreshed values
      const byId = Object.fromEntries((data.metrics || []).map((m) => [m.id, m]));
      const merged = {
        baseAsAt: baked.asAt,
        refreshedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
        metrics: baked.metrics.map((m) => {
          const u = byId[m.id];
          if (!u || !u.value) return m;
          return { ...m, value: u.value, detail: u.detail || m.detail, asAt: u.asAt || m.asAt, trend: u.trend || m.trend, changed: u.value !== m.value };
        }),
        changes: (data.changes || []),
      };
      try { localStorage.setItem("bb-atlas:live-metrics", JSON.stringify(merged)); } catch {}
      live = merged;
      renderTiles(merged, true);
      if (merged.changes.length) {
        stamp.innerHTML = `<span class="live">● refreshed</span> · ${merged.changes.length} change${merged.changes.length > 1 ? "s" : ""}: ` +
          BB.esc(merged.changes.slice(0, 3).map((c) => c.summary || c).join(" · "));
      }
    } catch (e) {
      stamp.innerHTML = "refresh failed — backend may be waking (free tier). Try again in ~30s.";
    } finally {
      btn.disabled = false;
    }
  });

  // --- delta log ---
  try {
    const deltas = await BB.fetchJSON("content/live/deltas.json");
    document.getElementById("delta-list").innerHTML = deltas.entries
      .slice(0, 12)
      .map((d) => `<li>
        <span class="d-date">${BB.esc(d.date)}</span>
        <span class="d-text">${BB.esc(d.summary)}</span>
        ${d.changes && d.changes.length ? `<span class="d-changes">${d.changes.map((c) => "· " + BB.esc(c)).join("<br>")}</span>` : ""}
      </li>`).join("");
  } catch {
    document.getElementById("delta-list").innerHTML = "<li><span class='d-text'>No delta log yet.</span></li>";
  }

  // --- pipeline ---
  try {
    const pipe = await BB.fetchJSON("content/live/pipeline.json");
    document.getElementById("pipe-list").innerHTML = pipe.items.map((p) => `<li>
      <span class="status-dot ${BB.esc(p.status || "amber")}"></span>
      <span class="p-name">${BB.esc(p.name)}</span>
      <span class="p-stage">${BB.esc(p.stage)}${p.nextDate ? " · next: " + BB.esc(p.nextDate) : ""}</span>
      ${p.source && p.source.url ? `<a href="${BB.esc(p.source.url)}" target="_blank" rel="noopener">↗ src</a>` : ""}
      <span class="p-ecl">${BB.esc(p.eclImpact || "")}</span>
    </li>`).join("");
  } catch {
    document.getElementById("pipe-list").innerHTML = "<li>pipeline.json missing.</li>";
  }

  // --- calendar ---
  try {
    const cal = await BB.fetchJSON("content/live/calendar.json");
    document.getElementById("cal-list").innerHTML = cal.events.map((e) => `<li>
      <span class="c-date">${BB.esc(e.date)}</span>
      <span class="c-inst">${BB.esc(e.institution)}</span>
      <span class="c-event">${BB.esc(e.event)} ${e.confirmed === false ? '<span class="est">est</span>' : ""}</span>
      ${e.source && e.source.url ? `<a href="${BB.esc(e.source.url)}" target="_blank" rel="noopener">↗</a>` : ""}
      ${e.note ? `<span class="c-note">${BB.esc(e.note)}</span>` : ""}
    </li>`).join("");
  } catch {
    document.getElementById("cal-list").innerHTML = "<li>calendar.json missing.</li>";
  }
})();
