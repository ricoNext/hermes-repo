# hermes-repo

**Give AI coding assistants repo-local project memory.** hermes-repo wires assistant hooks into a Git repository so useful session context can be captured, consolidated into `.memory/`, and injected into future sessions.

npm: `@riconext/hermes-repo` · Inspired by [Hermes Agent](https://github.com/NousResearch/hermes) memory & skill loop · [中文](README.zh-CN.md)

![](https://neptune-ipc.oss-cn-shenzhen.aliyuncs.com/img/20260521182425723.png)

## What Works Today

hermes-repo currently provides a single-repo memory loop:

| Capability | Current behavior |
|------------|------------------|
| Assistant setup | `init` creates `.memory/`, merges `AGENTS.md`, and writes hook config for selected assistants |
| Session capture | Stop hooks write session summaries into `.memory/captures/raw/session-*.md` |
| Session injection | SessionStart hooks print `.memory/MEMORY.md` plus all `.memory/rules/*.md` content |
| LLM capture upgrade | `capture-llm --flush` processes queued capture upgrade jobs when LLM is configured |
| Consolidation | `flush` uses an OpenAI-compatible LLM to turn raw captures into knowledge files and `MEMORY.md` |
| Multi-assistant support | Claude Code, Cursor, CodeBuddy, and OpenAI Codex adapters are available |

Not currently exposed as CLI commands: `search`, `stats`, `ref`, `promote`, and `init --scan`. Some older design docs may mention them as planned or historical workflow ideas; the README describes the shipped CLI.

## Why

AI coding sessions repeatedly lose local project context:

- Conventions like package manager, naming style, or API shape get restated in every new chat.
- A bug explanation from last week stays buried in transcript history.
- Team knowledge drifts because assistant context is not versioned with the repository.

hermes-repo keeps the working memory inside the repo. Raw captures stay local by default, while consolidated knowledge files can be reviewed and committed like other project documentation.

## Five-Minute Start

From your project Git root:

```bash
npx @riconext/hermes-repo init
```

Interactive `init` asks for:

- target repository directory
- assistants to wire up
- whether to copy example capture templates

It does not ask for LLM credentials. Configure those manually in `.memory/config.json` if you want `flush` or `capture-llm` to use an LLM.

Non-interactive setup:

```bash
npx @riconext/hermes-repo init -y --tools claude-code
npx @riconext/hermes-repo init -y --tools claude-code,cursor,codebuddy,codex
```

Then use your assistant normally:

1. At session start, the hook runs `inject`.
2. At session end, the hook runs `capture`.
3. When raw captures have accumulated and LLM is configured, run:

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

  Manual -> hermes-repo flush
    requires configured LLM
    reads pending/stale raw sessions
    writes rules/domains/workflows/decisions/incidents
    regenerates MEMORY.md
```

## Storage Model

| Layer | Paths | Git behavior | Purpose |
|-------|-------|--------------|---------|
| Local / personal | `.memory/config.json`, `.memory/captures/`, `.memory/consolidate-state.json`, `.memory/.consolidate.lock` | ignored by the init gitignore block | secrets, transcripts, local processing state |
| Shared knowledge | `.memory/MEMORY.md`, `.memory/rules/`, `.memory/domains/`, `.memory/workflows/`, `.memory/decisions/`, `.memory/incidents/` | re-included by the init gitignore block | reviewed project knowledge for future sessions |
| Assistant guidance | `AGENTS.md`, selected assistant config files | normal repo files unless your own gitignore excludes them | tells assistants how to use memory |

Team collaboration today is the normal Git workflow: inspect generated knowledge files, edit if needed, and submit them in a PR. There is no `promote` CLI in the current version.

## LLM Configuration

`capture` and `inject` work without LLM. `flush` and successful `capture-llm` upgrades require LLM config.

hermes-repo uses an OpenAI-compatible Chat Completions endpoint:

```json
{
  "llm": {
    "enabled": true,
    "provider": "openai",
    "baseUrl": "https://api.deepseek.com",
    "model": "deepseek-chat",
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
- `consolidate.autoFlush.enabled` is on by default for new projects. It can trigger background `flush` after capture thresholds are met, but it still needs LLM config.

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

```bash
bun install
bun run build
bun run test
bun run typecheck
```

Release helpers:

```bash
bun run changeset
bun run release
```

## Roadmap

Planned areas include memory search, stats, explicit feedback/reference tracking, reviewed promotion workflows, cold-start scanning, and MCP-based retrieval. These are not current CLI capabilities unless implemented in a future release.

## License

[MIT](LICENSE)
