# 05. 기능 테스트 Registry (TEST-F)

> V모델 05. 모든 SPEC는 ≥1 TEST-F로 닫힘. 실제 코드 = `src/test`(vitest). 이 표 = 의도·추적.

| ID | 검증 SPEC | 테스트 요약 | test_ref | 상태 |
|---|---|---|---|---|
| TEST-F-001 | SPEC-001 | 도메인 타입 생성·포트 인터페이스 계약(목 어댑터가 인터페이스 충족) | `src/test/ports.test.ts` | Planned |
| TEST-F-002 | SPEC-002 | text→Source, url→Source(크롤 목), 빈/오류 입력 처리 | `src/test/ingest.test.ts` | Planned |
| TEST-F-003 | SPEC-003 | stub Extract: 자료→카드·엔티티·관계 결정론 / gemini 어댑터는 계약만(목) | `src/test/extract.test.ts` | Planned |
| TEST-F-004 | SPEC-004 | gold 재현 시 accepted, 불일치 시 gap; 모순 카드 탐지; score 계산; **반증**(틀린 KB는 gap으로 잡힘) | `src/test/verify.test.ts` | Planned |
| TEST-F-005 | SPEC-005 | store 저장·조회, export JSON ↔ import 라운드트립 동일성(무손실) | `src/test/store.test.ts` | Planned |
| TEST-F-006 | SPEC-006 | compile 파이프라인 end-to-end(stub 어댑터): 소스+gold → {cards, report}; API 핸들러 200 | `src/test/compile.test.ts` | Planned |
| TEST-F-007 | SPEC-007 | in-memory retrieval: 질의→관련 카드 반환, 어댑터 교체 가능 | `src/test/retrieval.test.ts` | Planned |
| TEST-F-008 | SPEC-008 | KnowledgeService search(스니펫·점수)·ask(grounded 답변+출처)·근거없으면 기권 | `src/test/serve.test.ts` | Pass |
| TEST-F-009 | SPEC-009 | (Deferred) 만료/승인/버전 | — | Deferred |
| TEST-F-010 | SPEC-010 | PII(주민번호·전화·이메일·카드) + 대외비 탐지, redact 마스킹, block throw, 깨끗한 텍스트 0(반증), compile warn/redact 통합 | `src/test/safety.test.ts`, `src/test/compile.test.ts` | Pass |
| TEST-F-011 | SPEC-011 | md → 섹션 카드 + Topic/Concept/Reference + mentions/references, 개념 dedup | `src/test/markdown.test.ts` | Pass |

## 비고
MVP green 목표 = TEST-F-001~007. 008/009 Deferred. stub 어댑터로 API 없이 결정론 검증.
