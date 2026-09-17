# 사용법 (USAGE)

`@naia/kb-compiler` — 자료를 넣으면 검증된 지식베이스(KB)로 컴파일하는 엔진.

> 진입점 개념·소유권 = [`../AGENTS.md`](../AGENTS.md), [`../OWNERSHIP.md`](../OWNERSHIP.md). 벤치마크 = [`BENCHMARK.md`](BENCHMARK.md).

---

## 설치 / 빌드

```bash
pnpm install
pnpm build      # dist/ 생성 (소비자가 import)
pnpm test       # vitest (LLM/네트워크 불필요 — stub 어댑터)
pnpm typecheck
```

소비 앱에서:
```jsonc
// package.json — dev/로컬 배선(운영은 private registry 퍼블리시 후 versioned dep 권장)
"dependencies": { "@naia/kb-compiler": "file:../../../naia-kb-compiler" }
```

---

## 가장 빠른 사용 (기본 = 오프라인 stub)

```ts
import { createClient } from "@naia/kb-compiler";

const client = createClient(); // 기본: stub 추출 + in-memory 검색/저장 (LLM 불필요)

const result = await client.compile({
  sources: [
    { kind: "text", title: "여권 발급", uri: "https://gov.example.kr/passport",
      text: "여권 발급\n대상: 국민\n필요서류: 신분증\n담당: 민원여권과\n수수료: 53000원" },
  ],
  goldQA: [{ q: "여권 발급 수수료?", a: "53000원" }], // 정답 앵커(합격 기준)
});

console.log(result.report);        // { cardCount, acceptedCount, gapCount, draftCount, score }
console.log(result.verify?.gaps);  // 사람이 확인해야 할 갭(미답/미스매치/저신뢰/모순)
const json = await client.exportKb(); // 표준 JSON (무손실·가반)
```

### 핵심 개념
- **goldQA = 합격 기준(루프 밖 정답 앵커).** 생성된 KB가 이 답을 재현해야 카드가 `accepted`. 없으면 카드는 `draft`로 남는다.
- **카드 status**: `accepted`(gold-QA 검증) / `gap`(문제 표면화, 비서빙) / `draft`(컴파일됨·미검증). **서빙 규칙: `gap`이 아닌 컴파일 카드는 검색·질의에 나온다.** `accepted`는 검증 표시이지 검색 게이트가 아니다. 질의는 "뭐야" 같은 질문 허사를 빼고 카드 본문과 맞춘다.
- **report.score** = goldQA 재현율(0~1, accepted 기준).

---

## 어댑터 교체 (port/adapter — 비종속)

코어는 어떤 어댑터인지 모름. 일부만 오버라이드:

```ts
import { createClient, GeminiExtractAdapter } from "@naia/kb-compiler";

// 실 추출(Vertex Gemini) — 토큰·엔드포인트 주입(google-auth 등에 하드 비의존)
const client = createClient({
  extract: new GeminiExtractAdapter({
    tokenProvider: async () => await getAdcToken(),
    endpoint: "https://.../publishers/google/models/gemini-3.1-flash-lite:generateContent",
  }),
});
```

| Port | 기본 어댑터 | 교체 예 |
|------|------------|---------|
| `IngestPort` | text/url(주입 fetch) | 문서 파서(PDF/HWP) |
| `ExtractPort` | `StubExtractAdapter`(결정론) | `GeminiExtractAdapter`(실 LLM) |
| `RetrievalPort` | `MemoryRetrievalAdapter`(키워드) | 벡터(pgvector) / 그래프(LightRAG) |
| `StorePort` | `MemoryStoreAdapter`(+JSON export) | Postgres |
| `GeneratePort` | (미구현) | grounded+abstain |

자체 어댑터는 포트 인터페이스만 구현하면 됨:
```ts
import type { RetrievalPort } from "@naia/kb-compiler";
class MyVectorRetrieval implements RetrievalPort { /* index/search */ }
createClient({ retrieval: new MyVectorRetrieval() });
```

---

## HTTP API 로 노출 (프레임워크 비의존)

```ts
import { handleCompile, defaultAdapters } from "@naia/kb-compiler";

// Next.js route 예
export async function POST(req: Request) {
  const { status, body } = await handleCompile(await req.json(), defaultAdapters());
  return Response.json(body, { status });
}
```
요청 body = `{ sources: [...], goldQA?: [...], lowConfidenceThreshold?: 0~1 }`.

---

## 정본 이동/교체 (비종속 보장)

```ts
const json = await client.exportKb();   // 표준 JSON 정본
// → 다른 백엔드/엔진/온프레로 그대로 이전. import(json) 로 무손실 복원.
```
매니지드 인덱스(벡터·그래프)는 *재생성 가능 캐시* — 정본이 아님. 언제든 교체 가능.
