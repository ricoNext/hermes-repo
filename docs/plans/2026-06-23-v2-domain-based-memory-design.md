# Hermes v2 设计方案：基于域的知识组织重构

:> 日期: 2026-06-23
:> 状态: 已确认，待实施

## 背景

v1 结构运行两个月后发现的核心问题：**信息生命周期没有分清楚**。

- captures 噪声太大（对话流水、结论、需求混在一起）
- topics 粒度不稳定（有价值的和泛名的混在一起）
- 团队共识 vs 个人临时记忆没区分开
- 缺少状态字段（是否有效、是否已实现、是否需人工确认）
- skills 没用起来

## 设计原则

1. **Captures 是 raw evidence，不是知识** — 必须经过 LLM 整理才能进入知识库
2. **按业务域组织** — 改库存读 inventory/，改报价读 quoted/
3. **状态驱动** — 每条知识都有生命周期状态
4. **懒 Consolidate** — 手动触发，LLM 完整提炼（单次调用）
5. **两阶段注入** — 先注导航，AI 按需读取

## 最终目录结构

```
.memory/
├── MEMORY.md                   # 导航中心 + AI 注入入口（LLM 自动生成 + 可编辑）
├── config.json                 # 主配置（含 LLM 配置，apiKey 敏感字段 gitignored）
├── consolidate-state.json      # consolidate 状态追踪
│
├── rules/                      # 必读规则（每次会话都应加载）
│   └── *.md                    # frontmatter: status, confidence, lastReviewed
│
├── domains/                    # 业务知识（LLM 提取的业务域）
│   ├── {domain}/               # 域名由 LLM 从 captures 内容自动提取
│   │   └── *.md                # frontmatter: domain, status, confidence, lastReviewed
│   └── general/                # 无法归类的默认兜底域
│
├── workflows/                  # 可执行流程（procedural captures 晋升而来）
│   └── *.md
│
├── decisions/                  # 历史决策记录（为什么这么做）
│   └── {date}-{slug}.md
│
├── incidents/                  # 踩坑记录（问题、根因、修复方式）
│   └── {date}-{slug}.md
│
└── captures/
    ├── raw/                    # session 级别的原始记录（raw evidence）
    │   └── session-{id}.md    # 一个文件 = 一个对话
    └── archived/              # 可选：已处理完的旧记录
```

### 与 v1 的变更对照

| v1 | v2 | 说明 |
|----|-----|------|
| topics/ | rules/ + domains/ + workflows/ + decisions/ + incidents/ | 按类型拆分 |
| captures/{semantic,episodic,procedural}/ | captures/raw/ | 统一存储，按 session 聚合 |
| captures/pending/ | 去掉 | 状态改到文件 frontmatter |
| skills/ | workflows/ | 更名，语义更清晰 |
| refs/ | 去掉 | 引用追踪由 lastReviewed 替代 |
| team/ | 去掉 | v2 不考虑团队版 |
| llm.json | 合并入 config.json | 减少文件数量 |
| sessions/ | 去掉 | 直接扫 captures/raw/ 获取 session 列表 |
| promote 命令 | 去掉 | v2 不考虑团队版 |
| ref 命令 | 去掉 | refs 已移除 |
| init --scan | 去掉冷启动扫描 | 等积累 captures 后 consolidate 更干净 |
| personal/ | 去掉 | v2 不区分个人/团队层 |
| .archive/ | 去掉 | 由 captures/archived/ 替代 |

## 核心数据模型

### Capture 文件（captures/raw/session-{id}.md）

一个对话对应一个文件，支持追加：

```markdown
---
sessionId: abc123
source: session | commit | manual
status: pending | done | stale      # consolidate 状态机
domain: null                        # consolidate 后由 LLM 填写
createdAt: 2026-06-23T16:00:00
lastModifiedAt: 2026-06-23T17:30:00
consolidatedAt: null               # 上次 consolidate 时间
captureCount: 3
---

## Capture #1 — 16:00:00
### type: semantic
### tags: [discount, quoted]

讨论了报价单的 discount 显示逻辑...

## Capture #2 — 16:15:00
### type: episodic
### tags: [bug-fix]

因为 xxx 导致了 yyy 问题...

## Capture #3 — 17:30:00
### type: procedural
### tags: [gacp]

GACP 提交流程的步骤...
```

