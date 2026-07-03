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

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex items-start gap-4">
          {selectable && onSelect && (
            <Checkbox
              checked={selected}
              onCheckedChange={onSelect}
              className="mt-1"
            />
          )}

          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg">{memory.title}</CardTitle>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
              <Badge variant={getTypeVariant(memory.type)}>{memory.type}</Badge>
              <Badge variant="outline">重要性: {memory.importance}</Badge>
              {memory.tags && memory.tags.length > 0 && (
                <>
                  {memory.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {memory.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{memory.tags.length - 3}
                    </Badge>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {onPreview && (
              <Button size="sm" variant="ghost" onClick={onPreview}>
                <Eye className="h-4 w-4" />
              </Button>
            )}

            {onEdit && (
              <Button size="sm" variant="ghost" onClick={onEdit}>
                <Edit className="h-4 w-4" />
              </Button>
            )}

            {!readonly && (onArchive || onTrash) && (
              <>
                {onArchive && (
                  <Button size="sm" variant="default" onClick={onArchive}>
                    <CheckCircle className="mr-1 h-4 w-4" />
                    归档
                  </Button>
                )}
                {onTrash && (
                  <Button size="sm" variant="outline" onClick={onTrash}>
                    <XCircle className="mr-1 h-4 w-4" />
                    拒绝
                  </Button>
                )}
              </>
            )}

            {!readonly && onDelete && (
              <Button size="sm" variant="destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <p className="mb-4 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
          {memory.content}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={memory.author.avatarUrl} />
              <AvatarFallback>{memory.author.name[0]}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">
              {memory.author.name}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {new Date(memory.createdAt).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
