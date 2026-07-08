import type { IncomingHttpHeaders } from "node:http";
import { FastMCP } from "fastmcp";
import { z } from "zod";
import {
  authenticateToken,
  type RestSessionData,
  type SessionData,
  unauthorizedResponse,
} from "./auth.js";
import { config } from "./config.js";
import { HttpError } from "./http-error.js";
import { prisma } from "./db.js";
import {
  addMemory,
  createProject,
  deleteMemory,
  deleteProject,
  listProjects,
  reviewMemory,
  searchMemories,
} from "./services/memory.js";
import {
  addProjectMember,
  listProjectMembers,
  listUserProjectMemberships,
  removeProjectMember,
  transferProjectOwnership,
  updateProjectMemberRole,
} from "./services/project.js";
import {
  createUser,
  getUserById,
  listUsers,
  loginWithPassword,
} from "./services/user.js";

function getHeader(
  headers: IncomingHttpHeaders | Headers,
  name: string,
): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  const value = headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export async function resolveAuth(
  headers: IncomingHttpHeaders | Headers,
): Promise<SessionData> {
  const authorization = getHeader(headers, "authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  const user = await authenticateToken(token);
  if (!user) {
    throw new HttpError(401, "未登录或登录已过期");
  }

  return { user };
}

export async function resolveRestSession(
  headers: IncomingHttpHeaders | Headers,
): Promise<RestSessionData> {
  const session = await resolveAuth(headers);

  const headerProjectId = getHeader(headers, "x-project-id");
  if (headerProjectId) {
    return { ...session, projectId: headerProjectId };
  }

  const role = await prisma.projectRole.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!role) {
    throw new HttpError(400, "缺少 X-Project-Id，且当前用户没有默认项目");
  }

  return { ...session, projectId: role.projectId };
}

function getSession(context: { session?: SessionData }): SessionData {
  if (!context.session) {
    throw new Error("未认证的 MCP 会话");
  }
  return context.session;
}

const projectIdSchema = z
  .string()
  .uuid()
  .describe("目标项目 ID（来自仓库 .memory/config.json 的 storage.mcp.projectId）");

export function createServer(): FastMCP<SessionData> {
  const server = new FastMCP<SessionData>({
    name: "team-memory-server",
    version: "0.1.0",
    health: {
      enabled: true,
      path: "/health",
      message: "ok",
    },
    authenticate: async (request) => {
      try {
        return await resolveAuth(request.headers);
      } catch (error) {
        if (error instanceof HttpError && error.status === 401) {
          throw unauthorizedResponse();
        }
        throw error;
      }
    },
  });

  registerTools(server);
  registerRoutes(server);

  return server;
}

function registerTools(server: FastMCP<SessionData>): void {
  server.addTool({
    name: "list_projects",
    description: "列出当前用户可访问的团队项目",
    parameters: z.object({
      query: z.string().optional().describe("按名称或描述过滤"),
    }),
    execute: async (args, context) => {
      const { user } = getSession(context);
      const projects = await listProjects(user, args.query ?? "");
      return JSON.stringify({ projects });
    },
  });

  server.addTool({
    name: "add_memory",
    description: "在指定项目中创建一条记忆（默认状态：PENDING）",
    parameters: z.object({
      projectId: projectIdSchema,
      title: z.string().describe("记忆标题"),
      content: z.string().describe("记忆内容"),
      type: z.enum(["NOTE", "CONTEXT", "PREFERENCE", "SNIPPET"]),
      tags: z.array(z.string()).default([]),
      importance: z.number().min(1).max(5).default(1),
    }),
    execute: async (args, context) => {
      const { user } = getSession(context);
      const { projectId, ...input } = args;
      const memory = await addMemory(user, projectId, input);
      return JSON.stringify({
        success: true,
        memoryId: memory.id,
        projectId,
        message: `记忆 "${args.title}" 已创建`,
      });
    },
  });

  server.addTool({
    name: "search_memories",
    description: "在指定项目中搜索记忆（关键词检索）",
    parameters: z.object({
      projectId: projectIdSchema,
      query: z.string().describe("搜索查询"),
      filters: z
        .object({
          type: z
            .enum(["NOTE", "CONTEXT", "PREFERENCE", "SNIPPET"])
            .optional(),
          status: z.enum(["PENDING", "ARCHIVED", "TRASH"]).optional(),
          authorId: z.string().optional(),
          minImportance: z.number().min(1).max(5).optional(),
        })
        .optional(),
      limit: z.number().min(1).max(50).default(10),
    }),
    execute: async (args, context) => {
      const { user } = getSession(context);
      const memories = await searchMemories(
        user,
        args.projectId,
        args.query,
        args.filters,
        args.limit,
      );

      return JSON.stringify({
        projectId: args.projectId,
        memories: memories.map((memory) => ({
          ...memory,
          content:
            memory.content.length > 200
              ? `${memory.content.slice(0, 200)}...`
              : memory.content,
        })),
      });
    },
  });

  server.addTool({
    name: "review_memory",
    description: "审核记忆（管理员功能）",
    parameters: z.object({
      memoryId: z.string().describe("记忆 ID"),
      status: z.enum(["ARCHIVED", "TRASH"]).describe("审核结果"),
      note: z.string().optional().describe("审核备注"),
    }),
    execute: async (args, context) => {
      const { user } = getSession(context);
      await reviewMemory(user, args.memoryId, args.status, args.note);
      return JSON.stringify({
        success: true,
        message: `记忆已${args.status === "ARCHIVED" ? "归档" : "移入垃圾桶"}`,
      });
    },
  });

  server.addTool({
    name: "delete_memory",
    description: "删除一条记忆",
    parameters: z.object({
      memoryId: z.string().describe("记忆 ID"),
    }),
    execute: async (args, context) => {
      const { user } = getSession(context);
      await deleteMemory(user, args.memoryId);
      return JSON.stringify({
        success: true,
        message: "记忆已删除",
      });
    },
  });
}

