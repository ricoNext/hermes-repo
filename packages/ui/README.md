# @riconext/hermes-ui

团队记忆 **Web 管理界面**，基于 Next.js 16 + Shadcn/ui。

## 技术栈

- Next.js 16（App Router + Turbopack）
- Shadcn/ui（Base UI + Tailwind CSS v4）
- TanStack Query、Zustand、React Hook Form + Zod

## 开发

在仓库根目录：

```bash
bun install
bun run dev:ui
```

或在本包目录：

```bash
bun run dev
```

默认访问 [http://localhost:3001](http://localhost:3001)。

复制环境变量：

```bash
cp .env.example .env.local
```

## 页面

- `/` — 仪表盘：项目列表 + 记忆浏览器（对接 MCP 管理 API 后加载数据）

设计文档见 `docs/plans/2026-06-30-team-memory-mcp-system-design.md`。
