/** @spec SPEC-004 / TEST-F-004(보강) — 매칭 정확성: 숫자 정확일치 + 한국어 조사 stem (리뷰 F1/F2). */
import { describe, it, expect } from "vitest";
import { contentQuery, coverage, isLabelHeading, stem } from "../core/text.js";

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

  it("이름 ↔ ○○명 규칙 축소: 다른 내용 토큰 접두가 같을 때만 매칭", () => {
    expect(coverage("이름", "직원 15명")).toBe(0);
    expect(coverage("이름", "스무명")).toBe(0);
    expect(coverage("이름", "무기명")).toBe(0);
    expect(coverage("회사 이름", "회사 파일명은 readme.md")).toBe(0.5);
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

  it("추가 질문 허사 제거", () => {
    expect(contentQuery("수수료는 얼마야?")).toBe("수수료는");
    expect(contentQuery("수수료가 뭐였지?")).toBe("수수료가");
    expect(contentQuery("수수료가 얼마예요?")).toBe("수수료가");
    expect(contentQuery("수수료가 얼마에요?")).toBe("수수료가");
    expect(contentQuery("비용이 얼마나?")).toBe("비용이");
    expect(contentQuery("담당 누구지?")).toBe("담당");
    expect(contentQuery("배포 언제?")).toBe("배포");
    expect(contentQuery("이유가 왜?")).toBe("이유가");
    expect(contentQuery("회사 어디?")).toBe("회사");
    expect(contentQuery("사무실 어디예요?")).toBe("사무실");
    expect(contentQuery("사무실 어디에요?")).toBe("사무실");
    expect(contentQuery("담당은 누구예요?")).toBe("담당은");
    expect(contentQuery("담당은 누구에요?")).toBe("담당은");
    expect(contentQuery("수수료는 얼마죠?")).toBe("수수료는");
    expect(contentQuery("담당 누구?")).toBe("담당");
  });

  it("contentQuery idempotent 확인", () => {
    const queries = ["회사 이름이 뭐야?", "환불 있어?", "수수료는 얼마야?", "담당 누구지?", "뭐야?"];
    for (const q of queries) {
      expect(contentQuery(contentQuery(q))).toBe(contentQuery(q));
    }
  });
});

describe("isLabelHeading (라벨 제목 판정)", () => {
  it("라벨 제목: 내용 토큰이 모두 질의에 적중", () => {
    expect(isLabelHeading("## 배포 규칙", "배포 규칙이 뭐였지?")).toBe(true);
    expect(isLabelHeading("## 배포 규칙", "배포 규칙")).toBe(true);
    expect(isLabelHeading("## 회사명", "회사 이름이 뭐야?")).toBe(true);
    expect(isLabelHeading("## 환불", "환불")).toBe(true);
  });

  it("질의 밖 토큰이 포함된 제목은 라벨 제목이 아님", () => {
    expect(isLabelHeading("## 배포 규칙은 0755 이후 금지", "배포 규칙이 뭐야?")).toBe(false);
    expect(isLabelHeading("## 환불은 7일 이내", "환불 알려줘")).toBe(false);
    expect(isLabelHeading("## 환불은 7일 이내", "환불 있어?")).toBe(false);
    expect(isLabelHeading("### 0755 이후 금요일 배포 금지", "0755")).toBe(false);
    expect(isLabelHeading("### 0755 이후 금요일 배포 금지", "배포")).toBe(false);
    expect(isLabelHeading("## 나이아 제품 전시 소개", "default 회사 제품 전시 소개")).toBe(false);
  });
});
