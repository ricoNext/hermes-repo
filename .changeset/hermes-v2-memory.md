---
"@riconext/hermes-repo": major
---

Hermes v2 memory architecture.

Breaking changes:

- Removed the legacy `promote`, `ref`, and `stats` commands.
- Removed cold-start scan and v1 promotion/reference/skill lifecycle modules.
- Replaced typed capture folders with session-level raw capture files in `.memory/captures/raw/`.

Added:

- Session-based capture aggregation with pending/done/stale status tracking.
- Consolidation flow that writes rules, domains, workflows, decisions, incidents, and MEMORY.md from raw sessions.
- Two-stage inject behavior that injects MEMORY.md navigation plus required rules.