function registerRoutes(server: FastMCP<SessionData>): void {
  const app = server.getApp();

  app.onError((err, c) => {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status as 400 | 401 | 403 | 404);
    }
    console.error(err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return c.json({ error: message }, 500);
  });

  app.use("/api/*", async (c, next) => {
    if (c.req.method === "OPTIONS") {
      const origin = c.req.header("Origin") ?? config.corsOrigins[0];
      const allowOrigin = config.corsOrigins.includes(origin)
        ? origin
        : config.corsOrigins[0];
      return c.body(null, 204, {
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-Project-Id",
      });
    }

    await next();
    const origin = c.req.header("Origin");
    if (origin && config.corsOrigins.includes(origin)) {
      c.header("Access-Control-Allow-Origin", origin);
    } else {
      c.header("Access-Control-Allow-Origin", config.corsOrigins[0]);
    }
    c.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Project-Id",
    );
  });

  app.post("/api/auth/login", async (c) => {
    const body = await c.req.json<{ username?: string; password?: string }>();
    if (!body.username?.trim() || !body.password) {
      return c.json({ error: "username and password are required" }, 400);
    }

    const result = await loginWithPassword(body.username, body.password);
    if (!result) {
      return c.json({ error: "用户名或密码错误" }, 401);
    }

    return c.json(result);
  });

  app.get("/api/auth/me", async (c) => {
    const session = await resolveAuth(c.req.raw.headers);
    const user = await getUserById(session.user.id);
    if (!user) {
      return c.json({ error: "user not found" }, 404);
    }
    return c.json(user);
  });

  app.get("/api/users", async (c) => {
    await resolveAuth(c.req.raw.headers);
    const users = await listUsers();
    return c.json(users);
  });

  app.post("/api/users", async (c) => {
    const session = await resolveAuth(c.req.raw.headers);
    const body = await c.req.json<{
      username?: string;
      name?: string;
      password?: string;
      email?: string | null;
      systemRole?: "SUPER_ADMIN" | "ADMIN" | "MEMBER";
    }>();

    const user = await createUser(session.user, {
      username: body.username ?? "",
      name: body.name ?? "",
      password: body.password ?? "",
      email: body.email ?? null,
      systemRole: body.systemRole ?? "MEMBER",
    });
    return c.json(user, 201);
  });

  app.get("/api/users/:userId/projects", async (c) => {
    const session = await resolveAuth(c.req.raw.headers);
    const memberships = await listUserProjectMemberships(
      session.user,
      c.req.param("userId"),
    );
    return c.json(memberships);
  });

  app.get("/api/projects", async (c) => {
    const session = await resolveAuth(c.req.raw.headers);
    const q = c.req.query("q") ?? "";
    const projects = await listProjects(session.user, q);
    return c.json(projects);
  });

  app.post("/api/projects", async (c) => {
    const session = await resolveAuth(c.req.raw.headers);
    const body = await c.req.json<{ name?: string; description?: string }>();
    if (!body.name?.trim()) {
      return c.json({ error: "name is required" }, 400);
    }
    const project = await createProject(session.user, {
      name: body.name.trim(),
      description: body.description?.trim(),
    });
    return c.json(project, 201);
  });

  app.delete("/api/projects/:id", async (c) => {
    const session = await resolveAuth(c.req.raw.headers);
    await deleteProject(session.user, c.req.param("id"));
    return c.body(null, 204);
  });

  app.get("/api/projects/:id/members", async (c) => {
    const session = await resolveAuth(c.req.raw.headers);
    const members = await listProjectMembers(session.user, c.req.param("id"));
    return c.json(members);
  });

  app.post("/api/projects/:id/members", async (c) => {
    const session = await resolveAuth(c.req.raw.headers);
    const body = await c.req.json<{ userId?: string; role?: "ADMIN" | "MEMBER" }>();
    if (!body.userId) {
      return c.json({ error: "userId is required" }, 400);
    }
    if (!body.role) {
      return c.json({ error: "role is required" }, 400);
    }
    const member = await addProjectMember(
      session.user,
      c.req.param("id"),
      body.userId,
      body.role,
    );
    return c.json(member, 201);
  });

  app.patch("/api/projects/:id/members/:userId", async (c) => {
    const session = await resolveAuth(c.req.raw.headers);
    const body = await c.req.json<{ role?: "ADMIN" | "MEMBER" }>();
    if (!body.role) {
      return c.json({ error: "role is required" }, 400);
    }
    const member = await updateProjectMemberRole(
      session.user,
      c.req.param("id"),
      c.req.param("userId"),
      body.role,
    );
    return c.json(member);
  });

  app.delete("/api/projects/:id/members/:userId", async (c) => {
    const session = await resolveAuth(c.req.raw.headers);
    await removeProjectMember(
      session.user,
      c.req.param("id"),
      c.req.param("userId"),
    );
    return c.body(null, 204);
  });

  app.post("/api/projects/:id/transfer-ownership", async (c) => {
    const session = await resolveAuth(c.req.raw.headers);
    const body = await c.req.json<{ userId?: string }>();
    if (!body.userId) {
      return c.json({ error: "userId is required" }, 400);
    }
    const member = await transferProjectOwnership(
      session.user,
      c.req.param("id"),
      body.userId,
    );
    return c.json(member);
  });

  app.get("/api/memories", async (c) => {
    const session = await resolveRestSession(c.req.raw.headers);
    const memories = await searchMemories(
      session.user,
      session.projectId,
      c.req.query("q") ?? "",
      {
        type: (c.req.query("type") as never) || undefined,
        status: (c.req.query("status") as never) || undefined,
      },
    );
    return c.json(memories);
  });

  app.post("/api/memories", async (c) => {
    const session = await resolveRestSession(c.req.raw.headers);
    const body = await c.req.json<{
      title?: string;
      content?: string;
      type?: "NOTE" | "CONTEXT" | "PREFERENCE" | "SNIPPET";
      tags?: string[];
      importance?: number;
    }>();

    if (!body.title?.trim() || !body.content) {
      return c.json({ error: "title and content are required" }, 400);
    }

    const memory = await addMemory(session.user, session.projectId, {
      title: body.title.trim(),
      content: body.content,
      type: body.type ?? "NOTE",
      tags: body.tags ?? [],
      importance: body.importance ?? 1,
    });

    return c.json({ memoryId: memory.id }, 201);
  });

  app.patch("/api/memories/:id/review", async (c) => {
    const session = await resolveRestSession(c.req.raw.headers);
    const body = await c.req.json<{
      status?: "ARCHIVED" | "TRASH";
      note?: string;
    }>();
    if (!body.status) {
      return c.json({ error: "status is required" }, 400);
    }
    const memory = await reviewMemory(
      session.user,
      c.req.param("id"),
      body.status,
      body.note,
    );
    return c.json(memory);
  });

  app.delete("/api/memories/:id", async (c) => {
    const session = await resolveRestSession(c.req.raw.headers);
    await deleteMemory(session.user, c.req.param("id"));
    return c.body(null, 204);
  });
}
