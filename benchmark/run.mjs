#!/usr/bin/env node
/**
 * 벤치마크 러너 — 자료셋(앵커/held-out/gate) → compile → 지표 산출 → 구조화 JSON.
 * 사용: node benchmark/run.mjs benchmark/datasets/gov-sample.json
 * 종료코드: 모든 목표 충족=0, 아니면 1 (CI 회귀 게이트).
 * dist 필요(pnpm build). 가이드 = docs/BENCHMARK.md.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, MemoryRetrievalAdapter, coverage } from "../dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ANSWER_T = 0.6; // 정답 재현 합격선
const MATCH_T = 0.5; // gate 매칭 판정선
const MIN_ACCURACY = 0.7;

const datasetPath = process.argv[2] ?? join(__dirname, "datasets/gov-sample.json");
const ds = JSON.parse(readFileSync(datasetPath, "utf8"));
const cardText = (c) => [c.title, ...Object.values(c.fields)].join(" ");

// 1) compile (goldQA = 앵커)
const client = createClient();
const res = await client.compile({ sources: ds.sources, goldQA: ds.goldQA });

// 2) held-out (컴파일에 안 준 질문 — 과적합 차단)
const retr = new MemoryRetrievalAdapter();
await retr.index(res.kb);
let correct = 0, totalAnswerable = 0, abstainExpected = 0, abstainCorrect = 0;
const heldDetail = [];
for (const t of ds.heldOut) {
  const hits = await retr.search(t.q, 3);
  if (t.answerable) {
    totalAnswerable++;
    const best = hits[0];
    const ok = !!best && coverage(t.a, cardText(best)) >= ANSWER_T;
    if (ok) correct++;
    heldDetail.push({ q: t.q, expected: t.a, ok });
  } else {
    abstainExpected++;
    const abstained = hits.length === 0;
    if (abstained) abstainCorrect++;
    heldDetail.push({ q: t.q, expected: "(기권)", ok: abstained });
  }
}
const accuracy = totalAnswerable ? correct / totalAnswerable : 1;

// 3) gate (매칭 회귀 — falsePass/falseFail)
let gpass = 0;
const failures = [];
for (const g of ds.gate) {
  const cov = coverage(g.needle, g.haystack);
  const isMatch = cov >= MATCH_T;
  const ok = g.expect === "match" ? isMatch : !isMatch;
  if (ok) gpass++;
  else failures.push({ ...g, cov, kind: g.expect === "nomatch" ? "falsePass" : "falseFail" });
}

const pass =
  res.report.score === 1 &&
  accuracy >= MIN_ACCURACY &&
  abstainCorrect === abstainExpected &&
  failures.length === 0;

const result = {
  dataset: ds.name,
  compile: {
    sourceCount: res.report.sourceCount,
    cardCount: res.report.cardCount,
    acceptedCount: res.report.acceptedCount,
    gapCount: res.report.gapCount,
    draftCount: res.report.draftCount,
    score: res.report.score,
  },
  heldOut: { total: ds.heldOut.length, answerable: totalAnswerable, correct, accuracy, abstainExpected, abstainCorrect, detail: heldDetail },
  gate: { total: ds.gate.length, passed: gpass, failures },
  thresholds: { minAccuracy: MIN_ACCURACY, answer: ANSWER_T, match: MATCH_T },
  pass,
};

const outDir = join(__dirname, "results");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `${basename(ds.name)}-latest.json`);
writeFileSync(outPath, JSON.stringify(result, null, 2));

console.log(`\n벤치마크: ${ds.name}`);
console.log(`  compile  : 카드 ${result.compile.cardCount} · accepted ${result.compile.acceptedCount} · gap ${result.compile.gapCount} · score ${result.compile.score}`);
console.log(`  held-out : 정확도 ${(accuracy * 100).toFixed(0)}% (${correct}/${totalAnswerable}) · 기권 ${abstainCorrect}/${abstainExpected}`);
console.log(`  gate     : ${gpass}/${result.gate.total} 통과${failures.length ? ` · 실패 ${failures.map((f) => f.kind).join(",")}` : ""}`);
console.log(`  → ${pass ? "PASS ✅" : "FAIL ❌"}  (결과: ${outPath})\n`);

process.exit(pass ? 0 : 1);
