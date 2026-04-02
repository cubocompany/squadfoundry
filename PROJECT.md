# Project: Squad Foundry

## Overview

Squad Foundry is a local, extensible multi-agent squad orchestration platform. It enables the design, configuration, and execution of collaborative AI agent squads for any domain — from software development to social media content to documentation and research.

## Domain

platform / meta-tooling

## Stack / Technology

- **Language:** TypeScript (strict mode, ESM)
- **Runtime:** Node.js >= 20
- **Test runner:** Vitest
- **Package manager:** npm
- **Core dependencies:** `commander` (CLI), `glob` (file discovery), `zod` (schema validation)
- **No framework dependencies** in the core layer

## Key Conventions

- **Naming:** kebab-case for files and folders, PascalCase for classes, camelCase for functions/variables
- **Modules:** ESM-only (`"type": "module"`)
- **Imports:** Always use `.js` extension in imports (required for ESM + TypeScript)
- **Adapter pattern:** Core never imports adapters. Always depend on interfaces.
- **No magic state:** All state transitions are explicit and logged
- **Artifacts:** All job outputs are human-readable files (JSON + Markdown)

## Project Structure

```
orchestrator/
  core/           Types, state machine, guardrails (zero external deps)
  adapters/       Pluggable interface implementations (host, model, vcs, etc.)
  context/        Context discovery and loading
  artifacts/      Job artifact persistence
  runtime/        Squad execution engine
  builder/        Squad design interview + generation
  cli/            CLI entrypoint

squads/
  examples/       Ready-to-use squad examples
  templates/      Reusable squad template patterns

templates/        Document templates (PROJECT.md, TASKS.md, etc.)
docs/             Platform documentation
tests/            Unit and integration tests
```

## Goals for Current Phase

- [x] Core type system
- [x] Explicit state machine
- [x] Guardrail engine
- [x] All adapter interfaces
- [x] Adapter stubs (host, VCS, publishing, deploy, context)
- [x] Context loader + index
- [x] Artifact store
- [x] Squad runtime (full execution engine)
- [x] Squad builder (interview + generation)
- [x] CLI entrypoint
- [x] Software development squad example
- [x] Instagram content squad example
- [x] Templates
- [x] Tests (unit + integration)
- [ ] Activate real adapters (Anthropic, GitHub, Instagram)
- [ ] Dashboard / status UI
- [ ] Multi-squad job scheduler

## Known Constraints / Non-Goals

- All external adapters are stubs — real API calls require configuration
- No persistent database — filesystem only
- No real-time collaboration between agents (sequential execution only in v0.1)
- No authentication layer (local use only)

## Host Compatibility

Designed to work with: Claude Code, OpenCode, Cursor, Codex, Zed, Antigravity, any host that can invoke a Node.js CLI or import TypeScript modules.
