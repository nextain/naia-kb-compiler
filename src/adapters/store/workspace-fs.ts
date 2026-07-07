/** @spec SPEC-005 — Store 어댑터(워크스페이스 파일). 정본 Kb 를 워크스페이스에 가반 JSON 으로 영속.
 *
 *  - 메모리 어댑터(`memory.ts`)와 **동일 envelope `{version:1, kb}`** → export/import 상호 호환
 *    (한 어댑터의 export 를 다른 어댑터가 import 가능 = 가반성, NFR-002 / D02 no-lockin).
 *  - 저장 위치 = `{dir}/kb.json` (예: `{adkPath}/knowledge/{scope}/kb.json`). dir 은 소비자가 결정·주입
 *    (코어/어댑터는 adkPath·scope 해소를 모른다 = D01 비종속).
 *  - 파일은 사람이 들여다볼 수 있게 pretty-print, export() 는 정규 compact envelope 반환.
 *
 *  ⚠️ 범위: 본 어댑터는 **Kb 만** 영속한다(StorePort 계약 `save(kb)`). 원본 소스 바이트(`sources/`)·운영자
 *  정답셋(goldQA)·거버넌스는 `Kb` 에 없어 본 어댑터로 보존되지 않는다(별도 경로 필요 — 통합 설계 K0 후속).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { StorePort } from "../../domain/ports.js";
import type { Kb } from "../../domain/types.js";

const EMPTY: Kb = { cards: [], entities: [], relations: [] };
const ENVELOPE_VERSION = 1;

export interface WorkspaceStoreOptions {
  /** kb.json 이 저장될 디렉터리. 예: `{adkPath}/knowledge/{scope}`. */
  dir: string;
  /** 파일명(기본 `kb.json`). */
  fileName?: string;
}

/** 표준 envelope 검증 + Kb 추출. 형태 불일치 시 throw(잘못된 import 차단). */
function parseEnvelope(json: string): Kb {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("잘못된 KB export 포맷(JSON 파싱 실패)");
  }
  const kb = (parsed as { kb?: unknown } | null)?.kb as Kb | undefined;
  if (
    !kb ||
    !Array.isArray(kb.cards) ||
    !Array.isArray(kb.entities) ||
    !Array.isArray(kb.relations)
  ) {
    throw new Error("잘못된 KB export 포맷");
  }
  return kb;
}

export class WorkspaceStoreAdapter implements StorePort {
  private readonly file: string;

  constructor(opts: WorkspaceStoreOptions) {
    this.file = join(opts.dir, opts.fileName ?? "kb.json");
  }

  async save(kb: Kb): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const payload = JSON.stringify({ version: ENVELOPE_VERSION, kb }, null, 2);
    await writeFile(this.file, payload, "utf8");
  }

  async load(): Promise<Kb> {
    const json = await this.readOrNull();
    if (json === null) return structuredClone(EMPTY); // 첫 실행(파일 없음) = 빈 KB
    return parseEnvelope(json);
  }

  /** 정규 compact envelope `{version:1, kb}`(메모리 어댑터와 동일) — 어느 store 로도 import 가능. */
  async export(): Promise<string> {
    const kb = await this.load();
    return JSON.stringify({ version: ENVELOPE_VERSION, kb });
  }

  async import(json: string): Promise<void> {
    await this.save(parseEnvelope(json)); // 검증 후 영속
  }

  private async readOrNull(): Promise<string | null> {
    try {
      return await readFile(this.file, "utf8");
    } catch (e: unknown) {
      if (e && typeof e === "object" && (e as { code?: string }).code === "ENOENT") return null;
      throw e; // 권한/손상 등은 fail (조용히 빈 KB 로 덮지 않음)
    }
  }
}
