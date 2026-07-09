export interface TeamMemory {
  id: string;
  title: string;
  content: string;
  type: string;
  tags: string[];
  importance: number;
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SyncState {
  pushed: Record<string, string>; // path -> contentHash
  lastPull: string;
}
