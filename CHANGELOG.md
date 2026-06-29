# Changelog

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
