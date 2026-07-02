import type {
  MemoryType,
  Prisma,
  Project,
  Visibility,
} from "@prisma/client";
import type { AuthUser } from "../auth.js";
import { HttpError } from "../http-error.js";
import { prisma } from "../db.js";
import {
  canReadMemoryInProject,
  checkMemoryPermission,
  checkProjectPermission,
  isSuperAdmin,
  isUserManager,
} from "../permissions.js";

export interface CreateMemoryInput {
  title: string;
  content: string;
  type: MemoryType;
  visibility?: Visibility;
  tags?: string[];
  importance?: number;
}

export interface SearchMemoryFilters {
  type?: MemoryType;
  visibility?: Visibility;
  authorId?: string;
  minImportance?: number;
}

export interface MemoryView {
  id: string;
  title: string;
  content: string;
  type: MemoryType;
  visibility: Visibility;
  importance: number;
  tags: string[];
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

function toMemoryView(
  memory: Prisma.MemoryGetPayload<{ include: { author: true } }>,
): MemoryView {
  return {
    id: memory.id,
    title: memory.title,
    content: memory.content,
    type: memory.type,
    visibility: memory.visibility,
    importance: memory.importance,
    tags: memory.tags,
    author: {
      id: memory.author.id,
      name: memory.author.name,
      avatarUrl: memory.author.avatarUrl,
    },
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
  };
}

export async function listProjects(user: AuthUser, searchTerm = "") {
  const projects = isSuperAdmin(user)
    ? await prisma.project.findMany({ orderBy: { createdAt: "desc" } })
    : (
        await prisma.projectRole.findMany({
          where: { userId: user.id },
          include: { project: true },
        })
      ).map((role: { project: Project }) => role.project);

  if (!searchTerm.trim()) {
    return projects;
  }

  const q = searchTerm.toLowerCase();
  return projects.filter(
    (project: Project) =>
      project.name.toLowerCase().includes(q) ||
      project.description?.toLowerCase().includes(q),
  );
}

export async function createProject(
  user: AuthUser,
  input: { name: string; description?: string },
) {
  if (!isUserManager(user)) {
    throw new HttpError(403, "仅管理员或超管可创建项目");
  }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const project = await tx.project.create({
      data: {
        name: input.name,
        description: input.description,
      },
    });

    await tx.projectRole.create({
      data: {
        userId: user.id,
        projectId: project.id,
        role: "OWNER",
      },
    });

    return project;
  });
}

export async function deleteProject(user: AuthUser, projectId: string) {
  const allowed = await checkProjectPermission(user, projectId, "admin");
  if (!allowed) {
    throw new HttpError(403, "无权限删除此项目");
  }

  await prisma.project.delete({ where: { id: projectId } });
}

export async function addMemory(
  user: AuthUser,
  projectId: string,
  input: CreateMemoryInput,
) {
  const allowed = await checkProjectPermission(user, projectId, "read");
  if (!allowed) {
    throw new HttpError(403, "无权限在此项目创建记忆");
  }

  return prisma.memory.create({
    data: {
      title: input.title,
      content: input.content,
      type: input.type,
      visibility: input.visibility ?? "PRIVATE",
      tags: input.tags ?? [],
      importance: input.importance ?? 1,
      authorId: user.id,
      projectId,
    },
    include: { author: true },
  });
}

export async function searchMemories(
  user: AuthUser,
  projectId: string,
  query: string,
  filters: SearchMemoryFilters = {},
  limit = 10,
): Promise<MemoryView[]> {
  const allowed = await checkProjectPermission(user, projectId, "read");
  if (!allowed) {
    throw new HttpError(403, "无权限访问此项目");
  }

  const memories = await prisma.memory.findMany({
    where: {
      projectId,
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.visibility ? { visibility: filters.visibility } : {}),
      ...(filters.authorId ? { authorId: filters.authorId } : {}),
      ...(filters.minImportance
        ? { importance: { gte: filters.minImportance } }
        : {}),
      ...(query.trim()
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { content: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { author: true },
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });

  const visible: MemoryView[] = [];
  for (const memory of memories) {
    const canRead = await canReadMemoryInProject(
      user,
      projectId,
      memory.visibility,
      memory.authorId,
    );
    if (canRead) {
      visible.push(toMemoryView(memory));
    }
  }

  return visible;
}

export async function promoteMemory(
  user: AuthUser,
  memoryId: string,
  newVisibility: Extract<Visibility, "SHARED" | "PUBLIC">,
) {
  const memory = await prisma.memory.findUnique({ where: { id: memoryId } });
  if (!memory) {
    throw new HttpError(404, "记忆不存在");
  }

  if (memory.authorId !== user.id) {
    const allowed = await checkMemoryPermission(user, memoryId, "write");
    if (!allowed) {
      throw new HttpError(403, "无权限修改此记忆的可见性");
    }
  }

  return prisma.memory.update({
    where: { id: memoryId },
    data: { visibility: newVisibility },
    include: { author: true },
  });
}

export async function deleteMemory(user: AuthUser, memoryId: string) {
  const allowed = await checkMemoryPermission(user, memoryId, "delete");
  if (!allowed) {
    throw new HttpError(403, "无权限删除此记忆");
  }

  await prisma.memory.delete({ where: { id: memoryId } });
}
