# 代码审查报告：从使用者视角的质量审视

**审查日期**：2026-06-29
**审查版本**：v1.2.5
**审查视角**：从实际使用者的角度，关注"会不会踩坑"而非纯粹代码风格

---

## 审查摘要

本次审查聚焦用户可感知的问题，而非代码风格。共识别 10 个问题点，其中 2 个 P0（直接影响用户行为）、4 个 P1（维护风险或隐性 bug）、4 个 P2/P3（可延后处理）。

| 优先级 | 数量 | 核心风险 |
|--------|------|---------|
| 🔴 P0 | 2 | 配置默认值不一致；配置错误静默吞没 |
| 🟡 P1 | 4 | frontmatter 解析器重复×3；信号正则重复；isAssistantId 无效校验；shouldCapture 死代码 |
| 🟢 P2 | 2 | hookExit 写法误导；串行 fallback 策略与多助手 |
| 🔵 P3 | 1 | 全量同步 I/O |
| ℹ️ Info | 1 | v1 兼容代码硬编码而非复用默认值常量 |

---

## 🔴 P0：用户直接踩坑

### A-01. LLM 配置默认值不一致

**用户影响**：初始化和运行时拿到不同的默认值，导致静默打到错误的 API endpoint。

| 位置 | `baseUrl` 默认值 | `model` 默认值 |
|------|---|---|
| `src/config/llmConfig.ts:8-9` | `https://api.deepseek.com` | `deepseek-v4-flash` |
| `src/config/readConfig.ts:21-22` | `https://api.openai.com/v1` | `gpt-4o` |
| `src/init/writeScaffoldFile.ts:24-25` | `https://api.openai.com/v1` | `gpt-4o` |

**复现场景**：
1. 用户运行 `hermes init` → 生成的 `config.json` 默认指向 OpenAI + gpt-4o
2. 如果配置文件某字段缺失，`readConfig` 的 fallback 回退到 OpenAI
3. 但 `llmConfig.ts` 的 `defaultDisabledLlmConfig()` 返回 DeepSeek
4. 用户以为配了 DeepSeek 的 key 就行了，结果某些代码路径静默打到 OpenAI

**修复方案**：
- 统一默认值到 `llmConfig.ts` 的常量，所有其他位置引用这些常量
- 或者反过来：在 `llmConfig.ts` 中也用 OpenAI 默认值，让 DeepSeek 仅作为推荐而非默认
- 在 `readConfig.ts` 和 `writeScaffoldFile.ts` 中 import `DEFAULT_LLM_BASE_URL` 和 `DEFAULT_LLM_MODEL`

**涉及文件**：
- `src/config/llmConfig.ts`
- `src/config/readConfig.ts`
- `src/init/writeScaffoldFile.ts`
- `src/init/mergeConfig.ts`（如有重复默认值）

**估计工作量**：1-2 小时

---

### A-02. 配置错误静默吞没，无 schema 校验

**用户影响**：用户手写 config.json 出错时（字段名拼错、值类型写错），`readConfig` 静默回退默认值，不报错也不提示。

**复现场景**：
1. 用户把 `baseUrl` 写成 `baseURL`（大小写错误）
2. `readConfig` 中 `typeof llm?.baseUrl === "string"` → false → fallback `"https://api.openai.com/v1"`
3. 用户以为配置生效了，实际用的是默认值
4. 调试困难：没有任何日志或错误提示

**当前实现**：`readConfig.ts` 用手写的 8 个 `typeof` 检查逐一校验，但不收集也不报告哪些字段被忽略了。

**修复方案**：
- **轻量方案**（推荐）：在校验时收集"已识别字段"和"未识别字段"，当 raw 对象中存在未被识别的 key 时输出 warning 到 `debugLog`
- **中等方案**：引入轻量 schema 校验（如 zod/valibot），在 config 读取失败时输出具体错误信息（哪个字段、期望什么类型、实际拿到什么）
- **最低可行方案**：在 `readConfigAtRepo` 的 catch 分支中，不返回 null，而是返回 `{ config: null, warnings: string[] }` 让调用方决定是否要告知用户

**涉及文件**：
- `src/config/readConfig.ts`
- `src/config/types.ts`
- 可选新增：`src/config/validateConfig.ts`

**估计工作量**：轻量方案 2-3 小时；中等方案 4-6 小时

---

## 🟡 P1：隐性 bug 或维护风险

### A-03. Frontmatter 解析器重复实现 ×3

**问题**：同一个 YAML frontmatter 解析逻辑（分割 `---` → 逐行 `key: value` → 类型推断）在三处独立实现：

