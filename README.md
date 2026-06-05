# hermes-repo

**让 AI 编程助手真正「住」在你的 Git 仓库里** — 不用换 IDE、不用上云记忆平台，会话结束自动记下约定与踩坑，下次打开对话项目上下文已经在。

npm：`@riconext/hermes-repo` · 灵感来自 [Hermes Agent](https://github.com/NousResearch/hermes) 的记忆与技能闭环 · [完整设计文档](docs/hermes-repo-design.md)

![](https://neptune-ipc.oss-cn-shenzhen.aliyuncs.com/img/20260521182425723.png)

## 为什么选择 hermes-repo

你可能试过：只靠根目录 `AGENTS.md` 手写项目说明（容易过时、越写越长）、靠聊天记录「记住上次说了啥」（换机器就没了）、或等某家助手的内置记忆（绑平台、难进 Git、团队难对齐）。

**hermes-repo 换了一条更踏实的路：记忆跟着 repo 走，人审过才能进团队层。**

| 你会得到 | 这意味着什么 |
|----------|----------------|
| **开箱闭环** | `init` 一次 → hooks 自动捕获 / 注入 → `flush` 生成 `MEMORY.md`，不必自己拼脚本 |
| **多助手共用一套记忆** | Claude Code、Cursor、CodeBuddy 已接入；同一 `.memory/`，不重复维护三份说明 |
| **个人沉淀 + 团队 PR** | 捕获默认不进 Git；值得共享的经 `promote` 评审后写入 `topics/`，像管代码一样管约定 |
| **不拖慢你写代码** | Stop hook 先落盘简版捕获，LLM 在后台升级；没配 API 也能完整跑通 |
| **越用越聪明** | `ref` 反馈、`search` / `stats`、30/90 天生命周期 — 摘要里留下「真的被用过的」记忆 |
| **成本可控** | 仅 OpenAI 兼容 API；默认推荐 DeepSeek `deepseek-v4-flash`，记忆场景便宜够用 |

一句话：**把「这个项目是怎么回事」从聊天窗口里搬回仓库里，并且让 AI 每次会话都能自动读到最新版。**

适合已经用 AI 写真实业务代码、又希望**知识可版本化、可审查、可迁移**的个人与小团队 — 而不是再找一个和黑盒绑死的「云端第二大脑」。

---

## 解决什么问题

用 Claude Code、Cursor 等助手写代码时，常见痛点是：

- 每个新会话都要重新说明「我们项目用 pnpm」「API 返回 snake_case」
- 上周踩过的坑，这周又要踩一遍
- 团队里只有某个人「懂项目」，知识锁在聊天记录里

**hermes-repo** 把有价值的信息写成项目里的**结构化记忆**，在会话开始时自动注入上下文，并支持检索、统计和（可选）经审查后纳入团队共享层。

---

## 它能做什么

| 能力 | 你会感受到什么 |
|------|----------------|
| **自动记住** | 会话结束后，助手 hooks 把本次有价值的内容写成记忆文件 |
| **下次自带上下文** | 新会话开始时，自动加载项目摘要（`MEMORY.md`） |
| **三种记忆** | 约定与事实、具体事件经过、可复用的操作步骤 |
| **越用越准** | 被引用过的记忆优先保留；长期不用的会降级或归档 |
| **可搜索** | 用关键词查历史捕获、主题和技能 |
| **团队共识** | 个人先沉淀，审查后再合并进团队可提交的 `topics/` |

不配 LLM 也能完成闭环；**长期在本仓库使用建议配置 LLM**（见 [配置 LLM](#配置-llm建议)）。

---

## 适合谁

- **个人开发者**：单仓库长期使用同一套 AI 助手，希望「项目记忆」跟着 repo 走
- **小团队**：约定、流程经 PR 审查后进入 `topics/` / `skills/`，新人 AI 也能对齐
- **多助手用户**：同一套 `.memory/` 可同时接入 Claude Code、Cursor、CodeBuddy、Codex（见下表）

---

## 整体架构

hermes-repo 是挂在**你的 Git 项目**上的记忆层：不改变你平时的编码方式，通过编程助手的 **hooks** 在后台读写 `.memory/`，由 **CLI** 负责初始化、整理、检索与团队晋升。

```
用户跑: npx @riconext/hermes-repo init
                │
                ▼
        交互：checkbox 多选编程助手（claude-code / cursor / codebuddy / codex）
        非交互：init -y [--tools id1,id2]  默认 assistants: [claude-code]
                │  init -y --scan  可选冷启动：扫描仓库生成首批 semantic 捕获 + flush
                ▼
        在项目中创建/合并:
        ├── .memory/
        │   ├── config.json           # version, storage, assistants[], debug
        │   ├── llm.json              # [个人] 可选 LLM（gitignore，init 可生成示例）
        │   ├── captures/
        │   │   ├── semantic/         # [个人] 语义记忆
        │   │   ├── episodic/       # [个人] 情景记忆
        │   │   └── procedural/     # [个人] 流程记忆（*.md.promote 侧车可触发 Skill）
        │   ├── topics/             # [团队] consolidate / promote --apply 写入
        │   ├── skills/             # [团队] flush 内 promoteSkills → SKILL.md
        │   ├── sessions/           # [个人] 会话索引 index.json
        │   ├── refs/               # [个人] ref CLI 写入，flush 聚合后删除
        │   ├── promote/            # [个人] promote --pr 草案（gitignore，含 staging/topics/）
        │   ├── templates/        # [团队] PROMOTE_PR.md、capture 示例等
        │   ├── team/               # [团队] decisions、conflict-resolutions、steward-log
        │   ├── .archive/           # [个人] 生命周期归档捕获
        │   ├── consolidate-state.json / .consolidate.lock  # [个人] flush 状态（gitignore）
        │   ├── skill-usage.json    # [个人] 技能引用统计（gitignore）
        │   └── MEMORY.md           # [团队] Level 0 摘要（≤约 2.2K 字符，inject 用）
        ├── AGENTS.md               # 通用助手指令（init 合并 hermes 标记块）
        └── 按 config.assistants[] 写入助手配置:
            .claude/settings.local.json    # claude-code: SessionStart→inject, Stop→capture
            .cursor/hooks.json             # cursor: sessionStart→inject, stop→capture
            .codebuddy/settings.local.json # codebuddy: SessionStart→inject, Stop→capture
            .codex/config.toml             # codex: AGENTS.md 项目指令锚点

────────────────── 运行时闭环（单仓库）──────────────────

SessionStart / sessionStart hook → npx @riconext/hermes-repo inject
  1. 读取 .memory/MEMORY.md（及配置）
  2. 输出到 stdout（Claude/CodeBuddy 正文；Cursor JSON additional_context）
  → AI 开箱加载项目摘要

用户正常编码 …

Stop / stop hook → npx @riconext/hermes-repo capture
  1. 按 hook 路径 / config.assistants 路由到 claude-code | cursor | codebuddy 会话源
  2. 读取会话 transcript（JSONL 等）
  3. shouldCapture 质量过滤（过短/无信号 → exit 0 跳过）
  4. 启发式写入 captures/<type>/capture-YYYY-MM-DD-NNN.md
  5. 若 llm.json 启用：入队 capture-llm 后台任务（detached）升级正文
  6. 达阈值时 maybeScheduleConsolidate → 后台 flush（detached）

flush / runConsolidate（手动或 capture 后自动）:
  1. dedupeCaptures → detectConflicts（捕获间规则互斥）
  2. buildTopics → topics/<slug>.md（可选 LLM）
  3. promoteSkills → skills/<slug>/SKILL.md（≥3 同 tag procedural 或 .promote 侧车）
  4. applyFeedback（refs/ → use_count、skill-usage）
  5. applyLifecycle（30d MEMORY 降级、90d 归档、*.md.ignore）
  6. buildMemory → 更新 MEMORY.md（含可用技能目录、待解决冲突段）

────────────────── 团队晋升（独立 CLI，非 flush 内联）──────────────────

个人标记: touch captures/<type>/xxx.md.promote
  → promote --preview | --pr   # PR 正文 + promote/staging/topics/ + decisions.template.json
  → 人工 review → promote --apply --manifest decisions.json  # 写入 topics/，清理侧车
  → flush  # 刷新 MEMORY.md

────────────────── 用户可主动调用的 CLI ──────────────────

  init [-y] [--tools] [--scan] [--force]
  capture / inject          # 通常由 hooks 调用
  capture-llm [--flush|--job]   # LLM 升级队列
  flush [--force] [--dry-run]   # consolidate 主入口
  ref / search / stats
  promote --preview | --pr | --apply --manifest
```

### 记忆生命周期

```text
init 脚手架 → 日常编码（助手 + hooks）
       → Stop：质量过滤 → 写入 captures/（个人层）
       → flush：去重 / 冲突标注 → 更新 topics/ + MEMORY.md（团队层摘要）
       → SessionStart：注入 MEMORY.md → AI 开箱即懂项目
       → ref / search：反馈与深挖历史
       → promote（可选）：个人捕获经评审进入团队 topics/
```

### 两层存储：个人 vs 团队

| 层级 | 典型路径 | 是否提交 Git | 用途 |
|------|----------|--------------|------|
| **个人层** | `captures/`、`sessions/`、`refs/` | 否（默认 gitignore） | 原始会话捕获、引用反馈，本机沉淀 |
| **团队层** | `topics/`、`skills/`、`MEMORY.md`、`team/` | 是（审查后） | 团队共识、可复用 Skill、注入用摘要 |

流向：**个人捕获 →（可选）promote 评审 → 团队 topics/skills → flush 更新 MEMORY.md → 全员助手加载**。

### 三种记忆类型

| 类型 | 记什么 | 举例 |
|------|--------|------|
| **语义** semantic | 事实、约定、架构决策 | API 返回格式、认证方案 |
| **情景** episodic | 某次事件的前因后果 | 迁移超时根因 |
| **流程** procedural | 可复用步骤 | 部署、迁移流程（可晋升为 Skill） |

### 检索分层（由快到深）

| 层级 | 方式 | 场景 |
|------|------|------|
| **L0 注入** | `MEMORY.md` 写入会话上下文 | 每次新开对话，约 2KB 摘要 |
| **L1 搜索** | `hermes-repo search`、目录浏览 | 需要查某条历史或主题时 |
| **L2 远期** | 独立 MCP 记忆服务 | 跨仓库、语义检索（规划中） |

### `.memory/` 目录一览

```text
.memory/
├── llm.json      # 个人：可选 LLM API（gitignore，勿提交）
├── captures/     # 个人：semantic / episodic / procedural 原始捕获
├── topics/       # 团队：按主题整理后的约定
├── skills/       # 团队：可复用 SKILL.md
├── MEMORY.md     # 团队：自动摘要（注入用）
├── sessions/     # 个人：会话索引
├── refs/         # 个人：引用反馈（flush 时聚合）
├── promote/      # 个人：晋升 PR 草案（gitignore）
├── team/         # 团队：决策与冲突记录
└── config.json   # 已启用助手、存储后端等
```

架构细节、hooks 契约与 MCP 远期方案见 [设计文档 · 整体架构](docs/hermes-repo-design.md#整体架构)。

---

## 五分钟上手

在**项目 Git 根目录**执行：

```bash
npx @riconext/hermes-repo init
```

按提示选择要接入的编程助手。完成后：

1. 正常用 AI 写代码 — 结束时自动**捕获**会话要点  
2. 新开对话 — 自动**注入**当前项目记忆摘要  
3. 需要时手动整理：`npx @riconext/hermes-repo flush`

**非交互环境（CI、脚本）**：

```bash
npx @riconext/hermes-repo init -y --tools claude-code
# 可选：根据仓库结构生成首批记忆
npx @riconext/hermes-repo init -y --scan --tools claude-code
```

初始化会生成 `.memory/`（记忆数据）、根目录 `AGENTS.md`（告诉助手如何用记忆），以及对应助手的 hooks 配置。个人层内容默认不提交 Git；团队层（主题、技能、摘要）可经 PR 提交。

---

## 配置 LLM（建议）

hermes-repo 的 **hooks 路径不依赖 LLM**（捕获、注入始终快速返回）。LLM 在**后台**参与「写得更准、整理得更好」，失败或未配置时会自动降级为规则模板，不阻塞日常编码。

### 模型接口与推荐

- **目前仅支持 OpenAI 兼容格式**：请求发往 `{baseUrl}/chat/completions`（与 OpenAI Chat Completions 相同的 JSON 结构与鉴权方式）。Anthropic 原生 API、Gemini 原生 API 等**不能**直接填写，需通过提供 OpenAI 兼容网关的服务间接使用。
- **建议使用 [DeepSeek](https://platform.deepseek.com/)**：`init` 与模板默认 `baseUrl: https://api.deepseek.com`、`model: deepseek-v4-flash`。记忆捕获与 consolidate 以短文本摘要为主，该模型**便宜且足够用**；若你已熟悉其他 OpenAI 兼容服务（如 OpenRouter、自建代理），只需改 `baseUrl` / `model` / `apiKey` 即可。

### 什么时候建议开启

| 场景 | 建议 |
|------|------|
| 试用、CI、无 API 预算 | 保持 `enabled: false`，启发式捕获 + 规则 `flush` 即可 |
| 个人项目长期 dogfood | **建议开启**，复杂会话的捕获分类与摘要明显更好 |
| 团队仓库 + promote | **建议开启**，`topics/` 草案与晋升 PR 说明更清晰（仍可选） |

### 开启后多做什么

| 环节 | 无 LLM | 有 LLM |
|------|--------|--------|
| **Stop → capture** | 立即写入启发式 capture | 先写简版，复杂会话后台 `capture-llm` 升级正文 |
| **flush** | 规则合并 `topics/`、`MEMORY.md` | 同上，可由 LLM 润色主题与摘要 |
| **Skill / promote** | 规则生成 | 可选 LLM 润色 `SKILL.md`、晋升 PR 条目说明 |

### 如何配置

**方式一：交互式 init（推荐）**

```bash
npx @riconext/hermes-repo init
```

按提示填写 API 地址、模型名与密钥；会写入 `.memory/llm.json`。

**方式二：手动编辑**

`init` 会在 `.memory/templates/llm.json.example` 提供示例。复制或编辑 `.memory/llm.json`：

```json
{
  "enabled": true,
  "provider": "openai",
  "baseUrl": "https://api.deepseek.com",
  "model": "deepseek-v4-flash",
  "apiKey": "你的密钥",
  "timeoutMs": 60000,
  "maxInputChars": 24000,
  "mode": "async"
}
```

| 字段 | 说明 |
|------|------|
| `enabled` | `true` 才启用；`false` 时与未配置等价 |
| `apiKey` / `baseUrl` / `model` | 三者缺一不可；须为 **OpenAI 兼容** `/chat/completions` 端点 |
| `provider` | 仅作标记（如 `"openai"`），实际以 `baseUrl` 指向的服务为准 |
| `mode` | 默认 `async`：hook 不等待；调试可用 `sync` 或环境变量 `HERMES_LLM_SYNC=1` |

非 DeepSeek 时：保持 `enabled: true`，将 `baseUrl`、`model` 换成你所用网关提供的 OpenAI 兼容地址与模型名即可。

**`init -y` 时**：会生成 `enabled: false` 的骨架；再次 `init` **不会覆盖**已有 `apiKey`，可安全补配。

### 安全说明

- `.memory/llm.json` 在 init 写入的 **gitignore 块中**，**不要提交到 Git**
- `config.json` 里**没有** API 密钥字段
- 团队共享记忆走 `topics/` / `MEMORY.md`，与个人 LLM 配置无关

### 验证与排障

```bash
# 处理积压的 LLM 升级任务
npx @riconext/hermes-repo capture-llm --flush

# 查看 hook / capture 日志
# 在 .memory/config.json 设 "debug": true，然后 tail -f .memory/hermes-debug.log
```

升级成功的 capture 会在 frontmatter 中带 `llmUpgradedAt`。若长期无升级，检查 `enabled`、`apiKey`、网络及 `baseUrl` 是否可达。

更完整的字段说明、触发条件与异步流程见 [phase-3-v0.8-llm-capture.md](docs/phase-3-v0.8-llm-capture.md)。

---

## 支持的编程助手

| 助手 | 状态 | 说明 |
|------|------|------|
| **Claude Code** | 已支持 | Stop / SessionStart hooks |
| **Cursor** | 已支持 | `hooks.json` 集成 |
| **CodeBuddy** | 已支持 | Stop / SessionStart hooks |
| **OpenAI Codex** | 已支持 | `AGENTS.md` + `.codex/config.toml` 项目级引导 |
| VS Code Copilot / Copilot CLI | 规划中 | AGENTS.md 可先手写引导 |

---

## 常用命令

| 命令 | 用途 |
|------|------|
| `init` | 初始化记忆目录与 hooks（可交互配置 LLM） |
| `capture-llm --flush` | 处理积压的 LLM 捕获升级任务 |
| `flush` | 整理捕获，更新 `MEMORY.md` 与主题 |
| `search <关键词>` | 搜索记忆 |
| `stats` | 查看记忆健康度 |
| `ref` | 记录「这条记忆有用」（反馈） |
| `promote --pr` / `--apply` | 将个人捕获晋升到团队层（需评审） |
| `bun run changeset` | 记录下一次发布的变更说明 |
| `bun run changeset:version` | 生成版本号与 `CHANGELOG.md` |

Hook 场景下还会用到 `capture`、`inject`（一般由助手自动调用，无需手敲）。

命令与配置细节：[设计文档](docs/hermes-repo-design.md) 

---

## 团队协作（可选）

```bash
# 标记某条个人捕获值得共享
touch .memory/captures/semantic/你的捕获文件.md.promote

# 生成晋升说明与草案（人工开 PR）
npx @riconext/hermes-repo promote --pr

# 评审通过后落盘并刷新摘要
npx @riconext/hermes-repo promote --apply --manifest decisions.json
npx @riconext/hermes-repo flush
```

建议指定 **Memory Steward** 轮值 review 晋升与冲突；流程说明见 [团队晋升文档](docs/phase-11-v0.13-promote.md)。

---

## 发布流程

本仓库使用 Changesets 管理版本与 `CHANGELOG.md`，并通过 GitHub Actions 在推送 `v*` tag 时发布 npm。

```bash
# 有用户可见改动时，随代码提交 changeset
bun run changeset

# 发版前生成 package.json 版本与 CHANGELOG.md
bun run changeset:version

# 本地验证
bun run typecheck
bun run test

# 提交版本变更后，打与 package.json 一致的 tag
git tag v0.14.0
git push origin v0.14.0
```

发布前需在 GitHub Actions secrets 中配置 `NPM_TOKEN`。详细说明见 [.changeset/README.md](.changeset/README.md)，自动发布 workflow 见 [.github/workflows/publish-npm.yml](.github/workflows/publish-npm.yml)。

---

## 路线图

| 阶段 | 内容 |
|------|------|
| **当前（~0.13）** | 单仓库闭环：捕获、整理、注入、搜索/统计、Skill、冷启动、团队 promote |
| **后续** | 记忆策展（curator）、跨仓库、MCP 记忆服务（独立仓库） |

完整版本史与成本分析见 [设计文档 · 开发路线图](docs/hermes-repo-design.md#开发路线图)。

---

## 文档

| 文档 | 说明 |
|------|------|
| [hermes-repo-design.md](docs/hermes-repo-design.md) | 架构、数据格式、团队流程、AGENTS 约定 |
| [phase-11-v0.13-promote.md](docs/phase-11-v0.13-promote.md) | 团队记忆晋升工作流 |
| [phase-3-v0.8-llm-capture.md](docs/phase-3-v0.8-llm-capture.md) | 可选 LLM 捕获配置 |

各版本实施记录：`docs/phase-*.md`。

---

## 参与开发

```bash
bun install && bun run build && bun run test
```

本地调试：`node dist/cli.js --help`  
Hook 排障：在 `.memory/config.json` 中设置 `"debug": true`，查看 `.memory/hermes-debug.log`。

---

## License

[MIT](LICENSE)
