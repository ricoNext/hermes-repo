import type { MemoryScope } from "@prisma/client";
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
    return memory.scope === "PUBLIC" && requiredRole === "read";
  }

  switch (memory.scope) {
    case "PERSONAL":
      return false;
    case "TEAM":
      return userRole.role !== "MEMBER" || requiredRole === "read";
    case "PUBLIC":
      return true;
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
  scope: MemoryScope,
  authorId: string,
): Promise<boolean> {
  if (isSuperAdmin(user)) {
    return true;
  }

  if (authorId === user.id) {
    return true;
  }

  if (scope === "PUBLIC") {
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

  if (scope === "TEAM") {
    return true;
  }

  return false;
}
