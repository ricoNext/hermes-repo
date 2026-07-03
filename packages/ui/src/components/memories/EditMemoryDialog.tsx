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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Memory, MemoryType } from "@/lib/api/types";

interface EditMemoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memory: Memory;
  onSave: (updates: Partial<Memory>) => void;
}

export function EditMemoryDialog({
  open,
  onOpenChange,
  memory,
  onSave,
}: EditMemoryDialogProps) {
  const [title, setTitle] = useState(memory.title);
  const [content, setContent] = useState(memory.content);
  const [type, setType] = useState<MemoryType>(memory.type);
  const [importance, setImportance] = useState(String(memory.importance));
  const [tags, setTags] = useState(memory.tags.join(", "));

  const handleSave = () => {
    onSave({
      title: title.trim(),
      content: content.trim(),
      type,
      importance: Number(importance),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>编辑记忆</DialogTitle>
          <DialogDescription>修改记忆的详细信息</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">标题</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="记忆标题"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">内容</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="记忆内容"
              rows={8}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">类型</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as MemoryType)}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOTE">笔记</SelectItem>
                  <SelectItem value="CONTEXT">上下文</SelectItem>
                  <SelectItem value="PREFERENCE">偏好</SelectItem>
                  <SelectItem value="SNIPPET">代码片段</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="importance">重要性 (1-5)</Label>
              <Input
                id="importance"
                type="number"
                min="1"
                max="5"
                value={importance}
                onChange={(e) => setImportance(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">标签（逗号分隔）</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="backend, api, typescript"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
