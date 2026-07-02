export type MemoryType = "NOTE" | "CONTEXT" | "PREFERENCE" | "SNIPPET";
export type Visibility = "PRIVATE" | "SHARED" | "PUBLIC";
export type SystemRole = "SUPER_ADMIN" | "ADMIN" | "MEMBER";
export type ProjectRole = "OWNER" | "ADMIN" | "MEMBER";

export interface User {
  id: string;
  username: string;
  email: string | null;
  name: string;
  systemRole: SystemRole;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
}

export interface ProjectMember {
  userId: string;
  username: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  systemRole: SystemRole;
  role: ProjectRole;
  createdAt: string;
}

export interface UserProjectMembership {
  projectId: string;
  projectName: string;
  role: ProjectRole;
  createdAt: string;
}

export interface MemoryAuthor {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface Memory {
  id: string;
  title: string;
  content: string;
  type: MemoryType;
  visibility: Visibility;
  importance: number;
  author: MemoryAuthor;
  createdAt: string;
  updatedAt: string;
}

export interface SearchMemoriesParams {
  query?: string;
  type?: MemoryType;
  visibility?: Visibility;
}
