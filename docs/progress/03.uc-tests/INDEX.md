# 03. 시나리오 테스트 Registry (TEST-S)

> V모델 03. 모든 UC는 ≥1 TEST-S로 닫힘. TEST-S는 ≥1 UC/NFR-REQ 역참조(orphan 0).
> MVP = 통합 스모크 중심. 코드 경로 = `test_ref`.

| ID | 검증대상 | 시나리오 요약 | 형태 | test_ref | 상태 |
|---|---|---|---|---|---|
| TEST-S-001 | UC-001 | text/url 소스를 투입 → 정규화된 Source 객체로 등록됨 | 단위/통합 | `src/test/ingest.test.ts` | Planned |
| TEST-S-002 | UC-002 | 자료 → ServiceCard + Entity/Relation 초안 생성 (stub Extract로 결정론 검증) | 통합 | `src/test/extract.test.ts` | Planned |
| TEST-S-003 | UC-003 | GoldQA 주입 → compile 결과가 gold 답 재현하면 pass, 못하면 gap 리포트 | 통합(인수) | `src/test/verify.test.ts` | Planned |
| TEST-S-004 | UC-004 | 저신뢰/모순 카드만 gaps[]로 표면화, 통과분만 accepted[] | 통합 | `src/test/verify.test.ts` | Planned |
| TEST-S-005 | UC-005 | 근거 카드 있으면 인용 포함 응답, 없으면 abstain | 통합 | `src/test/serve.test.ts` | Planned |
| TEST-S-006 | UC-006 | 만료일 지난 카드 stale 플래그, 승인 전/후 상태 전이 | 단위 | `src/test/govern.test.ts` | Planned |
| TEST-S-007 | UC-007 | RetrievalPort/ExtractPort 어댑터 교체 시 코어 변경 없이 동작 (stub↔alt) | 단위 | `src/test/ports.test.ts` | Planned |
| TEST-S-008 | UC-008 | Store export → 표준 JSON, 재import 시 동일 KB 복원(가반성·무손실) | 통합 | `src/test/export.test.ts` | Planned |
| TEST-S-009 | UC-009 | 소비자가 compile API 호출 → cards 반환 → 외부 적재 콜백 호출됨 (배선) | 통합 | `src/test/api.test.ts` + (admin)`packages/admin/src/test/kb-compile.test.ts` | Pass |
| TEST-S-010 | UC-010 | PII/대외비 포함 자료 → warn(경고)/redact(마스킹)/block(차단). 깨끗한 자료는 통과 | 단위/통합 | `src/test/safety.test.ts`, `src/test/compile.test.ts` | Pass |
| TEST-S-011 | UC-011 | md 프로즈 → 섹션 카드 + Topic/Concept/Reference 엔티티 + mentions/references 관계, 개념 dedup | 단위 | `src/test/markdown.test.ts` | Pass |

## 비고
- MVP(B)에서 TEST-S-001/002/003/004/009 = Pass 목표. 005~008은 인터페이스·일부.
- stub Extract 어댑터로 LLM API 없이 결정론 검증(가짜 성공 방지: 반증 케이스 포함).
