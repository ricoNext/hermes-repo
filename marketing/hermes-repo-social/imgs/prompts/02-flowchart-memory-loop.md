---
illustration_id: 02
type: flowchart
style: vector-illustration
palette: custom-product
output: ../02-flowchart-memory-loop.svg
---

hermes-repo memory loop - Process Flow

Layout: circular loop around a central `.memory/` repository folder.

STEPS:
1. Capture - Stop hook records useful session context into `.memory/captures/raw/`
2. Consolidate - OpenAI-compatible LLM turns raw captures into rules, domains, workflows, decisions, incidents
3. Inject - SessionStart hook loads `MEMORY.md` and `rules/*.md` into the next assistant session

CONNECTIONS: circular arrows labeled capture -> consolidate -> inject. Central node is `.memory/`.
LABELS: Capture, Consolidate, Inject, Stop hook, SessionStart hook, LLM, `MEMORY.md`, `rules/*.md`
COLORS: Background #F8FAFC, Primary Blue #2563EB, Green #16A34A, Amber #F59E0B, Slate #334155. Color values and names are rendering guidance only; do not display hex codes.
STYLE: Flat vector flowchart with bold arrows, geometric step containers, clean developer documentation aesthetic, large readable labels.
ASPECT: 16:9

