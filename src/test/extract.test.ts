/** @spec SPEC-003 / TEST-F-003 — Extract(stub) 결정론. */
import { describe, it, expect } from "vitest";
import { IngestAdapter } from "../adapters/ingest/text.js";
import { StubExtractAdapter } from "../adapters/extract/stub.js";
import { SOURCES } from "./fixtures.js";

describe("StubExtractAdapter", () => {
  it("자료 → 카드 + 인식 필드 + 그래프 데이터", async () => {
    const sources = await new IngestAdapter().ingest(SOURCES);
    const ex = await new StubExtractAdapter().extract(sources);

    expect(ex.cards).toHaveLength(2);
    const passport = ex.cards.find((c) => c.title === "여권 발급")!;
    expect(passport.fields.fee).toBe("53000원");
    expect(passport.fields.documents).toContain("신분증");
    expect(passport.fields.department).toBe("민원여권과");
    expect(passport.sourceUris).toContain("https://gov.example.kr/passport");
    // 인식 필드 많을수록 신뢰도↑
    expect(passport.confidence).toBeGreaterThan(0.5);

    // 경량 그래프: Service 노드 + handled_by/requires_document/costs 관계
    expect(ex.entities.some((e) => e.type === "Service" && e.name === "여권 발급")).toBe(true);
    expect(ex.relations.some((r) => r.type === "handled_by")).toBe(true);
  });

  it("필드 없는 자료 → 저신뢰(<0.5)", async () => {
    const sources = await new IngestAdapter().ingest([{ kind: "text", title: "잡설", text: "그냥 평문\n또 평문" }]);
    const ex = await new StubExtractAdapter().extract(sources);
    expect(ex.cards[0].confidence).toBeLessThan(0.5);
  });
});
