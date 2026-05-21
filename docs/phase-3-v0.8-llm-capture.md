# Phase 3：v0.8.0 LLM 捕获提炼

> **状态**：已完成 · **版本**：`0.8.0` · **依赖**：[Phase 2 capture](phase-2-v0.2-capture.md)（v0.2.5+）

## 目标

在启发式 `shouldCapture` 通过后：

1. **立即**写入 `simpleFormat` 捕获（与 v0.7 兼容，hook 快速返回）。
2. 对复杂会话且 `.memory/llm.json` 已启用时，**异步** `capture-llm` 用 LLM 升级同一 capture 文件。
3. 支持 `semantic` / `episodic` / `procedural` 三分类（LLM 路径）。

## 配置：`.memory/llm.json`

**全部 LLM 配置**在此文件（含 `apiKey`）。该文件在 init 写入的 `.gitignore` 块中**忽略**，勿提交 Git。

```json
{
  "enabled": true,
  "provider": "openai",
  "baseUrl": "https://api.deepseek.com",
  "model": "deepseek-v4-flash",
  "apiKey": "sk-...",
  "timeoutMs": 60000,
  "maxInputChars": 24000,
  "mode": "async"
}
```

| 字段 | 说明 |
|------|------|
| `enabled` | `false` 时仅 simple 捕获 |
| `mode` | `async`（默认）或 `sync`（调试用） |
| `apiKey` / `baseUrl` / `model` | 缺一不可 |

`config.json` **不含** `llm` 字段。

### init

- **交互**：可选配置 LLM（baseUrl、model、password apiKey）。
- **`init -y`**：写入 `{ "enabled": false }` 骨架。
- 再次 init **保留**已有 `apiKey`。

示例模板：`.memory/templates/llm.json.example`（无真实 key）。

## 何时走 LLM

`shouldCapture` 通过且 `isLlmAvailable(llm.json)` 且 `needsLlm(session)`：

- 消息 ≥ 20，或
- `fileChanges` ≥ 3，或
- 架构/约定类信号词，或
- 用户纠正

## 异步流程

```text
stop hook → capture
  → simpleFormat 写盘
  → 若 needsLlm：写 .memory/captures/pending/<jobId>.json
  → spawn detached: hermes-repo capture-llm --job <id>
capture-llm → llmFormat → 原子替换 capture（frontmatter 增加 llmUpgradedAt）
```

手动补跑：`hermes-repo capture-llm --flush -C <repo>`。

调试同步：`HERMES_LLM_SYNC=1` 或 `llm.json` 中 `"mode": "sync"`。

## 启发式收紧（v0.8）

- 英文强信号词改为**整词边界**（减少 `fix`/`note` 子串误伤）。
- 有效 user 轮次 &lt; 2 且 `toolCalls` ≤ 1 → 不捕获（减少「你好」类会话落盘）。

## 代码入口

| 模块 | 路径 |
|------|------|
| 读配置 | `src/config/llmConfig.ts`, `readLlmConfig.ts` |
| 格式化 | `src/capture/formatCapture.ts` |
| 提交捕获 | `src/capture/commitCapture.ts` |
| 入队 | `src/capture/enqueueLlmJob.ts` |
| Worker | `src/capture/runLlmJob.ts`, `src/commands/captureLlm.ts` |
| HTTP | `src/llm/chatCompletions.ts` |

## 验收

- 无 `llm.json` 或 `enabled: false`：行为同 v0.7。
- 启用 LLM + mock：capture 文件含 `llmUpgradedAt` 与提炼正文。
- `bun run test` 全通过。

## 与 Phase 4

本阶段不写 `MEMORY.md`；consolidate 在 Phase 4 消费已升级的 capture 文件。
