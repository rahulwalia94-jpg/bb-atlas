import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const PORT = process.env.PORT || 10000;
// Lock CORS to the GitHub Pages origin. Set ALLOWED_ORIGIN on Render, e.g.
// https://<your-github-username>.github.io
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const SYSTEM_PROMPT = `You are an expert in UK Business Banking, SME credit risk, and IFRS 9 impairment. The user is a Barclays Business Banking Impairment analyst with deep retail-credit background. Answer with precision, cite sources when using search, always connect answers back to impairment/ECL implications, and compare Barclays vs competitors where relevant.`;

const app = express();
app.use(express.json({ limit: "256kb" }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  } else if (!ALLOWED_ORIGIN) {
    // Not configured yet — permissive so first deploy can be smoke-tested.
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/healthz", (_req, res) => res.json({ ok: true }));

// Body: { question: string, moduleId?: number, moduleTitle?: string,
//         moduleSummary?: string, history?: [{role:"user"|"assistant", content:string}] }
app.post("/api/ask", async (req, res) => {
  try {
    const { question, moduleId, moduleTitle, moduleSummary, history } = req.body || {};
    if (!question || typeof question !== "string" || question.length > 4000) {
      return res.status(400).json({ error: "A question (string, ≤4000 chars) is required." });
    }

    const messages = [];
    for (const turn of Array.isArray(history) ? history.slice(-10) : []) {
      if (
        turn &&
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.content === "string" &&
        turn.content.length <= 8000
      ) {
        messages.push({ role: turn.role, content: turn.content });
      }
    }

    let userContent = question;
    if (moduleTitle || moduleSummary) {
      userContent =
        `[Context: the user is currently reading BB Atlas module ` +
        `${Number.isInteger(moduleId) ? moduleId : "?"} — "${moduleTitle || ""}". ` +
        `Module summary: ${moduleSummary || ""}]\n\n${question}`;
    }
    messages.push({ role: "user", content: userContent });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
      messages,
    });

    if (response.stop_reason === "refusal") {
      return res.json({
        answer: "I can't help with that request. Try rephrasing, or ask about UK business banking, SME credit, or IFRS 9 impairment.",
        sources: [],
      });
    }

    let answer = "";
    const sources = [];
    const seen = new Set();
    for (const block of response.content) {
      if (block.type === "text") {
        answer += block.text;
        for (const c of block.citations || []) {
          if (c.url && !seen.has(c.url)) {
            seen.add(c.url);
            sources.push({ title: c.title || c.url, url: c.url });
          }
        }
      } else if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) {
          if (r.type === "web_search_result" && r.url && !seen.has(r.url)) {
            seen.add(r.url);
            sources.push({ title: r.title || r.url, url: r.url });
          }
        }
      }
    }

    res.json({ answer: answer.trim(), sources: sources.slice(0, 8) });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "The tutor is rate-limited right now — try again in a minute." });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: "Server misconfigured: invalid ANTHROPIC_API_KEY." });
    }
    console.error("ask error:", err);
    res.status(500).json({ error: "The tutor hit an unexpected error. Try again." });
  }
});

// Body: { metrics: [{id,label,value,asAt}] } — the currently-baked values.
// Uses live web search to re-verify each and returns updated values + a change list.
app.post("/api/refresh", async (req, res) => {
  try {
    const { metrics } = req.body || {};
    if (!Array.isArray(metrics) || !metrics.length || metrics.length > 30) {
      return res.status(400).json({ error: "metrics array (1-30 items) required" });
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system:
        "You verify UK business-banking metrics using live web search. You are precise, cite-driven, and never guess. Today's date matters: prefer the most recent official figure.",
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
      messages: [
        {
          role: "user",
          content:
            `Re-verify these UK business banking metrics with web search. For each metric where you find a NEWER or DIFFERENT official figure, return it; skip metrics that are unchanged or that you cannot verify.\n\n` +
            `Current baked values:\n${JSON.stringify(metrics, null, 1)}\n\n` +
            `Respond with ONLY a JSON object, no prose:\n` +
            `{"metrics":[{"id":"<same id>","value":"<new value>","detail":"<one-line context>","asAt":"<YYYY-MM>","trend":"up|down|flat"}],` +
            `"changes":[{"id":"<id>","summary":"<metric label>: <old> → <new> (why)"}]}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return res.status(500).json({ error: "Refresh was declined — try again." });
    }
    let text = "";
    for (const block of response.content) if (block.type === "text") text += block.text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: "Could not parse refresh result." });
    const data = JSON.parse(match[0]);
    res.json({ metrics: data.metrics || [], changes: data.changes || [] });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "Rate-limited — try again in a minute." });
    }
    console.error("refresh error:", err);
    res.status(500).json({ error: "Refresh failed — try again." });
  }
});

app.listen(PORT, () => console.log(`BB Atlas tutor listening on :${PORT}`));
