---
session_id: 2314b6df-bf3b-4f23-9020-0d4c5ebff471
topic: 지식그래프 뷰어 가독성/직관성 개선
status: done
started: 2026-06-16
---

# 지식그래프 뷰어를 "더 와닿게" 개선

## 배경
- naia-kb-compiler 데모 UI의 지식그래프(server graph)가 2D force 레이아웃.
- 루크 피드백: "노드 간 거리가 눈에 와닿지 않는다 / 좀 더 와닿게 만들 수 없냐".
- 거리=의미가 아니라 force 부산물이라 직관과 안 맞는 구조적 한계.

## 목표
현재 뷰어 구현 확인 → 거리 대신 위상/군집/허브가 한눈에 들어오도록 개선안 도출 → 적용.

## 진단 (실제 데이터 기준)
- viz = `benchmark/results/nextain-strategy-viz.json` (gitignored). 뷰어 = `examples/cms/graph.{html,js}`, server.mjs `/viz/<name>`.
- 안 와닿던 원인 = 2D force뿐 아니라 **데이터가 얇음**: 노드타입 2종(Topic/Concept)·관계 1종(`mentions`)·허브가 보일러플레이트(작성일/합계/상태).
- 구조적 핵심 = Topic-mentions-Concept **이분(bipartite)** → Concept끼리 연결 0 → 군집 자체가 불가.
- 노이즈 출처 = 표/양식의 굵은 라벨이 Concept로 승격. 추출기 = 결정론 markdown(`src/adapters/extract/markdown.ts`, SPEC-003, LLM 미사용).

## 조치 (추출 데이터 개선 — 루크 선택 "근본")
1. **노이즈 필터** (`markdown.ts`): `BOILERPLATE` 라벨셋 + `isValueTerm`(숫자시작·단위만) → 굵은 용어가 노이즈면 Concept 제외.
2. **co_occurs 관계**: 같은 섹션 공출현 Concept쌍 누적 → `coOccurMin`(기본 2) 이상만 무방향 관계. Concept-Concept 엣지 = 주제 군집.
3. 테스트 3건 보강(`markdown.test.ts`): 노이즈 제외·co_occurs 양성(min1)·약신호 차단(min2).

## 결과 (검증)
- 전체 vitest **51 passed** (exit 0), `pnpm build` clean.
- 코퍼스(117 md) 재생성: 관계타입 2→3종(mentions 2726·references 64·**co_occurs 586**), Concept 2159→2099(노이즈 제거).
- viz: 엣지타입 {mentions 283, **co_occurs 176**}, 잔존 노이즈 허브 **0**, top=의미구절.
- **벤치 FAIL은 회귀 아님**: stash로 변경 전 코드 재현 → 동일 compile 0.666/held-out 67%/exit1. gold QA 1개 미검색(카드·검색 영역, 본 작업과 직교).

## 후속 (선택)
- 뷰어 군집화(graph.js): community 색칠 + 군집 공간분리 + 허브 라벨 강화 → "와닿음" 한 단계 더. (데이터는 이미 군집 가능 상태)
- 의미 typed relation(requires_document·handled_by 등) = ExtractPort gemini 어댑터 경로(LLM). 결정론 markdown 범위 밖.
- 벤치 gold QA 1건 미검색 별도 조사(직교).

상태: **done** (데이터 개선분). 뷰어에서 "서버 그래프 불러오기" 재클릭 시 반영.

## 2차 — 뷰어 시각화 강화 (루크 "둘다"+"있어보이게"+"범례")
신규/수정 파일(examples/cms/):
- `graph-common.js` (신규) — 라벨전파 군집탐지(의존성0·결정론) + 군집 팔레트 + 관계타입 색/의미 + `buildLegendHTML`. 2D·3D 공용.
- `graph.js` (개선) — 노드=군집색·섹션 링(◎)·개념 원(○)·링크 다이아(◇)·크기=degree, 엣지=타입색+weight굵기, 군집 centroid 분리력, hover 콜백, 범례데이터 반환.
- `graph3d.js`+`graph3d.html` (신규) — WebGL/CDN 없이 캔버스 3D force(x,y,z) 투영 + 마우스 궤도 + 자동회전 + 원근 깊이감(크기/알파). 오프라인·의존성0.
- `graph.html` (개선) — 의미 범례(군집·관계·크기·거리설명) + hover 정보패널 + 3D 링크.
- `server.mjs` — `/graph-common.js`·`/graph3d.html`·`/graph3d.js` 라우트 추가.
데이터: `Relation.weight`(types) + co_occurs 공출현횟수(markdown) + viz 전달(run-corpus).

검증: JS 5개 `node --check` OK, `pnpm build` clean, **vitest 51 passed(exit0)**, viz weight 2~9(176엣지), 군집 16개(상위17·17·14). 서버 재시작 후 전 라우트 200·corpus ready(117/924).
⚠️ 미검증 = **브라우저 실제 캔버스 렌더링**(헤드리스 불가) → 루크 화면 하드리프레시 확인 필요.
함정 기록: 옛 서버 프로세스는 새 라우트 미보유 → graph-common.js 404 → `GRAPH_COMMON undefined`. **정적 라우트 추가 시 기동 중 서버 재시작 필수**(파일은 매 요청 fresh read지만 라우트는 기동시 고정).
