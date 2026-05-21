# Phase 2d：v0.7.0 CodeBuddy hooks 闭环

> **状态**：已完成 · **版本**：`0.7.0` · **依赖**：[Phase 2c Cursor](phase-2c-v0.2.6-cursor.md)（v0.2.6）
>
> **设计依据**：[hermes-repo-design.md § CodeBuddy](hermes-repo-design.md)

## 目标

在 Claude / Cursor hooks 已可用的基础上，让 **CodeBuddy Code CLI**（及共用 `.codebuddy/` 配置的 IDE）能够：

1. **SessionStart** → `inject` 注入 `.memory/MEMORY.md`（stdout 纯文本，同 Claude）。
2. **Stop** → `capture` 经 `transcript_path` 解析 JSONL → 共用 `shouldCapture` → 写入 `.memory/captures/`。
3. 仅 `codebuddy` 时不访问 `~/.claude` / `~/.cursor`。

## 启用方式

```bash
npx @riconext/hermes-repo init -y --tools codebuddy
npx @riconext/hermes-repo init -y --tools claude-code,cursor,codebuddy
```

`init` 合并写入 `.codebuddy/settings.local.json`（仅覆盖 `Stop`、`SessionStart`）。

CodeBuddy Code **v1.16.0+** 内用 `/hooks` 确认 hook 已加载。

## Hook 契约

| 事件 | 命令 | 说明 |
|------|------|------|
| `SessionStart` | `npx @riconext/hermes-repo inject` | stdout 纯文本（非 Cursor JSON） |
| `Stop` | `npx @riconext/hermes-repo capture` | stdin 含 `transcript_path`，路由 `runCodebuddyCapture` |

### CodeBuddy `Stop` stdin（官方 schema）

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/xxx/.codebuddy/projects/.../session.jsonl",
  "cwd": "/path/to/repo",
  "hook_event_name": "Stop",
  "stop_hook_active": false
}
```

## 会话源附录（macOS 实机调研）

与 Claude **不同**，CodeBuddy 项目目录编码与 **Cursor** 一致：

```text
~/.codebuddy/projects/<encoded-workspace>/<session-id>.jsonl
```

- **`<encoded-workspace>`**：绝对路径去掉 leading `/`，再将 `/` 换为 `-`。
  - 例：`/Users/you/proj` → `Users-you-proj`（Claude 则为 `-Users-you-proj`）。
- 子 agent：`<encoded>/<session-id>/subagents/*.jsonl`（扫描时递归收集）。

### 解析优先级（`resolveCodebuddySessionJsonl`）

1. `HERMES_CODEBUDDY_SESSION` — 测试 / 手动。
2. hook / 选项 `transcript_path`。
3. `~/.codebuddy/projects/<encoded-cwd>/` 下最新 `.jsonl`（含子目录）。
4. 无法解析 → `no codebuddy session found`，exit 0。

| 变量 | 用途 |
|------|------|
| `HERMES_CODEBUDDY_SESSION` | 覆盖 JSONL（测试） |
| `CODEBUDDY_CONFIG_DIR` | 默认 `~/.codebuddy` |
| `CODEBUDDY_SESSION_ID` | 无 stdin 时手动调试 |

## `capture` 路由

- `transcript_path` 含 `/.codebuddy/` → CodeBuddy 分支。
- 含 `/.claude/` → Claude 分支。
- 无 `transcript_path` 且 `stop` + `session_id` → Cursor 分支。
- 三助手无 stdin：Claude → Cursor → CodeBuddy 顺序回退。

## 验收标准

1. `init -y --tools codebuddy` → `.codebuddy/settings.local.json` + `assistants` 含 `codebuddy`。
2. 新会话 inject（stdout）。
3. `Stop` 后 debug 可见 codebuddy 分支与 `jsonl=`。
4. 仅 `codebuddy` 不读 Claude/Cursor 路径。
5. `bun run test` 全绿；hook 失败 exit 0。

## 明确不做（2d）

- `SubagentStop` / `SessionEnd` 补捕。
- `type: "prompt"` hooks。
- `PreToolUse` 审计链。
