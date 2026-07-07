# 04. 기능 설계 Registry (SPEC)

> V모델 04. 모든 SPEC는 ≥1 UC 역참조 + ≥1 TEST-F로 닫힘(orphan 0). 마크다운은 SPEC(의도)까지, 그 아래는 코드(`src`).

| ID | 유도 UC | 기능 요약 | 계층 | 상태 | TEST-F |
|---|---|---|---|---|---|
| SPEC-001 | UC-002,007 | **도메인 모델 + 포트 인터페이스** — Source/ServiceCard/Entity/Relation/GoldQA/Kb 타입 + 6 포트(Ingest/Extract/Embed/Retrieval/Store/Generate) 인터페이스. 코어는 어댑터 비의존. | core | Planned | TEST-F-001 |
| SPEC-002 | UC-001 | **Ingest 어댑터** — text/url → 정규화 Source. (문서 파서는 후속 어댑터) | adapter | Planned | TEST-F-002 |
| SPEC-003 | UC-002 | **Extract** — 자료 → 카드·엔티티·관계 초안. 어댑터: `stub`(결정론, 테스트용) + `gemini`(실, ADC). | adapter | Planned | TEST-F-003 |
| SPEC-004 | UC-003,004 | **eval-anchored Verify** — GoldQA로 생성 KB 자가검증: 각 gold 질의를 KB로 답해보고 기대와 비교 → accepted[]/gaps[]/score. 통과분만 채택. | core | Planned | TEST-F-004 |
| SPEC-005 | UC-008 | **Store + Export** — 정본 저장(in-memory + pg 어댑터) + 표준 JSON 무손실 export/import. | adapter | Planned | TEST-F-005 |
| SPEC-006 | UC-009 | **Compile 오케스트레이션 + API** — ingest→extract→verify→store 파이프라인 + `compile()` 함수 + HTTP 핸들러. 소비자가 호출. | core | Planned | TEST-F-006 |
| SPEC-007 | UC-002,007 | **Retrieval 투영 어댑터** — 카드/엔티티 → 검색 표현. `in-memory`(키워드+간이) 기본, `vector`/`graph` 인터페이스 placeholder. | adapter | Planned | TEST-F-007 |
| SPEC-008 | UC-005 | **서빙(KnowledgeService: 검색·질의응답)** — 빌드된 KB 위 retrieval + 추출형 grounded 답변 + 인용 + 근거없으면 기권(GeneratePort 주입 시 LLM 생성). agent/omni/CMS 공용 진입점. | core | Done | TEST-F-008 |
| SPEC-009 | UC-006 | **거버넌스** — 만료/재검토일·승인 상태·버전. | core | Deferred | TEST-F-009 |
| SPEC-010 | UC-010 | **안전(PII·대외비)** — scanSensitive(주민번호·전화·이메일·카드·계좌·여권 + 대외비 키워드) + redact + applySafety(warn/redact/block). compile 통합(외부 추출 전). | core | Done | TEST-F-010 |
| SPEC-011 | UC-011 | **Markdown 추출 어댑터** — 헤딩→섹션 카드, 굵은 용어→Concept, 링크→Reference, 그래프 관계(mentions/references). 로컬·결정론. | adapter | Done | TEST-F-011 |

## MVP 범위 (B)
**SPEC-001~006 구현 + SPEC-007 최소(in-memory).** SPEC-008/009 = 인터페이스/Deferred.
계층: core(어댑터 비의존 도메인·오케스트레이션) / adapter(교체 가능 구현). NFR-001(port/adapter)·NFR-002(가반성) = SPEC-001/005가 담보.
