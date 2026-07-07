# 통합 아키텍처 — naia-adk / naia-agent / naia-memory / naia-os

> 결정 기록(ADR). 2026-06-16 대화 + 다중 AI 크로스리뷰(3렌즈) 반영. naia-kb-compiler를 별도 제품이 아니라 **naia 스택의 지식 능력**으로 흡수하는 설계.

## 0. 전제 (전략)
- naia-kb-compiler = **넥스테인 소유 자산**, 별도 *제품*이라기보다 naia 스택의 지식 능력. 가치 = **온프레/대외비 + 한국 버티컬 + SI 원가레버 + 내부 인프라**.
- 라이선스 = **Apache 2.0**. 기업·파트너 관련 조건은 별도 계약.

## 1. 역할 분담 (직교)
| 구성 | 책임 | 주입 |
|---|---|---|
| **naia-adk** | 지식이 사는 곳 + 컴파일·큐레이션·RBAC·거버넌스 (빌드/관리 타임). data-private(T3)/data-teams(T2)/data-company/projects. | — |
| **naia-agent** | 컴파일된 KB **런타임 서빙**(검색/Q&A 툴). RAG/컨텍스트 책임. | 풀(tool) |
| **naia-memory** | **개인 기억**(자전적·대화·관계). | 푸시(능동회상) |
| **naia-kb-compiler** | 문서→KB 컴파일·검증(eval-anchored)·안전(PII/대외비)·서빙(KnowledgeService). adk 능력으로 흡수, agent가 소비. | 풀 |

**경계 한 줄**: memory=기억(WHO, 푸시) / kb-compiler=지식(WHAT, 풀). 안 섞음(조직문서→개인기억 금지, 개인이력→공유KB 금지).

## 2. naia-adk 최적화 (RBAC tier-aware)
- tier별 인덱스 분리. **data-private(T3) = 로컬 전용·클라우드 미전송·redact/block·하위 tier 질의서 비노출**. data-teams(T2)=팀 스코프. 질의 시 호출자 tier가 검색 가능 tier 결정(RBAC 격리).
- 안전필터 ↔ tier 정합(T3=대외비/PII).
- **포크 전파**: naia-adk base에 넣으면 모든 포크(org-adk·user-adk·alpha-adk)가 자기 data 폴더 Q&A 상속 = 컨텍스트 유지 SW 공급 비전.
- 패키징 = ADK 스킬(`/kb compile|search|ask`, tier 인자).

## 3. naia-agent 연계 (런타임)
- kb-compiler를 agent의 **툴/검색 백엔드**로 등록(강제주입 아님). `KnowledgeService.search/ask` 소비.
- memory와 EmbedPort(BGE-M3 q8 로컬) 공유 → RAM·중복 절감. 둘 다 로컬 추론(프라이버시).

## 4. naia-os UI (크로스리뷰 반영 — 원안 수정)
- **전용 `knowledge` 패널**(상시 chrome 아님) — 에이전트가 `skill_knowledge_*` 툴 호출 시 **자동 표시**(naia-os 패널-소유-툴 auto-switch 메커니즘 재사용). "sprawl 없음 + 주소화 목적지 + 맥락 등장" 동시 충족.
- **탭**(워크스페이스 탭 패턴): Sources(인용·핀) / Browse·검색(+**신선도·커버리지 스트립**) / Graph(force-directed) / Manage(컴파일·재인덱싱·갭·tier, 경량).
- **신선도 브릿지(필수)**: 답변 시 인덱스 신선도 + 재인덱싱 노출 → 소비↔큐레이션 연결, stale 답변 신뢰사고 방지, 기능 상시 존재감.
- **검색 지능 = naia-agent**(Shell↔agent=stdio IPC, Shell은 렌더만). 초기엔 tool-result JSON을 패널이 렌더, 인용 청크 와이어변경은 후순위.
- **무거운 운영 콘솔 = admin 앱**(개인=자동패널 / 운영자=전용 콘솔, 기준=큐레이션 빈도).
- 구현 최저비용 경로: `sample-note` 패널 복사 → `knowledge` 패널 + `skill_knowledge_*` 툴(impl=agent) + Sources 패널 렌더 + Manage/Graph 탭.

## 5. 미해결 / 다음
- ADK 스킬화 + tier 격리 RetrievalPort.
- naia-agent 툴 등록 + 서빙 배선.
- naia-os `knowledge` 패널(위 4) — naia-os/naia-agent 양 repo 작업.
- 파트너: naia 통째 vs 지식 조각만 → 흡수(A) vs 얇은 모듈(B) 결정.

## 크로스리뷰 출처
- R1 UX/IA: NEEDS-REVISION(신선도 브릿지·주소화 목적지·폴더≠지식). R2 전용패널 옹호: ONLY-FOR-OPERATORS(개인=fold/자동, 운영자=콘솔, 기준=큐레이션 빈도). R3 naia-os 타당성: FEASIBLE-WITH-CHANGES(패널-소유-툴 auto-switch가 동적 메커니즘, 검색=agent-side, 워크스페이스 탭 실재, 그래프=신규 lib).
