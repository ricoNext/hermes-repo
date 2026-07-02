import type { Role } from "@prisma/client";
import type { AuthUser } from "../auth.js";
import { HttpError } from "../http-error.js";
import { prisma } from "../db.js";
import {
  checkProjectPermission,
  isUserManager,
} from "../permissions.js";

export interface ProjectMemberView {
  userId: string;
  username: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  systemRole: string;
  role: Role;
  createdAt: string;
}

export interface UserProjectMembershipView {
  projectId: string;
  projectName: string;
  role: Role;
  createdAt: string;
}

function toMemberView(
  role: {
    id: string;
    role: Role;
    createdAt: Date;
    user: {
      id: string;
      username: string;
      name: string;
      email: string | null;
      avatarUrl: string | null;
      systemRole: string;
    };
  },
): ProjectMemberView {
  return {
    userId: role.user.id,
    username: role.user.username,
    name: role.user.name,
    email: role.user.email,
    avatarUrl: role.user.avatarUrl,
    systemRole: role.user.systemRole,
    role: role.role,
    createdAt: role.createdAt.toISOString(),
  };
}

async function ensureProjectExists(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) {
    throw new HttpError(404, "项目不存在");
  }
}

export async function listProjectMembers(
  user: AuthUser,
  projectId: string,
): Promise<ProjectMemberView[]> {
  await ensureProjectExists(projectId);

  const allowed =
    isUserManager(user) ||
    (await checkProjectPermission(user, projectId, "read"));
  if (!allowed) {
    throw new HttpError(403, "无权限查看此项目成员");
  }

  const roles = await prisma.projectRole.findMany({
    where: { projectId },
    include: { user: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return roles.map(toMemberView);
}

export async function addProjectMember(
  user: AuthUser,
  projectId: string,
  targetUserId: string,
  role: Role,
): Promise<ProjectMemberView> {
  if (!isUserManager(user)) {
    throw new HttpError(403, "仅管理员或超管可设置项目成员");
  }

  await ensureProjectExists(projectId);

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });
  if (!targetUser) {
    throw new HttpError(404, "用户不存在");
  }

  if (role === "OWNER") {
    throw new HttpError(400, "不能直接添加 OWNER 角色");
  }

  const existing = await prisma.projectRole.findUnique({
    where: {
      userId_projectId: { userId: targetUserId, projectId },
    },
  });
  if (existing) {
    throw new HttpError(409, "该用户已是项目成员");
  }

  const created = await prisma.projectRole.create({
    data: { userId: targetUserId, projectId, role },
    include: { user: true },
  });

  return toMemberView(created);
}

export async function updateProjectMemberRole(
  user: AuthUser,
  projectId: string,
  targetUserId: string,
  role: Role,
): Promise<ProjectMemberView> {
  if (!isUserManager(user)) {
    throw new HttpError(403, "仅管理员或超管可设置项目成员");
  }

  await ensureProjectExists(projectId);

  const existing = await prisma.projectRole.findUnique({
    where: {
      userId_projectId: { userId: targetUserId, projectId },
    },
    include: { user: true },
  });
  if (!existing) {
    throw new HttpError(404, "该用户不是项目成员");
  }

  if (existing.role === "OWNER") {
    throw new HttpError(400, "不能修改 OWNER 角色");
  }
  if (role === "OWNER") {
    throw new HttpError(400, "不能将成员提升为 OWNER");
  }

  const updated = await prisma.projectRole.update({
    where: {
      userId_projectId: { userId: targetUserId, projectId },
    },
    data: { role },
    include: { user: true },
  });

  return toMemberView(updated);
}

export async function removeProjectMember(
  user: AuthUser,
  projectId: string,
  targetUserId: string,
): Promise<void> {
  if (!isUserManager(user)) {
    throw new HttpError(403, "仅管理员或超管可设置项目成员");
  }

  await ensureProjectExists(projectId);

  const existing = await prisma.projectRole.findUnique({
    where: {
      userId_projectId: { userId: targetUserId, projectId },
    },
  });
  if (!existing) {
    throw new HttpError(404, "该用户不是项目成员");
  }

  if (existing.role === "OWNER") {
    throw new HttpError(400, "不能移除项目 OWNER");
  }

  await prisma.projectRole.delete({
    where: {
      userId_projectId: { userId: targetUserId, projectId },
    },
  });
}

export async function transferProjectOwnership(
  user: AuthUser,
  projectId: string,
  targetUserId: string,
): Promise<ProjectMemberView> {
  await ensureProjectExists(projectId);

  const canTransfer =
    isUserManager(user) ||
    (await checkProjectPermission(user, projectId, "admin"));
  if (!canTransfer) {
    throw new HttpError(403, "无权限转让项目拥有权");
  }

  if (user.id === targetUserId) {
    throw new HttpError(400, "不能将拥有权转让给自己");
  }

  const currentOwner = await prisma.projectRole.findFirst({
    where: { projectId, role: "OWNER" },
  });
  if (!currentOwner) {
    throw new HttpError(500, "项目缺少拥有者");
  }

  const targetRole = await prisma.projectRole.findUnique({
    where: {
      userId_projectId: { userId: targetUserId, projectId },
    },
    include: { user: true },
  });
  if (!targetRole) {
    throw new HttpError(404, "目标用户不是项目成员");
  }
  if (targetRole.role === "OWNER") {
    throw new HttpError(400, "该用户已是项目拥有者");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.projectRole.update({
      where: {
        userId_projectId: { userId: currentOwner.userId, projectId },
      },
      data: { role: "ADMIN" },
    });
    return tx.projectRole.update({
      where: {
        userId_projectId: { userId: targetUserId, projectId },
      },
      data: { role: "OWNER" },
      include: { user: true },
    });
  });

  return toMemberView(updated);
}

export async function listUserProjectMemberships(
  actor: AuthUser,
  targetUserId: string,
): Promise<UserProjectMembershipView[]> {
  if (!isUserManager(actor)) {
    throw new HttpError(403, "无权查看用户项目关联");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });
  if (!targetUser) {
    throw new HttpError(404, "用户不存在");
  }

  const roles = await prisma.projectRole.findMany({
    where: { userId: targetUserId },
    include: { project: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return roles.map((role) => ({
    projectId: role.projectId,
    projectName: role.project.name,
    role: role.role,
    createdAt: role.createdAt.toISOString(),
  }));
}
