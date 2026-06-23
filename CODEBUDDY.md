# CODEBUDDY.md

This file provides guidance to CodeBuddy Code when working with code in this repository.

## Project Overview

hermes-repo is a cross-assistant project-level memory system for AI coding assistants (Claude Code, Cursor, CodeBuddy, Codex). It captures session context via hooks, builds structured memories, and injects project context into new sessions.

## Build, Test, and Development Commands

```bash
# Install dependencies
bun install

# Build the project
bun run build

# Run all tests
bun run test

# Run a single test file
bun run build && npx vitest run tests/init.test.ts

# Type checking
bun run typecheck

# Development mode (watch builds)
bun run dev

# Local debugging
node dist/cli.js --help
```

## Release Process

```bash
# When you have user-visible changes, create a changeset
bun run changeset

# Release: generates CHANGELOG, updates version, creates tag, and pushes
bun run release
```

The release script handles version bumping, changelog generation, type checking, testing, git tagging, and pushing. GitHub Actions publishes to npm when a `v*` tag is pushed.

## Architecture Overview

### Core Concepts

- **Three Memory Types**: semantic (facts/conventions), episodic (event narratives), procedural (reusable workflows)
- **Two Storage Layers**: Personal layer (captures/, sessions/, refs/) - gitignored; Team layer (topics/, skills/, MEMORY.md) - committed
- **Hook-based Pipeline**: SessionStart → `inject` (load context) → user codes → Stop → `capture` (save session) → optional `flush` (consolidate)

### Key Module Structure

```
src/
├── cli.ts                    # CLI entry point, command definitions
├── commands/                 # Command handlers (init, capture, flush, etc.)
├── init/                     # Project initialization and scaffold
│   ├── assistants/           # Per-assistant hook setup (Claude, Cursor, CodeBuddy, Codex)
│   └── runInit.ts            # Main init orchestration
├── capture/                  # Session capture pipeline
│   ├── shouldCapture.ts      # Quality filtering (signal strength, convergence)
│   ├── router.ts             # Route to assistant-specific capture logic
│   ├── [assistant]/          # Claude Code, Cursor, CodeBuddy adapters
│   └── writeCapture.ts       # Write capture files
├── consolidate/              # Memory consolidation pipeline
│   ├── runConsolidate.ts     # Main flush orchestration
│   ├── buildTopics.ts        # Dedupe & merge captures → topics/
│   ├── buildMemory.ts        # Generate MEMORY.md summary
│   └── dedupe.ts             # Remove duplicate captures
├── skills/                   # Skill extraction from procedural captures
├── feedback/                 # Reference tracking (ref command)
├── lifecycle/                # Memory lifecycle (30d demotion, 90d archive)
├── llm/                      # Optional LLM integration for better capture/consolidate
├── config/                   # Config reading, debug logging
└── promote/                  # Team memory promotion workflow
```

### Data Flow

1. **init**: Creates `.memory/` structure, generates AGENTS.md, configures assistant hooks
2. **inject**: Reads `.memory/MEMORY.md` → outputs to stdout (hooks load this into session context)
3. **capture**: Reads session transcript → quality filter → write to `.memory/captures/<type>/` → optional LLM upgrade
4. **flush**: Deduplicate captures → detect conflicts → build topics/ → promote skills/ → update MEMORY.md
5. **promote**: Mark personal captures with `.promote` sidecar → generate PR → team review → apply to topics/

### Important Implementation Details

- **Quality Filtering** (`shouldCapture.ts`): Captures are filtered by signal strength (keywords like "修复", "fix", "root cause") and convergence detection (whether the session reached a resolution)
- **Assistant Routing** (`router.ts`): Hook paths determine which assistant's session parser to use
- **Convergence Detection** (`convergence.ts`): Checks if the last 5 messages contain resolution signals (fewer user messages, tool results indicating success)
- **Memory Types**:
  - semantic: Conventions, architecture decisions (detected by keywords like "约定", "convention")
  - episodic: Events with causes (detected by keywords like "因为", "root cause")
  - procedural: Step-by-step workflows (detected by numbered lists, "步骤" keywords)

### Testing Strategy

Tests are located in `tests/` and use Vitest. Each major module has corresponding test files:
- `init.test.ts` - Init command
- `capture.test.ts`, `capture-*.test.ts` - Capture pipeline
- `flush.test.ts`, `runConsolidate.test.ts` - Consolidation
- `promote*.test.ts` - Team promotion workflow

### Configuration

- `.memory/config.json`: Main config (version, assistants, debug flag)
- `.memory/llm.json`: Optional LLM config (gitignored) - OpenAI-compatible API for enhanced captures
- `templates/`: Scaffold templates for AGENTS.md, capture files, etc.

### Debug Mode

To debug hooks/capture issues:
1. Set `"debug": true` in `.memory/config.json`
2. Check `.memory/hermes-debug.log` for detailed logs
