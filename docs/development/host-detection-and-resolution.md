# Host Detection and Resolution

This document explains how Squad Foundry resolves host adapters in CLI-first mode.

## Overview

Resolution happens in three stages:

1. `ActiveHostDetector` collects host signals from argv, files, env, and process hints.
2. `HostResolutionService` applies confidence + validity rules.
3. `HostRuntimeService` materializes the adapter and persists preference metadata.

## Confidence and Resolution Rules

- `high`: use detected host only if adapter initializes and supports command.
- `medium`: reuse persisted host only if:
  - adapter initializes,
  - command is supported,
  - at least one medium/strong signal still matches prior validation.
- `low`: use assisted selection (interactive CLI) or fail with explicit message in non-interactive mode.

## Persisted Preference Format

File: `squadfoundry.hosts.json`

Example:

```json
{
  "preferredHost": "local",
  "validation": {
    "timestamp": "2026-04-02T12:00:00.000Z",
    "matchedSignals": ["file:CLAUDE.md"]
  },
  "lastValidated": "2026-04-02T12:00:00.000Z",
  "hosts": ["antigravity", "anthropic", "local", "openai"]
}
```

## Runtime Provenance

Each `run` writes:

- `artifacts/<squad>/<job>/reports/runtime-metadata.json`

Fields:

- `resolvedHost`
- `confidence`
- `reasons`
- `activeModel`
- `fallbackPath`

`status` prints these fields for quick diagnosis.

## MCP Mode

MCP uses the same resolution pipeline but does not run interactive selection.
If no valid detected/persisted host is available, MCP returns an explicit error asking for `SQUAD_FOUNDRY_ADAPTER`.
