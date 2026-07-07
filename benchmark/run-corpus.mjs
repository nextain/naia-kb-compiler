#!/usr/bin/env node
/**
 * 코퍼스 벤치마크 — 실 문서 디렉터리(md) → 안전스캔 → Markdown 추출(로컬) → 지식그래프 + 벤치마크.
 * 사용: node benchmark/run-corpus.mjs <corpusDir> [datasetJson]
 *   corpusDir 는 인자(레포에 경로 미포함). 클라우드 전송 없음(로컬 추출).
 * dist 필요(pnpm build). 가이드 = docs/BENCHMARK.md.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, basename, relative, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, MarkdownExtractAdapter, MemoryRetrievalAdapter, coverage } from "../dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const corpusDir = process.argv[2];
const datasetPath = process.argv[3] ?? join(__dirname, "datasets/nextain-strategy.json");
if (!corpusDir) {
  console.error("사용: node benchmark/run-corpus.mjs <corpusDir> [datasetJson]");
  process.exit(2);
}
const ds = JSON.parse(readFileSync(datasetPath, "utf8"));
const EXCLUDE = new Set(ds.exclude ?? []);
const EXCLUDE_FILES = new Set(ds.excludeFiles ?? []);
const ANSWER_T = 0.6;
const QUESTION_T = 0.5;
const cardText = (c) => [c.title, ...Object.values(c.fields)].join(" ");

// md 수집
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (EXCLUDE.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (extname(name) === ".md" && !EXCLUDE_FILES.has(name)) acc.push(p);
  }
  return acc;
}
const files = walk(corpusDir);
const sources = files.map((p) => ({ kind: "text", title: relative(corpusDir, p), text: readFileSync(p, "utf8") }));

// compile — Markdown 추출(로컬) + 안전 warn
const client = createClient({ extract: new MarkdownExtractAdapter() });
const res = await client.compile({ sources, goldQA: ds.goldQA, safety: "warn" });

// 그래프 통계
const byType = (arr, key) => arr.reduce((m, x) => ((m[x[key]] = (m[x[key]] ?? 0) + 1), m), {});
const inDegree = {};
for (const r of res.kb.relations) inDegree[r.to] = (inDegree[r.to] ?? 0) + 1;
const topConcepts = res.kb.entities
  .filter((e) => e.type === "Concept")
  .map((e) => ({ name: e.name, mentions: inDegree[e.id] ?? 0 }))
  .sort((a, b) => b.mentions - a.mentions)
  .slice(0, 15);

// 벤치마크 (held-out — 과적합 차단)
const retr = new MemoryRetrievalAdapter();
await retr.index(res.kb);
let correct = 0, totalAnswerable = 0, abstainExpected = 0, abstainCorrect = 0;
const detail = [];
for (const t of ds.heldOut) {
  const hits = await retr.search(t.q, 10);
  const relevant = hits.find((c) => coverage(t.q, cardText(c)) >= QUESTION_T);
  if (t.answerable) {
    totalAnswerable++;
    const ok = !!relevant && coverage(t.a, cardText(relevant)) >= ANSWER_T;
    if (ok) correct++;
    detail.push({ q: t.q, expected: t.a, ok, card: relevant?.title });
  } else {
    abstainExpected++;
    const abstained = !relevant;
    if (abstained) abstainCorrect++;
    detail.push({ q: t.q, expected: "(기권)", ok: abstained });
  }
}
const accuracy = totalAnswerable ? correct / totalAnswerable : 1;
const pass = res.report.score === 1 && accuracy >= 0.7 && abstainCorrect === abstainExpected;

const graph = {
  dataset: ds.name,
  corpus: { fileCount: files.length },
  graph: {
    cards: res.report.cardCount,
    entities: res.report.entityCount,
    relations: res.report.relationCount,
    entityTypes: byType(res.kb.entities, "type"),
    relationTypes: byType(res.kb.relations, "type"),
    topConcepts,
  },
  safety: {
    piiCount: res.safety?.piiCount ?? 0,
    confidentialCount: res.safety?.confidentialCount ?? 0,
    findingKinds: byType(res.safety?.findings ?? [], "kind"),
  },
  benchmark: {
    compileScore: res.report.score,
    heldOut: { answerable: totalAnswerable, correct, accuracy, abstainExpected, abstainCorrect, detail },
  },
  pass,
};

const outDir = join(__dirname, "results");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `${basename(ds.name)}-graph.json`);
writeFileSync(outPath, JSON.stringify(graph, null, 2));

// 뷰어용 viz — 연결성 보존: 상위 개념(Concept) + 그에 연결된 Topic + 그들 사이 엣지
const degAll = {};
for (const r of res.kb.relations) { degAll[r.to] = (degAll[r.to] ?? 0) + 1; degAll[r.from] = (degAll[r.from] ?? 0) + 1; }
const entById = new Map(res.kb.entities.map((e) => [e.id, e]));
const TOP_CONCEPTS = 70, MAX_TOPICS = 110;
const topConceptIds = new Set(
  res.kb.entities.filter((e) => e.type === "Concept")
    .map((e) => ({ id: e.id, d: degAll[e.id] ?? 0 }))
    .filter((x) => x.d >= 2) // 2회+ 언급된 개념만(노이즈 제거)
    .sort((a, b) => b.d - a.d).slice(0, TOP_CONCEPTS).map((x) => x.id),
);
const topicIds = new Set();
for (const r of res.kb.relations) if (topConceptIds.has(r.to) && entById.get(r.from)?.type === "Topic") {
  if (topicIds.size < MAX_TOPICS) topicIds.add(r.from);
}
const keep = new Set([...topConceptIds, ...topicIds]);
const vizNodes = [...keep].map((id) => { const e = entById.get(id); return { id, label: e.name, type: e.type, deg: degAll[id] ?? 0 }; });
const vizEdges = res.kb.relations.filter((r) => keep.has(r.from) && keep.has(r.to)).map((r) => (r.weight ? { from: r.from, to: r.to, type: r.type, weight: r.weight } : { from: r.from, to: r.to, type: r.type }));
writeFileSync(join(outDir, `${basename(ds.name)}-viz.json`), JSON.stringify({ nodes: vizNodes, edges: vizEdges }));

console.log(`\n코퍼스 벤치마크: ${ds.name}  (md ${files.length}개, 로컬 추출·클라우드 미전송)`);
console.log(`  그래프   : 카드 ${graph.graph.cards} · 엔티티 ${graph.graph.entities} · 관계 ${graph.graph.relations}`);
console.log(`  엔티티형 : ${JSON.stringify(graph.graph.entityTypes)}`);
console.log(`  관계형   : ${JSON.stringify(graph.graph.relationTypes)}`);
console.log(`  ⚠️ 안전  : PII ${graph.safety.piiCount} · 대외비 ${graph.safety.confidentialCount}  ${JSON.stringify(graph.safety.findingKinds)}`);
console.log(`  Top개념  : ${topConcepts.slice(0, 8).map((c) => `${c.name}(${c.mentions})`).join(", ")}`);
console.log(`  벤치     : compile score ${graph.benchmark.compileScore} · held-out ${(accuracy * 100).toFixed(0)}% (${correct}/${totalAnswerable}) · 기권 ${abstainCorrect}/${abstainExpected}`);
console.log(`  → ${pass ? "PASS ✅" : "FAIL ❌"}  (결과: ${outPath})\n`);
process.exit(pass ? 0 : 1);
