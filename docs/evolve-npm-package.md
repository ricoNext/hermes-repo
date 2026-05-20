# 自我进化文档：可复用 npm 包实现方案

本文描述如何将「Hermes 式学习闭环」做成 **任意 Git 代码仓库** 均可接入的
**npm 包**（CLI + 模板 + 校验）。**mis-pc-entry** 仅作为「目录与工具链」的
**参考画像**（preset），不是包的硬编码依赖。

---

## 包描述（README / npm description，约 350 字）

Hermes-repo 是面向任意 Git 仓库的命令行工具，将 Hermes 式「经验 → 技能 →
自改进」学习闭环映射到文档与团队约定：通过 `init` 生成 `.evolve/captures`
与可选的 `docs/evolves` 树，用 Markdown 模板沉淀纠错、审查与根因；`validate`
检查元数据与引用路径，`doctor` 按 preset 对齐 AGENTS、OpenSpec、Cursor
规则等常见布局。无服务端、不自动改规范、不替代 IDE 里的 AI；升级经 Pull
Request，由人审批。主打「Hermes
能力装进 repo」——可挂 CI、跨栈复用，适合希望统一「踩坑有记录、契约能升级、
对外能讲清 Hermes 式闭环」的研发与平台团队。

---

## 1. 目标与非目标

### 1.1 目标

- **仓库无关**：通过配置与 preset 适配前端/后端/单体/多包 monorepo。
- **无服务端运行时**：业务仓库不部署「进化服务」；可选在 **CI** 或本地
  运行 CLI。
- **约定优于配置**：默认目录 `.evolve/`、`docs/evolves/`，可被配置覆盖。
- **人机协同不变**：包只辅助 **捕获、校验、脚手架、报告**；**不自动**
  改写团队规范文件（与 `evolve.md` 原则一致）。

### 1.2 非目标

- 不内置 Hermes、不替代 Cursor/Claude。
- 不强制 OpenSpec / AGENTS.md；无则跳过相关校验。
- 不实现「规范有效率」的完整 GEPA（L2）数据采集（可留插件接口）。

---

## 2. 包形态建议

### 2.1 品牌定位（便于推广）

- **一句话**：把 **Hermes 式学习闭环**（经验 → 技能 → 自改进）落到 **任意
  Git 仓库** 的文档与规范上，用 CLI + 模板 + 校验把闭环「接上线」。
- **推广时可强调的能力映射**（与 `docs/evolve.md` 中 Hermes 概念一致）：
  捕获层 ≈ MEMORY、可进化文档 ≈ SKILL、Curator/Validator ≈ 维护与门禁、
  PR 审批 ≈ 人类阀门；本包负责 **脚手架、schema、preset、报告**，不替代
  宿主仓库的 AI 工具。
  
- **第三方「Hermes Agent」等商标**：若该名称在贵司法辖区受商标保护，请在
  README 使用「Hermes **式** / inspired by」等表述或取得授权，避免侵权争议；
  具体以法务意见为准。

### 2.2 正式包名与发布

- **npm 包名（推荐）**：`hermes-repo`  
  - **主 CLI 命令**：`hermes-repo`（`bin` 与包名一致，便于 README、演讲与
    `npx hermes-repo init` 自解释）。
  - **可选短别名**：`evolve`（同一入口，照顾老用户与打字习惯；与
    `evolve.config.yaml` 文件名呼应）。`package.json` 示例：
    `"bin": { "hermes-repo": "dist/cli.js", "evolve": "dist/cli.js" }`。
- **作用域包（可选）**：`@<npm-org>/hermes-repo`（例如 `@gongniu/hermes-repo`），
  便于组织内统一源与权限。
- **可选子路径导出**：`hermes-repo/schema`（或作用域包下同等路径），导出
  capture 的 JSON Schema，供其它工具引用。

### 2.3 技术栈（包自身）

- **Node**：与目标生态对齐，包声明 **`engines.node: ">=24"`**（安装与 CLI 均按此约束）。
- **语言**：TypeScript 编译为 CJS + ESM dual 或仅 ESM（二选一，在包内统一）。
- **CLI 框架**：`cac` / `commander` 等轻量库。
- **配置加载**：`cosmiconfig`（支持 `evolve.config.ts` / `.evolverc.yaml` 等）。
- **校验**：`zod` + 内置 JSON Schema；可选 `glob` 扫描。

