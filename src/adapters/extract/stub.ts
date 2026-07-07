/** @spec SPEC-003 — Extract 어댑터(stub): 결정론. 자료의 `키: 값` 라인 → 카드·엔티티·관계. 테스트·오프라인용. */
import type { ExtractPort, ExtractResult } from "../../domain/ports.js";
import type { Source, ServiceCard, Entity, Relation } from "../../domain/types.js";

const KEY_MAP: Record<string, string> = {
  자격: "eligibility", 대상: "eligibility", 조건: "eligibility",
  서류: "documents", 필요서류: "documents", 구비서류: "documents",
  담당: "department", 부서: "department", 담당부서: "department",
  수수료: "fee", 비용: "fee", 요금: "fee",
  시간: "hours", 운영시간: "hours", 영업시간: "hours",
  전화: "phone", 연락처: "phone",
  url: "url", 주소: "address", 링크: "url",
};

export class StubExtractAdapter implements ExtractPort {
  async extract(sources: Source[]): Promise<ExtractResult> {
    const cards: ServiceCard[] = [];
    const entities: Entity[] = [];
    const relations: Relation[] = [];
    // 호출별 로컬 카운터 → 같은 입력은 같은 id(결정론). 종류별 분리.
    let cardN = 0;
    let entN = 0;
    const id = (p: string) => (p === "card" ? `card_${++cardN}` : `ent_${++entN}`);

    for (const s of sources) {
      const lines = s.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const title = (s.title || lines[0] || "무제").slice(0, 200);
      const fields: Record<string, string> = { content: s.text };
      let recognized = 0;

      for (const line of lines) {
        const m = line.match(/^([^:：]{1,20})\s*[:：]\s*(.+)$/);
        if (!m) continue;
        const rawKey = m[1].trim();
        const val = m[2].trim();
        const key = KEY_MAP[rawKey.toLowerCase()] ?? KEY_MAP[rawKey];
        if (key) {
          fields[key] = val;
          recognized++;
        } else {
          fields[rawKey] = val;
        }
      }

      const confidence = Math.min(0.95, 0.4 + 0.12 * recognized);
      const cardId = id("card");
      cards.push({
        id: cardId,
        title,
        fields,
        sourceUris: s.uri ? [s.uri] : [],
        confidence,
        status: "draft",
      });

      // 경량 그래프 데이터: Service 노드 + 필드 기반 관계
      const svc: Entity = { id: id("ent"), type: "Service", name: title };
      entities.push(svc);
      const link = (type: string, entType: string, key: string) => {
        if (!fields[key]) return;
        const e: Entity = { id: id("ent"), type: entType, name: fields[key] };
        entities.push(e);
        relations.push({ from: svc.id, type, to: e.id });
      };
      link("handled_by", "Department", "department");
      link("requires_document", "Document", "documents");
      link("costs", "Fee", "fee");
    }

    return { cards, entities, relations };
  }
}