### Capture 状态机

```
新建文件 → pending (从未 consolidate)
           ↓ [consolidate 成功]
         done (已总结)
           ↓ [新 capture 追加到该文件]
         stale (有新内容，需重新处理)
           ↓ [consolidate 成功]
         done
```

### Knowledge 文件 Frontmatter（domains/rules/workflows/decisions/incidents 共享）

```yaml
---
title: 报价单折扣显示规则
domain: quoted                      # 所属业务域
type: rule | domain-knowledge | workflow | decision | incident
status: active | implemented | superseded | needs_review | archived
confidence: high | medium | low     # 信息可信度
lastReviewed: 2026-06-23
sourceSessions:                     # 来源 session 列表
  - session-abc123
  - session-def456
---
```

## 核心流程

### 1. Inject（Session Start 时）

```
Hook 触发 → 读 MEMORY.md 导航摘要
          → 读 rules/ 全部内容
          → 组装为 context 注入 AI session
          → AI 按需 cat domains/*/workflows/* 具体文件
```

### 2. Capture（Session Stop 时）

```
Hook 触发 → 解析对话内容
          → 找到或创建 captures/raw/session-{id}.md
          → 追加新的 Capture 段落到末尾
          → 若该文件 status=done → 改为 stale
```

### 3. Consolidate（手动 hermes flush 触发）

```
扫描 captures/raw/ 中 status ∈ {pending, stale} 的文件
    │
    ▼
[单次 LLM 调用] 完整提炼
  输入:
    - 所有 pending/stale 的 capture session 文件内容
    - 已有知识文件列表（路径 + frontmatter 摘要，用于智能合并）
    - 当前 MEMORY.md 内容（用于增量更新导航）

  输出 (JSON):
    - knowledgeFiles[]: 新建/更新的知识文件数组
      每项包含: targetPath, frontmatter, bodyMarkdown
    - memoryMd: 更新后的 MEMORY.md 完整内容
    - skippedSessions[]: 跳过的 session 及原因

  程序执行:
    1. 遍历 knowledgeFiles[]，写入对应目录
       (rules/, domains/{domain}/, workflows/, decisions/, incidents/)
    2. 写入 MEMORY.md（保留用户自定义编辑标记）
    3. 更新 consolidate-state.json
    4. 将处理完的 capture 文件 status → done
    5. 检查自动归档（done + 超 N 天 → archived/）
```

### 4. MEMORY.md 模板（Consolidate 后生成）

```markdown
# 项目知识库

最后更新: 2026-06-23 | 域: 4 | 规则: 3 | 工作流: 2

## 必读规则
> 每次会话都应加载

- [rules/coding.md](./rules/coding.md) — 编码规范
- [rules/frontend-validation.md](./rules/frontend-validation.md) — 前端验证要求

## 业务域
> 根据任务选择相关域读取

| 域 | 文件 | 摘要 |
|----|------|------|
| quoted | entry.md, discount.md | 报价单、折扣显示 |
| inventory | dashboard.md, warehouse-select.md | 库存仪表盘 |
| yapi | sync-notes.md | YApi 同步流程 |
| general | auto-capture.md | 通用约定 |

## 工作流
> 可复用执行流程

- [gacp.md](./workflows/gacp.md) — GACP 提交规范
- [yapi-sync.md](./workflows/yapi-sync.md) — YApi 接口同步

## 决策 & 踩坑
> 需要背景时按需查看

- decisions/: 2 条记录
- incidents/: 1 条记录
```

## 实施计划

