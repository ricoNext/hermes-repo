---
"@riconext/hermes-repo": minor
---

feat: 添加 flush --if-needed 选项实现可靠的自动 flush

- 新增 `flush --if-needed` 命令选项，仅在满足 autoFlush 阈值时执行
- 更新所有助手 hook 配置（Claude Code、Cursor、CodeBuddy、Codex），在 Stop hook 中自动调用 `flush --if-needed`
- 移除 `commitCapture` 中不可靠的后台进程调度逻辑（`maybeScheduleConsolidate`）
- 更新文档说明新的 autoFlush 机制

通过编辑器 hook 直接触发 `flush --if-needed`，替代了之前不可靠的 spawn 后台进程方式，确保自动 flush 在所有编辑器环境中都能正常工作。
