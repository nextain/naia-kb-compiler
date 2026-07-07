/** 테스트 공용 픽스처 — ○○구청류 민원 자료(결정론). */
import type { SourceInput, GoldQA } from "../domain/types.js";

export const SOURCES: SourceInput[] = [
  {
    kind: "text",
    title: "여권 발급",
    uri: "https://gov.example.kr/passport",
    text: [
      "여권 발급",
      "대상: 대한민국 국민 누구나",
      "필요서류: 신분증, 여권용 사진 1매",
      "담당: 민원여권과",
      "수수료: 53000원",
      "운영시간: 평일 09:00~18:00",
    ].join("\n"),
  },
  {
    kind: "text",
    title: "전입신고",
    uri: "https://gov.example.kr/move-in",
    text: [
      "전입신고",
      "대상: 새로 이사 온 세대주",
      "필요서류: 신분증",
      "담당: 주민센터",
      "수수료: 무료",
    ].join("\n"),
  },
];

export const GOLD: GoldQA[] = [
  { q: "여권 발급 수수료 얼마야?", a: "53000원" },
  { q: "전입신고 필요서류?", a: "신분증" },
];
