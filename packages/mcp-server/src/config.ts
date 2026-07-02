export const config = {
  port: Number(process.env.PORT ?? 3000),
  transport: (process.env.MCP_TRANSPORT ?? "httpStream") as
    | "stdio"
    | "httpStream",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  devAuthBypass: process.env.DEV_AUTH_BYPASS === "true",
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
};

function parseCorsOrigins(value: string | undefined): string[] {
  const defaults = ["http://localhost:3001", "http://127.0.0.1:3001"];
  if (!value?.trim()) {
    return defaults;
  }

  const origins = value.split(",").map((item) => item.trim()).filter(Boolean);
  return origins.length > 0 ? origins : defaults;
}

export function assertDatabaseConfigured(): void {
  if (!config.databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Copy packages/mcp-server/.env.example and start PostgreSQL.",
    );
  }
}
