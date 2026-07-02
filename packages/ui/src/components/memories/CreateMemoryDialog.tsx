"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CreateMemoryDialog({ projectId }: { projectId: string }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button>创建记忆</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建记忆</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          记忆创建表单将在接入 MCP 管理 API 后实现（项目 ID: {projectId}）。
        </p>
      </DialogContent>
    </Dialog>
  );
}
