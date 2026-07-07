# benchmark/

엔진 회귀·품질 벤치마크. 방법론·지표·해석 = [`../docs/BENCHMARK.md`](../docs/BENCHMARK.md).

```
benchmark/
├── datasets/   # 입력 (sources + goldQA 앵커 + heldOut 시험 + gate 회귀)
├── results/    # 산출 JSON (gitignored, 러너가 생성)
└── run.mjs     # 러너 (dist 필요)
```

```bash
pnpm build
node benchmark/run.mjs benchmark/datasets/gov-sample.json
```

핵심: **goldQA(앵커) ≠ heldOut(시험)** — 같으면 과적합. gate=적대리뷰 함정 회귀(숫자 부분포함·한국어 조사·answer-stuffing). 종료코드 0/1 = CI 게이트.
