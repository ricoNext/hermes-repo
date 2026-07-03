import type { MemoryStatus } from "@prisma/client";
import type { AuthUser } from "./auth.js";
import { prisma } from "./db.js";

export function isSuperAdmin(user: AuthUser): boolean {
  return user.systemRole === "SUPER_ADMIN";
}

export function isUserManager(user: AuthUser): boolean {
  return user.systemRole === "SUPER_ADMIN" || user.systemRole === "ADMIN";
}

export async function checkMemoryPermission(
  user: AuthUser,
  memoryId: string,
  requiredRole: "read" | "write" | "delete" = "read",
): Promise<boolean> {
  const memory = await prisma.memory.findUnique({
    where: { id: memoryId },
  });

  if (!memory) {
    return false;
  }

  if (isSuperAdmin(user)) {
    return true;
  }

  if (memory.authorId === user.id) {
    return true;
  }

  const userRole = await prisma.projectRole.findUnique({
    where: {
      userId_projectId: {
        userId: user.id,
        projectId: memory.projectId,
      },
    },
  });

  if (!userRole) {
    return false;
  }

  // 基于 status 的权限判断
  switch (memory.status) {
    case "PENDING":
      // 待审核记忆：仅管理员可操作
      return userRole.role === "ADMIN" || userRole.role === "OWNER";
    case "ARCHIVED":
      // 已归档记忆：所有项目成员可读，管理员可写
      if (requiredRole === "read") return true;
      return userRole.role === "ADMIN" || userRole.role === "OWNER";
    case "TRASH":
      // 垃圾桶记忆：仅管理员可操作
      return userRole.role === "ADMIN" || userRole.role === "OWNER";
    default:
      return false;
  }
}

export async function checkProjectPermission(
  user: AuthUser,
  projectId: string,
  requiredRole: "read" | "write" | "admin" = "read",
): Promise<boolean> {
  if (isSuperAdmin(user)) {
    return true;
  }

  const userRole = await prisma.projectRole.findUnique({
    where: {
      userId_projectId: {
        userId: user.id,
        projectId,
      },
    },
  });

  if (!userRole) {
    return false;
  }

  switch (requiredRole) {
    case "read":
      return true;
    case "write":
      return userRole.role === "ADMIN" || userRole.role === "OWNER";
    case "admin":
      return userRole.role === "OWNER";
    default:
      return false;
  }
}

export async function canReadMemoryInProject(
  user: AuthUser,
  projectId: string,
  status: MemoryStatus,
  authorId: string,
): Promise<boolean> {
  if (isSuperAdmin(user)) {
    return true;
  }

  if (authorId === user.id) {
    return true;
  }

  // 已归档记忆所有项目成员可见
  if (status === "ARCHIVED") {
    const userRole = await prisma.projectRole.findUnique({
      where: {
        userId_projectId: {
          userId: user.id,
          projectId,
        },
      },
    });
    return !!userRole;
  }

  // 待审核和垃圾桶记忆仅管理员可见
  const userRole = await prisma.projectRole.findUnique({
    where: {
      userId_projectId: {
        userId: user.id,
        projectId,
      },
    },
  });

  if (!userRole) {
    return false;
  }

  return userRole.role === "ADMIN" || userRole.role === "OWNER";
}
