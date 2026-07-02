import { assertDatabaseConfigured, config } from "./config.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  assertDatabaseConfigured();

  const server = createServer();

  if (config.transport === "stdio") {
    await server.start({ transportType: "stdio" });
    return;
  }

  await server.start({
    transportType: "httpStream",
    httpStream: {
      port: config.port,
      stateless: false,
      cors: {
        origin: config.corsOrigins,
        credentials: true,
        allowedHeaders: [
          "Content-Type",
          "Authorization",
          "X-Project-Id",
          "Accept",
          "Mcp-Session-Id",
          "Mcp-Protocol-Version",
          "Last-Event-Id",
        ],
        methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      },
    },
  });

  console.log(
    `hermes-mcp-server listening on http://localhost:${config.port} (httpStream + REST API)`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
