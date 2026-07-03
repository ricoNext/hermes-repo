--
-- PostgreSQL database dump
--

\restrict XLrgF8RciLJFjckLhBLiKxj5BHFsf0w86l6aIDOtD1NoRV4dJkc7leaNpYg8z7u

-- Dumped from database version 16.14 (Debian 16.14-1.pgdg12+1)
-- Dumped by pg_dump version 16.14 (Debian 16.14-1.pgdg12+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: MemoryScope; Type: TYPE; Schema: public; Owner: hermes
--

CREATE TYPE public."MemoryScope" AS ENUM (
    'PERSONAL',
    'TEAM',
    'PUBLIC'
);


ALTER TYPE public."MemoryScope" OWNER TO hermes;

--
-- Name: MemoryType; Type: TYPE; Schema: public; Owner: hermes
--

CREATE TYPE public."MemoryType" AS ENUM (
    'NOTE',
    'CONTEXT',
    'PREFERENCE',
    'SNIPPET'
);


ALTER TYPE public."MemoryType" OWNER TO hermes;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: hermes
--

CREATE TYPE public."Role" AS ENUM (
    'OWNER',
    'ADMIN',
    'MEMBER'
);


ALTER TYPE public."Role" OWNER TO hermes;

--
-- Name: SystemRole; Type: TYPE; Schema: public; Owner: hermes
--

CREATE TYPE public."SystemRole" AS ENUM (
    'SUPER_ADMIN',
    'ADMIN',
    'MEMBER'
);


ALTER TYPE public."SystemRole" OWNER TO hermes;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Memory; Type: TABLE; Schema: public; Owner: hermes
--

CREATE TABLE public."Memory" (
    id text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    type public."MemoryType" DEFAULT 'NOTE'::public."MemoryType" NOT NULL,
    scope public."MemoryScope" DEFAULT 'PERSONAL'::public."MemoryScope" NOT NULL,
    importance integer DEFAULT 1 NOT NULL,
    tags text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "authorId" text NOT NULL,
    "projectId" text NOT NULL
);


ALTER TABLE public."Memory" OWNER TO hermes;

--
-- Name: Project; Type: TABLE; Schema: public; Owner: hermes
--

CREATE TABLE public."Project" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Project" OWNER TO hermes;

--
-- Name: ProjectRole; Type: TABLE; Schema: public; Owner: hermes
--

CREATE TABLE public."ProjectRole" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "projectId" text NOT NULL,
    role public."Role" DEFAULT 'MEMBER'::public."Role" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ProjectRole" OWNER TO hermes;

--
-- Name: User; Type: TABLE; Schema: public; Owner: hermes
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text,
    name text NOT NULL,
    "avatarUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    username text NOT NULL,
    "passwordHash" text NOT NULL,
    "systemRole" public."SystemRole" DEFAULT 'MEMBER'::public."SystemRole" NOT NULL
);


ALTER TABLE public."User" OWNER TO hermes;

--
-- Data for Name: Memory; Type: TABLE DATA; Schema: public; Owner: hermes
--