| 位置 | 函数名 | 特点 |
|------|--------|------|
| `src/capture/writeCapture.ts:30-49` | `parseSessionFileFrontmatter` | 带 `as unknown as` 双重断言 |
| `src/consolidate/sessionScanner.ts:19-39` | `parseSessionFrontmatter` | 逻辑相同，也是 `as unknown as` |
| `src/consolidate/parseCapture.ts:75-108` | `parseCaptureMarkdown` | 变体，返回 `ParsedCapture` 而非 frontmatter |

**风险**：将来给 frontmatter 加新字段（如优化 #11 的 `author`/`stability`）需改三处，漏改一处就是隐性 bug。

**修复方案**：
1. 提取到 `src/markdown/frontmatter.ts`（目前该文件只有序化工具），新增 `parseFrontmatter(content: string): Record<string, unknown> | null`
2. 三处调用改为 import 这个统一函数
3. `as unknown as SessionFileFrontmatter` 断言保留在调用侧（后续可替换为 schema 校验）

**涉及文件**：
- `src/markdown/frontmatter.ts`（新增 `parseFrontmatter`）
- `src/capture/writeCapture.ts`（删除本地实现，改用 import）
- `src/consolidate/sessionScanner.ts`（同上）
- `src/consolidate/parseCapture.ts`（改用共享 frontmatter 解析 + 特定字段提取）

**估计工作量**：1-2 小时

---

### A-04. 信号检测正则和 `inferCaptureType` 重复散落

**问题**：`CORRECTION_RE`、`SEMANTIC_SIGNAL_RE` 和 `inferCaptureType()` 在多处重复定义：

| 位置 | 重复内容 |
|------|---------|
| `src/capture/shouldCapture.ts:33-37` | `CORRECTION_RE` + `SEMANTIC_SIGNAL_RE` + `inferCaptureType()` |
| `src/capture/needsLlm.ts:8-11` | `CORRECTION_RE`（复制粘贴）、`ARCHITECTURE_SIGNAL_RE` |
| `src/capture/formatCapture.ts:13` | `SEMANTIC_SIGNAL_RE` 内联重复 + `inferCaptureType()` 重复 |

**风险**：修改信号规则时极易漏改某处，导致同一会话在 `shouldCapture` 和 `needsLlm` 阶段判据不一致。

**修复方案**：
1. 在 `src/capture/` 下新建 `signals.ts`，统一导出所有正则常量和 `inferCaptureType()`
2. 各文件改为 import

**涉及文件**：
- 新增 `src/capture/signals.ts`
- `src/capture/shouldCapture.ts`
- `src/capture/needsLlm.ts`
- `src/capture/formatCapture.ts`

**估计工作量**：1 小时

---

### A-05. `isAssistantId` 实际上什么都没校验

**问题**：

```typescript
// src/config/readConfig.ts:12-14
function isAssistantId(value: unknown): value is AssistantId {
  return typeof value === "string";
}
```

这个 type guard 声称验证了 `AssistantId`，但只检查了"是不是 string"——任何字符串都通过。如果用户在 `assistants` 数组里写了 `"copilot"`，它被原样接受，直到运行时路由匹配不到才静默返回 `no capture assistant`。

**修复方案**：
```typescript
const VALID_ASSISTANT_IDS: Set<string> = new Set(["claude-code", "cursor", "codebuddy", "codex"]);

function isAssistantId(value: unknown): value is AssistantId {
  return typeof value === "string" && VALID_ASSISTANT_IDS.has(value);
}
```

**涉及文件**：
- `src/config/readConfig.ts`
- 可选：将 `VALID_ASSISTANT_IDS` 与 `src/init/assistants/registry.ts` 的注册表对齐

**估计工作量**：0.5 小时

---

### A-06. `shouldCapture()` 最后分支是死代码

**问题**：

```typescript
// src/capture/shouldCapture.ts:86-91
const isGreetingOnly = session.messages.length <= 2
  && session.toolCalls === 0
  && session.fileChanges === 0;
if (isGreetingOnly) {
  return false;
}

return false; // ← 这行永远被执行
```

无论 `isGreetingOnly` 判断结果如何，函数最终都 `return false`。这意味着：不满足前面的强信号/高复杂度/有文件修改条件的**中等会话**（如 3 条消息、0 次工具调用、0 文件修改）也会被拒绝。`isGreetingOnly` 的判断实际上永远走 `return false`，使该条件分支成为死代码。

**意图可能是**：greeting-only → 拒绝；非 greeting-only 且无强信号 → 也拒绝（当前行为）；或者原本设计了中间地带但没实现。

