/** @spec SPEC-005 — Store 어댑터(file-backed): <dir>/kb.json 에 표준 envelope({version:1, kb}) 영속.
 *  MemoryStoreAdapter(in-memory)의 fs 형제 — 정본 가반 포맷(무손실). 소비자(naia-agent K1b compile)가
 *  outDir 을 주입하면 compile 내부 store.save(kb) 가 여기로 영속한다. K-SEC: <dir> 안에만 씀. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { StorePort } from "../../domain/ports.js";
import type { Kb } from "../../domain/types.js";

const EMPTY: Kb = { cards: [], entities: [], relations: [] };

export interface WorkspaceStoreOptions {
  /** 출력 디렉터리 — kb.json 이 이 안에 쓰인다(예: <adk>/knowledge/<scope>). */
  dir: string;
  /** 파일명 override(기본 kb.json). */
  filename?: string;
}

export class WorkspaceStoreAdapter implements StorePort {
  private readonly dir: string;
  private readonly path: string;
  constructor(opts: WorkspaceStoreOptions) {
    this.dir = opts.dir;
    this.path = join(opts.dir, opts.filename ?? "kb.json");
  }

  async save(kb: Kb): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.path, JSON.stringify({ version: 1, kb }, null, 2), "utf8");
  }

  /** 미컴파일(파일 부재)·손상 = 빈 KB 로 degrade(throw 아님) — 읽기 경로 안정. */
  async load(): Promise<Kb> {
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as { version?: number; kb?: Kb };
      return parsed?.kb ?? structuredClone(EMPTY);
    } catch {
      return structuredClone(EMPTY);
    }
  }

  async export(): Promise<string> {
    return JSON.stringify({ version: 1, kb: await this.load() });
  }

  /** 표준 envelope JSON → kb.json 영속(가반 import, 무손실). */
  async import(json: string): Promise<void> {
    const parsed = JSON.parse(json) as { version?: number; kb?: Kb };
    if (!parsed?.kb) throw new Error("잘못된 KB export 포맷");
    await this.save(parsed.kb);
  }
}
