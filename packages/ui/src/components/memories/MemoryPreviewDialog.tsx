"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Memory } from "@/lib/api/types";

interface MemoryPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memory: Memory;
}

function getStatusBadge(status: Memory["status"]) {
  switch (status) {
    case "PENDING":
      return { label: "待审核", variant: "secondary" as const };
    case "ARCHIVED":
      return { label: "已归档", variant: "default" as const };
    case "TRASH":
      return { label: "垃圾桶", variant: "destructive" as const };
  }
}

function getTypeVariant(type: Memory["type"]) {
  switch (type) {
    case "NOTE":
      return "default" as const;
    case "CONTEXT":
      return "secondary" as const;
    case "PREFERENCE":
      return "outline" as const;
    case "SNIPPET":
      return "destructive" as const;
  }
}

export function MemoryPreviewDialog({
  open,
  onOpenChange,
  memory,
}: MemoryPreviewDialogProps) {
  const statusBadge = getStatusBadge(memory.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{memory.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
            <Badge variant={getTypeVariant(memory.type)}>{memory.type}</Badge>
            <Badge variant="outline">重要性: {memory.importance}</Badge>
            {memory.tags && memory.tags.length > 0 && (
              <>
                {memory.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </>
            )}
          </div>

          <ScrollArea className="h-[400px] rounded-md border p-4">
            <div className="whitespace-pre-wrap text-sm">{memory.content}</div>
          </ScrollArea>

          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={memory.author.avatarUrl} />
                <AvatarFallback>{memory.author.name[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{memory.author.name}</p>
                <p className="text-xs text-muted-foreground">作者</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm">
                创建于 {new Date(memory.createdAt).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                更新于 {new Date(memory.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>关闭</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
