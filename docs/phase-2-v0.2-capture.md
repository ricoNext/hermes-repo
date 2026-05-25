# Phase 2：v0.2 `capture` + `inject` 实施计划

> **状态**：已完成 · **版本**：`0.2.3`（含 `config.debug` 与 `hermes-debug.log`）· **依赖**：[Phase 1 init](phase-1-v0.1-init.md)（v0.1.1）
>
> **设计依据**：[hermes-repo-design.md](hermes-repo-design.md) § 双通道捕获、Claude Adapter、质量门槛、Level 0

## 目标

在已 `init` 的仓库中使用 Claude Code 时：

1. **SessionStart** → `inject` 将 `.memory/MEMORY.md` 摘要输出到 stdout（Level 0，约 2200 字符上限）。
2. **Stop** → `capture` 读取最近会话 JSONL → 启发式过滤 → 写入 `.memory/captures/` 并更新 `sessions/index.json`。
3. Hook 路径异常时 **exit 0**，不阻塞 Claude Code。
4. 仅当 `config.assistants` 含 `claude-code` 时执行 Claude 捕获逻辑。

## 已确认产品决策：`shouldCapture`

相对设计文档伪代码，**删除**「无 `fileChanges` 则直接 `return false`」门禁。其余门槛一致：

- 会话轮次 &lt; 3 → 不捕获
- 满足其一即捕获：强信号词、用户纠正、复杂任务（`toolCalls > 5`）
- 仅有 fileChanges、无任何价值信号 → 不捕获

实现见 `src/capture/shouldCapture.ts`；fixture `session-no-files-correction.jsonl` 覆盖「0 file changes + 用户纠正」。

## Claude Code hook / JSONL 契约（Sprint 2b.0）

### hooks 调用方式

`templates/hooks.json.tpl` 已配置（Claude Code 嵌套 `type: "command"` 格式）：

| Hook | `command` |
|------|-----------|
| `Stop` | `npx @riconext/hermes-repo capture` |
| `SessionStart` | `npx @riconext/hermes-repo inject` |

`init` 将 hooks 合并写入 **`.claude/settings.local.json`**（Claude Code 不读取独立的 `.claude/hooks.json`）。已有仓库请重新 `init -y`；可在 Claude 中用 `/hooks` 确认 Stop / SessionStart 已加载，并删除无效的 `.claude/hooks.json`。

Hook **不传 CLI 参数**；工作目录为仓库根（Claude Code 启动目录）。可选 `-C, --cwd` 仅用于本地调试。

### 会话 JSONL 路径（已按 [Claude Code 官方文档](https://code.claude.com/docs/en/claude-directory#application-data) 对齐）

**官方落盘**（Application data）：

```text
~/.claude/projects/<项目目录>/<session-id>.jsonl
```

- `<项目目录>`：仓库绝对路径将 `/` 替换为 `-`（例：`/Users/you/proj` → `-Users-you-proj`）
- 配置根目录可通过环境变量 `CLAUDE_CONFIG_DIR` 覆盖（默认 `~/.claude`）

