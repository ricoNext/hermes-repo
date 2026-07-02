"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import {
  deleteMemory,
  promoteMemory,
  searchMemories,
} from "@/lib/api/memories";
import { useAuthStore } from "@/lib/auth/store";
import type { MemoryType, Visibility } from "@/lib/api/types";
import { CreateMemoryDialog } from "./CreateMemoryDialog";
import { MemoryCard } from "./MemoryCard";

interface MemoryExplorerProps {
  projectId: string;
}

export function MemoryExplorer({ projectId }: MemoryExplorerProps) {
  const token = useAuthStore((state) => state.token);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: memories, isLoading, isError, error } = useQuery({
    queryKey: [
      "memories",
      projectId,
      searchQuery,
      typeFilter,
      visibilityFilter,
    ],
    queryFn: () =>
      searchMemories(projectId, {
        query: searchQuery || undefined,
        type: typeFilter === "all" ? undefined : (typeFilter as MemoryType),
        visibility:
          visibilityFilter === "all"
            ? undefined
            : (visibilityFilter as Visibility),
      }),
    enabled: Boolean(token && projectId),
  });

  const promoteMutation = useMutation({
    mutationFn: ({
      memoryId,
      newVisibility,
    }: {
      memoryId: string;
      newVisibility: Visibility;
    }) => promoteMemory(projectId, memoryId, newVisibility),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories", projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (memoryId: string) => deleteMemory(projectId, memoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories", projectId] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">项目记忆</h2>
        <CreateMemoryDialog projectId={projectId} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="搜索记忆..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        <Select
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value ?? "all")}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有类型</SelectItem>
            <SelectItem value="NOTE">笔记</SelectItem>
            <SelectItem value="CONTEXT">上下文</SelectItem>
            <SelectItem value="PREFERENCE">偏好</SelectItem>
            <SelectItem value="SNIPPET">代码片段</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={visibilityFilter}
          onValueChange={(value) => setVisibilityFilter(value ?? "all")}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="可见性" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有可见性</SelectItem>
            <SelectItem value="PRIVATE">私有</SelectItem>
            <SelectItem value="SHARED">项目共享</SelectItem>
            <SelectItem value="PUBLIC">公开</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <div>加载中...</div> : null}
      {isError ? (
        <p className="text-sm text-destructive">
          {error instanceof ApiError
            ? error.status === 401
              ? "登录已过期，请重新登录"
              : error.status === 0
                ? error.message
                : `请求失败（${error.status}）：${error.message}`
            : "加载记忆失败，请稍后重试"}
        </p>
      ) : null}

      {!isLoading && !isError ? (
        <div className="grid gap-4">
          {memories?.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无记忆</p>
          ) : null}
          {memories?.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onPromote={(newVisibility) =>
                promoteMutation.mutate({ memoryId: memory.id, newVisibility })
              }
              onDelete={() => deleteMutation.mutate(memory.id)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
