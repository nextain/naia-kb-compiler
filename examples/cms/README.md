# 테스트용 웹 CMS

엔진을 눈으로 테스트하는 경량 웹 UI — 자료 붙여넣기 → **안전스캔/컴파일** → KB·지식그래프·갭·개인정보/대외비 경고를 화면에서 확인. 프레임워크 없음(node:http + 단일 HTML).

```bash
pnpm build                  # dist 필요
node examples/cms/server.mjs   # → http://localhost:7878 (PORT 환경변수로 변경)
```

- **자료(소스)**: 문서/URL 본문 붙여넣기(markdown 가능), 여러 개 추가.
- **정답 앵커(goldQA)**: `질문 | 정답` 한 줄씩 → eval-anchored 검증.
- **추출기**: markdown(프로즈→그래프) / stub(키:값). **안전 모드**: warn/redact/block.
- **결과**: 리포트(카드·accepted·gap·score) · 안전(PII·대외비) · 지식그래프(엔티티/관계/Top개념) · 갭 · 카드 목록.

엔드포인트: `POST /api/compile`, `POST /api/safety` (둘 다 `@naia/kb-compiler` dist 사용).
