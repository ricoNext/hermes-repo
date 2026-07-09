# Product Introduction

[项目介绍](https://linux.do/t/topic/2502074)

npm: `@riconext/hermes-repo` · Inspired by [Hermes Agent](https://github.com/NousResearch/hermes) memory & skill loop · [中文](README.zh-CN.md)

```text
 _
| |__   ___ _ __ _ __ ___   ___  ___        _ __ ___ _ __   ___
| '_ \ / _ \ '__| '_ ' _ \ / _ \/ __|      | '__/ _ \ '_ \ / _ \
| | | |  __/ |  | | | | | |  __/\__ \      | | |  __/ |_) | (_) |
|_| |_|\___|_|  |_| |_| |_|\___||___/      |_|  \___| .__/ \___/
                                                    |_|

repo-local memory for AI coding assistants
capture -> consolidate -> inject
```

Have you run into this: you open a new AI coding session, and the first thing you do is not write code — you re-explain the project conventions.

"This repo uses bun."

"The API client lives here."

"The root cause of that bug last time wasn't a type issue — it was a permission boundary."

That information was already said in some earlier chat, then vanished in the next session. `hermes-repo` exists to fix that: **put AI coding assistants' project memory back into the Git repository.**

![Context loss in AI coding sessions](https://neptune-ipc.oss-cn-shenzhen.aliyuncs.com/img/20260708173721600.png)

## What is hermes-repo

`hermes-repo` is a repo-local memory tool. It wires hooks from Claude Code, Cursor, CodeBuddy, OpenAI Codex, and similar assistants into the current repository, so project context forms a closed loop:

- At session end, capture valuable context.
- When consolidation is needed, use an OpenAI-compatible LLM to turn raw records into structured knowledge.
- At the next session start, automatically inject project memory into the assistant.

In one sentence: **it lets the AI assistant remember not just this chat, but this repository.**

## Advantages over built-in tool memory

Many AI coding tools already ship memory, rules, or project context. Those features are useful, but they are usually locked to one product, one account, or one editor environment. `hermes-repo` takes a different approach: it pulls the memory layer out of any specific tool and puts it in the project repository itself.

That brings several direct advantages:

- **Works across assistants**: the same project memory can serve Claude Code, Cursor, CodeBuddy, and OpenAI Codex — not locked to a single tool.
- **Travels with the Git repo**: important project rules, workflows, and architecture decisions can live in `.memory/` and evolve with the code.
- **Auditable and editable**: memory is not a black box. You can open the Markdown files, see what was recorded, and correct it by hand.
- **Separates local privacy from team knowledge**: secrets, raw transcripts, and processing state stay local and are ignored by default; consolidated structured knowledge can be version-controlled as needed.
- **Fits long-lived projects**: built-in tool memory is more like "the assistant remembers you"; `hermes-repo` is more like "the project remembers itself." People can switch tools, machines, or sessions, and the core context still stays in the repo.

So it is not meant to replace each tool's built-in memory. It adds a lower layer: **give the project an independent, transparent, portable long-term memory.**

![hermes-repo memory loop](https://neptune-ipc.oss-cn-shenzhen.aliyuncs.com/img/20260708173801133.png)

## Not "saving chat history" — project knowledge consolidation

Ordinary chat history has a problem: the information exists, but it is not usable. You have to dig, summarize, and paste it into the next session yourself.

`hermes-repo` is closer to a project knowledge base:

- `.memory/MEMORY.md`: navigation summary injected into the next session.
- `.memory/rules/`: rules loaded in full on every inject.
- `.memory/domains/`: domain knowledge and business background.
- `.memory/workflows/`: reusable development procedures.
- `.memory/decisions/`: architecture and product decisions.
- `.memory/incidents/`: failure stories and root-cause analysis.

This structured knowledge can travel with the Git repo by default; local sensitive data such as `.memory/config.json`, raw transcripts, and processing state is gitignored.

## Why this matters

The efficiency bottleneck in AI coding often is not whether the model can write code — it is whether it understands the current project:

- Does it know your package manager, directory layout, and naming style?
- Does it know which approaches were tried before, and why they were abandoned?
- Does it know the real root cause of a bug and the fix boundaries?
- Does it know which files the team allows changing, and which ones should not be touched casually?

If people have to re-explain everything every time, the AI is only a one-off contractor.
If context can be captured, consolidated, and injected, it becomes more like a long-term collaborator on the project.

## From personal repo memory to team-level memory

The monorepo is already split into three layers:

- `@riconext/hermes-repo`: CLI, hooks, and the local `.memory/` workflow — published on npm.
- `@riconext/hermes-mcp-server`: team memory MCP service based on FastMCP + PostgreSQL, with tools for list / add / search / promote / delete memory.
- `@riconext/hermes-ui`: Web admin UI based on Next.js 16 + Shadcn/ui for managing projects and memories.

![hermes-repo module structure](https://neptune-ipc.oss-cn-shenzhen.aliyuncs.com/img/20260708173837700.png)

More importantly, the MCP service and UI do not depend on a third-party hosted platform. You can deploy them on your own machine, an internal server, or team infrastructure — database, access control, memory content, and upgrade cadence stay under your control. That matters especially for teams that do not want project knowledge scattered across different SaaS tools.

The direction is clear: first give every repository its own long-term memory, then promote valuable experience into shared team knowledge.

## Who it is for

If you regularly use AI coding assistants on a project, `hermes-repo` is for you.

If your team already switches among Claude Code, Cursor, CodeBuddy, or Codex, it is an even better fit.

If you are tired of every new session feeling like onboarding a new hire, this is the problem it solves.

Project:

```text
https://github.com/ricoNext/hermes-repo
```

Install:

```bash
npx @riconext/hermes-repo init
```

## Architecture

```text
User runs: npx @riconext/hermes-repo init
        |
        v
Creates/merges:
  .memory/
    config.json              # local config, includes LLM key, gitignored
    MEMORY.md                # navigation summary injected into sessions
    rules/                   # always injected in full
    domains/general/         # domain knowledge
    workflows/               # reusable procedures
    decisions/               # architecture/product decisions
    incidents/               # bug stories and root causes
    captures/raw/            # raw session captures, gitignored
    captures/archived/       # archived captures, gitignored
    consolidate-state.json   # local processing state, gitignored
  AGENTS.md                  # shared assistant guidance
  assistant hook config      # .claude, .cursor, .codebuddy, .codex

Runtime:
  SessionStart -> hermes-repo inject
    reads MEMORY.md + rules/*.md
    writes assistant-specific hook output

  Stop -> hermes-repo capture
    resolves the current assistant transcript
    appends a section to captures/raw/session-{id}.md
    optionally queues a background LLM upgrade job
    may schedule background flush when autoFlush thresholds are met

  Manual -> hermes-repo flush
    requires configured LLM
    reads pending/stale raw sessions
    writes rules/domains/workflows/decisions/incidents
    regenerates MEMORY.md
```

## Storage Model

| Layer | Paths | Git behavior | Purpose |
|-------|-------|--------------|---------|
| Local | `.memory/config.json`, `.memory/captures/`, `.memory/consolidate-state.json`, `.memory/.consolidate.lock` | ignored by the init gitignore block | secrets, transcripts, processing state |
| Knowledge | `.memory/MEMORY.md`, `.memory/rules/`, `.memory/domains/`, `.memory/workflows/`, `.memory/decisions/`, `.memory/incidents/` | tracked unless your gitignore excludes them | structured memory injected into future sessions |
| Assistant guidance | `AGENTS.md`, selected assistant config files | normal repo files | tells assistants how to use memory |

# Getting Started

From your project Git root:

```bash
npx @riconext/hermes-repo init
```

Interactive `init` asks for:

- target repository directory
- assistants to wire up
- whether to write the capture example template to `.memory/templates/`
- whether to configure an OpenAI-compatible LLM now

If you configure LLM during init, hermes-repo writes the settings to `.memory/config.json` and the final summary confirms whether `flush` is ready. If LLM is incomplete, `capture` and `inject` still work, but `flush` / `autoFlush` cannot consolidate memory yet.

> `flush` / `autoFlush` is critical: it uses an LLM to summarize raw session captures, generate a memory map index, and inject that index into context on the next conversation.

Other `init` options:

| Option | Description |
|--------|-------------|
| `-y, --yes` | Non-interactive mode with defaults (skip all prompts) |
| `-f, --force` | Overwrite existing scaffold files (does not delete captures, etc.) |
| `-C, --cwd <dir>` | Target directory; defaults to the current working directory |
| `--tools <ids>` | Comma-separated assistant ids, e.g. `claude-code,cursor` (**must be used with `-y`**) |
| `--mcp-project-id <id>` | Non-interactive: enable MCP and bind a team project UUID |
| `--mcp-server-url <url>` | Non-interactive: MCP server URL; default `http://localhost:3000` |
| `--mcp-user-id <id>` | Non-interactive: MCP user UUID, used when pushing memories |

Examples:

```bash
# Interactive init
hermes-repo init

# Non-interactive with default assistants
hermes-repo init -y

# Non-interactive with multiple assistants
hermes-repo init -y --tools claude-code,cursor

# Non-interactive + enable MCP
hermes-repo init -y \
  --mcp-project-id "uuid-here" \
  --mcp-user-id "user-uuid-here" \
  --mcp-server-url "http://localhost:3000"

# Force overwrite existing files
hermes-repo init -y -f

# Init in a specific directory
hermes-repo init -y -C /path/to/repo
```

Notes:

- `--tools` must be used with `-y`, otherwise it errors
- MCP-related options only take effect in non-interactive mode

Then use your assistant normally:

1. At session start, the hook runs `inject` to inject the `MEMORY.md` navigation summary.
2. At session end, the hook runs `capture` for raw session capture.
3. When raw captures accumulate and LLM is configured, wait for `autoFlush` or run manually:

```bash
npx @riconext/hermes-repo flush
```

## LLM Configuration

Configure LLM to enable consolidation. `flush`, `capture-llm`, and `autoFlush` all depend on it.

hermes-repo uses an OpenAI-compatible Chat Completions endpoint:

```json
{
  "llm": {
    "enabled": true,
    "provider": "openai",
    "baseUrl": "https://api.deepseek.com",
    "model": "deepseek-v4-flash",
    "apiKey": "your-key",
    "timeoutMs": 60000,
    "maxInputChars": 24000,
    "mode": "async"
  },
  "consolidate": {
    "autoFlush": {
      "enabled": true,
      "minPendingSessions": 3,
      "minIntervalMinutes": 30,
      "maxPendingChars": 20000
    }
  }
}
```

Important details:

- `enabled`, `apiKey`, `baseUrl`, and `model` must all be set for LLM calls.
- `baseUrl` is the service root; hermes-repo calls `{baseUrl}/chat/completions`.
- Native Anthropic or Gemini endpoints are not supported directly. Use a gateway that exposes an OpenAI-compatible endpoint.
- `.memory/config.json` may contain `apiKey` and is gitignored by default.
- New projects enable `consolidate.autoFlush.enabled` by default. With complete LLM config, capture can trigger background `flush` when thresholds are met.
- If you turn `autoFlush` off, run `npx @riconext/hermes-repo flush` manually after captures accumulate.

Process queued capture upgrades manually:

```bash
npx @riconext/hermes-repo capture-llm --flush
```

## MCP Server Usage

hermes-repo provides an MCP server (`@riconext/hermes-mcp-server`) for team-level memory management. It exposes MCP tools for listing projects, adding memories, searching, and promoting memories, alongside a REST API for the web UI.

The MCP service is used in two places:

- During `flush`: the program pulls team memories from the MCP service and pushes personal memories
- In conversation: you can ask the coding tool to call MCP tools to pull team memories into the project or push memories to the service

To push and pull team memories during `flush`, configure the MCP service during `init`.

These fields matter:

```json
"serverUrl": "MCP server URL",
"projectId": "projectId registered on the MCP server for the current project",
"userId": "userId created on the MCP server for the current project",
```

To make MCP tools available automatically in conversation, you can also add the MCP server manually. It provides the following tools:

### MCP Tools

- `list_projects` — list available projects
- `add_memory` — add a new memory to a project
- `search_memories` — search memories by keyword
- `promote_memory` — promote a memory to team level
- `delete_memory` — delete a memory

### Deploy the MCP Server

You need to deploy the MCP service yourself before using it. Clone the project locally and:

1. **Start PostgreSQL**

   From the repository root:

   ```bash
   docker compose up -d
   ```

2. **Configure environment**

   ```bash
   cd packages/mcp-server
   cp .env.example .env
   ```

   Key variables:

   - `DATABASE_URL` — PostgreSQL connection string
   - `MCP_TRANSPORT` — `httpStream` (default) or `stdio`
   - `DEV_AUTH_BYPASS=true` — skip JWT auth during development

3. **Initialize database**

   ```bash
   bun run db:push
   bun run db:seed
   ```

   Default admin account: `admin` / `admin` (role: SUPER_ADMIN)

4. **Start the MCP server**

   ```bash
   bun run dev:mcp   # from repo root
   # or
   cd packages/mcp-server
   bun run dev
   ```

   Server runs at `http://localhost:3000`. Health check: `http://localhost:3000/health`.

### Connect to Claude Code

Add the MCP server to your Claude Code configuration:

```json
{
  "mcpServers": {
    "hermes": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "X-User-Id": "00000000-0000-4000-8000-000000000001"
      }
    }
  }
}
```

Replace `/path/to/hermes-repo` with your actual repository path.

## Deploy UI

The web UI (`@riconext/hermes-ui`) provides a dashboard for browsing projects and memories.

1. **Configure environment**

   ```bash
   cd packages/ui
   cp .env.example .env.local
   ```

   Edit `.env.local`:

   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:3000
   ```

2. **Start the UI**

   From the repository root:

   ```bash
   bun run dev:ui
   ```

   Or from the UI package directory:

   ```bash
   bun run dev
   ```

   Access the UI at `http://localhost:3001`

3. **Build for production**

   ```bash
   cd packages/ui
   bun run build
   bun run start
   ```

> The MCP service is optional, but if you need team memory management with `@riconext/hermes-repo`, you must deploy the MCP service yourself.

# Configuration Reference

```json
{
  // Supported AI coding tools
  "assistants": [
    "claude-code",
    "cursor",
    "codebuddy",
    "codex"
  ],

  // Enable debug logs; logs are written to .memory/logs/
  "debug": false,
  // LLM config
  "llm": {
    // Whether LLM is enabled
    "enabled": true,
    // Provider
    "provider": "openai",
    "baseUrl": "https://api.deepseek.com",
    "model": "deepseek-v4-flash",
    // API key
    "apiKey": "",
    // Request timeout (ms)
    "timeoutMs": 60000,
    // Max input characters per request
    "maxInputChars": 24000
  },
  // Consolidation / auto flush / archive config
  "consolidate": {
    // Entries older than N days may be archived
    "autoArchiveDays": 30,
    "autoFlush": {
      // Whether to auto flush --if-needed after capture
      "enabled": true,
      // Pending session count threshold; flush when exceeded
      "minPendingSessions": 3,
      // Minimum minutes since last consolidation
      "minIntervalMinutes": 30,
      // Pending total character threshold
      "maxPendingChars": 20000

      // Consolidation runs only when any threshold is met and LLM is available.
    }
  },
  "mcp": {
    // Whether MCP sync is enabled
    "enabled": true,
    // MCP server URL
    "serverUrl": "",
    // Project UUID
    "projectId": "",
    // User UUID
    "userId": "",
    "sync": {
      // Sync mode: auto / manual / off
      "mode": "auto",
      "onFlush": {
        // Push on flush
        "push": true,
        // Pull on flush
        "pull": true
      },
      // Retry count
      "retries": 3,
      // Timeout (ms)
      "timeout": 30000
    }
  }
}
```