**Stop hook** 在 stdin JSON 中提供 `transcript_path`（[Hooks 通用字段](https://code.claude.com/docs/en/hooks#common-input-fields)），`capture` 优先使用该路径。

`resolveSessionJsonlPath()` 优先级：

1. `HERMES_SESSION_JSONL` — 仅测试 / 手动调试
2. hook stdin 的 `transcript_path`
3. `~/.claude/projects/<当前 cwd 编码目录>/*.jsonl`
4. 全局 `projects/*/*.jsonl` 按 mtime 最新（并回退扫描旧版 `sessions/` 子目录）

实现见 `src/capture/claude-code/resolveSession.ts`。

### 调试日志（`config.debug`）

`init` 生成的 `.memory/config.json` 含 `"debug": false`；**每次 `init` 都会合并更新**该文件（见 [设计文档 § config 写入策略](hermes-repo-design.md)），旧仓库重新 `init -y` 即可补上 `debug` 字段。将 `"debug": true` 后，`capture` / `inject` 会向 **stderr** 与 **`.memory/hermes-debug.log`** 双写步骤信息（每行含 ISO 时间戳），例如：

```text
2026-05-20T12:00:00.000Z hermes-repo [capture] skip: no session jsonl found
2026-05-20T12:00:01.000Z hermes-repo [capture] ok: .memory/captures/semantic/capture-2026-05-20-001.md
2026-05-20T12:00:02.000Z hermes-repo [inject] ok: injected 412 chars
```

实时查看：`tail -f .memory/hermes-debug.log`。启发式跳过时会附带 `jsonl=` 路径便于排查。

`inject` 的 stdout 仍仅用于 MEMORY 内容，供 hook 注入。日志文件由 `.gitignore` 个人层忽略，不提交。

### JSONL 行格式（v0.2 解析假设）

`parseJsonl()` 兼容以下字段（见 `src/capture/claude-code/parseJsonl.ts`）：

- `type: "user" | "assistant"` 或 `message.role`
- 文本：`message.content` 字符串，或 `content[]` 中 `text` / CodeBuddy `input_text` / `output_text` 块
- 工具：`type: "tool_use"`、`function_call`（CodeBuddy），或 `message.content` 内 `tool_use` 块 → 计入 `toolCalls`
- CodeBuddy 元数据行（`file-history-snapshot`、`summary`、`function_call_result`）跳过
- 写文件：`tool_use.name` 为 `Write` / `Edit` / `MultiEdit` 等 → 计入 `fileChanges`

格式变更时仅需替换 `parseJsonl` / resolver，测试 fixture 在 `tests/fixtures/*.jsonl`。

## 交付清单

| 模块 | 路径 |
|------|------|
| CLI | `capture`（`-C`, `--dry-run`, `--strict`）、`inject`（`-C`, `--strict`） |
| 配置 | `src/config/findRepoRoot.ts`、`readConfig.ts` |
| 捕获 | `src/capture/*`、`src/capture/claude-code/*` |
| 注入 | `src/inject/runInject.ts`（`INJECT_MAX_CHARS = 2200`） |
| Hook 退出 | `src/hookExit.ts`：默认异常 exit 0 |
| 测试 | `tests/capture.test.ts`、`inject.test.ts`、`shouldCapture.test.ts`、`readConfig.test.ts` |

**本阶段不做**：LLM 提取、consolidate/flush、Cursor adapter、search/stats/promote、MCP。

## CLI 用法

```bash
# Hook 自动调用（init 后）
# Stop → capture
# SessionStart → inject

# 本地调试
node dist/cli.js inject -C /path/to/repo
node dist/cli.js capture -C /path/to/repo
node dist/cli.js capture --dry-run   # 打印摘要不写盘

# 指定 JSONL（测试）
HERMES_SESSION_JSONL=./tests/fixtures/session-rich.jsonl node dist/cli.js capture
```

## 验收标准（10 条）

1. `bun run test` + `bun run typecheck` 全绿。
2. 未 init 仓库：`capture` / `inject` exit 0，不写文件。
3. `init -y` 后：`inject` stdout 含「项目记忆」占位文案。
4. `config.assistants` 无 `claude-code` 时 `capture` 不写 captures。
5. fixture 通过启发式后，`.memory/captures/**` 新增 md，frontmatter 合法。
6. `sessions/index.json` 新增一条且 JSON 可解析。
7. 启发式不通过时不落盘；**无 file changes + 用户纠正** fixture 应落盘。
8. `capture` / `inject` 抛错时 hook 模式仍 exit 0（`--strict` 可 exit 1）。
9. `--dry-run` 不写盘。
10. 无 LLM、无 consolidate 自动触发、无 MEMORY 自动更新。

## 与 v0.3 衔接

- `shouldCapture === true` 分支可插入 LLM 格式化（`semantic` / `episodic` / `procedural` 精细化）。
- 预留 `src/capture/formatCapture.ts`：`simpleFormat`（v0.2）与 `llmFormat`（v0.3）可替换。
