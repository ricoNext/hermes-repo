"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memoryTitle: string;
  action: "archive" | "trash";
  onConfirm: (note?: string) => void;
}

export function ReviewDialog({
  open,
  onOpenChange,
  memoryTitle,
  action,
  onConfirm,
}: ReviewDialogProps) {
  const [note, setNote] = useState("");

  const handleConfirm = () => {
    onConfirm(note.trim() || undefined);
    setNote("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action === "archive" ? "归档记忆" : "拒绝记忆"}
          </DialogTitle>
          <DialogDescription>
            {action === "archive"
              ? "将此记忆归档为团队知识库"
              : "将此记忆移入垃圾桶"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>记忆标题</Label>
            <p className="text-sm text-muted-foreground">{memoryTitle}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">审核备注（可选）</Label>
            <Textarea
              id="note"
              placeholder={
                action === "archive"
                  ? "例如：符合团队规范，内容完整"
                  : "例如：内容不符合团队标准"
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant={action === "archive" ? "default" : "destructive"}
            onClick={handleConfirm}
          >
            确认{action === "archive" ? "归档" : "拒绝"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
