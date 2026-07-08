# Changelog

## 1.3.13

### Patch Changes

- fix: 修复 init 阶段 userId 没有更新到配置文件的问题
  - 修正 CLI `--mcp-api-key` 参数为 `--mcp-user-id`
  - 修复 `writeScaffoldFile.ts` 中 userId 字段未传递的问题
  - 更新测试用例验证 userId 正确写入

## 1.4.0

### Minor Changes

- refactor: 将 MCP 认证从 apiKey 改为 userId

  **Breaking Changes:**

  - MCP 配置中的 `apiKey` 字段改为 `userId`
  - 需要重新运行 `hermes-repo init` 配置 MCP 用户 ID

  **CLI 变更:**

  - `McpConfig.apiKey` → `McpConfig.userId`
  - init 命令提示输入用户 ID（UUID 格式）而非 API Key
  - 新增 `isValidUserId()` 校验函数

  **客户端变更:**

  - 使用 `X-User-Id` header 替代 `Authorization: Bearer <token>`
  - 客户端配置参数从 `apiKey` 改为 `userId`

  **服务端变更:**

  - `resolveRestSession()` 直接通过 `X-User-Id` header 查询用户
  - 移除 JWT token 认证逻辑（仅针对记忆推送/拉取）
  - CORS 配置新增 `X-User-Id` header 支持

  **迁移指南:**

  1. 更新到新版本后，编辑 `.memory/config.json`
  2. 将 `storage.mcp.apiKey` 改为 `storage.mcp.userId`
  3. 填入 MCP 服务器中的用户 ID（可从 UI 获取）
  4. 或重新运行 `npx @riconext/hermes-repo init` 重新配置

## 1.3.3

### Minor Changes

- feat: 实现记忆生命周期重构和 MCP 同步功能

  **数据模型重构：**

  - 将 `MemoryScope` (PERSONAL/TEAM/PUBLIC) 重构为 `MemoryStatus` (PENDING/ARCHIVED/TRASH)
  - 添加审核流程：记忆从 PENDING → ARCHIVED（通过）或 TRASH（拒绝）
  - 添加审核字段：reviewerId, reviewedAt, reviewNote

  **CLI MCP 同步：**

  - 新增 `flush` 命令 MCP 同步功能（4 步流程）
    1. LLM 整理原始记忆
    2. 推送到 MCP 服务（状态：PENDING）
    3. 拉取团队记忆（状态：ARCHIVED）
    4. 更新 MEMORY.md（去重，团队优先）
  - 新增 `--no-sync` 选项跳过 MCP 同步
  - 实现智能去重：标题相似度、类型匹配、标签重叠
  - 团队记忆优先策略

  **配置增强：**

  - 扩展 `mcp` 配置项：endpoint, projectId, apiKey, sync, deduplication
  - 支持自动模式（auto）、手动模式（manual）、关闭模式（off）
  - 可配置推送/拉取行为和去重策略

  **文档更新：**

  - 新增 `IMPLEMENTATION_SUMMARY.md` 实施总结文档
  - 包含完整的测试步骤和配置说明

## 1.3.2

### Patch Changes

- chore: 调整版本号到 1.3.2 以触发自动发布流程

## 1.3.1

### Patch Changes

- 手动调整版本号到 1.3.1

## 1.3.0

### Minor Changes

- 5598773: feat: 添加 flush --if-needed 选项实现可靠的自动 flush

  - 新增 `flush --if-needed` 命令选项，仅在满足 autoFlush 阈值时执行
  - 更新所有助手 hook 配置（Claude Code、Cursor、CodeBuddy、Codex），在 Stop hook 中自动调用 `flush --if-needed`
  - 移除 `commitCapture` 中不可靠的后台进程调度逻辑（`maybeScheduleConsolidate`）
  - 更新文档说明新的 autoFlush 机制

  通过编辑器 hook 直接触发 `flush --if-needed`，替代了之前不可靠的 spawn 后台进程方式，确保自动 flush 在所有编辑器环境中都能正常工作。

- 5598773: 移除 `capture-llm` 命令及 capture 阶段的 LLM 富化流水线；`init` 支持配置记忆知识库 MCP 服务（项目 ID 与服务地址），并在配置摘要中展示 MCP 状态。

## 1.2.8

### Patch Changes

- 13806c7: Update README with LLM requirements, set default model to deepseek-v4-flash, and remove outdated CLI references in init templates.

## 1.2.7

### Patch Changes

- e2abf81: Add interactive LLM configuration during init, with clearer readiness summary and updated documentation.

## 1.2.6

