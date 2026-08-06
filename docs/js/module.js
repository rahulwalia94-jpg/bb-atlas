// Module page: loads content/modules/module-<id>.json and renders
// sections, domino chain, and quiz. Marks the module read on quiz completion
// or after scrolling to the end.
(async function () {
  "use strict";
  const params = new URLSearchParams(location.search);
  const id = parseInt(params.get("id") || "0", 10);

  let mod;
  try {
    mod = await BB.fetchJSON(`content/modules/module-${id}.json`);
  } catch {
    document.getElementById("mod-title").textContent = "Module not found";
    document.getElementById("mod-kicker").innerHTML = "<span class='tick'>◈</span> 404";
    return;
  }

  document.title = `BB Atlas — ${mod.title}`;
  document.getElementById("mod-kicker").innerHTML = `<span class="tick">◈</span> ${BB.esc(mod.kicker)}`;
  document.getElementById("mod-title").textContent = mod.title;
  document.getElementById("mod-summary").textContent = mod.summary;
  document.getElementById("mod-meta").innerHTML =
    `<span>${mod.readingTime} min read</span>` +
    `<span>${mod.sections.length} sections</span>` +
    `<span>${(mod.glossaryTerms || []).length} glossary terms</span>` +
    (BBProgress.isRead(id) ? `<span style="color:var(--green)">✓ read</span>` : "");

  // context handed to the tutor
  window.BB_MODULE_CONTEXT = { id, title: mod.title, summary: mod.summary };

  // --- sections ---
  const host = document.getElementById("mod-sections");
  host.innerHTML = mod.sections
    .map(
      (s, i) => `<section id="${BB.esc(s.id)}">
        <h2><span class="sec-no">§ ${String(i + 1).padStart(2, "0")}</span>${BB.esc(s.heading)}</h2>
        ${s.html}
      </section>`
    )
    .join("");

  // --- domino chain ---
  if (mod.domino && mod.domino.nodes && mod.domino.nodes.length) {
    document.getElementById("domino-block").style.display = "";
    document.getElementById("domino-title").textContent = mod.domino.title || "";
    BBDomino.render(document.getElementById("domino-host"), mod.domino, {
      onNodeClick(node) {
        if (node.sectionId) {
          const el = document.getElementById(node.sectionId);
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }
      },
    });
  }

  // --- quiz ---
  if (mod.quiz && mod.quiz.length) {
    document.getElementById("quiz-block").style.display = "";
    const qHost = document.getElementById("quiz-host");
    const answered = new Array(mod.quiz.length).fill(null);

    qHost.innerHTML = mod.quiz
      .map(
        (q, qi) => `<div class="quiz-q" data-q="${qi}">
          <p class="q-text"><span class="q-no">Q${qi + 1}</span>${BB.esc(q.q)}</p>
          ${q.options
            .map((o, oi) => `<button class="quiz-opt" data-opt="${oi}">${BB.esc(o)}</button>`)
            .join("")}
          <div class="quiz-explain">${BB.esc(q.explain)}</div>
        </div>`
      )
      .join("");

    qHost.addEventListener("click", (e) => {
      const btn = e.target.closest(".quiz-opt");
      if (!btn || btn.disabled) return;
      const qEl = btn.closest(".quiz-q");
      const qi = +qEl.dataset.q;
      if (answered[qi] !== null) return;
      const oi = +btn.dataset.opt;
      const correct = mod.quiz[qi].answer;
      answered[qi] = oi === correct;
      qEl.querySelectorAll(".quiz-opt").forEach((b, i) => {
        b.disabled = true;
        if (i === correct) b.classList.add("correct");
        else if (i === oi) b.classList.add("wrong");
      });
      qEl.querySelector(".quiz-explain").classList.add("show");

      if (answered.every((a) => a !== null)) {
        const score = answered.filter(Boolean).length;
        BBProgress.setQuizScore(id, score, mod.quiz.length);
        BBProgress.markRead(id);
        const el = document.getElementById("quiz-score");
        el.style.display = "";
        const best = BBProgress.quizScore(id);
        el.innerHTML = `<span class="big">${score}/${mod.quiz.length}</span> this run · best ${best.score}/${best.total} — ${
          score === mod.quiz.length
            ? "flawless. The desk is safer with you on it."
            : score >= 7
            ? "solid. Re-read the sections behind the misses."
            : "worth another pass — the ECL is in the details."
        }`;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }

  // mark read on reaching the end of the article
  const sentinel = document.getElementById("quiz-block") || document.querySelector(".mod-nav");
  if ("IntersectionObserver" in window && sentinel) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) {
        BBProgress.markRead(id);
        io.disconnect();
      }
    });
    io.observe(sentinel);
  }

  // --- prev / next ---
  try {
    const index = await BB.fetchJSON("content/modules-index.json");
    const ids = index.modules.map((m) => m.id).sort((a, b) => a - b);
    const pos = ids.indexOf(id);
    const prev = document.getElementById("nav-prev");
    const next = document.getElementById("nav-next");
    if (pos > 0) {
      prev.style.visibility = "visible";
      prev.href = `module.html?id=${ids[pos - 1]}`;
      prev.textContent = `← ${String(ids[pos - 1]).padStart(2, "0")} · ${index.modules.find((m) => m.id === ids[pos - 1]).title}`;
    }
    if (pos >= 0 && pos < ids.length - 1) {
      next.style.visibility = "visible";
      next.href = `module.html?id=${ids[pos + 1]}`;
      next.textContent = `${String(ids[pos + 1]).padStart(2, "0")} · ${index.modules.find((m) => m.id === ids[pos + 1]).title} →`;
    }
  } catch {}
})();
