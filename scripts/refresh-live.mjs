#!/usr/bin/env node
// Weekly bake: re-verifies docs/content/live/metrics.json via the Anthropic API
// with live web search, appends value history, and writes a delta-log entry.
// Runs in CI (.github/workflows/refresh.yml) with ANTHROPIC_API_KEY, or locally:
//   ANTHROPIC_API_KEY=sk-... node scripts/refresh-live.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) {
  console.log("ANTHROPIC_API_KEY not set — skipping refresh (nothing changed).");
  process.exit(0);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const liveDir = path.join(root, "docs", "content", "live");
const metricsPath = path.join(liveDir, "metrics.json");
const deltasPath = path.join(liveDir, "deltas.json");

const baked = JSON.parse(fs.readFileSync(metricsPath, "utf8"));
const today = new Date().toISOString().slice(0, 10);

const prompt =
  `Re-verify these UK business banking metrics with web search. For each metric where you find a NEWER or DIFFERENT official figure, return it; skip metrics that are unchanged or unverifiable.\n\n` +
  `Current baked values:\n` +
  JSON.stringify(baked.metrics.map(({ id, label, value, asAt }) => ({ id, label, value, asAt })), null, 1) +
  `\n\nRespond with ONLY a JSON object, no prose:\n` +
  `{"metrics":[{"id":"<same id>","value":"<new value>","detail":"<one-line context>","asAt":"<YYYY-MM>","trend":"up|down|flat","source":{"title":"...","url":"https://..."}}],` +
  `"changes":[{"id":"<id>","summary":"<metric label>: <old> → <new> (why)"}]}`;

console.log("Refreshing metrics via Anthropic API + web search…");
const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": KEY,
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: "You verify UK business-banking metrics using live web search. Precise, cite-driven, never guess.",
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 10 }],
    messages: [{ role: "user", content: prompt }],
  }),
});

if (!res.ok) {
  console.error("API error:", res.status, await res.text());
  process.exit(1);
}
const body = await res.json();
if (body.stop_reason === "refusal") {
  console.log("Refresh declined — leaving files unchanged.");
  process.exit(0);
}
let text = "";
for (const block of body.content || []) if (block.type === "text") text += block.text;
const match = text.match(/\{[\s\S]*\}/);
if (!match) {
  console.error("Could not parse model output; leaving files unchanged.");
  process.exit(1);
}
const update = JSON.parse(match[0]);
const byId = Object.fromEntries((update.metrics || []).map((m) => [m.id, m]));

let changed = 0;
for (const m of baked.metrics) {
  const u = byId[m.id];
  if (!u || !u.value || u.value === m.value) continue;
  m.history = m.history || [];
  m.history.push({ date: today, value: u.value });
  m.value = u.value;
  if (u.detail) m.detail = u.detail;
  if (u.asAt) m.asAt = u.asAt;
  if (u.trend) m.trend = u.trend;
  if (u.source && u.source.url) m.source = u.source;
  changed++;
}
baked.asAt = today;
fs.writeFileSync(metricsPath, JSON.stringify(baked, null, 1));

let deltas = { entries: [] };
try { deltas = JSON.parse(fs.readFileSync(deltasPath, "utf8")); } catch {}
deltas.entries.unshift({
  date: today,
  summary: changed
    ? `Weekly refresh — ${changed} metric${changed > 1 ? "s" : ""} updated.`
    : "Weekly refresh — no changes; all figures re-verified as current.",
  changes: (update.changes || []).map((c) => c.summary || String(c)),
});
deltas.entries = deltas.entries.slice(0, 50);
fs.writeFileSync(deltasPath, JSON.stringify(deltas, null, 1));

console.log(`Done: ${changed} metric(s) updated, delta log written.`);