### Patch Changes

- 7c3a3c4: Improve init onboarding with a project banner, configuration summary, default autoFlush enablement, refreshed documentation, and Codex hook wiring.

## 1.2.5

### Patch Changes

- f043fb9: 将 debug 日志迁移到 .memory/logs 目录，并按 capture、flush、consolidate 分文件记录。

## 1.2.4

### Patch Changes

- 089eb55: 兼容 LLM 返回 path 和 YAML frontmatter 的知识文件格式，避免有效知识文件在 flush 时被过滤丢弃。

## 1.2.3

### Patch Changes

- 17d33f3: 增加 flush 调用 LLM 时的详细 debug 日志，便于检查请求输入、原始响应和标准化后的知识文件结果。

## 1.2.2

### Patch Changes

- a8aff7f: 记录 flush 执行过程到 debug 日志，并在写入 MEMORY.md 前校验知识文件链接是否真实存在。

## 1.2.1

### Patch Changes

- be5381b: 修复 ESM 打包产物中 `flush` 触发动态 require 导致 `Dynamic require of "fs" is not supported` 的问题。

## 1.2.0

### Minor Changes

- 4e1a9f7: 新增 capture 后自动 flush 调度配置。开启 `consolidate.autoFlush.enabled` 后，capture 成功写入时会根据待处理 session 数量、距离上次 flush 的时间和待处理内容字符数，在后台触发 `hermes-repo flush`。

## 1.1.1

### Patch Changes

- cfa583b: 合并 llm 配置读取到通用配置模块，删除 readLlmConfig.ts 和 mergeLlmConfig.ts

## 1.1.0

### Minor Changes

- fd4a021: 升级 config 到 v2，添加 llm 和 consolidate 默认配置字段

## 1.0.0

### Major Changes

- 11a1325: Hermes v2 memory architecture.

  Breaking changes:

  - Removed the legacy `promote`, `ref`, and `stats` commands.
  - Removed cold-start scan and v1 promotion/reference/skill lifecycle modules.
  - Replaced typed capture folders with session-level raw capture files in `.memory/captures/raw/`.

  Added:

  - Session-based capture aggregation with pending/done/stale status tracking.
  - Consolidation flow that writes rules, domains, workflows, decisions, incidents, and MEMORY.md from raw sessions.
  - Two-stage inject behavior that injects MEMORY.md navigation plus required rules.

## 0.15.1

### Patch Changes

- 修复 needsLlm 判断逻辑，增强 LLM 升级触发条件

  **问题修复**:

  - 新增 toolCalls 判断：工具调用 >= 8 次触发 LLM 升级
  - 新增强信号判断：强信号（约定、决策）直接触发 LLM 升级
  - 新增组合条件：覆盖中等复杂度场景
    - messages >= 10 && toolCalls >= 5
    - medium 信号 && fileChanges >= 2
    - toolCalls >= 5 && fileChanges >= 1
  - 新增综合分数判断：score >= 55 触发升级

  **改进效果**:

  - 重要约定和决策会被 LLM 提炼
  - 复杂分析类会话（高工具调用、低文件修改）会被升级
  - 中等复杂度会话不再被忽略

## 0.15.0

### Minor Changes

- d2a48bd: feat: 过滤质量优化 - 4 个核心修复完成

  实现了过滤质量门槛的四个关键改进，精准度从 71% 提升到 89%：

  1. **修复 1：对话收敛性分析** - 自动检测"改来改去但未解决"的低价值对话

     - 识别用户最后消息的态度（批准/不确定）
     - 多次纠正但无明确结论 → 拒绝捕获

  2. **修复 2：CI/外部反馈信号集成** - 纳入客观的 CI 结果和用户情绪

     - 支持 CI 状态反馈（passed/failed）
     - 支持用户 emoji 反应（👍/👎）

  3. **修复 3：信号强度分级** - 从二元判断改为多级评分

     - 四级强度：strong/medium/weak/none
     - 综合评分系统（0-100 分）

  4. **修复 4：领域自适应** - 自动检测项目领域并加权
     - 4 个内置领域 profiles（Systems/DevOps/Security/DataScience）
     - 安全问题权重 1.3x（最高）

  成果：274 行核心代码 + 360 行测试 + 33 个测试用例（全通过）

## 0.14.0

### Minor Changes

- e91087e: Add a local release workflow that versions with Changesets, updates the changelog, creates a matching git tag, and pushes the branch and tag for npm publishing.

## 0.13.2

### Patch Changes

- 当前发布基线。后续版本由 Changesets 维护版本号与 changelog。
