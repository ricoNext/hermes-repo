---
"@riconext/hermes-repo": minor
---

新增 capture 后自动 flush 调度配置。开启 `consolidate.autoFlush.enabled` 后，capture 成功写入时会根据待处理 session 数量、距离上次 flush 的时间和待处理内容字符数，在后台触发 `hermes-repo flush`。
