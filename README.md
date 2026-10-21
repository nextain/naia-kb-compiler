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
