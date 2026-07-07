#!/usr/bin/env node
/**
 * 객관 벤치마크 — KorQuAD v1.0 dev (retrieval + answer-containment) + 속도 측정.
 * 가드레일: 1문단=1카드(추출기 우회·절단 금지), Hit@k=정답 passage id, 문단 distractor 풀, 튜닝 금지.
 * **실제 엔진 어댑터**(MemoryRetrieval IDF / Bm25Retrieval) 사용 — 재현 아닌 실측.
 * 사용: node benchmark/run-korquad.mjs [korquad_dev.json] [questionSample]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MemoryRetrievalAdapter, Bm25RetrievalAdapter, normalize } from "../dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = process.argv[2] ?? join(__dirname, ".data/korquad_dev.json");
const SAMPLE = process.argv[3] ? Number(process.argv[3]) : 0;
const data = JSON.parse(readFileSync(dataPath, "utf8")).data;

// 1문단=1카드 (추출기 우회·절단 없음). 고유 문단 dedup.
const pidByCtx = new Map();
const cards = [];
const questions = [];
for (const doc of data) {
  for (const p of doc.paragraphs) {
    let pid = pidByCtx.get(p.context);
    if (pid === undefined) {
      pid = `p${cards.length}`;
      pidByCtx.set(p.context, pid);
      cards.push({ id: pid, title: pid, fields: { content: p.context }, sourceUris: [], confidence: 1, status: "accepted" });
    }
    for (const qa of p.qas) questions.push({ q: qa.question, answer: qa.answers[0].text, goldPid: pid });
  }
}
let qset = questions;
if (SAMPLE > 0 && SAMPLE < questions.length) qset = questions.filter((_, i) => i % Math.ceil(questions.length / SAMPLE) === 0);
const kb = { cards, entities: [], relations: [] };
const contentNorm = new Map(cards.map((c) => [c.id, normalize(c.fields.content)]));

async function evaluate(name, adapter) {
  const t0 = performance.now();
  await adapter.index(kb);
  const tIndex = performance.now() - t0;

  // 워밍업(JIT) — 측정 공정성 (순서 편향 제거)
  for (let i = 0; i < Math.min(200, qset.length); i++) await adapter.search(qset[i].q, 10);

  const ks = [1, 5, 10];
  const hit = { 1: 0, 5: 0, 10: 0 }, ac = { 1: 0, 5: 0, 10: 0 };
  const tq0 = performance.now();
  for (const qa of qset) {
    const top = await adapter.search(qa.q, 10);
    const ans = normalize(qa.answer);
    for (const k of ks) {
      const slice = top.slice(0, k);
      if (slice.some((c) => c.id === qa.goldPid)) hit[k]++;
      if (ans && slice.some((c) => (contentNorm.get(c.id) ?? "").includes(ans))) ac[k]++;
    }
  }
  const tQuery = performance.now() - tq0;
  const pct = (x) => +((x / qset.length) * 100).toFixed(1);
  return {
    name,
    hit1: pct(hit[1]), hit5: pct(hit[5]), hit10: pct(hit[10]),
    ac1: pct(ac[1]), ac5: pct(ac[5]), ac10: pct(ac[10]),
    indexMs: +tIndex.toFixed(0), queryMs: +tQuery.toFixed(0), perQueryMs: +(tQuery / qset.length).toFixed(3),
  };
}

const ours = await evaluate("ours(IDF)", new MemoryRetrievalAdapter());
const bm25 = await evaluate("BM25", new Bm25RetrievalAdapter());

console.log(`\nKorQuAD v1.0 dev — 객관 벤치마크 (실제 엔진 어댑터)`);
console.log(`  코퍼스: 고유문단 ${cards.length} · 질문 ${qset.length}${SAMPLE ? ` (샘플/${questions.length})` : " (전체)"}`);
console.log(`  지표  Hit@k=정답 passage id · AC@k=정답문자열 포함(정규화)`);
const row = (r) => console.log(`  ${r.name.padEnd(10)} Hit@1 ${String(r.hit1).padStart(5)} · Hit@5 ${String(r.hit5).padStart(5)} · Hit@10 ${String(r.hit10).padStart(5)}  |  AC@5 ${String(r.ac5).padStart(5)}  |  index ${String(r.indexMs).padStart(4)}ms · query ${String(r.perQueryMs).padStart(6)}ms/q`);
row(ours); row(bm25);
const dh = +(bm25.hit5 - ours.hit5).toFixed(1);
console.log(`  Δ(BM25−IDF) Hit@5 ${dh > 0 ? "+" : ""}${dh}pt · 속도 IDF ${ours.perQueryMs}ms vs BM25 ${bm25.perQueryMs}ms/q\n`);

mkdirSync(join(__dirname, "results"), { recursive: true });
writeFileSync(join(__dirname, "results/korquad-dev.json"), JSON.stringify({
  dataset: "KorQuAD_v1.0_dev",
  corpus: { uniquePassages: cards.length, questions: qset.length, total: questions.length },
  metric: "Hit@k=gold passage id in top-k · AC@k=answer string in any top-k (normalized). 실제 엔진 어댑터. 튜닝 없음.",
  results: { ours_IDF: ours, BM25: bm25 },
}, null, 2));
console.log(`  → benchmark/results/korquad-dev.json\n`);
