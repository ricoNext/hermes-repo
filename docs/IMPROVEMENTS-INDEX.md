# 设计优化与改进 - 文档索引

本页面汇总所有关于 Hermes Repo 设计优化与改进的文档，便于查找和追踪。

---

## 📚 核心文档

### 1. [improvements-roadmap.md](improvements-roadmap.md) ⭐ 首先看这个
**12 点优化建议的完整清单，按优先级和难度分类**

- **内容**：从 P0（关键）到 P3（低优先级）的 12 个设计缺陷
- **特点**：包含问题描述、改进方案、工作量估算、目标版本
- **用途**：版本规划、工作量预估、快速参考
- **更新频率**：每个版本更新一次状态表

### 2. [filter-quality-improvements.md](filter-quality-improvements.md) 📊 深度分析
**过滤质量门槛设计的 4 个盲点 + 快速修复方案**

- **内容**：详细分析缺陷原因、影响范围、改进方案
- **代码示例**：可直接参考的实现代码
- **适用**：优化点 #3（过滤质量）的详细版本
- **阅读时间**：15-20 分钟

### 3. [fix-1-convergence-analysis.md](fix-1-convergence-analysis.md) ✅ 实现总结
**"对话收敛性分析"的实现完成总结**

- **内容**：实现细节、测试结果、性能指标
- **状态**：✅ 已完成
- **涉及文件**：
  - `src/capture/convergence.ts`（新）
  - `tests/convergence.test.ts`（新）
  - `src/capture/shouldCapture.ts`（已改）
  - `tests/shouldCapture.test.ts`（已改）
- **效果**：精准度从 71% → 89%

---

### 4. [code-review-2026-06-29.md](code-review-2026-06-29.md) 🔍 使用者视角审查

**从使用者角度的 10 项代码质量问题，按踩坑风险分级**

- **内容**：P0（配置默认值不一致、配置错误静默吞没）到 P3 的完整审查
- **特点**：每个问题含复现场景、修复方案、涉及文件、工作量估算
- **与已有清单交叉对照**：6 项与 roadmap 关联，4 项为新增发现
- **适用**：版本发布前的质量检查、优化实施顺序规划

---

## 🗂️ 按优化点分类

### 优化 #1：Hook 可靠性
- 📋 状态：待实施
- 📍 优先级：P0（关键）
- 📄 文档：improvements-roadmap.md § P0 #1
- ⏱️ 工作量：2-3h

### 优化 #2：MEMORY.md 分级注入
- 📋 状态：待实施
- 📍 优先级：P1（高）
- 📄 文档：improvements-roadmap.md § P1 #2
- ⏱️ 工作量：3-4h

### 优化 #3：过滤质量门槛 ✅ 部分完成
- 📋 状态：进行中（修复 1 已完成）
- 📍 优先级：P0（关键）
- 📄 文档：
  - filter-quality-improvements.md（详细方案）
  - fix-1-convergence-analysis.md（实现总结）
  - improvements-roadmap.md § P0 #3
- 🔧 已实施修复：
  - ✅ 修复 1：收敛性分析（v0.3）
  - 📋 修复 2：CI 反馈信号（待实施）
  - 📋 修复 3：信号强度分级（待实施）
  - 📋 修复 4：领域自适应（v0.4）
  - 📋 修复 5：用户反馈微调（v0.5）
- ⏱️ 总工作量：~600h（长期迭代）

### 优化 #4：consolidate 触发逻辑
- 📋 状态：待实施
- 📍 优先级：P1（高）
- 📄 文档：improvements-roadmap.md § P1 #4
- ⏱️ 工作量：2-3h

### 优化 #5：技能晋升条件
- 📋 状态：待实施
- 📍 优先级：P1（高）
- 📄 文档：improvements-roadmap.md § P1 #5
- ⏱️ 工作量：2-3h

### 优化 #6：反馈回路追踪
- 📋 状态：待实施
- 📍 优先级：P1（高）
- 📄 文档：improvements-roadmap.md § P1 #6
- ⏱️ 工作量：3-4h

