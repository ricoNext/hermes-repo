import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye, Lock, MoreVertical, Trash2, Unlock } from "lucide-react";
import type { Memory, Visibility } from "@/lib/api/types";

interface MemoryCardProps {
  memory: Memory;
  onPromote: (newVisibility: Visibility) => void;
  onDelete: () => void;
}

function getVisibilityIcon(visibility: Memory["visibility"]) {
  switch (visibility) {
    case "PRIVATE":
      return <Lock className="h-4 w-4" />;
    case "SHARED":
      return <Unlock className="h-4 w-4" />;
    case "PUBLIC":
      return <Eye className="h-4 w-4" />;
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

export function MemoryCard({ memory, onPromote, onDelete }: MemoryCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {getVisibilityIcon(memory.visibility)}
            <CardTitle className="text-lg">{memory.title}</CardTitle>
            <Badge variant={getTypeVariant(memory.type)}>{memory.type}</Badge>
            <Badge variant="outline">重要性: {memory.importance}</Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {memory.visibility === "PRIVATE" ? (
                <>
                  <DropdownMenuItem onClick={() => onPromote("SHARED")}>
                    <Eye className="mr-2 h-4 w-4" />
                    升级为项目共享
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPromote("PUBLIC")}>
                    <Eye className="mr-2 h-4 w-4" />
                    升级为公开
                  </DropdownMenuItem>
                </>
              ) : null}
              {memory.visibility === "SHARED" ? (
                <DropdownMenuItem onClick={() => onPromote("PUBLIC")}>
                  <Eye className="mr-2 h-4 w-4" />
                  升级为公开
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">{memory.content}</p>
        <div className="flex items-center justify-between">
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
            {new Date(memory.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