### Phase 1: 基础结构改造 ✅ 已完成
- [x] 更新 `init/paths.ts` — 新目录结构定义
- [x] 重写 `capture/writeCapture.ts` — session 聚合模式
- [x] 更新 `config/types.ts` + `readConfig.ts` — v2 schema
- [x] 更新 `init/writeScaffoldFile.ts` — v2 scaffold
- [x] 更新模板文件（MEMORY.md.tpl, config.json.tpl, capture-session.example.md）
- [x] 删除废弃模板（llm.json.example, PROMOTE_PR.md, SKILL.md.tpl 等）
- [x] 更新 `capture/commitCapture.ts` — 使用新的 appendCaptureToSession

### Phase 2: Consolidate 重构 ✅ 已完成
- [x] 新建 `consolidate/runConsolidate.ts` — 单次 LLM 调用主编排
- [x] 新建 `consolidate/llmConsolidateV2.ts` — LLM prompt 构建 + API 调用 + 结果验证
- [x] 新建 `consolidate/writeKnowledge.ts` — knowledge 文件写入 + MEMORY.md 写入
- [x] 新建 `consolidate/sessionScanner.ts` — 扫描 pending/stale session 文件
- [x] 新建 `consolidate/archive.ts` — 自动归档（done + 超 N 天 → archived/）
- [x] 重写 `consolidate/state.ts` — v2 状态模型 (processedSessions)
- [x] 重写 `consolidate/scheduleConsolidate.ts` — v2 接口适配
- [x] LLM 未配置时直接报错（无降级模式）

### Phase 3: Inject & Hook 改造 ✅ 已完成
- [x] 重写 `src/inject/runInject.ts` — 两阶段注入（导航+rules 全文）
- [x] 更新 `src/inject/constants.ts` — INJECT_MAX_CHARS 2200 → 8000
- [x] 更新 `templates/AGENTS.hermes-block.tpl`
- [x] 重写 `templates/AGENTS.md.tpl` — v2 用户说明文档
- [x] 确认 `templates/hooks.*.json.tpl` 无需变更（inject 命令名不变）

### Phase 4: 清理 ✅ 已完成
- [x] 删除 `feedback/` 模块（引用追踪系统）
- [x] 删除 `skills/` 模块（技能晋升系统）
- [x] 删除 `promote/` 模块（团队层晋升）
- [x] 删除 `coldstart/` 模块（冷启动扫描）
- [x] 删除 `lifecycle/` 模块（30d demotion / 90d archive 旧逻辑）
- [x] 删除旧 consolidate 子模块（dedupe/detectConflict/buildTopics/buildMemory/listCaptures/llmConsolidate/parseCapture）
- [x] 移除 `promote`/`ref`/`search`/`stats` CLI 命令及注册
- [x] capture adapters 移除 shouldCapture 质量过滤（改为空会话检测）
- [x] 更新 `.gitignore` 模板（hermes-block.txt）— v2 目录结构
- [x] 简化 `init/runInit.ts` 和 `init/prompts.ts`（移除 coldstart/bootstrap/scan/llm.json）
- [x] TypeScript 编译通过（0 错误）

## Gitignore 策略

```
# 提交到 Git（团队共享的知识）
.memory/MEMORY.md
.memory/config.json              # 个人配置，包含 LLM apiKey，不提交
.memory/rules/
.memory/domains/
.memory/workflows/
.memory/decisions/
.memory/incidents/

# 不提交（个人数据 / 运行时状态）
.memory/captures/               # raw evidence，原始对话记录
.memory/consolidate-state.json  # 运行时状态
```

> **注意**: `config.json` 中 LLM 的 `apiKey` 是敏感字段，`.memory/config.json` 应保持 gitignored，不要提交到 Git。

## CLI 命令

| 命令 | 用途 | 变化 |
|------|------|------|
| `hermes init` | 初始化项目记忆结构 | 更新：创建 v2 目录 |
| `hermes capture` | 手动捕获（通常由 hook 自动调用） | 保留 |
| `hermes flush` | 触发 consolidate | 重构：单次 LLM 调用完整提炼 |
| ~~`hermes promote`~~ | 团队记忆提升 | **移除** |
| ~~`hermes ref`~~ | 引用追踪 | **移除** |

