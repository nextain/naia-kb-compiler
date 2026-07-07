/** @spec SPEC-006 / TEST-F-006 — compile e2e(stub 어댑터) + API 핸들러. */
import { describe, it, expect } from "vitest";
import { createClient, defaultAdapters } from "../client.js";
import { handleCompile } from "../api/handler.js";
import { SOURCES, GOLD } from "./fixtures.js";

describe("compile e2e", () => {
  it("소스+gold → KB + 리포트(정답 재현 → score 1, accepted)", async () => {
    const client = createClient();
    const res = await client.compile({ sources: SOURCES, goldQA: GOLD });
    expect(res.report.sourceCount).toBe(2);
    expect(res.report.cardCount).toBe(2);
    expect(res.report.score).toBe(1);
    expect(res.report.acceptedCount).toBe(2);
    expect(res.kb.cards.every((c) => c.status === "accepted")).toBe(true);
    // export 가능(가반)
    const json = await client.exportKb();
    expect(JSON.parse(json).kb.cards).toHaveLength(2);
  });

  it("gold 없이도 컴파일(검증 생략)", async () => {
    const res = await createClient().compile({ sources: SOURCES });
    expect(res.report.cardCount).toBe(2);
    expect(res.verify).toBeUndefined();
  });

  it("API 핸들러: 정상 200", async () => {
    const r = await handleCompile({ sources: SOURCES, goldQA: GOLD }, defaultAdapters());
    expect(r.status).toBe(200);
  });

  it("API 핸들러: 잘못된 body 400", async () => {
    const r = await handleCompile({ sources: [] }, defaultAdapters());
    expect(r.status).toBe(400);
  });

  it("안전: warn 모드로 PII/대외비 리포트(원문 유지)", async () => {
    const r = await createClient().compile({
      sources: [{ kind: "text", title: "내부", text: "담당: 김철수 010-1234-5678\n대외비" }],
    });
    expect(r.safety?.piiCount).toBeGreaterThanOrEqual(1);
    expect(r.safety?.confidentialCount).toBeGreaterThanOrEqual(1);
  });

  it("안전: redact 모드는 추출 전 PII 마스킹(카드 내용에 원문 없음)", async () => {
    const r = await createClient().compile({
      sources: [{ kind: "text", title: "내부", text: "전화: 010-1234-5678" }],
      safety: "redact",
    });
    const allText = JSON.stringify(r.kb.cards);
    expect(allText).not.toContain("010-1234-5678");
    expect(r.safety?.redactedCount).toBeGreaterThanOrEqual(1);
  });
});
