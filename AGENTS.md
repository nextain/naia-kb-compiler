# naia-kb-compiler

**지식 컴파일러 엔진** — 비전문가가 자료(URL·문서)를 투입하면 **운영 가능한 구조화 지식베이스(KB)** 를 자동 생성·검증해 주는 엔진. NotebookLM이 "읽기 전용 Q&A"에 그치는 것을 넘어, **인용·거버넌스·기권이 붙은 서빙용 KB를 *컴파일*** 한다.

> 표준: [agents.md](https://agents.md/) (AAIF). 이 파일이 **canonical SoT**. `CLAUDE.md`·`GEMINI.md` 는 동일 내용 mirror.

---

## 한 줄 정의

**자료 투입 → 자동 구조화(서비스카드/FAQ) → 운영자가 답한 소수 질의를 *합격 기준(정답 앵커)* 삼아 자가검증 → 못 채운 갭만 사람 확인 → 인용·거버넌스 붙여 서빙.**

전문성을 *운영자* 가 아니라 *엔진* 에 넣는다. 운영자는 "자료 넣고, 질문 몇 개 답하고, 빨간 깃발만 확인".

## 왜 (차별점)

- 자동 추출만으론 부정확(LLM 문서→구조화 ≈ 70~80%, 환각 관계 섞임). → **사람의 소수 정답을 루프 밖 합격 기준**으로 두어 자동추출을 안전하게 게이트한다. (= "정답을 AI 루프 밖에 앵커" 사고)
- 기성품(NotebookLM·Vertex Search·챗봇 플랫폼)은 *조각*만 제공. **[자동구축 + 정답앵커 자가검증 + 거버넌스 + 서빙]의 통합 루프**는 패키지로 없음. 해자 = 새 알고리즘이 아니라 **조합 + 한국 공공/민원 버티컬**.

## 핵심 설계 원칙

1. **도메인·고객·provider 비종속** — 특정 고객/LLM 하드코딩 금지. 어댑터 뒤로.
2. **소스 정본 = 자체 DB(표준·가반 포맷)** — 매니지드 인덱스(Vertex·그래프DB 등)는 *재생성 가능한 캐시*. 정본은 언제든 export 가능한 표준 포맷(JSON/관계형). 락인·종속 최소화.
3. **eval-anchored 큐레이션** — 운영자 정답셋 = 합격 기준 + 회귀(자료 바뀌면 재통과 확인).
4. **안전 우선(공공 표면)** — 근거 없으면 *지어내지 말고 기권*. 범위 게이트(법률/자격판단 거부). 만료·승인·인용 거버넌스.
5. **비전문가 운영자 UX** — 폼·승인만. JSON/임베딩/튜닝 노출 금지.
6. **서비스(API) + 전 구간 port/adapter** — 모든 외부 의존(LLM·임베딩·검색백엔드·저장소·파서)을 **포트 뒤 어댑터**로. 한 provider/백엔드에 갇히지 않음. (첫 소비자가 있으나 *비종속*.)

## 지식 표현 — 그래프 "데이터"는 항상, "엔진"은 어댑터

이 레포의 지식 구성 역할은 **그래프 *데이터*(엔티티·관계)는 늘 만들되, 그래프 *엔진/백엔드* 채택은 포트 뒤 선택**으로 둔다.

```
[추출]  LLM이 자료 → 엔티티(서비스·부서·서류·수수료·조건) + 관계(requires_document·handled_by·has_condition·refers_to)
   ↓
[표현]  서비스카드(필드 + 링크) = 경량 그래프 데이터, 자체 DB에 표준 포맷으로 저장 (= 정본)
   ↓
[검증]  운영자 정답 앵커로 추출 게이트 (자동추출 70~80% 문제 차단)
   ↓
[투영]  검색 표현으로 투영 — RetrievalPort 뒤 어댑터 교체:
         · 기본 = 벡터 RAG(매니지드/자체)
         · 트리거(구청 간 상호참조·자격추론·감사) 시 = 그래프(LightRAG/LazyGraphRAG/Spanner Graph)
```

정본이 표준 그래프 데이터라, **벡터든 그래프든 어느 백엔드로도 재투영 가능** = 우리도 소비자도 특정 검색 엔진에 갇히지 않음.

## 포트(교체 가능 경계) — 최소 집합

| Port | 책임 | 어댑터 예 |
|------|------|----------|
| `IngestPort` | URL 크롤·문서 파싱 | http-crawler / pdf·hwp·docx 파서 |
| `ExtractPort` | 자료 → 엔티티·관계·카드 초안 | Gemini / Claude / 로컬 LLM |
| `EmbedPort` | 임베딩 | Vertex / BGE-M3·KURE(자체) |
| `RetrievalPort` | 검색(투영) | 벡터(pgvector·Vertex Search) / 그래프(LightRAG·Spanner) |
| `StorePort` | 정본 저장(가반) | Postgres(JSON/관계형, export 가능) |
| `GeneratePort` | grounded 응답 | Gemini / 로컬 (게이트웨이 경유) |

모든 어댑터는 설정으로 스왑. 코어 로직은 어떤 어댑터인지 모른다.

## 소유권 / 라이선스 / 비종속

- **소유**: 넥스테인(Nextain) 자산(배경 IP). 본 레포는 **독립 자산** — 소비 응용과 레포·소유 분리.
- **상호 비종속(핵심)**: 소비자는 **언제든 이 엔진을 다른 솔루션으로 교체 가능**해야 한다. 이를 *법적 문구가 아니라 설계로 보장* — port/adapter, 표준·가반 포맷 정본, 재생성 가능 인덱스. 종속(lock-in)을 만드는 설계는 금지. (넥스테인도 특정 provider/백엔드에 안 묶임 — 양방향.)
- 상세 = `OWNERSHIP.md` + 별도 계약(SoT).

---

## Mandatory Reads (세션 시작 시)

1. `.agents/context/agents-rules.json` — 규칙 SoT
2. `.agents/context/project-index.yaml` — 컨텍스트 인덱스
3. `docs/progress/01.requirements/INDEX.md` — 요구사항(REQ)

## 구조 (계획)

```
naia-kb-compiler/
├── AGENTS.md (=CLAUDE/GEMINI.md)   # AI 진입점(SoT)
├── OWNERSHIP.md                    # IP/라이선스
├── .agents/context/               # 규칙·인덱스 (AI SoT)
├── .users/ko/                      # 사람용 한국어 mirror
├── docs/progress/                  # V모델 산출물 (REQ→UC→TEST-S→SPEC→TEST-F)
├── src/                            # 엔진 소스 (ingest·structure·verify·govern·serve)
└── scripts/                        # 검증·운영 스크립트
```

## V모델 게이트

P01 사용자 시나리오 → P02 테스트 시나리오 → P03 요구사항 → P04 통합 테스트 → P05 완료.
신규 기능은 이 순서. 코드 전 REQ/UC 먼저.

## 라이선스 가시성

**Apache 2.0 오픈소스.** 특허 대상이 있으면 그것만 별도 보호.
