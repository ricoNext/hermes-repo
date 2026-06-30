# hermes-repo

**Give AI coding assistants repo-local project memory.** hermes-repo wires assistant hooks into a Git repository so useful session context can be captured, consolidated into `.memory/`, and injected into future sessions.

npm: `@riconext/hermes-repo` · Inspired by [Hermes Agent](https://github.com/NousResearch/hermes) memory & skill loop · [中文](README.zh-CN.md)

![](https://neptune-ipc.oss-cn-shenzhen.aliyuncs.com/img/20260521182425723.png)

## Features

| Capability | Behavior |
|------------|----------|
| Assistant setup | `init` creates `.memory/`, merges `AGENTS.md`, and writes hook config for selected assistants |
| Session capture | Stop hooks append session summaries to `.memory/captures/raw/session-*.md` |
| Session injection | SessionStart hooks print `.memory/MEMORY.md` plus all `.memory/rules/*.md` content |
| LLM capture upgrade | When LLM is configured, `capture-llm --flush` processes queued per-session upgrade jobs |
| Consolidation | `flush` uses an OpenAI-compatible LLM to turn raw captures into knowledge files and `MEMORY.md` |
| Auto flush | With complete LLM config, capture can trigger background `flush` when thresholds are met |
| Multi-assistant support | Claude Code, Cursor, CodeBuddy, and OpenAI Codex adapters |

## Why

AI coding sessions repeatedly lose local project context:

- Conventions like package manager, naming style, or API shape get restated in every new chat.
- A bug explanation from last week stays buried in transcript history.

hermes-repo keeps working memory inside the repo: hooks capture sessions, LLM consolidates them into structured knowledge, and future sessions inject that knowledge automatically.

## Why LLM Is Required

hermes-repo has two stages:

| Stage | Commands | LLM required? |
|-------|----------|---------------|
| Capture & inject | `capture`, `inject` | No |
| Consolidate | `flush`, `capture-llm`, `autoFlush` | Yes |

`capture` only appends session transcripts to `.memory/captures/raw/`. That is raw evidence, not usable project memory.

`inject` loads `MEMORY.md` and `rules/*.md`. Those files are created or updated by `flush`, which calls an OpenAI-compatible LLM to classify content, write knowledge files, and regenerate the navigation summary.

Without LLM configuration, the hooks still run, but memory never gets consolidated. Configure LLM during interactive `init`, or edit `.memory/config.json` afterward, to make the memory loop work.

## Five-Minute Start

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

Non-interactive setup:

```bash
npx @riconext/hermes-repo init -y --tools claude-code
npx @riconext/hermes-repo init -y --tools claude-code,cursor,codebuddy,codex
```

`-y` skips the LLM prompt. Edit `.memory/config.json` manually afterward if you need `flush` or `autoFlush`.

Then use your assistant normally:

1. At session start, the hook runs `inject`.
2. At session end, the hook runs `capture`.
3. When raw captures accumulate and LLM is configured, either wait for `autoFlush` or run manually:

```bash
npx @riconext/hermes-repo flush
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
- `.memory/config.json` is gitignored because it may contain `apiKey`.
- `consolidate.autoFlush.enabled` is on by default for new projects. With complete LLM config, captures can automatically trigger background `flush` after thresholds are met.
- If you turn `autoFlush` off, run `npx @riconext/hermes-repo flush` manually after captures accumulate.

Process queued capture upgrades manually:

```bash
npx @riconext/hermes-repo capture-llm --flush
```

## Supported Assistants

| Assistant | Setup written by `init` | Runtime behavior |
|-----------|-------------------------|------------------|
| Claude Code | `.claude/settings.local.json` | SessionStart inject, Stop capture |
| Cursor | `.cursor/hooks.json` | sessionStart inject, stop capture |
| CodeBuddy | `.codebuddy/settings.local.json` | SessionStart inject, Stop capture |
| OpenAI Codex | `.codex/config.toml`, `.codex/hooks.json` | SessionStart inject, Stop capture |

Default non-interactive assistant selection is `claude-code`.

## CLI

```bash
npx @riconext/hermes-repo init [options]
npx @riconext/hermes-repo capture [options]
npx @riconext/hermes-repo inject [options]
npx @riconext/hermes-repo capture-llm [options]
npx @riconext/hermes-repo flush [options]
```

### `init`

Initializes the memory tree and assistant hook config.

Options:

- `-y, --yes`: non-interactive mode
- `--tools <ids>`: comma-separated assistant ids, requires `-y`
- `-f, --force`: refresh scaffold files and managed blocks
- `-C, --cwd <dir>`: target directory

Known assistant ids: `claude-code`, `cursor`, `codebuddy`, `codex`.

### `capture`

Usually called by assistant Stop hooks. It reads hook stdin, resolves the assistant transcript, and appends to `.memory/captures/raw/session-{id}.md`.

Options:

- `-C, --cwd <dir>`
- `--dry-run`
- `--strict`

### `inject`

Usually called by assistant SessionStart hooks. It outputs `MEMORY.md` and all `rules/*.md`, using the hook-specific JSON shape for Cursor and Codex.

Options:

- `-C, --cwd <dir>`
- `--strict`

### `capture-llm`

Processes pending capture upgrade jobs.

Options:

- `-C, --cwd <dir>`
- `--job <id>`
- `--flush`
- `--strict`

### `flush`

Runs LLM consolidation over pending or stale raw session captures.

Options:

- `-C, --cwd <dir>`
- `--force`
- `--dry-run`
- `--strict`

If LLM is disabled or incomplete, `flush` exits successfully by default for hook safety but prints `LLM not enabled in config.json`. Use `--strict` when you want failures to produce a non-zero exit code.

## Troubleshooting

Enable debug logs in `.memory/config.json`:

```json
{
  "debug": true
}
```

Useful logs:

- `.memory/logs/capture.log`
- `.memory/logs/flush.log`
- `.memory/logs/consolidate.log`

Local CLI debugging:

```bash
bun run build
node dist/cli.js --help
```

## Development

Requires Node.js >= 20.

```bash
bun install
bun run build
bun run test
bun run typecheck
```

Release:

```bash
bun run changeset
bun run release
```

## License

[MIT](LICENSE)
