import { apiFetch } from "./client";
import type { Memory, MemoryStatus, SearchMemoriesParams } from "./types";

export async function searchMemories(
  projectId: string,
  params: SearchMemoriesParams = {},
): Promise<Memory[]> {
  const search = new URLSearchParams();
  if (params.query) search.set("q", params.query);
  if (params.type) search.set("type", params.type);
  if (params.status) search.set("status", params.status);

  const query = search.toString();
  return apiFetch<Memory[]>(`/api/memories${query ? `?${query}` : ""}`, {
    projectId,
  });
}

export async function updateMemory(
  projectId: string,
  memoryId: string,
  updates: Partial<Memory>,
): Promise<Memory> {
  return apiFetch<Memory>(`/api/memories/${memoryId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
    projectId,
  });
}

export async function reviewMemory(
  projectId: string,
  memoryId: string,
  status: "ARCHIVED" | "TRASH",
  note?: string,
): Promise<void> {
  await apiFetch<void>(`/api/memories/${memoryId}/review`, {
    method: "PATCH",
    body: JSON.stringify({ status, note }),
    projectId,
  });
}

export async function batchReviewMemories(
  projectId: string,
  memoryIds: string[],
  status: "ARCHIVED" | "TRASH",
  note?: string,
): Promise<void> {
  await Promise.all(
    memoryIds.map((id) => reviewMemory(projectId, id, status, note))
  );
}

export async function deleteMemory(
  projectId: string,
  memoryId: string,
): Promise<void> {
  await apiFetch<void>(`/api/memories/${memoryId}`, {
    method: "DELETE",
    projectId,
  });
}
