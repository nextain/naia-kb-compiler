/** @spec SPEC-004 / TEST-F-004(보강) — 매칭 정확성: 숫자 정확일치 + 한국어 조사 stem (리뷰 F1/F2). */
import { describe, it, expect } from "vitest";
import { coverage, stem } from "../core/text.js";

describe("coverage 매칭(리뷰 반영)", () => {
  it("숫자 부분포함 오탐 방지: 300원 ⊄ 1300원", () => {
    expect(coverage("300원", "수수료 1300원")).toBe(0);
    expect(coverage("100", "전화 02-1004")).toBe(0);
  });

  it("정확 숫자는 매칭: 53000원", () => {
    expect(coverage("53000원", "수수료: 53000원")).toBe(1);
  });

  it("한국어 조사 무시: 신분증이 = 신분증", () => {
    expect(coverage("신분증이 필요합니다", "전입신고 신분증 주민센터")).toBeGreaterThanOrEqual(0.5);
  });

  it("stem: 조사 절단, 숫자 보존", () => {
    expect(stem("신분증이")).toBe("신분증");
    expect(stem("○○구청은")).toBe("○○구청");
    expect(stem("53000원")).toBe("53000원");
  });
});