**修复方案**：
- 如果确实只想接受强信号/高复杂度会话：删除 `isGreetingOnly` 分支，最后直接 `return false`，加注释说明决策逻辑
- 如果原本有中间地带设计：补全中间条件

**涉及文件**：
- `src/capture/shouldCapture.ts`

**估计工作量**：0.5 小时

---

## 🟢 P2：代码理解成本或行为偏差

### A-07. `hookExit` 三元表达式冗余

**问题**：

```typescript
// src/hookExit.ts:5
process.exit(strict ? code : code === 0 ? 0 : 0);
```

`code === 0 ? 0 : 0` 永远等于 `0`，三元表达式无意义。

**修复方案**：改为 `process.exit(strict ? code : 0)`，意图一目了然。

**涉及文件**：`src/hookExit.ts`

**估计工作量**：5 分钟

---

### A-08. `router.ts` 的 fallback 策略是串行硬编码优先级

**问题**：`routeCapture()` 在 fallback 阶段按硬编码顺序串行尝试各助手：Claude → Codex → Cursor → CodeBuddy。每轮 session 只有一个助手会产生 capture。

**潜在困扰**：
1. 用户配置中 `assistants` 数组的顺序表达的是"我用了谁"，而非"谁优先"
2. 多助手同时活跃时，优先级低的助手的 session 可能永远不会被捕获
3. 无文档说明这个优先级行为

**修复方案**（可选）：
- 短期：在 README 或 config.json 模板注释中说明 fallback 顺序
- 中期：允许用户在 config 中设定 `capturePriority` 数组
- 长期：支持并行 capture 或基于 session 来源自动匹配

**涉及文件**：`src/capture/router.ts`

**估计工作量**：短期 0.5 小时；中期 2-3 小时

---

## 🔵 P3：性能优化方向

### A-09. 全量同步 I/O

**问题**：整个项目所有文件读写都用 `readFileSync`/`writeFileSync`，唯一异步是 LLM 的 `fetch()` 调用。Hook 场景确实需要快返，但 `flush` 和 `search` 命令不需要——文件多的项目可能明显卡顿。

**修复方案**：在 `flush`/`search` 命令中逐步引入异步 I/O（`fs/promises`）。hook 路径保持同步。

**涉及文件**：涉及面广，建议渐进式改造

**估计工作量**：4-6 小时（分多个 PR）

---

## ℹ️ Info：v1 兼容代码硬编码而非复用

### A-10. `readConfigAtRepo()` v1 分支硬编码默认值

**问题**：处理 v1 配置时（第 96-115 行），手动硬编码了整份 v2 默认配置，而非调用 `defaultDisabledLlmConfig()` 或 `parseConsolidateConfig()`。与 A-01 直接相关——v1 升级得到的默认值与 `llmConfig.ts` 常量不同步。

**修复方案**：v1 分支改为调用 `defaultDisabledLlmConfig()` + `parseConsolidateConfig({})` 生成默认配置。

**涉及文件**：`src/config/readConfig.ts`

**估计工作量**：0.5 小时（取决于 A-01 的方案选择）

---

## 与已有改进清单的交叉对照

本次审查的部分发现与 `improvements-roadmap.md` 有交叉：

| 本审查项 | 对应已有优化 | 关系 |
|----------|-------------|------|
| A-01 (LLM 默认值不一致) | 无 | **新增** |
| A-02 (配置错误静默) | #1 (Hook 可靠性) | 补充视角：不只是 hook 失败，配置错误同样无声 |
| A-03 (frontmatter 重复) | #11 (YAML 字段扩展) | A-03 是 #11 的前置风险——扩展字段时漏改 |
| A-04 (信号正则重复) | #3 (过滤质量) | A-04 是 #3 的代码层根因 |
| A-05 (isAssistantId) | #8 (init 多选助手) | A-05 是 #8 的具体代码缺陷 |
| A-06 (shouldCapture 死代码) | #3 (过滤质量) | A-06 影响过滤精确度 |

---

## 建议实施顺序

1. **A-07** → 5 分钟，立即改
2. **A-01 + A-10** → 统一默认值，1-2 小时
3. **A-05** → isAssistantId 校验，0.5 小时
4. **A-06** → shouldCapture 清理，0.5 小时
5. **A-04** → 信号正则收拢，1 小时
6. **A-03** → frontmatter 解析器统一，1-2 小时
7. **A-02** → 配置校验 + 警告，2-3 小时
8. **A-08** → fallback 策略文档化，0.5 小时
9. **A-09** → 异步 I/O 渐进改造，长期

---

**审查者**：Claude Code 自动审查
**下次复审建议**：v1.3.0 发布前
