import type { SystemRole } from "@prisma/client";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { generateToken, type AuthUser } from "../auth.js";
import { prisma } from "../db.js";
import { HttpError } from "../http-error.js";
import { isUserManager } from "../permissions.js";

export interface UserView {
  id: string;
  username: string;
  email: string | null;
  name: string;
  systemRole: SystemRole;
  avatarUrl: string | null;
  createdAt: string;
}

function toUserView(user: {
  id: string;
  username: string;
  email: string | null;
  name: string;
  systemRole: SystemRole;
  avatarUrl: string | null;
  createdAt: Date;
}): UserView {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    systemRole: user.systemRole,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toAuthUser(user: {
  id: string;
  username: string;
  email: string | null;
  name: string;
  systemRole: SystemRole;
}): AuthUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    systemRole: user.systemRole,
  };
}

export async function loginWithPassword(
  username: string,
  password: string,
): Promise<{ token: string; user: UserView } | null> {
  const user = await prisma.user.findUnique({
    where: { username: username.trim() },
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return null;
  }

  return {
    token: generateToken(toAuthUser(user)),
    user: toUserView(user),
  };
}

export async function listUsers(): Promise<UserView[]> {
  const users = await prisma.user.findMany({
    orderBy: [{ systemRole: "asc" }, { createdAt: "asc" }],
  });
  return users.map(toUserView);
}

export interface CreateUserInput {
  username: string;
  name: string;
  password: string;
  email?: string | null;
  systemRole?: SystemRole;
}

export async function createUser(
  actor: AuthUser,
  input: CreateUserInput,
): Promise<UserView> {
  if (!isUserManager(actor)) {
    throw new HttpError(403, "无权创建用户，需要管理员或超管权限");
  }

  const username = input.username.trim();
  if (!username) {
    throw new HttpError(400, "用户名不能为空");
  }
  if (!input.name.trim()) {
    throw new HttpError(400, "姓名不能为空");
  }
  if (input.password.length < 6) {
    throw new HttpError(400, "密码长度至少 6 位");
  }

  const requestedRole = input.systemRole ?? "MEMBER";
  if (requestedRole === "SUPER_ADMIN" && actor.systemRole !== "SUPER_ADMIN") {
    throw new HttpError(403, "仅超管可以创建超管账号");
  }

  const email = input.email?.trim() || null;

  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (existing) {
    throw new HttpError(409, "用户名已存在");
  }

  if (email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingEmail) {
      throw new HttpError(409, "邮箱已被使用");
    }
  }

  const user = await prisma.user.create({
    data: {
      username,
      name: input.name.trim(),
      email,
      passwordHash: hashPassword(input.password),
      systemRole: requestedRole,
    },
  });

  return toUserView(user);
}

export async function getUserById(userId: string): Promise<UserView | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user ? toUserView(user) : null;
}
