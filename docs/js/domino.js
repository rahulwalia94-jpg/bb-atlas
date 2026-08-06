// Domino chain renderer — lays out a cause→effect DAG left-to-right as SVG.
// Usage: BBDomino.render(hostEl, chain, { onNodeClick(node) })
(function () {
  "use strict";

  const NODE_W = 148, NODE_H = 46, GAP_X = 46, GAP_Y = 18, PAD = 12;

  function layout(chain) {
    // longest-path layering
    const nodes = chain.nodes.map((n) => ({ ...n }));
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const indeg = {}, out = {};
    nodes.forEach((n) => { indeg[n.id] = 0; out[n.id] = []; });
    for (const [a, b] of chain.edges) {
      if (byId[a] && byId[b]) { out[a].push(b); indeg[b]++; }
    }
    // topological longest path
    const depth = {};
    const queue = nodes.filter((n) => indeg[n.id] === 0).map((n) => n.id);
    queue.forEach((id) => (depth[id] = 0));
    const indegLeft = { ...indeg };
    while (queue.length) {
      const id = queue.shift();
      for (const nxt of out[id]) {
        depth[nxt] = Math.max(depth[nxt] || 0, depth[id] + 1);
        if (--indegLeft[nxt] === 0) queue.push(nxt);
      }
    }
    // group by column
    const cols = [];
    nodes.forEach((n) => {
      const d = depth[n.id] || 0;
      (cols[d] = cols[d] || []).push(n);
    });
    nodes.forEach((n) => {
      const d = depth[n.id] || 0;
      const col = cols[d];
      const row = col.indexOf(n);
      n.x = PAD + d * (NODE_W + GAP_X);
      n.y = PAD + row * (NODE_H + GAP_Y) + (Math.max(...cols.map((c) => c.length)) - col.length) * (NODE_H + GAP_Y) / 2;
      n.terminal = out[n.id].length === 0;
    });
    const w = PAD * 2 + cols.length * NODE_W + (cols.length - 1) * GAP_X;
    const h = PAD * 2 + Math.max(...cols.map((c) => c.length)) * (NODE_H + GAP_Y) - GAP_Y;
    return { nodes, byId, w, h };
  }

  function wrapLabel(label) {
    const words = label.split(" ");
    const lines = [""];
    for (const w of words) {
      const cur = lines[lines.length - 1];
      if ((cur + " " + w).trim().length > 20) lines.push(w);
      else lines[lines.length - 1] = (cur + " " + w).trim();
    }
    return lines.slice(0, 3);
  }

  function render(host, chain, opts = {}) {
    const { nodes, byId, w, h } = layout(chain);
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "domino-svg");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("width", w);
    svg.style.maxWidth = "none";

    const defs = document.createElementNS(NS, "defs");
    defs.innerHTML = `<marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M0,0 L8,4 L0,8 z" fill="#5C5952"/></marker>`;
    svg.appendChild(defs);

    for (const [a, b] of chain.edges) {
      const na = byId[a], nb = byId[b];
      if (!na || !nb) continue;
      const p = document.createElementNS(NS, "path");
      const x1 = na.x + NODE_W, y1 = na.y + NODE_H / 2;
      const x2 = nb.x, y2 = nb.y + NODE_H / 2;
      const mx = (x1 + x2) / 2;
      p.setAttribute("d", `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2 - 3},${y2}`);
      p.setAttribute("class", "domino-edge");
      svg.appendChild(p);
    }

    for (const n of nodes) {
      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", "domino-node" + (n.terminal ? " terminal" : ""));
      const r = document.createElementNS(NS, "rect");
      r.setAttribute("x", n.x); r.setAttribute("y", n.y);
      r.setAttribute("width", NODE_W); r.setAttribute("height", NODE_H);
      g.appendChild(r);
      const lines = wrapLabel(n.label);
      lines.forEach((line, i) => {
        const t = document.createElementNS(NS, "text");
        t.setAttribute("x", n.x + NODE_W / 2);
        t.setAttribute("y", n.y + NODE_H / 2 + (i - (lines.length - 1) / 2) * 13 + 4);
        t.setAttribute("text-anchor", "middle");
        t.textContent = line;
        g.appendChild(t);
      });
      if (opts.onNodeClick) g.addEventListener("click", () => opts.onNodeClick(n));
      const title = document.createElementNS(NS, "title");
      title.textContent = n.label;
      g.appendChild(title);
      svg.appendChild(g);
    }

    host.innerHTML = "";
    host.appendChild(svg);
  }

  window.BBDomino = { render };
})();
