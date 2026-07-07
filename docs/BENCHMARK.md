# 벤치마크 가이드 (BENCHMARK)

이 엔진의 가치는 **"자동추출을 정답앵커로 게이트해 안전하게 만든다"** 이다. 따라서 벤치마크는 *추출 정확도*가 아니라 **게이트가 제대로 작동하는가(틀린 건 막고, 맞는 건 통과)** 와 **모르는 질문에 답을 얼마나 맞히는가(held-out)** 를 본다.

> 철학(워크스페이스 정합): **정답은 루프 밖에 앵커**(과적합 금지), **결과는 구조화 파일(md spec + JSON)**, **반증 가능**(틀린 KB는 RED로). 개발 단위마다 돌려 회귀 대체.

---

## 무엇을 측정하나 (지표)

| 지표 | 정의 | 목표 | 왜 |
|------|------|------|----|
| **compile.score** | goldQA(앵커) 재현율 (accepted 기준) | 높을수록 | 주어진 정답을 KB가 재현하는가 |
| **heldout.accuracy** | **held-out** 질문(컴파일에 안 준) 정답률 | 높을수록 | **과적합 아닌** 실제 일반화 |
| **abstain.correct** | 답이 없어야 할 질문에 기권한 비율 | 100% 지향 | 공공 표면 = 지어내면 안 됨 |
| **gate.falsePass** | 틀린 카드를 accepted 한 수 | **0** | 잘못된 정보 서빙 방지(핵심) |
| **gate.falseFail** | 맞는 카드를 부당 탈락시킨 수 | **0** | 운영자 정답을 잘못 거부 안 함 |

`gate.*` = 적대리뷰가 잡은 함정의 회귀 가드: 숫자 부분포함(`1300원⊉300원`)·한국어 조사(`신분증이=신분증`)·answer-stuffing(정답만 든 무관 카드).

---

## 데이터셋 양식 (`benchmark/datasets/*.json`)

```jsonc
{
  "name": "gov-sample",
  "sources":  [ { "kind": "text", "title": "...", "uri": "...", "text": "키: 값\n..." } ],
  "goldQA":   [ { "q": "...", "a": "..." } ],         // 컴파일에 주는 앵커
  "heldOut":  [ { "q": "...", "a": "...", "answerable": true } ], // 안 주는 시험(과적합 차단)
  "gate":     [ { "needle": "300원", "haystack": "1300원", "expect": "nomatch" } ] // 매칭 회귀
}
```
- **goldQA ≠ heldOut**: 같으면 과적합 측정 무의미. heldOut 은 컴파일에 절대 주지 않는다.
- `answerable:false` = 코퍼스에 답 없음 → 엔진이 **기권**해야 정답.

---

## 실행

```bash
pnpm build                         # dist 필요
node benchmark/run.mjs benchmark/datasets/gov-sample.json
# → 콘솔 요약 + benchmark/results/<dataset>-latest.json (구조화 결과)
```

종료코드: 모든 목표(falsePass=0, falseFail=0, abstain 정확, accuracy≥기준) 충족 시 0, 아니면 1 → **CI 회귀 게이트로 사용 가능**.

---

## 결과 JSON 스키마 (`benchmark/results/*.json`)

```jsonc
{
  "dataset": "gov-sample",
  "compile": { "sourceCount", "cardCount", "acceptedCount", "gapCount", "score" },
  "heldOut": { "total", "correct", "accuracy", "abstainExpected", "abstainCorrect" },
  "gate":    { "total", "passed", "failures": [ ... ] },
  "pass": true,            // 전체 목표 충족 여부
  "thresholds": { "minAccuracy": 0.7 }
}
```

---

## 실측: nextain-strategy 코퍼스 (2026-06-16, 정직 기록)

`node benchmark/run-corpus.mjs <nextain-team-strategy>` (md 117개, **로컬 추출·클라우드 미전송**):

| 항목 | 결과 |
|---|---|
| **지식그래프** | 카드 924 · 엔티티 3132(Topic 924 / Concept 2159 / Reference 49) · 관계 2937(mentions 2873 / references 64) ✅ |
| **안전(실데이터)** | PII 59건(주민번호 3·전화 8·이메일 17·…) + 대외비 46건 탐지 ✅ — 필터가 실제 기밀자료에서 작동 |
| compile score(앵커 재현) | 0.67 |
| held-out 정확도 | 67% (2/3) |
| 기권(abstain) | 0/2 (약함) |
| 종합 | **FAIL** (retrieval/abstention 임계 미달) |

