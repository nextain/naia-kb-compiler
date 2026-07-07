/** @spec SPEC-007 / TEST-F-007(보강) — Dense(코사인) + Hybrid(RRF). fake EmbedPort 로 hermetic(모델 불필요). */
import { describe, it, expect } from "vitest";
import { DenseRetrievalAdapter } from "../adapters/retrieval/dense.js";
import { Bm25RetrievalAdapter } from "../adapters/retrieval/bm25.js";
import { HybridRetrievalAdapter } from "../adapters/retrieval/hybrid.js";
import type { EmbedPort } from "../domain/ports.js";
import type { Kb } from "../domain/types.js";

// 결정론 fake 임베딩: 고정 어휘 bag-of-words (코사인=어휘중복). 실모델 불필요.
const VOCAB = ["여권", "수수료", "발급", "신분증", "전입신고", "주민센터", "등본"];
const fakeEmbed: EmbedPort = {
  async embed(texts) {
    return texts.map((t) => VOCAB.map((w) => (t.includes(w) ? 1 : 0)));
  },
};

const kb: Kb = {
  cards: [
    { id: "c1", title: "여권 발급", fields: { content: "여권 발급 수수료 53000원" }, sourceUris: [], confidence: 1, status: "accepted" },
    { id: "c2", title: "전입신고", fields: { content: "전입신고 신분증 주민센터" }, sourceUris: [], confidence: 1, status: "accepted" },
    { id: "c3", title: "주민등록등본", fields: { content: "등본 발급 신분증" }, sourceUris: [], confidence: 1, status: "accepted" },
  ],
  entities: [], relations: [],
};

describe("DenseRetrievalAdapter (fake embed)", () => {
  it("의미 벡터 코사인으로 관련 카드 랭킹", async () => {
    const r = new DenseRetrievalAdapter(fakeEmbed);
    await r.index(kb);
    expect((await r.search("여권 수수료"))[0].id).toBe("c1");
    expect((await r.search("전입신고 주민센터"))[0].id).toBe("c2");
  });
  it("무관 질의(어휘 0) → 빈 결과", async () => {
    const r = new DenseRetrievalAdapter(fakeEmbed);
    await r.index(kb);
    expect(await r.search("우주선 로켓")).toHaveLength(0);
  });
});

describe("HybridRetrievalAdapter (BM25 + dense, RRF)", () => {
  it("두 리트리버를 RRF 융합", async () => {
    const hybrid = new HybridRetrievalAdapter([new Bm25RetrievalAdapter(), new DenseRetrievalAdapter(fakeEmbed)]);
    await hybrid.index(kb);
    const top = await hybrid.search("여권 발급 수수료", 3);
    expect(top[0].id).toBe("c1");
    expect(top.length).toBeGreaterThanOrEqual(1);
  });
  it("한 리트리버만으로도 동작(포트 합성)", async () => {
    const h = new HybridRetrievalAdapter([new DenseRetrievalAdapter(fakeEmbed)]);
    await h.index(kb);
    expect((await h.search("등본 발급"))[0].id).toBe("c3");
  });
});
