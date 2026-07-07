/** @spec SPEC-004 / TEST-F-004 — eval-anchored 검증 + 반증. */
import { describe, it, expect } from "vitest";
import { IngestAdapter } from "../adapters/ingest/text.js";
import { StubExtractAdapter } from "../adapters/extract/stub.js";
import { MemoryRetrievalAdapter } from "../adapters/retrieval/memory.js";
import { verify } from "../core/verify.js";
import type { Kb } from "../domain/types.js";
import { SOURCES, GOLD } from "./fixtures.js";

async function buildKb(): Promise<Kb> {
  const sources = await new IngestAdapter().ingest(SOURCES);
  const ex = await new StubExtractAdapter().extract(sources);
  return { cards: ex.cards, entities: ex.entities, relations: ex.relations };
}

describe("verify (eval-anchored)", () => {
  it("정답 재현되면 accepted + score 1", async () => {
    const kb = await buildKb();
    const r = await verify(kb, GOLD, new MemoryRetrievalAdapter());
    expect(r.score).toBe(1);
    expect(r.acceptedCardIds.length).toBeGreaterThanOrEqual(2);
  });

  it("반증: 정답과 무관한 gold → gap(unanswered/mismatch), score<1", async () => {
    const kb = await buildKb();
    const r = await verify(kb, [{ q: "주차장 요금?", a: "시간당 2000원 지하주차장" }], new MemoryRetrievalAdapter());
    expect(r.score).toBeLessThan(1);
    expect(r.gaps.length).toBeGreaterThan(0);
  });

  it("반증: 빈 KB는 모든 gold를 unanswered로 잡음(가짜 성공 방지)", async () => {
    const empty: Kb = { cards: [], entities: [], relations: [] };
    const r = await verify(empty, GOLD, new MemoryRetrievalAdapter());
    expect(r.score).toBe(0);
    expect(r.gaps.every((g) => g.kind === "unanswered")).toBe(true);
  });

  it("저신뢰 카드 → gap(low_confidence)", async () => {
    const sources = await new IngestAdapter().ingest([{ kind: "text", title: "잡설", text: "평문\n평문2" }]);
    const ex = await new StubExtractAdapter().extract(sources);
    const kb: Kb = { cards: ex.cards, entities: ex.entities, relations: ex.relations };
    const r = await verify(kb, [], new MemoryRetrievalAdapter());
    expect(r.gaps.some((g) => g.kind === "low_confidence")).toBe(true);
  });

  it("반증: 정답만 든 무관 카드(answer-stuffing)는 미채택", async () => {
    const sources = await new IngestAdapter().ingest([{ kind: "text", title: "공지사항", text: "공지사항\n잡내용 53000원 채우기" }]);
    const ex = await new StubExtractAdapter().extract(sources);
    const kb: Kb = { cards: ex.cards, entities: ex.entities, relations: ex.relations };
    const r = await verify(kb, [{ q: "여권 발급 수수료 얼마야?", a: "53000원" }], new MemoryRetrievalAdapter());
    expect(r.acceptedCardIds).toHaveLength(0); // 질문 관련성 미달 → 정답 포함해도 불합격
    expect(r.score).toBe(0);
  });

  it("정합: 저신뢰 카드가 정답 재현해도 score↔accept 일치(둘 다 0/미채택)", async () => {
    const sources = await new IngestAdapter().ingest([{ kind: "text", title: "여권 발급 수수료", text: "여권 발급 수수료\n안내: 53000원" }]);
    const ex = await new StubExtractAdapter().extract(sources); // 인식필드0 → confidence 0.4
    const kb: Kb = { cards: ex.cards, entities: ex.entities, relations: ex.relations };
    expect(kb.cards[0].confidence).toBeLessThan(0.5);
    const r = await verify(kb, [{ q: "여권 발급 수수료?", a: "53000원" }], new MemoryRetrievalAdapter());
    expect(r.score).toBe(0); // 미채택이면 score에도 안 잡힘(F3)
    expect(r.acceptedCardIds).toHaveLength(0);
    expect(r.gaps.some((g) => g.kind === "low_confidence")).toBe(true);
  });

  it("모순: 동일 제목 상이 운영시간(fee 외 필드도)도 탐지(F5)", async () => {
    const sources = await new IngestAdapter().ingest([
      { kind: "text", title: "민원실", text: "민원실\n운영시간: 09:00~18:00" },
      { kind: "text", title: "민원실", text: "민원실\n운영시간: 10:00~22:00" },
    ]);
    const ex = await new StubExtractAdapter().extract(sources);
    const kb: Kb = { cards: ex.cards, entities: ex.entities, relations: ex.relations };
    const r = await verify(kb, [], new MemoryRetrievalAdapter());
    expect(r.gaps.some((g) => g.kind === "contradiction")).toBe(true);
  });

  it("동일 제목 상이 수수료 → gap(contradiction)", async () => {
    const sources = await new IngestAdapter().ingest([
      { kind: "text", title: "여권 발급", text: "여권 발급\n수수료: 53000원" },
      { kind: "text", title: "여권 발급", text: "여권 발급\n수수료: 99000원" },
    ]);
    const ex = await new StubExtractAdapter().extract(sources);
    const kb: Kb = { cards: ex.cards, entities: ex.entities, relations: ex.relations };
    const r = await verify(kb, [], new MemoryRetrievalAdapter());
    expect(r.gaps.some((g) => g.kind === "contradiction")).toBe(true);
  });
});