COPY public."Memory" (id, title, content, type, scope, importance, tags, "createdAt", "updatedAt", "authorId", "projectId") FROM stdin;
e4ae65cb-e259-4a12-917f-220a6b096d40	欢迎使用 Hermes 团队记忆	这是一条示例记忆。可通过 MCP 工具或管理 UI 创建更多记忆。	NOTE	TEAM	3	{onboarding}	2026-07-01 01:38:09.79	2026-07-01 01:38:09.79	7d5dcb7d-6eca-4452-9569-f7698db8c8f4	00000000-0000-4000-8000-000000000001
1ec3f53b-bf8a-415c-ba0b-2046afb5ad98	API 规范	所有 REST 接口需带 X-Project-Id	NOTE	PERSONAL	1	{}	2026-07-01 01:54:23.448	2026-07-01 01:54:23.448	7d5dcb7d-6eca-4452-9569-f7698db8c8f4	00000000-0000-4000-8000-000000000001
16a2a99f-799e-46c3-af2f-24e5a11d17de	API 规范	所有 REST 接口需带 X-Project-Id	NOTE	PERSONAL	1	{}	2026-07-01 02:09:58.192	2026-07-01 02:09:58.192	7d5dcb7d-6eca-4452-9569-f7698db8c8f4	00000000-0000-4000-8000-000000000001
146bf894-4924-48c1-909a-3222b7f931b5	API 规范1	所有 REST 接口需带 X-Project-Id	NOTE	PERSONAL	1	{}	2026-07-01 02:10:58.943	2026-07-01 02:10:58.943	7d5dcb7d-6eca-4452-9569-f7698db8c8f4	00000000-0000-4000-8000-000000000001
a474e58a-7873-4774-901c-4f640ef77d77	mis-pc-entry 项目知识库摘要	# 项目知识库\n\n最后更新: 2026-06-29 | 域: 1 | 规则: 0 | 工作流: 0 | 决策: 1 | 踩坑: 3\n\n## 业务域\n\n| 域 | 摘要 |\n|----|------|\n| canvas | 双模式平移与自定义空间名称交互规则 |\n\n## 决策\n\n- 2026-06-29 双模式平移决策 — 户型区域只移户型，空白区域移整个画板\n\n## 踩坑\n\n- 2026-06-26 保存常用报价 planId 误传 — 去掉 planId 避免权限错误\n- 2026-06-29 画布平移坐标不一致 — 使用容器坐标、扩展命中规则\n- 2026-06-29 收藏夹样板间缺 ID — 跳转路径少传 sampleRoomId\n\n## 使用说明\n\n- 整理记忆: `npx @riconext/hermes-repo flush`\n- 查看业务域: `ls .memory/domains/`	CONTEXT	TEAM	5	{mis-pc-entry,summary,knowledge-base}	2026-07-01 02:14:06.075	2026-07-01 02:14:06.075	7d5dcb7d-6eca-4452-9569-f7698db8c8f4	00000000-0000-4000-8000-000000000001
e87ef418-d714-4bb6-8590-ccd2f827bb2d	画布交互：平移模式与自定义空间名称	## 双模式平移\n\n画布支持两种平移模式，取决于拖拽起始位置：\n\n| 起始区域 | 平移对象 | 条件 |\n|---------|---------|------|\n| 户型图内（房间多边形或包围盒内） | 只移动户型，自定义空间保持不动 | 按下点在户型图包围盒内且不在自定义空间 OBB 内，或命中房间多边形 |\n| 自定义空间内 | 不触发平移，交给空间/产品交互 | 点在自定义空间 OBB 内 |\n| 其他空白区域（侧栏、中间留白等） | 移动整个画板（户型+自定义空间一起） | 以上条件均不满足 |\n\n### 实现要点\n\n- 使用 `resolveContainerPointer` 获取容器相对坐标（而非 `canvas.getPointer()`），保证坐标系与拖放逻辑一致。\n- 平移前先调用 `flushWheelZoom` 刷新缩放变换，避免滚轮缩放预览时视口偏移。\n- 命中规则优先级：1. 自定义空间 OBB 内 → 不平移 2. 房间多边形内 → 户型平移 3. 户型图包围盒内 → 户型平移 4. 其他 → 整板平移\n- 整板平移通过 `canvasPanXRef` / `canvasPanYRef` 记录偏移量，松手后烘焙到所有图层。\n- 滚轮缩放锚点计入 `canvasPan`，避免缩放中心偏移。\n- 切换户型/楼层时重置 `canvasPan`。\n\n## 自定义空间名称交互\n\n- 名称默认显示在空间几何中心，使用 Fabric `Textbox` 实现自动换行。\n- 双击名称进入 inline 编辑，maxLength = 10。\n- 名称始终做 counter-scale：`scaleX = scaleY = 1 / 父级 scale`，保持 11px 字体不变。	CONTEXT	TEAM	4	{mis-pc-entry,canvas,domain,interaction}	2026-07-01 02:14:08.297	2026-07-01 02:14:08.297	7d5dcb7d-6eca-4452-9569-f7698db8c8f4	00000000-0000-4000-8000-000000000001
560eb6b0-f0b5-4885-8608-92888e4e06d8	双模式平移决策：户型区域只移户型，空白区域移整个画板	## 决策背景\n\n原画布平移逻辑：只要 `opt.target` 为空（未命中 Fabric 对象），就移动整个画板（包括户型+自定义空间）。但用户期望：在户型区域（墙体、房间）拖拽时只移动户型，而在空白区域拖拽时整体平移。\n\n## 解决方案\n\n实现「双模式平移」：\n\n- **户型区域**：拖拽只移动户型，自定义空间保持原位。\n- **空白区域**：拖拽移动整个画板（户型+自定义空间）。\n- **自定义空间内**：不触发平移，留给空间/产品交互。\n\n## 实现方式\n\n- 添加 `canvasPanXRef` / `canvasPanYRef` 存储整板偏移量。\n- 在 `draw()` 时，将 `canvasPan` 同时加入 `offsetX/Y` 和 `customOffsetX/Y`，保证所有图层同步。\n- 滚轮缩放锚点也计入 `canvasPan`。\n- 切换户型/楼层时重置 `canvasPan`。\n- 命中检测使用容器坐标和扩展规则。\n\n## 替代方案\n\n- 保持原有单一模式：无法满足户型平移需求，放弃。\n- 使用右键拖拽整体平移：不符合用户习惯，放弃。	CONTEXT	TEAM	4	{mis-pc-entry,canvas,decision}	2026-07-01 02:14:09.584	2026-07-01 02:14:09.584	7d5dcb7d-6eca-4452-9569-f7698db8c8f4	00000000-0000-4000-8000-000000000001
35f8c0aa-5768-40aa-b8b7-21af19c963d2	保存常用报价时误传 planId 导致权限错误	## 问题描述\n\n在编辑快速报价 → 查看报价清单 → 点击「添加到常用报价」时，后端返回「当前用户没有该快速报价的操作权限」。\n\n## 根因\n\n`getSaveQuotationData()` 在构造请求数据时，会带上当前快速报价的 `planId`（快速报价 id）。保存常用报价时 `type` 被设为 `2`（常用报价），但 `planId` 仍为快速报价的 id。后端判断为「更新 id 为 xxx 的常用报价」，而该 id 实际属于快速报价且不属于当前用户（或权限不足），导致权限错误。\n\n## 修复\n\n保存常用报价时，从 `getSaveQuotationData()` 的返回值中解构 `planId` 并去除，只传其他字段。这样后端会新建一条 `type=2` 且不带 `planId` 的常用报价记录。\n\n```tsx\nconst { planId: _planId, ...quotationData } = getSaveQuotationData();\n```	NOTE	TEAM	3	{mis-pc-entry,quoted,incident,bugfix}	2026-07-01 02:14:10.633	2026-07-01 02:14:10.633	7d5dcb7d-6eca-4452-9569-f7698db8c8f4	00000000-0000-4000-8000-000000000001
7d9a0e11-9199-4198-92b1-1173b73fc18e	画布平移命中检测坐标不一致及修复	## 问题描述\n\n在实现双模式平移时，户型平移命中检测不准确，导致在墙体或房间内拖拽时无法触发户型平移。\n\n## 根因\n\n1. **坐标系不一致**：平移命中检测使用 `canvas.getPointer()`（画布坐标），而其他交互（如拖放）使用 `containerRef.getBoundingClientRect()` 计算的容器坐标，两者不一致导致 `isPointOnHousePlan` 几乎总是判 false。\n2. **命中范围过窄**：仅判断户型图包围盒，墙体等非房间填充区域容易漏判。\n\n## 修复\n\n1. 改用与 `handleDrop` 一致的 `resolveContainerPointer`（容器相对坐标）。\n2. 在获取指针坐标前先调用 `flushWheelZoom`，避免滚轮缩放预览时 viewport 未复位导致坐标错位。\n3. 扩展命中规则：首先检测自定义空间 OBB（不触发平移）→ 房间多边形（户型平移）→ 户型图包围盒（户型平移）→ 其余区域为整板平移	NOTE	TEAM	3	{mis-pc-entry,canvas,incident,bugfix}	2026-07-01 02:14:11.846	2026-07-01 02:14:11.846	7d5dcb7d-6eca-4452-9569-f7698db8c8f4	00000000-0000-4000-8000-000000000001
58889b47-2336-47a1-9af6-507c1ea4e43c	收藏夹样板间跳转 missing path param sampleRoomId	## 问题描述\n\n在个人中心收藏夹的「样板间」列表中点击某个项目，路由无法匹配，页面空白。\n\n## 根因\n\n跳转路径写成了 `/template/middle-page`，缺少 `:sampleRoomId` 参数。而实际路由配置为 `middle-page/:sampleRoomId`，缺少 ID 时路由无法匹配。\n\n## 修复\n\n将收藏夹列表（`template-list.tsx`）中的跳转改为与其他入口一致：`/template/middle-page/${sampleRoomId}`。\n\n## 相关代码\n\n- `src/pages/person/info/components/favorites/template-list.tsx`（修复跳转路径）\n- `src/pages/template/middle-page/index.tsx`（通过 `useParams()` 读取 `sampleRoomId`）	NOTE	TEAM	3	{mis-pc-entry,template,incident,bugfix}	2026-07-01 02:14:12.558	2026-07-01 02:14:12.558	7d5dcb7d-6eca-4452-9569-f7698db8c8f4	00000000-0000-4000-8000-000000000001
\.


