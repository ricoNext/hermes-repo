## 记忆系统

本项目使用 @riconext/hermes-repo 管理 AI 助手记忆。

核心文件:

- `.memory/MEMORY.md` — 注入到每次会话的摘要
- `.memory/captures/` — 按类型（semantic / episodic / procedural）归档的原始捕获
- `.memory/topics/` — 整理后的主题记忆

## 使用记忆

- 开始新任务前，先读取 `.memory/MEMORY.md`
- 如需查找历史经验: `npx @riconext/hermes-repo search <关键词>`
- 查看特定捕获: `cat .memory/captures/<type>/<文件名>.md`
- 查看主题: `cat .memory/topics/<主题>.md`
- 查看可用技能: `cat .memory/skills/*/SKILL.md`

## 技能使用

项目自动从重复的流程记忆中生成技能（SKILL.md），存在 `.memory/skills/`。

### 何时加载技能

当你需要执行以下操作时，先查看是否有对应的技能:

1. 部署 / 发布 / 回滚
2. 数据库迁移
3. 新模块 / 新页面创建
4. 重复性配置操作
5. 调试已知类型的问题

### 如何使用

1. 查看技能目录: `ls .memory/skills/`
2. 匹配到任务后: `cat .memory/skills/<name>/SKILL.md`
3. 按步骤执行
4. 执行结束后，在捕获中引用技能名（帮助 consolidate 追踪技能有效性）

## 何时搜索过去经验

当你遇到以下情况，应主动搜索 `.memory/` 中的历史记忆:

1. 处理你之前解决过类似问题的模块
2. 需要进行与上次类似的技术选型
3. 用户说「之前不是这样」或「上次讨论过」
4. 需要了解项目的历史架构决策

## 记录新经验

当你遇到以下情况，在 `.memory/captures/` 创建捕获文件:

1. 你犯了错误并被用户纠正
2. 你发现代码与已有约定不一致
3. 你了解到项目特有的架构决策（包括被否决的方案）
4. 你做出了非平凡的设计选择（包括为什么选 A 不选 B）
5. 你重复遇到了类似问题（说明前一次的经验没有被记住）
6. 你完成了复杂的多步操作流程

### 分类参考

- **语义记忆**: 事实、约定、决策原则 → type: semantic
- **情景记忆**: 具体事件经过 → type: episodic
- **流程记忆**: 操作步骤 → type: procedural

### scope 选择

- 这个经验适用于整个项目吗？→ scope: all
- 只适用于前端 / 后端 / 基础设施？→ 对应 scope

## 团队协作（多人仓库）

本项目由多人维护。记忆分两层:

### 个人层（仅你自己可见，不提交 git）

- `.memory/captures/` — 你这次的 AI 捕获
- `.memory/refs/` — 你的引用记录
- 不需要审批，直接写入

### 团队层（所有人可见，提交 git）

- `.memory/topics/` — 团队认同的约定
- `.memory/skills/` — 团队可复用的技能
- `.memory/MEMORY.md` — 团队记忆摘要

### 晋升团队层

当你觉得某条个人捕获对团队有价值:

1. 标记晋升: `touch .memory/captures/<type>/xxx.promote`
2. 使用 PR 模板 `.memory/templates/PROMOTE_PR.md` 创建晋升 PR
3. 等团队 review 后合并；`promote --pr` 生成草案，`promote --apply --manifest` 落盘（v0.13+）

### 冲突处理

如果发现团队层记忆与你的经验矛盾:

1. 在 `.memory/team/conflict-resolutions/` 创建冲突记录
2. 不要直接修改团队层文件
3. 在 PR 或周会上提出讨论

## 引用记录

当你读取某条捕获或技能后，记录引用（供 flush 聚合 `use_count`）:

```bash
npx @riconext/hermes-repo ref --capture captures/semantic/<文件>.md --reason "为何查看"
npx @riconext/hermes-repo ref --skill <slug> --reason "执行前加载技能"
```

也可在 `.memory/refs/` 手写 JSON（`target` 为相对 `.memory/` 的路径）。

## 禁止

- 不要写入代码的具体实现细节（代码本身是自文档的）
- 不要写入敏感信息（密钥、密码、个人数据）
- 不要重复写入已存在的内容（先搜索再写）
- 不要在没有用户交互的会话中创建捕获（纯自动化操作不产生经验）
