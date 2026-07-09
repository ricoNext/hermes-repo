---
illustration_id: 03
type: framework
style: vector-illustration
palette: custom-product
output: ../03-framework-team-memory.svg
---

hermes-repo system modules - Framework Diagram

Layout: three module columns feeding into a shared team memory layer.

ZONES:
- CLI / Hooks: `@riconext/hermes-repo`, `init`, `capture`, `inject`, `flush`, supports Claude Code, Cursor, CodeBuddy, OpenAI Codex.
- MCP Server: `@riconext/hermes-mcp-server`, FastMCP + PostgreSQL, tools for list/add/search/promote/delete memories.
- Web UI: `@riconext/hermes-ui`, Next.js 16 + Shadcn/ui, project and memory management interface.
- Shared base: "从个人 repo-local 记忆，到团队级记忆管理"

LABELS: CLI / Hooks, MCP Server, Web UI, Team Memory, Git-tracked knowledge, Local secrets ignored
COLORS: Background #FFFFFF, Slate #1F2937, Blue #3B82F6, Green #22C55E, Violet #8B5CF6, Amber #F59E0B. Color values and names are rendering guidance only; do not display hex codes.
STYLE: Flat vector framework diagram, modular product architecture, clean icons, minimal decorative elements, generous white space.
ASPECT: 16:9