### 可选新增命令（后续迭代）

- `hermes domain list` — 查看所有业务域
- `hermes memory show {domain}` — 查看某域知识内容
- `hermes memory status` — 查看 consolidate 状态概览

## 配置文件 Schema

### config.json

```json
{
  "version": 2,
  "assistants": ["claude", "cursor", "codebuddy", "codex"],
  "debug": false,

  "llm": {
    "enabled": true,
    "baseUrl": "https://api.openai.com/v1",
    "model": "gpt-4o",
    "apiKey": "sk-...",
    "timeoutMs": 60000,
    "maxInputChars": 24000,
    "mode": "async"
  },

  "consolidate": {
    "autoArchiveDays": 30
  }
}
```

### consolidate-state.json

```json
{
  "version": 1,
  "lastConsolidatedAt": "2026-06-23T17:00:00",
  "stats": {
    "totalCapturesProcessed": 15,
    "domains": ["quoted", "inventory", "yapi", "general"],
    "knowledgeFilesCreated": 8
  },
  "processedSessions": {
    "session-abc123": { "status": "done", "consolidatedAt": "2026-06-23T17:00:00" },
    "session-def456": { "status": "stale", "lastCaptureAt": "2026-06-23T18:00:00" }
  }
}
```

## Knowledge 文件命名规则

| 目标目录 | 命名方式 | 例子 |
|----------|---------|------|
| `rules/*.md` | kebab-case | `coding.md`, `frontend-validation.md` |
| `domains/{domain}/*.md` | kebab-case | `entry.md`, `discount-display.md` |
| `workflows/*.md` | 动词开头 kebab-case | `gacp-submit.md`, `yapi-sync.md` |
| `decisions/*.md` | `{date}-{slug}.md` | `2026-06-23-quoted-discount.md` |
| `incidents/*.md` | `{date}-{slug}.md` | `2026-06-22-react-query-cache.md` |

> **注意**: 同一 domain 下允许存在多个文件（如 discount.md + discount-calc.md），由 LLM 根据内容粒度决定是否拆分。

## LLM 依赖策略

**LLM 是 v2 的硬性依赖，不提供降级模式。**

- 未配置 LLM 时执行 `hermes flush` → 报错提示：`LLM 未配置，请在 config.json 中设置 llm.apiKey / llm.baseUrl / llm.model`
- 设计理由：v2 的核心价值就是 LLM 提炼，降级到"简单拼接"只会复现 v1 的问题

## 归档策略

**自动归档**：

- 每次 `hermes flush` 完成后检查
- 条件：capture 文件满足以下所有条件：
  - `status === "done"`
  - `consolidatedAt` 距今超过 `config.consolidate.autoArchiveDays` 天（默认 30）
- 操作：将文件从 `captures/raw/` 移动到 `captures/archived/`

## Hook 配置变化

### Inject 输出变更

v2 inject 与 v1 不同：

| 项目 | v1 | v2 |
|------|----|-----|
| 注入来源 | MEMORY.md 全文 | MEMORY.md 导航摘要 + rules/ 全部文件 |
| 内容量 | 小（几百行） | 中等（导航 + 规则全文） |
| 按需加载 | 无 | AI 可按需 cat domains/workflows |

### 需要同步更新的文件

- `templates/AGENTS.hermes-block.tpl` — inject 输出格式
- `templates/AGENTS.md.tpl` — 用户看到的说明文档
- `templates/hooks.*.json.tpl` — 各 assistant hook 配置中的 inject 命令
- 各 assistant adapter 中的 inject 实现

### Phase 3 实施时应包含 Hook 同步更新。

## 模板文件变更