**해석(중요)**: **그래프 생성·안전 탐지는 성공**. 실패는 **검색·기권 품질** — 로컬 키워드(IDF) 검색이 924카드 실프로즈에서 정답 카드를 항상 top 에 못 올리고, 흔한 단어 공유로 기권이 약함. **이는 임계값 튜닝으로 통과시키면 과적합**(금지)이므로 그대로 둔다. 근본 해결 = **`RetrievalPort` 를 벡터+한국어 reranker 어댑터로 교체**(port/adapter 설계의 목적, 앞선 다중 AI 조사 결론과 일치). 즉 벤치가 *다음에 무엇을 바꿔야 하는지*를 정직하게 가리킨다.

## 객관 벤치마크: KorQuAD v1.0 dev (2026-06-16) — 외부 공개 데이터 + 다중 AI 크로스리뷰

`node benchmark/run-korquad.mjs` — 코퍼스 **고유문단 961 · 질문 5774(전체)**, **실 엔진 어댑터**.
가드레일(적대 크로스리뷰 반영): **1문단=1카드**(추출기 우회·절단 금지) · **Hit@k=정답 passage id**(문자열 아님) · 문단 distractor 풀 · **튜닝 없음**(KorQuAD=held-out, verify 미투입) · **BM25 베이스라인 병행**.

| 리트리버 | Hit@1 | Hit@5 | Hit@10 | AC@5 | 속도(ms/q) |
|---|---|---|---|---|---|
| ours (IDF, 엔진) | 85.1 | 95.5 | 97.2 | 96.3 | 0.125 |
| BM25 (엔진 어댑터) | 85.8 | 96.1 | 97.8 | 96.9 | 0.138 |

- **IDF ≈ BM25**: 정확도 +0.6pt(Hit@5), 속도 동등 → 키워드급 리트리버로서 **BM25 패리티**.
- **벤치가 성능버그 적발**: IDF 어댑터가 검색마다 코퍼스 재토큰화(24.8ms/q) → index-time 캐시로 수정(**0.125ms/q, 198×**).
- **정직한 해석**: KorQuAD는 추출형(질문↔문단 어휘중복 큼)이라 키워드에 유리 → Hit@5 95.5%는 **키워드 floor의 상단**, 작은 코퍼스(961). 실프로즈 코퍼스(nextain 924카드)는 패러프레이즈가 많아 67% — **다른 regime, 둘 다 정직**. 일반화엔 벡터+reranker 필요.
- 외부 기준: open-domain BM25(NQ Top-20 59%)보다 높은 건 KorQuAD가 훨씬 쉬운 추출형·소코퍼스이기 때문(과장 금지). 학습형 추출/생성 SOTA와 동급 주장 안 함(우린 추출/생성 안 함).

### 상위 OSS 비교 + 반영 로드맵 (다중 AI 조사)
가장 유사: **LightRAG**(36k★, 듀얼레벨 graph+vector) · **nano-graphrag**(읽기 좋은 참조구현) · **RAGFlow**(하이브리드 0.7키워드+0.3벡터+rerank) · **Cognee**(로컬 KG memory). 그들이 우리 MVP보다 나은 점 = **의미검색(임베딩)·하이브리드 융합·LLM 추출·reranker**. 우리 고유 우위 = **eval-anchored 검증 + PII/대외비 필터 + 큐레이트 카드**(조사한 OSS 중 이 게이트/필터를 1급으로 제공하는 곳 없음).
- **반영 완료**: BM25 RetrievalPort(표준 베이스라인, IDF와 패리티 확인).
- **다음(우선순위)**: ① dense RetrievalPort = **BGE-M3 / KURE-v1**(MIT, 한국어, 로컬 ONNX) ② **RRF 하이브리드**(키워드+dense) ③ LLM 추출 어댑터(온라인) ④ contextual chunking ⑤ cross-encoder reranker. 전부 `RetrievalPort`/`ExtractPort` 교체 — 코어 불변.

## 해석 / 주의 (정직)

- **stub 추출 벤치**는 *파이프라인·게이트·검색·가반성*을 측정한다. **추출 LLM 품질**은 `GeminiExtractAdapter` 를 붙이고 **같은 데이터셋**으로 다시 돌려 비교(어댑터만 교체 — port/adapter 의 이점).
- 한국어 검색은 형태소 미적용(MVP) — 벡터/Nori 어댑터로 교체 시 heldout.accuracy 변화를 같은 벤치로 측정.
- 데이터셋은 **실제 공공기관 민원 질의 로그**로 확장할수록 신뢰↑. 합성 데이터만으로 점수 올리는 것(과적합) 경계.
- 새 기능/어댑터 추가 시 이 벤치를 돌려 **회귀**를 막는다(REQ-019 회귀 대체).
