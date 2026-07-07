/** @spec SPEC-007 / TEST-F-007 — in-memory retrieval + 어댑터 교체 가능성. */
import { describe, it, expect } from "vitest";
import { MemoryRetrievalAdapter } from "../adapters/retrieval/memory.js";
import { Bm25RetrievalAdapter } from "../adapters/retrieval/bm25.js";
import type { Kb, RetrievalPort } from "../index.js";

const kb: Kb = {
  cards: [
    { id: "c1", title: "여권 발급", fields: { fee: "53000원", content: "여권 발급 수수료" }, sourceUris: [], confidence: 0.8, status: "draft" },
    { id: "c2", title: "전입신고", fields: { documents: "신분증", content: "전입신고 서류" }, sourceUris: [], confidence: 0.8, status: "draft" },
  ],
  entities: [],
  relations: [],
};

describe("MemoryRetrievalAdapter", () => {
  it("질의 관련 카드 랭킹 반환", async () => {
    const r = new MemoryRetrievalAdapter();
    await r.index(kb);
    const hits = await r.search("여권 수수료", 5);
    expect(hits[0].id).toBe("c1");
  });

  it("무관 질의 → 빈 결과", async () => {
    const r = new MemoryRetrievalAdapter();
    await r.index(kb);
    expect(await r.search("우주선 발사")).toHaveLength(0);
  });

  it("Bm25RetrievalAdapter: 동일 RetrievalPort, 관련 카드 랭킹", async () => {
    const r = new Bm25RetrievalAdapter();
    await r.index(kb);
    expect((await r.search("여권 수수료"))[0].id).toBe("c1");
    expect(await r.search("우주선 발사")).toHaveLength(0);
  });

  it("RetrievalPort 인터페이스로 대체 가능(교체성)", async () => {
    const fake: RetrievalPort = {
      async index() {},
      async search() {
        return [kb.cards[1]];
      },
    };
    expect((await fake.search("아무거나"))[0].id).toBe("c2");
  });
});