--
-- Data for Name: Project; Type: TABLE DATA; Schema: public; Owner: hermes
--

COPY public."Project" (id, name, description, "createdAt", "updatedAt") FROM stdin;
88d7b578-ef9e-427a-b87a-dad7ad943881	mei-pc-entry	mis web 项目	2026-07-01 02:37:55.808	2026-07-01 02:37:55.808
00000000-0000-4000-8000-000000000001	默认项目	开发环境种子项目	2026-07-01 01:38:09.782	2026-07-01 07:44:10.401
\.


--
-- Data for Name: ProjectRole; Type: TABLE DATA; Schema: public; Owner: hermes
--

COPY public."ProjectRole" (id, "userId", "projectId", role, "createdAt") FROM stdin;
2483f4e5-ce0a-4a52-bf89-c1ef1099aba5	7d5dcb7d-6eca-4452-9569-f7698db8c8f4	88d7b578-ef9e-427a-b87a-dad7ad943881	OWNER	2026-07-01 02:37:55.813
f56bced7-ba7e-4761-a46e-9432a7ffc6b1	fd6be2ae-244f-4cbc-af76-25388f23e200	00000000-0000-4000-8000-000000000001	OWNER	2026-07-01 07:44:10.402
479d00f7-1db4-4c54-a95e-eb8e6e681174	7d5dcb7d-6eca-4452-9569-f7698db8c8f4	00000000-0000-4000-8000-000000000001	MEMBER	2026-07-01 01:38:09.785
d6e46d27-bcef-44fb-8e09-26b9524bdfac	e6436c2a-b20d-47eb-92d6-8ca84a2429e6	88d7b578-ef9e-427a-b87a-dad7ad943881	ADMIN	2026-07-01 09:48:53.4
29f027c8-8061-457d-b984-b2cd707e492f	517c4d0c-2ea2-4ea7-9587-46b86b894e33	88d7b578-ef9e-427a-b87a-dad7ad943881	MEMBER	2026-07-01 09:49:00.274
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: hermes
--

