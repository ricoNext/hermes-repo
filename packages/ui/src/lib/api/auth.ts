import { apiFetch } from "./client";
import type { SystemRole, User } from "./types";

export interface LoginResponse {
  token: string;
  user: User;
}

export interface CreateUserPayload {
  username: string;
  name: string;
  password: string;
  email?: string;
  systemRole?: SystemRole;
}

export async function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
    skipAuth: true,
  });
}

export async function fetchCurrentUser(): Promise<User> {
  return apiFetch<User>("/api/auth/me");
}

export async function fetchUsers(): Promise<User[]> {
  return apiFetch<User[]>("/api/users");
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  return apiFetch<User>("/api/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function systemRoleLabel(role: SystemRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "超管";
    case "ADMIN":
      return "管理员";
    case "MEMBER":
      return "项目成员";
    default:
      return role;
  }
}
