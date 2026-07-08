import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, Edit, Eye, Trash2, XCircle } from "lucide-react";
import type { Memory } from "@/lib/api/types";

interface MemoryCardProps {
  memory: Memory;
  onArchive?: () => void;
  onTrash?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onPreview?: () => void;
  readonly?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
}

function getStatusBadge(status: Memory["status"]) {
  switch (status) {
    case "PENDING":
      return { label: "待审核", className: "bg-amber-100 text-amber-800 border-amber-200" };
    case "ARCHIVED":
      return { label: "已归档", className: "bg-green-100 text-green-800 border-green-200" };
    case "TRASH":
      return { label: "垃圾桶", className: "bg-stone-200 text-stone-700 border-stone-300" };
  }
}

function getTypeBadge(type: Memory["type"]) {
  switch (type) {
    case "NOTE":
      return { label: "笔记", className: "bg-blue-100 text-blue-800 border-blue-200" };
    case "CONTEXT":
      return { label: "上下文", className: "bg-purple-100 text-purple-800 border-purple-200" };
    case "PREFERENCE":
      return { label: "偏好", className: "bg-pink-100 text-pink-800 border-pink-200" };
    case "SNIPPET":
      return { label: "代码片段", className: "bg-indigo-100 text-indigo-800 border-indigo-200" };
  }
}

export function MemoryCard({
  memory,
  onArchive,
  onTrash,
  onDelete,
  onEdit,
  onPreview,
  readonly,
  selectable,
  selected,
  onSelect,
}: MemoryCardProps) {
  const statusBadge = getStatusBadge(memory.status);
  const typeBadge = getTypeBadge(memory.type);

  return (
    <Card className="border-stone-200 bg-white shadow-sm transition-all hover:border-stone-300 hover:shadow-md">
      <CardHeader>
        <div className="flex items-start gap-4">
          {selectable && onSelect && (
            <Checkbox
              checked={selected}
              onCheckedChange={onSelect}
              className="mt-1 border-stone-300 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
            />
          )}

          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg font-semibold text-stone-900">{memory.title}</CardTitle>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
              <Badge className={typeBadge.className}>{typeBadge.label}</Badge>
              <Badge className="border-stone-200 bg-stone-100 text-stone-700">
                重要性 {memory.importance}
              </Badge>
              {memory.tags && memory.tags.length > 0 && (
                <>
                  {memory.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} className="border-stone-200 bg-white text-stone-600 text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {memory.tags.length > 3 && (
                    <Badge className="border-stone-200 bg-white text-stone-500 text-xs">
                      +{memory.tags.length - 3}
                    </Badge>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {onPreview && (
              <Button size="sm" variant="ghost" onClick={onPreview} className="text-stone-600 hover:text-stone-900 hover:bg-stone-100">
                <Eye className="h-4 w-4" />
              </Button>
            )}

            {onEdit && (
              <Button size="sm" variant="ghost" onClick={onEdit} className="text-stone-600 hover:text-stone-900 hover:bg-stone-100">
                <Edit className="h-4 w-4" />
              </Button>
            )}

            {!readonly && onArchive && (
              <Button size="sm" onClick={onArchive} className="bg-gradient-to-r from-green-500 to-green-600 text-white shadow-sm hover:from-green-600 hover:to-green-700">
                <CheckCircle className="mr-1.5 h-4 w-4" />
                归档
              </Button>
            )}

            {!readonly && onTrash && (
              <Button size="sm" variant="outline" onClick={onTrash} className="border-stone-200 text-stone-700 hover:bg-stone-50">
                <XCircle className="mr-1.5 h-4 w-4" />
                拒绝
              </Button>
            )}

            {!readonly && onDelete && (
              <Button size="sm" variant="destructive" onClick={onDelete} className="bg-red-600 text-white hover:bg-red-700">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <p className="mb-4 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">
          {memory.content}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7 ring-2 ring-stone-100">
              <AvatarImage src={memory.author.avatarUrl} />
              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-xs font-semibold text-white">
                {memory.author.name[0]}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-stone-700">
              {memory.author.name}
            </span>
          </div>
          <span className="text-xs text-stone-500">
            {new Date(memory.createdAt).toLocaleDateString('zh-CN')}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