COPY public."User" (id, email, name, "avatarUrl", "createdAt", "updatedAt", username, "passwordHash", "systemRole") FROM stdin;
fd6be2ae-244f-4cbc-af76-25388f23e200	admin@hermes.local	系统管理员	\N	2026-07-01 07:44:10.348	2026-07-01 07:44:10.348	admin	e4ad6971b57647e5882886636896f52b:6915e6dbd45399e390405415f58cbb33ef5f1be5a93e80f53daa24bb9c943893ab634b3957089accc703ea050d1f0b7b8c718ccbe3c09ece19f1c5d45a9f2b83	SUPER_ADMIN
7d5dcb7d-6eca-4452-9569-f7698db8c8f4	dev@hermes.local	Dev User	\N	2026-07-01 01:38:09.776	2026-07-01 07:44:10.397	dev	8ad8fc58116ebdd6b0567b5d6ef73ca9:c7ed9cf96ca856f97120f027ffaa0dadbb685059e639bd7bb82cdb206c11eb42a199915a696182e0eadfb46330931f8dbf8e895477b80e0eb41980bf428998a1	MEMBER
3f8f78f6-7804-4c44-a42f-a0d8e14e3324	111@11.com	测试 1	\N	2026-07-01 08:30:29.057	2026-07-01 08:30:29.057	cesd	4af5ae3dc6552a38f1a6ac761f25ea47:078f49a277b8fc5fc78e3f8c307d39019d21f6b548d546260b1c6e39c0072c1e314f0620befd9f4639ed1ae318ac1354b84d16d29b9da66598c7402528b8f719	ADMIN
e6436c2a-b20d-47eb-92d6-8ca84a2429e6	\N	aaa	\N	2026-07-01 08:52:43.152	2026-07-01 08:52:43.152	aaa	f2d77bc8dd8d4b8d66f68695b8517870:23c15618e67ccc1f181412021405cc3f990b39b41356edf8eccfc72e895950bb2199d1dbabba0713b71e23cf82c33a02c999b02dc551a8988e05edcb815d8f8d	MEMBER
517c4d0c-2ea2-4ea7-9587-46b86b894e33	\N	bbb	\N	2026-07-01 09:48:39.718	2026-07-01 09:48:39.718	bbb	411b71a2adcc1523312ae3aa9098b842:db69028fb2edc3ceeb1d4e8b765e1b43936559c093cb124b0fcbc9248750fb4054a5b70503f97d777564f21011158cf0ad0224df04b25b1ea6811ad8b118aaf7	MEMBER
\.


