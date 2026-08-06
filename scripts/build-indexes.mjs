#!/usr/bin/env node
// Build script: derives the site's index files from the module JSONs.
// Run after any content change:  node scripts/build-indexes.js
//
// Outputs (all under docs/content/):
//   modules-index.json  — id/slug/title/summary/readingTime per module
//   glossary.json       — merged glossary with cross-module mention links
//   sources.json        — per-module source lists
//   search-index.json   — flat text index for the client-side search
//
// Also runs the QA pass: JSON validity, quiz shape, domino integrity,
// xref slugs that resolve, and internal link checks. Exits 1 on hard errors.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(root, "docs", "content");
const modulesDir = path.join(contentDir, "modules");

const errors = [];
const warnings = [];

const moduleFiles = fs
  .readdirSync(modulesDir)
  .filter((f) => /^module-\d+\.json$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));

const modules = [];
for (const file of moduleFiles) {
  try {
    const mod = JSON.parse(fs.readFileSync(path.join(modulesDir, file), "utf8"));
    modules.push(mod);
  } catch (e) {
    errors.push(`${file}: invalid JSON — ${e.message}`);
  }
}

console.log(`Loaded ${modules.length} modules (${moduleFiles.join(", ")})`);

// ---------- per-module QA ----------
const stripTags = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

for (const mod of modules) {
  const tag = `module-${mod.id}`;
  const sectionIds = new Set((mod.sections || []).map((s) => s.id));

  if (!Array.isArray(mod.sections) || mod.sections.length < 4)
    errors.push(`${tag}: fewer than 4 sections`);
  const words = (mod.sections || []).map((s) => stripTags(s.html)).join(" ").split(/\s+/).length;
  if (words < 1200) warnings.push(`${tag}: only ~${words} words of prose`);

  const lensCount = (mod.sections || []).map((s) => (s.html.match(/class="lens"/g) || []).length).reduce((a, b) => a + b, 0);
  if (lensCount < 3) warnings.push(`${tag}: only ${lensCount} Impairment Lens asides (spec: ≥3)`);

  if (!Array.isArray(mod.quiz) || mod.quiz.length !== 10)
    errors.push(`${tag}: quiz has ${(mod.quiz || []).length} questions (spec: 10)`);
  for (const [i, q] of (mod.quiz || []).entries()) {
    if (!Array.isArray(q.options) || q.options.length !== 4)
      errors.push(`${tag} Q${i + 1}: needs exactly 4 options`);
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3)
      errors.push(`${tag} Q${i + 1}: answer index out of range`);
    if (!q.explain) warnings.push(`${tag} Q${i + 1}: missing explanation`);
  }

  const d = mod.domino || {};
  const nodeIds = new Set((d.nodes || []).map((n) => n.id));
  for (const n of d.nodes || []) {
    if (n.sectionId && !sectionIds.has(n.sectionId))
      errors.push(`${tag}: domino node "${n.id}" points at missing section "${n.sectionId}"`);
  }
  for (const [a, b] of d.edges || []) {
    if (!nodeIds.has(a) || !nodeIds.has(b))
      errors.push(`${tag}: domino edge [${a} → ${b}] references unknown node`);
  }
  if ((d.nodes || []).length < 6) warnings.push(`${tag}: domino chain has only ${(d.nodes || []).length} nodes`);
}

// ---------- glossary merge + mentions ----------
const terms = {};
for (const mod of modules) {
  for (const t of mod.glossaryTerms || []) {
    if (terms[t.slug]) {
      warnings.push(`glossary: "${t.slug}" defined in both module-${terms[t.slug].homeModule} and module-${mod.id} — keeping the first`);
      continue;
    }
    terms[t.slug] = {
      term: t.term,
      definition: t.definition,
      related: t.related || [],
      homeModule: mod.id,
      mentions: [],
    };
  }
}

// scan every section's html for data-term mentions
const xrefRe = /data-term="([^"]+)"/g;
const danglingSlugs = new Set();
for (const mod of modules) {
  for (const s of mod.sections || []) {
    const seenInSection = new Set();
    let m;
    while ((m = xrefRe.exec(s.html))) {
      const slug = m[1];
      if (!terms[slug]) { danglingSlugs.add(slug); continue; }
      if (seenInSection.has(slug)) continue;
      seenInSection.add(slug);
      terms[slug].mentions.push({
        href: `module.html?id=${mod.id}#${s.id}`,
        label: `M${String(mod.id).padStart(2, "0")} · ${s.heading}`,
      });
    }
  }
}
for (const slug of danglingSlugs) warnings.push(`xref: data-term="${slug}" used but never defined in any module's glossaryTerms`);

// verify related links resolve
for (const [slug, t] of Object.entries(terms)) {
  t.related = t.related.filter((r) => {
    if (!terms[r]) { warnings.push(`glossary: "${slug}" relates to unknown "${r}" — dropped`); return false; }
    return true;
  });
}

// ---------- outputs ----------
const write = (name, obj) => {
  fs.writeFileSync(path.join(contentDir, name), JSON.stringify(obj, null, 1));
  console.log(`wrote ${name}`);
};

write("modules-index.json", {
  builtAt: new Date().toISOString().slice(0, 10),
  modules: modules.map((m) => ({
    id: m.id, slug: m.slug, title: m.title, summary: m.summary,
    readingTime: m.readingTime, kicker: m.kicker,
  })),
});

write("glossary.json", { terms });

write("sources.json", {
  modules: modules.map((m) => ({ id: m.id, title: m.title, sources: m.sources || [] })),
});

// search index: one doc per section + one per glossary term
const docs = [];
for (const mod of modules) {
  for (const s of mod.sections || []) {
    docs.push({
      title: s.heading,
      where: `Module ${String(mod.id).padStart(2, "0")} · ${mod.title}`,
      href: `module.html?id=${mod.id}#${s.id}`,
      text: stripTags(s.html).slice(0, 1500),
    });
  }
}
for (const [slug, t] of Object.entries(terms)) {
  docs.push({
    title: t.term,
    where: "Glossary",
    href: `glossary.html#${slug}`,
    text: t.definition,
  });
}
write("search-index.json", { docs });

// ---------- report ----------
console.log(`\nGlossary: ${Object.keys(terms).length} terms`);
if (warnings.length) {
  console.log(`\n⚠ ${warnings.length} warnings:`);
  warnings.forEach((w) => console.log("  - " + w));
}
if (errors.length) {
  console.error(`\n✗ ${errors.length} errors:`);
  errors.forEach((e) => console.error("  - " + e));
  process.exit(1);
}
console.log("\n✓ QA clean" + (warnings.length ? " (with warnings)" : ""));
