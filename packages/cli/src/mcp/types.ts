export interface MCPConfig {
  enabled: boolean;
  endpoint: string;
  projectId: string;
  apiKey: string;
  sync: {
    mode: 'auto' | 'manual' | 'off';
    onFlush: {
      push: boolean;
      pull: boolean;
    };
    retries: number;
    timeout: number;
  };
  deduplication: {
    enabled: boolean;
    strategy: 'team-first' | 'keep-both';
    similarityThreshold: number;
  };
}

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
