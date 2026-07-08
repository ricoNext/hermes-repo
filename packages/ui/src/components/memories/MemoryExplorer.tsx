"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ApiError } from "@/lib/api/client";
import {
  batchReviewMemories,
  deleteMemory,
  reviewMemory,
  searchMemories,
  updateMemory,
} from "@/lib/api/memories";
import { canManageMemories } from "@/lib/auth/permissions";
import { useAuthStore } from "@/lib/auth/store";
import type { Memory, MemoryStatus, MemoryType } from "@/lib/api/types";
import { MemoryCard } from "./MemoryCard";
import { ReviewDialog } from "./ReviewDialog";
import { EditMemoryDialog } from "./EditMemoryDialog";
import { MemoryPreviewDialog } from "./MemoryPreviewDialog";
import { CheckCircle, XCircle } from "lucide-react";

interface MemoryExplorerProps {
  projectId: string;
}

export function MemoryExplorer({ projectId }: MemoryExplorerProps) {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<MemoryStatus>("PENDING");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<Set<string>>(new Set());

  // 权限控制：只有超管和管理员可以管理记忆
  const canManage = canManageMemories(currentUser?.systemRole);

  // Dialogs
  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    memoryId: string;
    memoryTitle: string;
    action: "archive" | "trash";
  } | null>(null);
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    memory: Memory;
  } | null>(null);
  const [previewDialog, setPreviewDialog] = useState<{
    open: boolean;
    memory: Memory;
  } | null>(null);

  const queryClient = useQueryClient();

  const { data: memories, isLoading, isError, error } = useQuery({
    queryKey: ["memories", projectId, activeTab, searchQuery, typeFilter],
    queryFn: () =>
      searchMemories(projectId, {
        status: activeTab,
        query: searchQuery || undefined,
        type: typeFilter === "all" ? undefined : (typeFilter as MemoryType),
      }),
    enabled: Boolean(token && projectId),
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      memoryId,
      status,
      note,
    }: {
      memoryId: string;
      status: "ARCHIVED" | "TRASH";
      note?: string;
    }) => reviewMemory(projectId, memoryId, status, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories", projectId] });
      setSelectedMemoryIds(new Set());
    },
  });

  const batchReviewMutation = useMutation({
    mutationFn: ({
      memoryIds,
      status,
      note,
    }: {
      memoryIds: string[];
      status: "ARCHIVED" | "TRASH";
      note?: string;
    }) => batchReviewMemories(projectId, memoryIds, status, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories", projectId] });
      setSelectedMemoryIds(new Set());
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      memoryId,
      updates,
    }: {
      memoryId: string;
      updates: Partial<Memory>;
    }) => updateMemory(projectId, memoryId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories", projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (memoryId: string) => deleteMemory(projectId, memoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories", projectId] });
      setSelectedMemoryIds(new Set());
    },
  });

  const handleSelectMemory = (memoryId: string, selected: boolean) => {
    const newSet = new Set(selectedMemoryIds);
    if (selected) {
      newSet.add(memoryId);
    } else {
      newSet.delete(memoryId);
    }
    setSelectedMemoryIds(newSet);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected && memories) {
      setSelectedMemoryIds(new Set(memories.map((m) => m.id)));
    } else {
      setSelectedMemoryIds(new Set());
    }
  };

  const handleBatchArchive = () => {
    if (selectedMemoryIds.size > 0) {
      batchReviewMutation.mutate({
        memoryIds: Array.from(selectedMemoryIds),
        status: "ARCHIVED",
      });
    }
  };

  const handleBatchTrash = () => {
    if (selectedMemoryIds.size > 0) {
      batchReviewMutation.mutate({
        memoryIds: Array.from(selectedMemoryIds),
        status: "TRASH",
      });
    }
  };

  const showBatchActions = canManage && selectedMemoryIds.size > 0 && activeTab === "PENDING";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-stone-900">团队记忆管理</h2>
          <p className="mt-1 text-sm text-stone-500">审核、归档和管理团队记忆</p>
        </div>

        {showBatchActions && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-stone-600">
              已选择 {selectedMemoryIds.size} 条
            </span>
            <Button
              size="sm"
              className="bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md hover:from-green-600 hover:to-green-700"
              onClick={handleBatchArchive}
              disabled={batchReviewMutation.isPending}
            >
              <CheckCircle className="mr-1.5 h-4 w-4" />
              批量归档
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-stone-200 text-stone-700 hover:bg-stone-50"
              onClick={handleBatchTrash}
              disabled={batchReviewMutation.isPending}
            >
              <XCircle className="mr-1.5 h-4 w-4" />
              批量拒绝
            </Button>
          </div>
        )}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as MemoryStatus);
          setSelectedMemoryIds(new Set());
        }}
      >
        <TabsList className="grid w-full grid-cols-3 bg-stone-100 p-1">
          <TabsTrigger
            value="PENDING"
            className="data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm"
          >
            待审核
            {memories && activeTab === "PENDING" && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                {memories.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="ARCHIVED"
            className="data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm"
          >
            已归档
            {memories && activeTab === "ARCHIVED" && (
              <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                {memories.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="TRASH"
            className="data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm"
          >
            垃圾桶
            {memories && activeTab === "TRASH" && (
              <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-700">
                {memories.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="搜索记忆标题或内容..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 border-stone-200 bg-white shadow-sm"
          />
          <Select
            value={typeFilter}
            onValueChange={(value) => setTypeFilter(value ?? "all")}
          >
            <SelectTrigger className="w-full border-stone-200 bg-white shadow-sm sm:w-[180px]">
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
        </div>

        <TabsContent value="PENDING" className="mt-6">
          {isLoading ? <div className="text-sm text-stone-600">加载中...</div> : null}
          {isError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="font-medium text-red-900">
                {error instanceof ApiError
                  ? error.status === 401
                    ? "登录已过期"
                    : error.status === 0
                      ? error.message
                      : `请求失败（${error.status}）`
                  : "加载记忆失败"}
              </p>
              <p className="mt-1 text-sm text-red-700">
                {error instanceof ApiError && error.status === 401
                  ? "请重新登录"
                  : "请稍后重试"}
              </p>
            </div>
          ) : null}

          {!isLoading && !isError ? (
            <div className="space-y-4">
              {canManage && memories && memories.length > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 shadow-sm">
                  <input
                    type="checkbox"
                    checked={selectedMemoryIds.size === memories.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm font-medium text-stone-700">全选</span>
                </div>
              )}

              {memories && memories.length === 0 ? (
                <div className="rounded-xl border border-stone-200 bg-white p-12 text-center shadow-sm">
                  <p className="text-sm text-stone-500">暂无待审核记忆</p>
                  <p className="mt-1 text-xs text-stone-400">新的记忆将出现在这里</p>
                </div>
              ) : null}
              <div className="grid gap-4">
                {memories?.map((memory) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    selectable={canManage}
                    selected={selectedMemoryIds.has(memory.id)}
                    onSelect={(selected) => handleSelectMemory(memory.id, selected)}
                    onPreview={() => setPreviewDialog({ open: true, memory })}
                    onEdit={canManage ? () => setEditDialog({ open: true, memory }) : undefined}
                    onArchive={canManage ? () =>
                      setReviewDialog({
                        open: true,
                        memoryId: memory.id,
                        memoryTitle: memory.title,
                        action: "archive",
                      }) : undefined
                    }
                    onTrash={canManage ? () =>
                      setReviewDialog({
                        open: true,
                        memoryId: memory.id,
                        memoryTitle: memory.title,
                        action: "trash",
                      }) : undefined
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="ARCHIVED" className="mt-6">
          {isLoading ? <div className="text-sm text-stone-600">加载中...</div> : null}
          {isError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="font-medium text-red-900">
                {error instanceof ApiError
                  ? error.status === 401
                    ? "登录已过期"
                    : error.status === 0
                      ? error.message
                      : `请求失败（${error.status}）`
                  : "加载记忆失败"}
              </p>
              <p className="mt-1 text-sm text-red-700">
                {error instanceof ApiError && error.status === 401
                  ? "请重新登录"
                  : "请稍后重试"}
              </p>
            </div>
          ) : null}

          {!isLoading && !isError ? (
            <div className="space-y-4">
              {memories && memories.length === 0 ? (
                <div className="rounded-xl border border-stone-200 bg-white p-12 text-center shadow-sm">
                  <p className="text-sm text-stone-500">暂无已归档记忆</p>
                  <p className="mt-1 text-xs text-stone-400">已归档的记忆将出现在这里</p>
                </div>
              ) : null}
              <div className="grid gap-4">
                {memories?.map((memory) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    onPreview={() => setPreviewDialog({ open: true, memory })}
                    readonly
                  />
                ))}
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="TRASH" className="mt-6">
          {isLoading ? <div className="text-sm text-stone-600">加载中...</div> : null}
          {isError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="font-medium text-red-900">
                {error instanceof ApiError
                  ? error.status === 401
                    ? "登录已过期"
                    : error.status === 0
                      ? error.message
                      : `请求失败（${error.status}）`
                  : "加载记忆失败"}
              </p>
              <p className="mt-1 text-sm text-red-700">
                {error instanceof ApiError && error.status === 401
                  ? "请重新登录"
                  : "请稍后重试"}
              </p>
            </div>
          ) : null}

          {!isLoading && !isError ? (
            <div className="space-y-4">
              {memories && memories.length === 0 ? (
                <div className="rounded-xl border border-stone-200 bg-white p-12 text-center shadow-sm">
                  <p className="text-sm text-stone-500">垃圾桶为空</p>
                  <p className="mt-1 text-xs text-stone-400">被拒绝的记忆将出现在这里</p>
                </div>
              ) : null}
              <div className="grid gap-4">
                {memories?.map((memory) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    onPreview={() => setPreviewDialog({ open: true, memory })}
                    onArchive={canManage ? () =>
                      setReviewDialog({
                        open: true,
                        memoryId: memory.id,
                        memoryTitle: memory.title,
                        action: "archive",
                      }) : undefined
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      {reviewDialog && (
        <ReviewDialog
          open={reviewDialog.open}
          onOpenChange={(open) => !open && setReviewDialog(null)}
          memoryTitle={reviewDialog.memoryTitle}
          action={reviewDialog.action}
          onConfirm={(note) => {
            reviewMutation.mutate({
              memoryId: reviewDialog.memoryId,
              status: reviewDialog.action === "archive" ? "ARCHIVED" : "TRASH",
              note,
            });
            setReviewDialog(null);
          }}
        />
      )}

      {editDialog && (
        <EditMemoryDialog
          open={editDialog.open}
          onOpenChange={(open) => !open && setEditDialog(null)}
          memory={editDialog.memory}
          onSave={(updates) => {
            updateMutation.mutate({
              memoryId: editDialog.memory.id,
              updates,
            });
            setEditDialog(null);
          }}
        />
      )}

      {previewDialog && (
        <MemoryPreviewDialog
          open={previewDialog.open}
          onOpenChange={(open) => !open && setPreviewDialog(null)}
          memory={previewDialog.memory}
        />
      )}
    </div>
  );
}
