# 产品介绍

```text
 _                                               
| |__   ___ _ __ _ __ ___   ___  ___        _ __ ___ _ __   ___
| '_ \ / _ \ '__| '_ ' _ \ / _ \/ __|      | '__/ _ \ '_ \ / _ \
| | | |  __/ |  | | | | | |  __/\__ \      | | |  __/ |_) | (_) |
|_| |_|\___|_|  |_| |_| |_|\___||___/      |_|  \___| .__/ \___/
                                                    |_|          

repo-local memory for AI coding assistants
capture -> consolidate -> inject
```


你有没有遇到过这种情况：打开一个新的 AI 编程会话，第一件事不是写代码，而是重新解释一遍项目约定。

“这个仓库用 bun。”

“API 客户端在这里。”

“上次那个 bug 的根因不是类型问题，是权限边界没处理好。”

这些信息明明已经在某次对话里讲过，但下一次会话又消失了。`hermes-repo` 想解决的就是这个问题：**把 AI 编程助手的项目记忆放回 Git 仓库。**

![AI 编程会话里的上下文丢失](https://neptune-ipc.oss-cn-shenzhen.aliyuncs.com/img/20260708173721600.png)

## hermes-repo 是什么

`hermes-repo` 是一个 repo-local memory 工具。它会把 Claude Code、Cursor、CodeBuddy、OpenAI Codex 等助手的 hook 接到当前仓库里，让项目上下文形成一个闭环：

- 会话结束时，捕获有价值的上下文。
- 需要整理时，用 OpenAI 兼容 LLM 把原始记录转成结构化知识。
- 下一次会话开始时，自动把项目记忆注入给助手。

一句话说：**它让 AI 助手不只记住这一轮聊天，而是记住这个仓库。**

## 相比工具自带记忆，它的优势在哪里

现在不少 AI 编程工具都有自己的记忆、规则或项目上下文能力，这些能力很有用，但通常会绑定在某一个产品、某一个账号或某一个编辑器环境里。`hermes-repo` 的思路不一样：它把记忆层从具体工具里抽出来，放到项目仓库本身。

这带来几个直接优势：

- **跨助手可用**：同一份项目记忆可以服务 Claude Code、Cursor、CodeBuddy、OpenAI Codex，而不是被锁在单一工具里。
- **跟着 Git 仓库走**：真正重要的项目规则、工作流、架构决策可以进入 `.memory/`，随代码一起演进。
- **可审计、可修改**：记忆不是黑盒。你可以直接打开 Markdown 文件，看它记录了什么，也可以手动修正。
- **区分本地隐私和团队知识**：密钥、原始 transcript、处理状态留在本地并默认忽略；沉淀后的结构化知识可以按需纳入版本控制。
- **适合长期项目**：工具内置记忆更像“助手记住你”，`hermes-repo` 更像“项目记住自己”。成员换工具、换机器、换会话，核心上下文仍然留在仓库里。

所以它不是要替代各个工具的内置记忆，而是补上更底层的一层：**让项目拥有一份独立、透明、可迁移的长期记忆。**

![hermes-repo 的记忆闭环](https://neptune-ipc.oss-cn-shenzhen.aliyuncs.com/img/20260708173801133.png)

## 它解决的不是“聊天记录保存”，而是“项目知识沉淀”

普通聊天记录的问题是：信息存在，但不可用。你要自己翻、自己总结、自己复制给下一轮会话。

`hermes-repo` 的设计更接近一个项目知识库：

- `.memory/MEMORY.md`：下一次会话注入用的导航摘要。
- `.memory/rules/`：每次注入都会全文加载的规则。
- `.memory/domains/`：领域知识和业务背景。
- `.memory/workflows/`：可复用开发流程。
- `.memory/decisions/`：架构和产品决策。
- `.memory/incidents/`：踩坑记录和根因分析。

这些结构化知识默认可以跟着 Git 仓库走；而 `.memory/config.json`、原始 transcript、处理状态等本地敏感信息会被 gitignore。

## 为什么这件事重要

AI 编程的效率瓶颈，很多时候不在模型会不会写代码，而在它是否理解当前项目：

- 它知道你的包管理器、目录结构和命名风格吗？
- 它知道哪些方案之前试过、为什么放弃吗？
- 它知道某个 bug 的真实根因和修复边界吗？
- 它知道团队约定哪些文件能动、哪些文件不能随便改吗？

如果每次都靠人重新解释，AI 只是一次性外援。  
如果上下文能被沉淀、整理、注入，它才更像项目里的长期协作者。

## 从个人仓库记忆，到团队级记忆系统

当前 monorepo 已经拆成三层：

- `@riconext/hermes-repo`：CLI、hooks、本地 `.memory/` 工作流，已经发布 npm。
- `@riconext/hermes-mcp-server`：基于 FastMCP + PostgreSQL 的团队记忆 MCP 服务，提供 list/add/search/promote/delete memory 等工具。
- `@riconext/hermes-ui`：基于 Next.js 16 + Shadcn/ui 的 Web 管理界面，用来管理项目和记忆。

![hermes-repo 的模块结构](https://neptune-ipc.oss-cn-shenzhen.aliyuncs.com/img/20260708173837700.png)

更重要的是，MCP 服务和 UI 不依赖某个第三方托管平台。你可以把它们部署在自己的机器、内网服务器或团队基础设施里，数据库、访问权限、记忆内容、升级节奏都由自己掌控。对于不希望项目知识散落在不同 SaaS 工具里的团队，这一点尤其关键。


这个方向很明确：先让每个仓库拥有自己的长期记忆，再把有价值的经验提升为团队共享知识。

## 适合谁

如果你经常在一个项目里使用 AI 编程助手，`hermes-repo` 适合你。

如果你的团队已经在 Claude Code、Cursor、CodeBuddy 或 Codex 之间切换，它更适合你。

如果你受够了“每次开新会话都像新人入职”，那它解决的正是这个问题。

项目地址：

```text
https://github.com/ricoNext/hermes-repo
```

文档地址：