> 说明：若组织禁止在子项目中使用 `async/await`，包实现可自行遵守；与
> 消费仓库的 lint 规则独立。

---

## 3. 仓库侧目录约定（默认 + 可配置）

以下与 `docs/evolve.md` 概念对齐，路径均可配置。

```text
<repo-root>/
├── evolve.config.yaml          # 可选；无则全用默认 + preset
├── .evolve/
│   ├── captures/               # 经验捕获（Markdown + front matter）
│   ├── captures/TEMPLATE.md
│   └── metrics.md              # 可选 L1，由 CLI 生成或半自动
├── docs/
│   ├── evolves/                # 可进化文档根（可选子目录树）
│   │   └── **/META.md          # 进化元规则（或 SKILL.md，见配置）
│   └── ...
└── （可选）AGENTS.md / CLAUDE.md / SOUL.md / openspec/ / .cursor/rules/
```

**mis-pc-entry 借鉴点**（映射为 **preset `cursor-openspec`**，仅默认值）：

| 配置键 | 该 preset 默认值 |
| --- | --- |
| `identity.files` | `["AGENTS.md","CLAUDE.md"]` |
| `rules.glob` | `.cursor/rules/**/*.mdc` |
| `openspec.root` | `openspec` |
| `openspec.changesGlob` | `openspec/changes/**/proposal.md` |
| `openspec.specsGlob` | `openspec/specs/**/spec.md` |
| `quality.commands` | `["pnpm lint","pnpm dlx ultracite check"]`（仅文档提示，不强制执行） |

其它仓库可使用 **`preset: "minimal"`** 或 **`preset: "none"`** 自行写全量
配置。

---

## 4. 配置文件设计

### 4.1 文件位置（优先级由高到低）

1. `evolve.config.ts`（若支持 TS 需 `jiti`/`tsx` 加载，或仅支持 YAML/JSON
   降低复杂度）
2. `evolve.config.yaml` / `evolve.config.yml`
3. `evolve.config.json`
4. `package.json` 字段 **`hermesRepo`**（与品牌包名对应，camelCase）

### 4.2 建议 schema（逻辑结构）

```yaml
# evolve.config.yaml 示例
version: 1
preset: minimal # minimal | cursor-openspec | none

paths:
  captures: .evolve/captures
  evolvesRoot: docs/evolves
  metaRuleFilename: META.md # 或 SKILL.md

identity:
  files:
    - README.md
  # 可选：SOUL.md 与 AGENTS 并存时的阅读顺序提示（给模板用）
  primary: README.md

openspec:
  enabled: false
  root: openspec

rules:
  enabled: false
  glob: .cursor/rules/**/*.mdc

quality:
  # 仅用于 `hermes-repo doctor` 输出「建议执行的命令」，不隐式执行
  suggestCommands: []

hooks: [] # 预留：capture 创建后的本地脚本路径（可选）
```

**设计原则**：未知键 **警告不失败**（semver major 再收紧）；`version`
字段用于配置迁移。

---

## 5. CLI 命令设计

### 5.1 `hermes-repo init`（已实现基线）

- **项目根**：`process.cwd()`（不解析 git root）。
- 创建 **`.hermes-repo/`**：写入 **`config.json`（仅此格式）**；**交互模式**下依次确认 **capture 记录目录**（默认 `.hermes-repo/captures`）、**可进化文档根**（默认 `.hermes-repo/specs`）、**`paths.metaRuleFilename`**（默认 `META.md`，仅文件名）；**`-y`** 下使用上述默认路径。所有路径均不得逃出项目根。
- 写入白名单模板 **`{paths.captures}/TEMPLATE.md`**（与 `config.json` 中 **`paths.captures`** 一致）；**覆盖策略 B**：每次 init **重写** `config.json` 与该模板，**不删除**用户在所选 captures 目录与可进化目录下的其它文件。
- **交互**：TTY 下使用 `@inquirer/prompts`；非 TTY 须使用 **`init -y` / `--yes`**。
- **preset**：当前版本不实现 `--preset`。