| 模板 | 变化 |
|------|------|
| `AGENTS.hermes-block.tpl` | **改写**: inject 输出格式（导航+rules全文） |
| `AGENTS.md.tpl` | **改写**: 用户说明文档，反映 v2 结构 |
| `MEMORY.md.tpl` | **改写**: v2 导航模板（规则/域/工作流/决策/踩坑） |
| `config.json.tpl` | **改写**: 合并 llm 配置，version: 2，新增 consolidate 节 |
| `hooks.*.json.tpl` (4个) | **改写**: inject 命令参数适配 v2 输出 |
| `capture-session.example.md` | **新增**: session 聚合格式示例 |
| `llm.json.example` | **删除**: 已合并入 config.json |
| `PROMOTE_PR.md` | **删除**: promote 功能已移除 |
| `SKILL.md.tpl` | **删除**: skills→workflows，由 LLM 生成无需模板 |
| `steward-log.md.tpl` | **删除**: team 功能已移除 |
| `capture-semantic.example.md` | **删除**: 合并为 session 格式 |
| `capture-episodic.example.md` | **删除**: 合并为 session 格式 |
| `capture-procedural.example.md` | **删除**: 合并为 session 格式 |

> **实施位置**: 模板变更分散在 Phase 1（config/MEMORY/capture 示例）和 Phase 3（AGENTS/hooks）。

## 不做的事（YAGNI）

- 增量自动 consolidate（后续迭代）
- 数据迁移脚本（无现有用户）
- 复杂的引用图/依赖关系
- Web UI
- 冷启动扫描 init --scan（等积累 captures 后 consolidate 更干净）
- sessions/ 索引文件（直接扫 captures/raw/）
- maxCapturesPerRequest 配置（单次 LLM 调用不需要分批控制）

## 边缘情况处理

### Capture 质量过滤

**v2 去掉 shouldCapture 质量过滤**。不再做信号强度检测或收敛判断。

- 所有对话内容都记录到 `captures/raw/session-{id}.md`
- 由 LLM 在 consolidate 时判断哪些有价值、哪些是噪音
- 理由：v1 的前置过滤容易误判，且 LLM 本身就能区分价值

### Stale 文件的智能合并

当 status=stale 的文件重新 consolidate 时，LLM 对已有知识文件执行**智能合并**：

```
输入:
  - 已有 domains/quoted/discount.md (前次 consolidate 结果)
  - 新增 session-{id}.md 中的相关 capture 内容

LLM 判断并输出:
  - 哪些段落保持不变
  - 哪些段落需要更新/修正
  - 哪些内容是新增的需追加

最终: 重写目标文件（包含合并后的完整内容）
```

### Capture 文件大小限制

**暂不处理**。单个 session 文件允许无限追加。

> 后续如果出现性能问题（如 LLM context window 限制），再考虑按 capture 数量或文件大小自动拆分。

## LLM Prompt 设计大纲

:> 以下为 consolidate 单次 LLM 调用的 prompt 设计要点。具体 prompt 文本在 Phase 2 实现时根据实际 LLM 行为调优。

### 单次 Consolidate 调用

**目的**: 一次性完成域提取、分类判断、内容提炼、导航生成

**Input:**
```json
{
  "pendingSessions": [
    {
      "sessionId": "abc123",
      "status": "pending",
      "content": "完整的 session capture markdown 内容...",
      "captureCount": 3,
      "createdAt": "2026-06-23T16:00:00"
    }
    // ... 所有 pending + stale 的 session 文件
  ],
  "existingKnowledge": [
    {
      "path": "domains/quoted/discount.md",
      "title": "报价单折扣显示逻辑",
      "type": "domain-knowledge",
      "domain": "quoted",
      "status": "active",
      "summary": "讨论了折扣的计算和显示规则..."
    }
    // ... 所有已有知识文件的 frontmatter 摘要
  ],
  "currentMemoryMd": "# 项目知识库\n\n最后更新: ..."
}
```

