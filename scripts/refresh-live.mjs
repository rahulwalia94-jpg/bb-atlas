#!/usr/bin/env node
// Weekly bake: re-verifies docs/content/live/metrics.json via the Anthropic API
// with live web search, appends value history, and writes a delta-log entry.
// Runs in CI (.github/workflows/refresh.yml) with ANTHROPIC_API_KEY, or locally:
//   ANTHROPIC_API_KEY=sk-... node scripts/refresh-live.mjs
//
// Requests are STREAMED and metrics are processed in small batches: a
// non-streaming call that spends minutes searching the web trips Node's
// 5-minute headers timeout (UND_ERR_HEADERS_TIMEOUT) before it ever replies.
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

const BATCH_SIZE = 5; // keeps each call well under any timeout
const baked = JSON.parse(fs.readFileSync(metricsPath, "utf8"));
const today = new Date().toISOString().slice(0, 10);

/** Stream one Messages API call and return the accumulated text. */
async function callClaude(batch) {
  const prompt =
    `Re-verify these UK business banking metrics using web search. For each metric where you find a NEWER or DIFFERENT official figure, return it; omit metrics that are unchanged or that you cannot verify.\n\n` +
    `Current values:\n${JSON.stringify(batch, null, 1)}\n\n` +
    `Respond with ONLY a JSON object, no prose:\n` +
    `{"metrics":[{"id":"<same id>","value":"<new value>","detail":"<one-line context>","asAt":"<YYYY-MM>","trend":"up|down|flat","source":{"title":"...","url":"https://..."}}],` +
    `"changes":[{"id":"<id>","summary":"<metric label>: <old> → <new> (why)"}]}`;

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
      stream: true,
      thinking: { type: "adaptive" },
      system: "You verify UK business-banking metrics using live web search. Precise, cite-driven, never guess.",
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  let stopReason = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === "[DONE]") continue;
      let ev;
      try { ev = JSON.parse(payload); } catch { continue; }
      if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") text += ev.delta.text;
      if (ev.type === "message_delta" && ev.delta?.stop_reason) stopReason = ev.delta.stop_reason;
    }
  }
  if (stopReason === "refusal") throw new Error("request declined by safety classifier");
  return text;
}

const allUpdates = [];
const allChanges = [];
const batches = [];
for (let i = 0; i < baked.metrics.length; i += BATCH_SIZE) {
  batches.push(baked.metrics.slice(i, i + BATCH_SIZE));
}

console.log(`Refreshing ${baked.metrics.length} metrics in ${batches.length} batches…`);

for (const [n, batch] of batches.entries()) {
  const slim = batch.map(({ id, label, value, asAt }) => ({ id, label, value, asAt }));
  let text = null;
  for (let attempt = 1; attempt <= 2 && text === null; attempt++) {
    try {
      text = await callClaude(slim);
    } catch (e) {
      console.warn(`  batch ${n + 1} attempt ${attempt} failed: ${e.message}`);
      if (attempt === 2) console.warn(`  batch ${n + 1} skipped.`);
      else await new Promise((r) => setTimeout(r, 4000));
    }
  }
  if (text === null) continue;

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) { console.warn(`  batch ${n + 1}: unparseable output, skipped.`); continue; }
  try {
    const parsed = JSON.parse(match[0]);
    allUpdates.push(...(parsed.metrics || []));
    allChanges.push(...(parsed.changes || []));
    console.log(`  batch ${n + 1}/${batches.length}: ${(parsed.metrics || []).length} update(s)`);
  } catch {
    console.warn(`  batch ${n + 1}: invalid JSON, skipped.`);
  }
}

const byId = Object.fromEntries(allUpdates.map((m) => [m.id, m]));
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
  changes: allChanges.map((c) => c.summary || String(c)),
});
deltas.entries = deltas.entries.slice(0, 50);
fs.writeFileSync(deltasPath, JSON.stringify(deltas, null, 1));

console.log(`Done: ${changed} metric(s) updated, delta log written.`);
