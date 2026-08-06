(async function () {
  "use strict";
  const table = document.getElementById("cmp-table");
  let data;
  try { data = await BB.fetchJSON("content/competitors.json"); }
  catch { table.innerHTML = "<tr><td style='padding:2rem'>competitors.json missing.</td></tr>"; return; }

  document.getElementById("cmp-asat").textContent = "as at " + (data.asAt || "build date");

  const cols = data.columns.filter((c) => c.key !== "colour");
  let sortKey = null, sortDir = 1;

  function fmt(v, col) {
    if (v === null || v === undefined || v === "") return "<span style='color:var(--ink-faint)'>—</span>";
    if (col.numeric && typeof v === "number") return BB.esc(String(v));
    return BB.esc(String(v));
  }

  function render() {
    let rows = [...data.rows];
    if (sortKey) {
      rows.sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * sortDir;
        return String(av).localeCompare(String(bv)) * sortDir;
      });
    }
    table.innerHTML =
      "<thead><tr>" +
      cols
        .map(
          (c) => `<th data-key="${BB.esc(c.key)}">${BB.esc(c.label)}${
            sortKey === c.key ? ` <span class="dir">${sortDir > 0 ? "↑" : "↓"}</span>` : ""
          }</th>`
        )
        .join("") +
      "</tr></thead><tbody>" +
      rows
        .map(
          (r) =>
            "<tr>" +
            cols
              .map((c, i) => {
                if (i === 0) {
                  return `<td class="name"><span class="dot ${BB.esc(r.colour || "violet")}"></span>${fmt(r[c.key], c)}</td>`;
                }
                return `<td class="${c.numeric ? "num" : ""}">${fmt(r[c.key], c)}</td>`;
              })
              .join("") +
            "</tr>"
        )
        .join("") +
      "</tbody>";
  }

  table.addEventListener("click", (e) => {
    const th = e.target.closest("th");
    if (!th) return;
    const key = th.dataset.key;
    if (sortKey === key) sortDir = -sortDir;
    else { sortKey = key; sortDir = 1; }
    render();
  });

  render();
})();
