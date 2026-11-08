**English** | [한국어](README.ko.md)

# naia-kb-compiler

**Knowledge compiler engine** (a Nextain asset, Apache 2.0).

A non-expert **feeds in material (URLs, documents)** → it automatically builds a **structured knowledge base (service cards, FAQ + entities/relations)** → self-verifies using **a small set of questions answered by the operator as the acceptance criteria (answer anchors)** → asks a person to confirm **only the gaps** it could not fill → and compiles a **serving KB** with **citations, governance, and abstention** attached.

Where NotebookLM stops at "read-only Q&A", this ***produces* operable knowledge**.

## Key points

- **Expertise built into the engine** — the operator adds material, answers a few questions, and checks only the red flags.
- **Answer-anchor self-verification** — automatic extraction (≈70–80% inaccurate) is gated by a small number of human answers.
- **Graph data always; the search backend is an adapter** — vector RAG ↔ graph (LightRAG/Spanner) can be swapped behind a port.
- **Port/adapter everywhere + data portability** — not tied to any LLM, embedding, search, or storage.

## Ownership / no lock-in

Owned by Nextain. **Guaranteed by design that no one is locked into** this engine/backend (replaceable at any time). Rights of companies and partners are covered by separate contracts. → [`OWNERSHIP.md`](OWNERSHIP.md)

## Entry points

AI tools: [`AGENTS.md`](AGENTS.md) (= `CLAUDE.md` = `GEMINI.md`). People: this README + [`.users/ko/`](.users/ko/) (Korean).

## Status

Scaffold stage. Design (V-model) → MVP slices, in that order. There is a first consumer, but no lock-in.

## License & Patent Notice

- **Code (`Apache-2.0`):** Licensed under the [Apache License 2.0 (`Apache-2.0`)](LICENSE). Free to use, modify, and distribute—including for commercial purposes, paid hosted or managed services (SaaS), and organizations of any size. Section 3 of the Apache License 2.0 includes a patent license for the code contained in this repository.
- **Patents:** [`PATENTS.md`](PATENTS.md) explains the claim boundary split, lists Nextain's patent applications, and grants an additional conditional patent covenant (beyond the scope already licensed under Section 3 of the Apache License 2.0) for individuals, non-profits, and conforming Naia ecosystem developers. That additional covenant does not cover practicing a Listed Patent through a method or module not contained in this repository in paid hosted services for third parties, closed/OEM products, or enterprise-wide deployments meeting or exceeding the revenue or seat thresholds in [`PATENTS.md`](PATENTS.md) Section 2; see [`PATENTS.md`](PATENTS.md) Sections 2 and 3.
- **Commercial:** [`LICENSE-COMMERCIAL.md`](LICENSE-COMMERCIAL.md) covers proprietary Nextain Tier-2 modules and cloud pipelines not published in this repository, commercial patent licenses for methods not contained here, and enterprise support and indemnification.
- **Contributing:** see [`CONTRIBUTING.md`](CONTRIBUTING.md). Pull requests are accepted under [`CLA.md`](CLA.md) (or [`CLA-CORPORATE.md`](CLA-CORPORATE.md) for corporate contributions).
