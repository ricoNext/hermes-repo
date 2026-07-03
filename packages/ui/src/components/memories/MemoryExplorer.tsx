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
  const [activeTab, setActiveTab] = useState<MemoryStatus>("PENDING");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<Set<string>>(new Set());

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

  const showBatchActions = selectedMemoryIds.size > 0 && activeTab === "PENDING";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold">团队记忆管理</h2>

        {showBatchActions && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              已选择 {selectedMemoryIds.size} 条
            </span>
            <Button
              size="sm"
              variant="default"
              onClick={handleBatchArchive}
              disabled={batchReviewMutation.isPending}
            >
              <CheckCircle className="mr-1 h-4 w-4" />
              批量归档
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBatchTrash}
              disabled={batchReviewMutation.isPending}
            >
              <XCircle className="mr-1 h-4 w-4" />
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="PENDING">
            待审核
            {memories && activeTab === "PENDING" && (
              <span className="ml-2 text-xs text-muted-foreground">
                ({memories.length})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="ARCHIVED">
            已归档
            {memories && activeTab === "ARCHIVED" && (
              <span className="ml-2 text-xs text-muted-foreground">
                ({memories.length})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="TRASH">
            垃圾桶
            {memories && activeTab === "TRASH" && (
              <span className="ml-2 text-xs text-muted-foreground">
                ({memories.length})
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
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
        </div>

        <TabsContent value="PENDING" className="mt-4">
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
            <div className="space-y-4">
              {memories && memories.length > 0 && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedMemoryIds.size === memories.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-muted-foreground">全选</span>
                </div>
              )}

              {memories && memories.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无待审核记忆</p>
              ) : null}
              <div className="grid gap-4">
                {memories?.map((memory) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    selectable
                    selected={selectedMemoryIds.has(memory.id)}
                    onSelect={(selected) => handleSelectMemory(memory.id, selected)}
                    onPreview={() => setPreviewDialog({ open: true, memory })}
                    onEdit={() => setEditDialog({ open: true, memory })}
                    onArchive={() =>
                      setReviewDialog({
                        open: true,
                        memoryId: memory.id,
                        memoryTitle: memory.title,
                        action: "archive",
                      })
                    }
                    onTrash={() =>
                      setReviewDialog({
                        open: true,
                        memoryId: memory.id,
                        memoryTitle: memory.title,
                        action: "trash",
                      })
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="ARCHIVED" className="mt-4">
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
            <div className="space-y-4">
              {memories && memories.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无已归档记忆</p>
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

        <TabsContent value="TRASH" className="mt-4">
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
            <div className="space-y-4">
              {memories && memories.length === 0 ? (
                <p className="text-sm text-muted-foreground">垃圾桶为空</p>
              ) : null}
              <div className="grid gap-4">
                {memories?.map((memory) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    onPreview={() => setPreviewDialog({ open: true, memory })}
                    onDelete={() => deleteMutation.mutate(memory.id)}
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
