/** @spec SPEC-004/007 — 텍스트 정규화·토큰·매칭 (어댑터 비의존, 결정론).
 * 리뷰 반영(F1/F2): 숫자/단위 토큰은 정확 일치(1300원 ⊉ 300원), 한국어는 조사 stem + 양방향 부분일치(신분증이 = 신분증).
 */

export function normalize(s: string): string {
  return (s ?? "").normalize("NFC").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

/** 의미 토큰(길이 ≥2, 공백·구두점 분리). */
export function tokens(s: string): string[] {
  return (s ?? "")
    .normalize("NFC")
    .toLowerCase()
    .split(/[\s\p{P}\p{S}]+/u)
    .filter((t) => t.length >= 2);
}

// 흔한 한국어 조사(어미는 미포함 — MVP). 끝에서 1회 제거.
const JOSA = /(으로서|으로써|에서는|에게서|에서|께서|이라고|라고|이라는|라는|으로|은|는|이|가|을|를|에|의|와|과|도|로|만|께|한테|에게|까지|부터|보다|처럼|마다|이나|나)$/;

/** 숫자 포함 토큰은 변형 안 함(정확 매칭 대상). 그 외 조사 1회 절단. */
export function stem(t: string): string {
  if (/\d/.test(t)) return t;
  const m = t.match(JOSA);
  if (m && t.length - m[0].length >= 2) return t.slice(0, t.length - m[0].length);
  return t;
}

function tokenMatch(needle: string, hayTokens: string[]): boolean {
  if (/\d/.test(needle)) {
    // 숫자/단위: 정확 일치만 (1300원이 300원을 포함으로 오탐 방지)
    return hayTokens.includes(needle);
  }
  const ns = stem(needle);
  if (ns.length < 2) return hayTokens.includes(needle);
  return hayTokens.some((h) => {
    const hs = stem(h);
    return hs === ns || hs.includes(ns) || ns.includes(hs); // 붙여쓰기 양방향 부분일치
  });
}

/** haystack 안에 needle 토큰이 얼마나 들어있나 (0..1). 정답 재현/질문 관련성 공통. */
export function coverage(needle: string, haystack: string): number {
  const ns = tokens(needle);
  if (ns.length === 0) return 0;
  const hayToks = tokens(haystack);
  let hit = 0;
  for (const t of ns) if (tokenMatch(t, hayToks)) hit++;
  return hit / ns.length;
}

/** Conversational fillers that must not gate grounded answers.
 *  Product questions like "회사 이름이 뭐야?" still have to match compiled cards. */
const QUESTION_FILLERS = new Set([
  "뭐야", "뭐예요", "뭐에요", "무엇인가", "무엇인가요", "뭔가요", "뭔데", "뭐가", "뭐",
  "알려줘", "알려주세요", "인가", "인가요", "일까", "일까요",
  "어디야", "언제야", "누구야", "어때", "어떻게",
  "있어", "있나요", "있습니까", "있니", "있나",
  "what", "whats", "who", "where", "when", "how", "please", "tell",
  "the", "is", "are", "a", "an", "does", "do", "of", "in",
]);

/** Drop interrogative/filler tokens. Empty result falls back to the original query. */
export function contentQuery(query: string): string {
  const kept = tokens(query).filter((t) => {
    const s = stem(t);
    return !QUESTION_FILLERS.has(t) && !QUESTION_FILLERS.has(s);
  });
  return kept.length ? kept.join(" ") : query;
}
