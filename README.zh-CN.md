# hermes-repo

**把 AI 编程助手的项目记忆放回 Git 仓库。** hermes-repo 会把助手 hooks 接到当前仓库里：会话结束时捕获有价值的上下文，需要时用 LLM 整理成 `.memory/` 下的知识文件，并在后续会话开始时自动注入。

npm：`@riconext/hermes-repo` · 灵感来自 [Hermes Agent](https://github.com/NousResearch/hermes) 的记忆与技能闭环 · [English](README.md)

> **Monorepo**：`packages/cli`（CLI，已发布 npm）、`packages/mcp-server`（MCP 服务，规划中）、`packages/ui`（管理界面，规划中）。详见 [packages/README.md](packages/README.md)。

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

![](https://neptune-ipc.oss-cn-shenzhen.aliyuncs.com/img/20260521182425723.png)

## 功能概览

| 能力 | 行为 |
|------|------|
| 助手接入 | `init` 创建 `.memory/`、合并 `AGENTS.md`，并为所选助手写入 hook 配置 |
| 会话捕获 | Stop hook 将会话摘要追加到 `.memory/captures/raw/session-*.md` |
| 会话注入 | SessionStart hook 输出 `.memory/MEMORY.md` 与 `.memory/rules/*.md` 全文 |
| LLM 捕获升级 | 配好 LLM 后，`capture-llm --flush` 处理排队的单会话升级任务 |
| 知识整理 | `flush` 调用 OpenAI 兼容 LLM，把原始捕获整理成知识文件并更新 `MEMORY.md` |
| 自动整理 | LLM 配置完整时，capture 达到阈值可后台自动触发 `flush` |
| 多助手支持 | 支持 Claude Code、Cursor、CodeBuddy、OpenAI Codex |

## 为什么需要

AI 编程会话经常丢失本地项目上下文：

- 每个新会话都要重新说明包管理器、命名风格、API 形态。
- 上周解释过的 bug 根因，后来还得在聊天记录里翻。

hermes-repo 把项目记忆留在 repo 里：hook 捕获会话，LLM 整理成结构化知识，后续会话自动注入。

## 为什么需要 LLM

hermes-repo 分两个阶段：

| 阶段 | 命令 | 是否需要 LLM |
|------|------|--------------|
| 捕获与注入 | `capture`、`inject` | 否 |
| 整理 | `flush`、`capture-llm`、`autoFlush` | 是 |

`capture` 只会把会话 transcript 追加到 `.memory/captures/raw/`，这是原始记录，还不是可用的项目记忆。

`inject` 加载的是 `MEMORY.md` 和 `rules/*.md`。这些文件由 `flush` 生成或更新——`flush` 会调用 OpenAI 兼容 LLM，完成分类、写入知识文件、重新生成导航摘要。

没有 LLM 配置时，hook 仍会运行，但记忆不会被整理。请在交互式 `init` 中配置 LLM，或之后编辑 `.memory/config.json`，记忆闭环才能正常工作。

## 五分钟上手

在项目 Git 根目录执行：

```bash
npx @riconext/hermes-repo init
```

交互式 `init` 会询问：

- 目标仓库目录
- 要接入哪些助手
- 是否写入 capture 示例模板到 `.memory/templates/`
- 是否现在配置 OpenAI 兼容 LLM

如果在 init 阶段配置 LLM，hermes-repo 会写入 `.memory/config.json`，并在结束摘要中确认 `flush` 是否可用。LLM 不完整时，`capture` 和 `inject` 仍可用，但 `flush` / `autoFlush` 暂时无法整理记忆。

非交互初始化：

```bash
npx @riconext/hermes-repo init -y --tools claude-code
npx @riconext/hermes-repo init -y --tools claude-code,cursor,codebuddy,codex
```

`-y` 会跳过 LLM 配置询问。如需使用 `flush` 或 `autoFlush`，请之后手动编辑 `.memory/config.json`。

之后正常使用助手：

1. 会话开始时，hook 运行 `inject`。
2. 会话结束时，hook 运行 `capture`。
3. 积累了原始捕获且已配置 LLM 后，可等待 `autoFlush` 自动整理，或手动执行：

```bash
npx @riconext/hermes-repo flush
```

## 整体架构

```text
用户运行: npx @riconext/hermes-repo init
        |
        v
创建/合并:
  .memory/
    config.json              # 本地配置，包含 LLM key，gitignored
    MEMORY.md                # 会话注入用导航摘要
    rules/                   # 每次注入时全文加载
    domains/general/         # 领域知识
    workflows/               # 可复用流程
    decisions/               # 架构/产品决策
    incidents/               # 踩坑和根因记录
    captures/raw/            # 原始会话捕获，gitignored
    captures/archived/       # 已归档捕获，gitignored
    consolidate-state.json   # 本地处理状态，gitignored
  AGENTS.md                  # 共享助手引导
  assistant hook config      # .claude, .cursor, .codebuddy, .codex

运行时:
  SessionStart -> hermes-repo inject
    读取 MEMORY.md + rules/*.md
    按助手 hook 协议输出

  Stop -> hermes-repo capture
    解析当前助手 transcript
    追加到 captures/raw/session-{id}.md
    可选：排队后台 LLM 升级任务
    满足阈值时可能调度后台 flush（autoFlush）

  手动 -> hermes-repo flush
    需要已配置 LLM
    读取 pending/stale 原始会话
    写入 rules/domains/workflows/decisions/incidents
    重新生成 MEMORY.md
```

## 存储模型

| 层级 | 路径 | Git 行为 | 用途 |
|------|------|----------|------|
| 本地 | `.memory/config.json`、`.memory/captures/`、`.memory/consolidate-state.json`、`.memory/.consolidate.lock` | init 写入的 gitignore 块会忽略 | 密钥、会话记录、处理状态 |
| 知识库 | `.memory/MEMORY.md`、`.memory/rules/`、`.memory/domains/`、`.memory/workflows/`、`.memory/decisions/`、`.memory/incidents/` | 默认纳入版本控制（除非你自行 gitignore） | 注入到后续会话的结构化记忆 |
| 助手引导 | `AGENTS.md`、已选择助手的配置文件 | 普通仓库文件 | 告诉助手如何使用记忆 |

## LLM 配置

配置 LLM 后才能启用整理能力。`flush`、`capture-llm`、`autoFlush` 都依赖 LLM。

hermes-repo 使用 OpenAI 兼容的 Chat Completions 接口：

```json
{
  "llm": {
    "enabled": true,
    "provider": "openai",
    "baseUrl": "https://api.deepseek.com",
    "model": "deepseek-v4-flash",
    "apiKey": "你的密钥",
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

注意事项：

- `enabled`、`apiKey`、`baseUrl`、`model` 都必须完整配置，LLM 调用才会发生。
- `baseUrl` 是服务根地址；hermes-repo 会请求 `{baseUrl}/chat/completions`。
- 不直接支持 Anthropic 或 Gemini 原生接口。需要通过 OpenAI 兼容网关使用。
- `.memory/config.json` 可能包含 `apiKey`，默认会被 gitignore。
- 新项目默认开启 `consolidate.autoFlush.enabled`。LLM 配置完整后，capture 达到阈值时可以后台自动触发 `flush`。
- 如果关闭 `autoFlush`，需要在积累 capture 后手动运行 `npx @riconext/hermes-repo flush`。

手动处理排队的捕获升级：

```bash
npx @riconext/hermes-repo capture-llm --flush
```

## MCP 服务器使用

hermes-repo 提供了 MCP 服务器（`@riconext/hermes-mcp-server`）用于团队级别的记忆管理。它暴露 MCP 工具用于列出项目、添加记忆、搜索和提升记忆，同时提供 REST API 供 Web UI 使用。

### MCP 工具

- `list_projects` — 列出可用项目
- `add_memory` — 向项目添加新记忆
- `search_memories` — 按关键词搜索记忆
- `promote_memory` — 将记忆提升到团队级别
- `delete_memory` — 删除记忆

### 部署 MCP 服务器

1. **启动 PostgreSQL**

   在仓库根目录：

   ```bash
   docker compose up -d
   ```

2. **配置环境变量**

   ```bash
   cd packages/mcp-server
   cp .env.example .env
   ```

   关键变量：

   - `DATABASE_URL` — PostgreSQL 连接字符串
   - `MCP_TRANSPORT` — `httpStream`（默认）或 `stdio`
   - `DEV_AUTH_BYPASS=true` — 开发模式跳过 JWT 认证

3. **初始化数据库**

   ```bash
   bun run db:push
   bun run db:seed
   ```

   默认管理员账号：`admin` / `admin`（角色：SUPER_ADMIN）

4. **启动 MCP 服务**

   ```bash
   bun run dev:mcp   # 从仓库根目录
   # 或
   cd packages/mcp-server
   bun run dev
   ```

   服务运行在 `http://localhost:3000`。健康检查：`http://localhost:3000/health`。

### 接入 Claude Code

在 Claude Code 配置中添加 MCP 服务器：

```json
{
  "mcpServers": {
    "hermes-memory": {
      "command": "node",
      "args": ["/path/to/hermes-repo/packages/mcp-server/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://hermes:hermes@localhost:5432/hermes_memory",
        "MCP_TRANSPORT": "stdio",
        "DEV_AUTH_BYPASS": "true"
      }
    }
  }
}
```

请将 `/path/to/hermes-repo` 替换为实际的仓库路径。

## 部署 UI

Web UI（`@riconext/hermes-ui`）提供了用于浏览项目和记忆的仪表盘。

1. **配置环境变量**

   ```bash
   cd packages/ui
   cp .env.example .env.local
   ```

   编辑 `.env.local`：

   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:3000
   ```

2. **启动 UI**

   从仓库根目录：

   ```bash
   bun run dev:ui
   ```

   或从 UI 包目录：

   ```bash
   bun run dev
   ```

   访问 UI：[http://localhost:3001](http://localhost:3001)。

3. **生产构建**

   ```bash
   cd packages/ui
   bun run build
   bun run start
   ```

## 支持的助手

| 助手 | `init` 写入 | 运行时行为 |
|------|-------------|------------|
| Claude Code | `.claude/settings.local.json` | SessionStart inject，Stop capture |
| Cursor | `.cursor/hooks.json` | sessionStart inject，stop capture |
| CodeBuddy | `.codebuddy/settings.local.json` | SessionStart inject，Stop capture |
| OpenAI Codex | `.codex/config.toml`、`.codex/hooks.json` | SessionStart inject，Stop capture |

非交互模式默认选择 `claude-code`。

## CLI

```bash
npx @riconext/hermes-repo init [options]
npx @riconext/hermes-repo capture [options]
npx @riconext/hermes-repo inject [options]
npx @riconext/hermes-repo capture-llm [options]
npx @riconext/hermes-repo flush [options]
```

### `init`

初始化记忆目录和助手 hook 配置。

选项：

- `-y, --yes`：非交互模式
- `--tools <ids>`：逗号分隔的助手 id，需要和 `-y` 一起使用
- `-f, --force`：刷新脚手架文件和受管理的标记块
- `-C, --cwd <dir>`：目标目录

已知助手 id：`claude-code`、`cursor`、`codebuddy`、`codex`。

### `capture`

通常由助手 Stop hook 调用。它读取 hook stdin，解析助手 transcript，并追加到 `.memory/captures/raw/session-{id}.md`。

选项：

- `-C, --cwd <dir>`
- `--dry-run`
- `--strict`

### `inject`

通常由助手 SessionStart hook 调用。它输出 `MEMORY.md` 和所有 `rules/*.md`，并为 Cursor、Codex 使用对应的 JSON 输出格式。

选项：

- `-C, --cwd <dir>`
- `--strict`

### `capture-llm`

处理 pending 的捕获升级任务。

选项：

- `-C, --cwd <dir>`
- `--job <id>`
- `--flush`
- `--strict`

### `flush`

对 pending 或 stale 的原始会话捕获执行 LLM 整理。

选项：

- `-C, --cwd <dir>`
- `--force`
- `--dry-run`
- `--strict`

如果 LLM 未启用或配置不完整，`flush` 默认会为了 hook 安全以成功状态退出，但会打印 `LLM not enabled in config.json`。需要非零退出码时使用 `--strict`。

## 排障

在 `.memory/config.json` 开启 debug：

```json
{
  "debug": true
}
```

常用日志：

- `.memory/logs/capture.log`
- `.memory/logs/flush.log`
- `.memory/logs/consolidate.log`

本地调试 CLI：

```bash
bun run build
node dist/cli.js --help
```

## 开发

需要 Node.js >= 20。

```bash
bun install
bun run build
bun run test
bun run typecheck
```

发布：

```bash
bun run changeset
bun run release
```

## License

[MIT](LICENSE)
