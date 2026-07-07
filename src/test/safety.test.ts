/** @spec SPEC-010 / TEST-F-010 — PII·대외비 탐지/레닥션/차단 + 반증. */
import { describe, it, expect } from "vitest";
import { scanSensitive, redact, applySafety, SafetyBlockedError } from "../core/safety.js";

describe("scanSensitive", () => {
  it("주민번호·전화·이메일·카드 탐지", () => {
    const f = scanSensitive("홍길동 880101-1234567 010-1234-5678 a@b.com 1234-5678-9012-3456");
    const kinds = f.map((x) => x.kind);
    expect(kinds).toContain("rrn");
    expect(kinds).toContain("phone");
    expect(kinds).toContain("email");
    expect(kinds).toContain("card");
    expect(f.find((x) => x.kind === "rrn")?.sample).not.toContain("880101"); // 원문 미노출(마스킹)
  });

  it("대외비 키워드 탐지(confidential severity)", () => {
    const f = scanSensitive("본 문서는 대외비입니다. Confidential.");
    const c = f.find((x) => x.kind === "confidential");
    expect(c?.severity).toBe("confidential");
    expect(c?.count).toBeGreaterThanOrEqual(2);
  });

  it("반증: 깨끗한 텍스트 → 탐지 0", () => {
    expect(scanSensitive("여권 발급 수수료는 53000원입니다.")).toHaveLength(0);
  });
});

describe("redact", () => {
  it("PII 마스킹, 대외비 키워드는 보존(경고대상)", () => {
    const r = redact("연락처 010-1234-5678 / 대외비");
    expect(r.text).not.toContain("010-1234-5678");
    expect(r.text).toContain("[phone]");
    expect(r.text).toContain("대외비"); // 키워드는 남김
    expect(r.redactedCount).toBe(1);
  });
});

describe("applySafety", () => {
  const src = [{ id: "s1", text: "홍길동 880101-1234567 대외비 문서" }];
  it("warn(기본): 원문 유지 + 리포트", () => {
    const { sources, report } = applySafety(src, "warn");
    expect(sources[0].text).toContain("880101-1234567");
    expect(report.piiCount).toBeGreaterThanOrEqual(1);
    expect(report.confidentialCount).toBeGreaterThanOrEqual(1);
  });
  it("redact: PII 마스킹된 소스 반환", () => {
    const { sources, report } = applySafety(src, "redact");
    expect(sources[0].text).not.toContain("880101-1234567");
    expect(report.redactedCount).toBeGreaterThanOrEqual(1);
  });
  it("block: 발견 시 throw", () => {
    expect(() => applySafety(src, "block")).toThrow(SafetyBlockedError);
  });
  it("깨끗한 소스는 block 이어도 통과", () => {
    expect(() => applySafety([{ id: "s2", text: "평범한 안내문" }], "block")).not.toThrow();
  });
});
