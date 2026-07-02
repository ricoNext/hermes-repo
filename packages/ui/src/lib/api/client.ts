import { getStoredToken, useAuthStore } from "@/lib/auth/store";

export function getApiBaseUrl(): string {
  // 浏览器默认走 Next.js 同源代理，避免跨域 CORS 问题
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL ?? "";
  }
  return (
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.API_PROXY_URL ??
    "http://localhost:3000"
  );
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return useAuthStore.getState().token ?? getStoredToken();
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { projectId?: string; skipAuth?: boolean },
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init?.projectId) {
    headers.set("X-Project-Id", init.projectId);
  }
  if (!init?.skipAuth && !headers.has("Authorization")) {
    const token = getAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(0, "无法连接 API，请确认 MCP 管理后端已启动");
  }

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
