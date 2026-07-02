import { apiFetch } from "./client";
import type { Project, ProjectMember, ProjectRole } from "./types";

export async function fetchProjects(searchTerm = ""): Promise<Project[]> {
  const query = searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : "";
  return apiFetch<Project[]>(`/api/projects${query}`);
}

export async function deleteProject(projectId: string): Promise<void> {
  await apiFetch<void>(`/api/projects/${projectId}`, { method: "DELETE" });
}

export async function createProject(input: {
  name: string;
  description?: string;
}): Promise<Project> {
  return apiFetch<Project>("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchProjectMembers(
  projectId: string,
): Promise<ProjectMember[]> {
  return apiFetch<ProjectMember[]>(`/api/projects/${projectId}/members`);
}

export async function addProjectMember(
  projectId: string,
  userId: string,
  role: Extract<ProjectRole, "ADMIN" | "MEMBER">,
): Promise<ProjectMember> {
  return apiFetch<ProjectMember>(`/api/projects/${projectId}/members`, {
    method: "POST",
    body: JSON.stringify({ userId, role }),
  });
}

export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  role: Extract<ProjectRole, "ADMIN" | "MEMBER">,
): Promise<ProjectMember> {
  return apiFetch<ProjectMember>(
    `/api/projects/${projectId}/members/${userId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ role }),
    },
  );
}

export async function removeProjectMember(
  projectId: string,
  userId: string,
): Promise<void> {
  await apiFetch<void>(`/api/projects/${projectId}/members/${userId}`, {
    method: "DELETE",
  });
}

export async function transferProjectOwnership(
  projectId: string,
  userId: string,
): Promise<ProjectMember> {
  return apiFetch<ProjectMember>(
    `/api/projects/${projectId}/transfer-ownership`,
    {
      method: "POST",
      body: JSON.stringify({ userId }),
    },
  );
}

export function projectRoleLabel(role: ProjectRole): string {
  switch (role) {
    case "OWNER":
      return "拥有者";
    case "ADMIN":
      return "项目管理员";
    case "MEMBER":
      return "项目成员";
    default:
      return role;
  }
}
