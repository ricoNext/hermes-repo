import jwt from "jsonwebtoken";
import type { SystemRole } from "@prisma/client";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { HttpError } from "./http-error.js";

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  name: string;
  systemRole: SystemRole;
}

export interface SessionData extends Record<string, unknown> {
  user: AuthUser;
}

export interface RestSessionData extends SessionData {
  projectId: string;
}

function toAuthUser(user: {
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

export async function authenticateToken(
  token: string | undefined,
): Promise<AuthUser | null> {
  if (config.devAuthBypass && (!token || token === "dev-token")) {
    const user =
      (await prisma.user.findUnique({ where: { username: "admin" } })) ??
      (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } }));
    if (user) {
      return toAuthUser(user);
    }
  }

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    if (!user) {
      return null;
    }
    return toAuthUser(user);
  } catch {
    return null;
  }
}

export function generateToken(user: AuthUser): string {
  return jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: "7d" });
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export function requireAuth(user: AuthUser | null): AuthUser {
  if (!user) {
    throw new HttpError(401, "未登录或登录已过期");
  }
  return user;
}

export function badRequestResponse(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}
