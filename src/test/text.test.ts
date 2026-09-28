/** @spec SPEC-004 / TEST-F-004(보강) — 매칭 정확성: 숫자 정확일치 + 한국어 조사 stem (리뷰 F1/F2). */
import { describe, it, expect } from "vitest";
import { contentQuery, coverage, stem } from "../core/text.js";

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

  it("이름 ↔ 3자 이상 ○○명 매칭 (2자 제외)", () => {
    expect(coverage("회사 이름", "회사명은 넥스테인이다")).toBe(1);
    expect(coverage("이름", "유명 인사")).toBe(0);
    expect(coverage("이름", "설명")).toBe(0);
  });
});

describe("contentQuery (질문 허사 제거)", () => {
  it("회사 이름이 뭐야? → 허사 뭐야 제거", () => {
    expect(contentQuery("회사 이름이 뭐야?")).toBe("회사 이름이");
  });

  it("허사만 있으면 원문 유지", () => {
    expect(contentQuery("뭐야?")).toBe("뭐야?");
  });

  it("인가 유지: 인가 절차 알려줘, 영업 인가는 어떻게 받아?", () => {
    const q1 = contentQuery("인가 절차 알려줘");
    expect(q1).toContain("인가");
    expect(q1).toContain("절차");
    const q2 = contentQuery("영업 인가는 어떻게 받아?");
    expect(q2).toContain("인가");
  });
});