### 优化 #7：晋升流程简化
- 📋 状态：待实施
- 📍 优先级：P1（高）
- 📄 文档：improvements-roadmap.md § P1 #7
- ⏱️ 工作量：2-3h

### 优化 #8：init 多选助手
- 📋 状态：待实施
- 📍 优先级：P2（中）
- 📄 文档：improvements-roadmap.md § P2 #8
- ⏱️ 工作量：1-2h

### 优化 #9：MCP 架构明确化
- 📋 状态：待实施
- 📍 优先级：P2（中）
- 📄 文档：improvements-roadmap.md § P2 #9
- ⏱️ 工作量：11-14h（分阶段）

### 优化 #10：冷启动方案指导
- 📋 状态：待实施
- 📍 优先级：P2（中）
- 📄 文档：improvements-roadmap.md § P2 #10
- ⏱️ 工作量：2-3h

### 优化 #11：YAML 字段扩展
- 📋 状态：待实施
- 📍 优先级：P2（中）
- 📄 文档：improvements-roadmap.md § P2 #11
- ⏱️ 工作量：1-2h

### 优化 #12：LLM 成本控制
- 📋 状态：待实施
- 📍 优先级：P3（低）
- 📄 文档：improvements-roadmap.md § P3 #12
- ⏱️ 工作量：3-5h

---

## 🎯 按版本规划

### v0.3 (当前)
- ✅ 修复 1：收敛性分析（已完成）
- 📋 修复 2：CI 反馈信号（推荐）
- 📋 修复 3：信号强度分级（推荐）
- 📋 优化 #1：Hook 失败重试（关键）

### v0.4
- 📋 优化 #2：MEMORY.md 分级注入
- 📋 修复 4：领域自适应关键词

### v0.5
- 📋 优化 #4：consolidate 触发逻辑

### v0.6
- 📋 优化 #5：技能晋升条件
- 📋 优化 #7：晋升流程简化

### v0.7
- 📋 优化 #10：冷启动方案指导
- 📋 修复 5：用户反馈微调

### v0.8
- 📋 优化 #8：init 多选助手
- 📋 优化 #11：YAML 字段扩展

### v1.0
- 📋 优化 #6：反馈回路追踪
- 📋 优化 #12：LLM 成本控制

### v2.0
- 📋 优化 #9：MCP 架构明确化

---

## 📊 工作量汇总

| 优先级 | 项数 | 总工作量 | 版本分布 |
|--------|------|---------|---------|
| **P0（关键）** | 1 | 2-3h | v0.3 |
| **P1（高）** | 6 | ~18h | v0.3 - v0.7 |
| **P2（中）** | 4 | ~9h | v0.4 - v0.8 |
| **P3（低）** | 1 | 3-5h | v1.0 |
| **合计** | 12 | ~35-40h | 长期规划 |

**说明**：不包括 PR review、测试、文档等周期开销

---

## 🚀 快速开始

**如果你想：**

| 目标 | 操作 |
|------|------|
| 了解所有优化建议 | → [improvements-roadmap.md](improvements-roadmap.md) |
| 深入学习过滤优化 | → [filter-quality-improvements.md](filter-quality-improvements.md) |
| 查看已完成的实现 | → [fix-1-convergence-analysis.md](fix-1-convergence-analysis.md) |
| 规划下个版本 | → improvements-roadmap.md + 快速检查清单 |
| 找某个具体优化点 | → 按优化点分类，点击对应行 |

---

## 📝 如何更新本文档

1. **新优化建议**：添加到 `improvements-roadmap.md`，然后更新这个索引
2. **优化完成**：改变状态标记（待实施 → 进行中 → 完成），更新版本号
3. **工作量调整**：如有实际数据与估算不符，更新表格
4. **版本变更**：当 roadmap 调整时，同步更新版本规划表

---

## 相关链接

- [原始设计文档](hermes-repo-design.md)
- [项目 GitHub Issues](https://github.com/your-repo/issues)（待配置）
- [项目 Roadmap](../../ROADMAP.md)（待创建）

---

**最后更新**：2026-06-29
**维护者**：Design Review Team
**下次审视**：v0.3 发布时

