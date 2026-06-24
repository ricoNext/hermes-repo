---
sessionId: example-session-id
source: session
status: pending
domain: null
createdAt: 2026-06-23T16:00:00
lastModifiedAt: 2026-06-23T16:00:00
consolidatedAt: null
captureCount: 2
---

## Capture #1 — 16:00:00
### type: semantic
### tags: ["discount","quoted"]

讨论了报价单的 discount 显示逻辑：
- 折扣字段来自后端 API `/api/quoted/discount`
- 前端展示需要乘以汇率
- 注意：折扣百分比需要除以 100 后展示

## Capture #2 — 16:15:00
### type: episodic
### tags: ["bug-fix"]

因为 discount 字段没有做空值判断，导致部分报价单页面白屏。
修复方案：在渲染前加 `?? 0` 兜底。
