# Phase 2c：v0.2.6 Cursor hooks 闭环

> **状态**：已完成 · **版本**：`0.2.6` · **依赖**：[Phase 2 capture/inject](phase-2-v0.2-capture.md)（v0.2.5）
>
> **设计依据**：[hermes-repo-design.md § Cursor](hermes-repo-design.md)

## 目标

在 Claude Code hooks 已可用的基础上，让 **Cursor Agent** 同样能：

1. **sessionStart** → `inject` 注入 `.memory/MEMORY.md` 摘要。
2. **stop** → `capture` 读取会话 transcript → 共用 `shouldCapture` → 写入 `.memory/captures/`。
3. 与 Claude **共享** `.memory/`；`assistants` 仅含 `cursor` 时不访问 `~/.claude/projects`。

## 启用方式

```bash
# 仅 Cursor
npx @riconext/hermes-repo init -y --tools cursor

# Claude + Cursor 双助手
npx @riconext/hermes-repo init -y --tools claude-code,cursor
```

`init` 合并写入 `.cursor/hooks.json`（仅覆盖 `sessionStart`、`stop`，保留用户其它 hook 事件）。

在 Cursor 中用 `/hooks` 确认 `sessionStart` / `stop` 已加载。

## Hook 契约

| 事件 | 命令 | 说明 |
|------|------|------|
| `sessionStart` | `npx @riconext/hermes-repo inject` | 检测 stdin 为 Cursor hook 时 stdout 输出 `{ "additional_context": "..." }` |
| `stop` | `npx @riconext/hermes-repo capture` | 读取 stdin JSON，路由至 `runCursorCapture` |

Hook **不传 CLI 参数**；失败仍 **exit 0**。

### Cursor `stop` stdin（常见字段）

```json
{
  "hook_event_name": "stop",
  "session_id": "<uuid>",
  "conversation_id": "<uuid>",
  "workspace_roots": ["/abs/path/to/repo"],
  "status": "completed"
}
```

无 `transcript_path`（与 Claude 不同）；由 `CursorSessionResolver` 定位 JSONL。

## 会话源附录（macOS 实机调研）

Cursor Agent transcript 落盘路径（与 Claude 编码规则不同）：

```text
~/.cursor/projects/<encoded-workspace>/agent-transcripts/<session-id>/<session-id>.jsonl
```

- **`<encoded-workspace>`**：仓库绝对路径去掉 leading `/`，再将 `/` 换为 `-`。
  - 例：`/Users/you/proj` → `Users-you-proj`（Claude 则为 `-Users-you-proj`）。
- **`<session-id>`**：与 hook stdin 的 `session_id`（或 `conversation_id`）一致。
- 子 agent 会话可能在 `agent-transcripts/<parent>/subagents/<id>.jsonl`。

### 解析优先级（`resolveCursorSessionJsonl`）

1. `HERMES_CURSOR_SESSION` — 仅测试 / 手动调试。
2. hook `session_id` → 上述目录下的 `<session-id>.jsonl`。
3. `workspace_roots[0]` 或仓库根对应项目下 **最新** `.jsonl`。
4. 无法解析 → `{ written: false, reason: "no cursor session found" }`，exit 0。

环境变量：

| 变量 | 用途 |
|------|------|
| `HERMES_CURSOR_SESSION` | 覆盖 JSONL 路径（测试） |
| `CURSOR_CONFIG_DIR` | 默认 `~/.cursor` |
| `CURSOR_SESSION_ID` | 无 hook stdin 时的手动调试 |

JSONL 行格式为 `role` + `message.content[]`（含嵌套 `tool_use`）；`parseJsonlFile` 已支持嵌套工具计数。

## `capture` 路由

[`router.ts`](../src/capture/router.ts)：

- stdin 含 `transcript_path` → Claude 分支（需 `claude-code` in `assistants`）。
- stdin 含 `session_id` / `hook_event_name: stop`（无 transcript）→ Cursor 分支。
- 双助手、无 stdin：先 Claude 最新 JSONL，若无再 Cursor。
- 仅 `cursor`：不调用 Claude resolver。

## 调试

`.memory/config.json` 设 `"debug": true` 后：

```bash
tail -f .memory/hermes-debug.log
```

`stop` 后可见 `capture` skip/ok 及 `jsonl=` 路径。

手动捕获（Cursor）：

```bash
HERMES_CURSOR_SESSION=./tests/fixtures/session-rich.jsonl npx @riconext/hermes-repo capture
```

## 验收标准

1. `init -y --tools cursor` → `.cursor/hooks.json` + `config.assistants` 含 `cursor`。
2. Cursor 新会话能注入 `MEMORY.md`（`sessionStart` + JSON `additional_context`）。
3. `stop` 触发 capture 且 router 走 cursor（debug 可见）。
4. `assistants: ["cursor"]` 时不读 Claude JSONL。
5. `bun run test` 全绿；hook 失败 exit 0。
6. 会话源可用时写入 captures 或启发式 skip 有明确 `reason`。

## 明确不做（2c）

- Tab hooks、`beforeReadFile` 审计、`workspaceOpen`。
- LLM 格式化（Phase 3）、consolidate（Phase 4）。
- `sessionEnd` 补捕（可选 follow-up）。

## 关键实现文件

| 路径 | 职责 |
|------|------|
| `templates/hooks.cursor.json.tpl` | init 模板 |
| `src/init/mergeCursorHooks.ts` | 合并 `.cursor/hooks.json` |
| `src/init/assistants/cursor.ts` | 适配器 `available: true` |
| `src/capture/hookInput.ts` | 统一 stdin 解析 |
| `src/capture/cursor/resolveSession.ts` | 会话 JSONL 路径 |
| `src/capture/cursor/run.ts` | Cursor 捕获流水线 |
| `src/capture/router.ts` | 双助手路由 |
