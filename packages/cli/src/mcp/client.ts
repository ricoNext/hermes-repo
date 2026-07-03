import type { TeamMemory } from './types.js';

export interface MCPClient {
  addMemory(input: {
    title: string;
    content: string;
    type: string;
    tags: string[];
    importance: number;
  }): Promise<{ memoryId: string }>;

  searchMemories(params: {
    status?: string;
    type?: string;
    query?: string;
  }): Promise<TeamMemory[]>;
}

export function createMCPClient(config: {
  endpoint: string;
  projectId: string;
  apiKey: string;
  timeout: number;
}): MCPClient {
  const headers = {
    'Authorization': `Bearer ${config.apiKey}`,
    'X-Project-Id': config.projectId,
    'Content-Type': 'application/json',
  };

  return {
    async addMemory(input) {
      const res = await fetch(`${config.endpoint}/api/memories`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(config.timeout),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`MCP API error: ${res.status} ${text}`);
      }

      return res.json();
    },

    async searchMemories(params) {
      const query = new URLSearchParams();
      if (params.status) query.set('status', params.status);
      if (params.type) query.set('type', params.type);
      if (params.query) query.set('q', params.query);

      const res = await fetch(
        `${config.endpoint}/api/memories?${query}`,
        {
          headers,
          signal: AbortSignal.timeout(config.timeout),
        }
      );

      if (!res.ok) {
        throw new Error(`MCP API error: ${res.status}`);
      }

      return res.json();
    },
  };
}