**Output:**
```json
{
  "knowledgeFiles": [
    {
      "targetPath": "domains/quoted/discount-display.md",
      "action": "create" | "update",
      "frontmatter": {
        "title": "报价单折扣显示逻辑",
        "domain": "quoted",
        "type": "domain-knowledge",
        "status": "active",
        "confidence": "high",
        "lastReviewed": "2026-06-23",
        "sourceSessions": ["session-abc123"]
      },
      "body": "# 报价单折扣显示逻辑\n\n## 核心规则\n\n..."
    }
    // ... 所有需要创建/更新的知识文件
  ],
  "memoryMd": "# 项目知识库\n\n最后更新: 2026-06-23 | 域: 4 | 规则: 3 | ...\n\n## 必读规则\n>...",
  "skippedSessions": [
    { "sessionId": "xyz789", "reason": "纯闲聊，无有价值知识" }
  ]
}
```

**System Prompt 要点:**
```
你是一个项目知识整理专家。你的任务是从 AI 编程助手的对话记录中提炼出结构化的知识库。

## 工作流程

### 第一步：分析理解
通读所有待处理的 session 记录，理解：
- 讨论了哪些业务领域（模块、子系统、功能）
- 产生了哪类知识（规范、事实、流程、决策、踩坑）
- 哪些内容有长期保留价值，哪些是临时噪音

### 第二步：域识别与匹配
为每条有价值的内容确定所属业务域：
- 查看 existingKnowledge 中已有的域列表
- 优先复用已有域，只有确实无法匹配时才新建域
- 无法归类的放入 general 域
- 域名用 kebab-case，简洁明了（如 quoted, inventory, payment）
- 不要创建过于细粒度的域（如不要按文件名建域）

### 第三步：分类判定

| 类型 | 判定条件 | 写入目录 |
|------|---------|---------|
| rule | 编码规范、约定、禁令 | rules/{name}.md |
| domain-knowledge | 业务域的事实、概念、数据模型 | domains/{domain}/{name}.md |
| workflow | 可复用的操作步骤、流程 | workflows/{name}.md |
| decision | 架构选型、方案选择及原因 | decisions/{date}-{slug}.md |
| incident | 踩坑记录、问题根因、修复方式 | incidents/{date}-{slug}.md |

分类优先级：
1. 如果是可执行的步骤流程 → workflow
2. 如果是"为什么选了X而不是Y" → decision
3. 如果是"遇到了X问题，原因是Y，修法是Z" → incident
4. 如果是编码规范、团队约定 → rule
5. 其余 → domain-knowledge（默认）

### 第四步：内容提炼
对归类后的内容进行提炼：

提炼原则：
1. 去除口语化表达、重复讨论、中间错误结论
2. 保留最终确定的结论和关键决策过程
3. 用结构化的 markdown 组织（标题、列表、表格、代码块）
4. 区分"事实"和"推断"，对不确定的内容标注 confidence: low
5. 保留足够的上下文让未来阅读者理解背景

如果是更新已有文件（action=update）：
- 对比新旧内容，保留仍有效的部分
- 更新被修正的部分（标注更新日期）
- 追加全新内容
- 移除已被完全替代的旧段落

### 第五步：生成导航 (MEMORY.md)
重新生成导航页面：

组织原则：
1. rules 放在最前面（必读），每个条目一行：[路径](链接) — 一句话摘要
2. domains 按域分组，用表格展示：域名 | 文件列表 | 该域概述
3. workflows 简短列出
4. decisions/incidents 只显示计数和最近几条
5. 每个摘要控制在 20 字以内
6. 整体保持紧凑（目标 < 100 行），AI 注入时不会太长
7. 保留用户的自定义编辑标记 <!-- user-edit-start --> ... <!-- user-edit-end -->

## 输出要求
- 输出严格的 JSON 格式
- knowledgeFiles 数组包含所有需要创建/更新的文件
  - 每项必须包含完整的 frontmatter 和 body markdown
- memoryMd 是完整的 MEMORY.md 内容
- 无价值的 session 在 skippedSessions 中说明原因（而非生成空内容）
```

---

### LLM 调用策略

| 项目 | 说明 |
|------|------|
| 调用次数 | **1 次** — 所有处理在单次调用中完成 |
| Token 用量 | 取决于 captures 数量和已有知识体量 |
| 分批策略 | 若输入超过 LLM context window 上限，按 session 时间倒序分批（优先处理最近的） |
