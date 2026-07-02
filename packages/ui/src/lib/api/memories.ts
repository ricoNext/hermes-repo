import { apiFetch } from "./client";
import type { Memory, SearchMemoriesParams, Visibility } from "./types";

export async function searchMemories(
  projectId: string,
  params: SearchMemoriesParams = {},
): Promise<Memory[]> {
  const search = new URLSearchParams();
  if (params.query) search.set("q", params.query);
  if (params.type) search.set("type", params.type);
  if (params.visibility) search.set("visibility", params.visibility);

  const query = search.toString();
  return apiFetch<Memory[]>(`/api/memories${query ? `?${query}` : ""}`, {
    projectId,
  });
}

export async function promoteMemory(
  projectId: string,
  memoryId: string,
  newVisibility: Visibility,
): Promise<void> {
  await apiFetch<void>(`/api/memories/${memoryId}/visibility`, {
    method: "PATCH",
    body: JSON.stringify({ visibility: newVisibility }),
    projectId,
  });
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
