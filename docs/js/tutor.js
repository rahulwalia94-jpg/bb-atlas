// AI Tutor panel — talks to the Render backend (POST /api/ask).
// Keeps the last 10 exchanges in localStorage and sends them as history.
(function () {
  "use strict";
  const API = (window.BB_CONFIG && window.BB_CONFIG.API_URL || "").replace(/\/$/, "");
  const log = document.getElementById("tutor-log");
  const q = document.getElementById("tutor-q");
  const send = document.getElementById("tutor-send");
  const note = document.getElementById("tutor-note");

  const HKEY = "bb-atlas:tutor-history";
  let history = [];
  try { history = JSON.parse(localStorage.getItem(HKEY)) || []; } catch {}

  function saveHistory() {
    history = history.slice(-20); // 10 exchanges
    try { localStorage.setItem(HKEY, JSON.stringify(history)); } catch {}
  }

  // Minimal, safe markdown → HTML (escape first, then re-introduce structure)
  function md(text) {
    let s = BB.esc(text);
    s = s.replace(/^### (.*)$/gm, "<h3>$1</h3>");
    s = s.replace(/^## (.*)$/gm, "<h2>$1</h2>");
    s = s.replace(/^# (.*)$/gm, "<h1>$1</h1>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    // bulleted lists
    s = s.replace(/((?:^[-*] .*(?:\n|$))+)/gm, (m) =>
      "<ul>" + m.trim().split(/\n/).map((l) => "<li>" + l.replace(/^[-*] /, "") + "</li>").join("") + "</ul>");
    // numbered lists
    s = s.replace(/((?:^\d+\. .*(?:\n|$))+)/gm, (m) =>
      "<ol>" + m.trim().split(/\n/).map((l) => "<li>" + l.replace(/^\d+\. /, "") + "</li>").join("") + "</ol>");
    // paragraphs
    return s.split(/\n{2,}/).map((p) =>
      /^<(ul|ol|h\d)/.test(p.trim()) ? p : "<p>" + p.replace(/\n/g, "<br>") + "</p>").join("");
  }

  function addMsg(cls, html) {
    const el = document.createElement("div");
    el.className = "t-msg " + cls;
    el.innerHTML = html;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  // replay stored history
  for (const turn of history) {
    addMsg(turn.role === "user" ? "user" : "assistant",
      turn.role === "user" ? BB.esc(turn.content) : md(turn.content));
  }

  if (!API) {
    note.textContent = "Backend not deployed yet — set API_URL in js/config.js. Content and quizzes work offline.";
  } else {
    note.textContent = "Answers may use live web search · not financial advice";
  }

  async function ask() {
    const question = q.value.trim();
    if (!question) return;
    q.value = "";
    addMsg("user", BB.esc(question));

    if (!API) {
      addMsg("error", "The tutor backend isn't deployed yet. Deploy the /server folder on Render, then paste its URL into docs/js/config.js (API_URL). Everything else on this site works offline.");
      return;
    }

    send.disabled = true;
    const pending = addMsg("pending", "Thinking… (may search the web)");
    try {
      const ctx = window.BB_MODULE_CONTEXT || {};
      const res = await fetch(API + "/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          moduleId: ctx.id,
          moduleTitle: ctx.title,
          moduleSummary: ctx.summary,
          history: history.slice(-20),
        }),
      });
      const data = await res.json();
      pending.remove();
      if (!res.ok || data.error) {
        addMsg("error", BB.esc(data.error || `Request failed (${res.status}).`));
      } else {
        let html = md(data.answer);
        if (data.sources && data.sources.length) {
          html += `<div class="t-sources">` +
            data.sources.map((s) => `<a href="${BB.esc(s.url)}" target="_blank" rel="noopener">↗ ${BB.esc(s.title)}</a>`).join("") +
            `</div>`;
        }
        addMsg("assistant", html);
        history.push({ role: "user", content: question });
        history.push({ role: "assistant", content: data.answer });
        saveHistory();
      }
    } catch (e) {
      pending.remove();
      addMsg("error", "Couldn't reach the tutor backend — it may be waking from sleep (free tier). Try again in ~30 seconds.");
    } finally {
      send.disabled = false;
    }
  }

  send.addEventListener("click", ask);
  q.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); }
  });
})();
