// Progress tracking — localStorage only.
(function () {
  "use strict";
  const P = "bb-atlas:";

  function get(key, fallback) {
    try {
      const v = localStorage.getItem(P + key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  }
  function set(key, value) {
    try { localStorage.setItem(P + key, JSON.stringify(value)); } catch {}
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  // streak: consecutive days with any visit
  function touchStreak() {
    const last = get("streak-last", null);
    let n = get("streak-n", 0);
    const t = today();
    if (last === t) return n;
    const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    n = last === y ? n + 1 : 1;
    set("streak-last", t);
    set("streak-n", n);
    return n;
  }

  window.BBProgress = {
    markRead(id) { const r = get("read", {}); r[id] = true; set("read", r); },
    isRead(id) { return !!get("read", {})[id]; },
    readCount() { return Object.keys(get("read", {})).length; },
    setQuizScore(id, score, total) {
      const q = get("quiz", {});
      const prev = q[id];
      if (!prev || score > prev.score) q[id] = { score, total, at: today() };
      set("quiz", q);
    },
    quizScore(id) { return get("quiz", {})[id] || null; },
    readiness(totalModules) {
      // 50% weight reading, 50% weight quiz performance
      const read = this.readCount() / totalModules;
      const q = get("quiz", {});
      let qsum = 0;
      for (let i = 0; i < totalModules; i++) {
        const s = q[i];
        if (s && s.total) qsum += s.score / s.total;
      }
      const quiz = qsum / totalModules;
      return Math.round((read * 0.5 + quiz * 0.5) * 100);
    },
    streak: touchStreak(),
  };
})();
