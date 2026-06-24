# Hermes 记忆系统指南

> 本文档由 `hermes init` 自动生成。如需更新记忆结构，运行 `hermes init --force`。

## 核心概念

本项目使用 **hermes-repo** 管理 AI 编程助手的项目级记忆系统。

**设计原则：**
- **Captures 是 raw evidence** — 对话记录自动保存到 `captures/raw/`，不等于知识
- **LLM 提炼后进入知识库** — 手动 `hermes flush` 触发 consolidate，由 LLM 整理成结构化知识
- **按业务域组织** — 改库存读 `domains/inventory/`，改报价读 `domains/quoted/`
- **两阶段注入** — 启动时先加载导航+规则全文，AI 按需读取具体域知识

## 目录结构

```
.memory/
├── MEMORY.md              # ← 导航中心（自动生成 + 可手动编辑）
├── config.json            # 配置（含 LLM 设置）
│
├── rules/                 # 必读规则（编码规范、约定）
├── domains/{domain}/      # 业务域知识（LLM 自动分类）
│   └── general/           # 兜底域
├── workflows/             # 可复用操作流程
├── decisions/             # 历史决策记录
├── incidents/             # 踩坑记录
│
└── captures/
    ├── raw/               # 原始对话记录（gitignored）
    └── archived/          # 已归档的旧记录
```

## Inject（启动时自动加载）

每次 AI 会话开始时，hook 会自动调用 `hermes inject`：

**注入内容：**
1. `MEMORY.md` 导航摘要（所有知识的索引）
2. `rules/` 目录下全部文件的完整内容（必读规则）

**AI 应该怎么做：**
- 先阅读 MEMORY.md 了解项目全貌和可用知识
- 遵守 rules/ 中列出的所有编码规范
- 根据任务判断需要哪个业务域的知识 → 用工具读取对应文件：
  ```bash
  cat .memory/domains/{domain}/{file}.md
  cat .memory/workflows/{file}.md
  ```

## Capture（结束时自动保存）

对话结束时，hook 会自动调用 `hermes capture`：

- 所有对话内容保存到 `captures/raw/session-{id}.md`
- 一个对话一个文件，支持追加
- **无需手动创建捕获** — 系统自动处理

## Consolidate（手动触发提炼）

当积累了足够的对话记录后，手动执行：

```bash
npx @riconext/hermes-repo flush
```

这会：
1. 扫描所有待处理的 session 文件（pending / stale）
2. 单次 LLM 调用完成完整提炼：
   - 域提取 → 分类判定 → 内容提炼 → 导航生成
3. 输出写入 `rules/`, `domains/`, `workflows/`, `decisions/`, `incidents/`
4. 更新 `MEMORY.md` 导航
5. 将已处理的 session 标记为 done

**前提条件：**
- 需要配置 LLM（见下方配置说明）

## 配置 LLM

在 `.memory/config.json` 中配置：

```json
{
  "llm": {
    "enabled": true,
    "baseUrl": "https://api.openai.com/v1",
    "model": "gpt-4o"
  }
}
```

API Key 通过环境变量设置：
```bash
export HERMES_LLM_API_KEY="sk-..."
```

## 常用命令

| 命令 | 用途 |
|------|------|
| `hermes init` | 初始化记忆脚手架 |
| `hermes inject` | 注入上下文（通常由 hook 自动调用） |
| `hermes capture` | 保存对话记录（通常由 hook 自动调用） |
| `hermes flush` | 触发 LLM consolidate（手动） |

## 知识类型

consolidate 时 LLM 会将内容分为 5 类：

| 类型 | 存放位置 | 说明 |
|------|---------|------|
| rule | `rules/` | 编码规范、团队约定、禁令 |
| domain-knowledge | `domains/{domain}/` | 业务事实、数据模型、领域逻辑 |
| workflow | `workflows/` | 可复用操作步骤流程 |
| decision | `decisions/` | 架构选型及原因 |
| incident | `incidents/` | 踩坑记录、问题根因、修复方式 |

每条知识都有状态字段：`active` | `implemented` | `superseded` | `needs_review` | `archived`

## 编辑约定

- **MEMORY.md 可以手动编辑** — 用 `<!-- user-edit-start --> ... <!-- user-edit-end -->` 包裹自定义区域，flush 时保留
- **Knowledge 文件可以手动编辑** — 直接修改 markdown 内容即可
- **不要直接编辑 captures/raw/ 中的文件** — 这些是自动生成的原始记录

## 禁止事项

- 不要写入代码的具体实现细节（代码本身是自文档的）
- 不要写入敏感信息（密钥、密码、个人数据）
- 不要重复写入已存在的内容（先搜索再写）