### 5.2 `hermes-repo capture new`

- 生成 `capture-<ISO-date>-<序号>.md`，预填 front matter（`type`、`trigger`、
  `date`、`affected-docs`、`affected-rules`）。
- 支持 `--trigger bug-root-cause` 等缩短交互。

### 5.3 `hermes-repo validate`

- **结构**：captures 是否符合 schema；必填字段是否存在。
- **链接**：`affected-docs` / `affected-rules` 路径是否存在（相对 repo root）。
- **openspec**（若启用）：`affected-openspec` 等扩展字段可选校验。

### 5.4 `hermes-repo doctor`

- 汇总：是否安装 git、config 是否解析、preset 是否识别、`identity.files`
  是否存在至少一个、`quality.suggestCommands` 提示。
- **不**运行 `pnpm install`；可检测 `packageManager` 字段给出口头建议。

### 5.5 `hermes-repo metrics`（可选，L1）

- 统计 captures 数量、按 `trigger` 分布、最近 30 天新增；写入
  `.evolve/metrics.md`（**覆盖**或 `--append` 策略二选一，文档写清）。
- **不**计算「规范有效率」（L2）除非未来接插件。

### 5.6 `hermes-repo promote`（可选，弱实现）

- 输出 **Markdown 片段**：列出待处理的同类 capture，便于粘贴到 PR
  描述（**不**开分支、不推远程，避免与各家 Git 流程冲突）。

---

## 6. 与 AI 工具链的集成方式（包提供「素材」而非绑定）

包内 **`templates/`** 发布：

- `AGENTS-evolve-snippet.md`：可粘贴到 `AGENTS.md` 的捕获/PR 规则短节。
- `cursor-rule-snippet.mdc`：可选，仅当用户希望把「必须写 capture」写进
  Cursor 规则时自行复制。

**不在包内**硬编码 Cursor/Claude 专有 API；仅文档与模板。

---

## 7. 与 CI 集成

- 推荐：`hermes-repo validate` 在 **lint 阶段之后**或 **独立 job**，失败
  条件仅 **schema + 断链**（避免与业务 ESLint 混淆）。
- 可选：`hermes-repo metrics` 在 **weekly cron** 更新 metrics 文件后由 bot
  提 PR（组织自行决定）。

---

## 8. 测试与自举

- **单元测试**：config 合并、路径解析、validate 规则。
- **fixtures**：仓库内 `packages/hermes-repo/test/fixtures/` 下放多个微型
  假仓库目录（minimal、openspec、cursor-rules）。
- **Dogfood**：mis-pc-entry 作为 **e2e fixture** 之一（可选 submodule 或
  snapshot 子集），避免 CI 依赖私有 monorepo 体积过大。

---

## 9. 版本与兼容性

- **SemVer**：破坏性改动升 major（如 capture schema 必填项增加）。
- **配置 `version: 1`**：包内 `migrateConfig(v0 -> v1)` 预留钩子。

---

## 10. 与 `docs/evolve.md` 的分工

| 文档 | 侧重 |
| --- | --- |
| `docs/evolve.md` | 概念闭环、与本仓库（mis-pc-entry）对齐的落地注意 |
| `docs/evolve-npm-package.md`（本文） | **可复用包**的边界、CLI、配置、preset |

后续若 monorepo 中实现包本体，建议路径示例：`packages/hermes-repo/`（与
应用仓库分离时则独立 git 仓库）。

---

## 11. 实施里程碑（建议）

1. **M0**：仅 `hermes-repo init` + `TEMPLATE.md` + JSON Schema +
   `hermes-repo validate`。
2. **M1**：`presets`（minimal + cursor-openspec）+ `doctor`。
3. **M2**：`capture new` + `metrics`（L1）。
4. **M3**：插件钩子、`promote`、文档站点（可选）。

以上方案可按组织节奏裁剪；**核心 MVP 是 init + validate + 稳定 schema**，
即可在任意仓库推广。