--
-- Name: Memory Memory_pkey; Type: CONSTRAINT; Schema: public; Owner: hermes
--

ALTER TABLE ONLY public."Memory"
    ADD CONSTRAINT "Memory_pkey" PRIMARY KEY (id);


--
-- Name: ProjectRole ProjectRole_pkey; Type: CONSTRAINT; Schema: public; Owner: hermes
--

ALTER TABLE ONLY public."ProjectRole"
    ADD CONSTRAINT "ProjectRole_pkey" PRIMARY KEY (id);


--
-- Name: Project Project_pkey; Type: CONSTRAINT; Schema: public; Owner: hermes
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: hermes
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Memory_authorId_idx; Type: INDEX; Schema: public; Owner: hermes
--

CREATE INDEX "Memory_authorId_idx" ON public."Memory" USING btree ("authorId");


--
-- Name: Memory_authorId_scope_idx; Type: INDEX; Schema: public; Owner: hermes
--

CREATE INDEX "Memory_authorId_scope_idx" ON public."Memory" USING btree ("authorId", scope);


--
-- Name: Memory_projectId_idx; Type: INDEX; Schema: public; Owner: hermes
--

CREATE INDEX "Memory_projectId_idx" ON public."Memory" USING btree ("projectId");


--
-- Name: Memory_projectId_scope_idx; Type: INDEX; Schema: public; Owner: hermes
--

CREATE INDEX "Memory_projectId_scope_idx" ON public."Memory" USING btree ("projectId", scope);


--
-- Name: Memory_projectId_type_scope_idx; Type: INDEX; Schema: public; Owner: hermes
--

CREATE INDEX "Memory_projectId_type_scope_idx" ON public."Memory" USING btree ("projectId", type, scope);


--
-- Name: Memory_scope_idx; Type: INDEX; Schema: public; Owner: hermes
--

CREATE INDEX "Memory_scope_idx" ON public."Memory" USING btree (scope);


--
-- Name: ProjectRole_userId_projectId_key; Type: INDEX; Schema: public; Owner: hermes
--

CREATE UNIQUE INDEX "ProjectRole_userId_projectId_key" ON public."ProjectRole" USING btree ("userId", "projectId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: hermes
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_username_key; Type: INDEX; Schema: public; Owner: hermes
--

CREATE UNIQUE INDEX "User_username_key" ON public."User" USING btree (username);


--
-- Name: Memory Memory_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: hermes
--

ALTER TABLE ONLY public."Memory"
    ADD CONSTRAINT "Memory_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Memory Memory_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: hermes
--

ALTER TABLE ONLY public."Memory"
    ADD CONSTRAINT "Memory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProjectRole ProjectRole_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: hermes
--

ALTER TABLE ONLY public."ProjectRole"
    ADD CONSTRAINT "ProjectRole_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProjectRole ProjectRole_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: hermes
--

ALTER TABLE ONLY public."ProjectRole"
    ADD CONSTRAINT "ProjectRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict XLrgF8RciLJFjckLhBLiKxj5BHFsf0w86l6aIDOtD1NoRV4dJkc7leaNpYg8z7u

