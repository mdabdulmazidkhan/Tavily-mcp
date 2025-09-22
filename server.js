import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

// Store active transports and servers
const transports = {};
const servers = {};
const SERVER_NAME = "My MCP Server"; // Replace with your server name

// Placeholder function to discover tools (replace with your real tools)
async function discoverTools() {
  return [];
}

// Setup server handlers
async function setupServerHandlers(server, tools) {
  for (const tool of tools) {
    server.registerTool(tool);
  }
}

// Vercel serverless function handler
export default async function handler(req, res) {
  const tools = await discoverTools();

  if (req.method === "GET") {
    // SSE endpoint
    const server = new Server(
      { name: SERVER_NAME, version: "0.1.0" },
      { capabilities: { tools: {} } }
    );

    server.onerror = (error) => console.error("[Error]", error);
    await setupServerHandlers(server, tools);

    const transport = new SSEServerTransport("/", res); // SSE on root path
    transports[transport.sessionId] = transport;
    servers[transport.sessionId] = server;

    // Cleanup when connection closes
    res.on("close", async () => {
      delete transports[transport.sessionId];
      await server.close();
      delete servers[transport.sessionId];
    });

    await server.connect(transport);
  } else if (req.method === "POST") {
    // Message handling
    const url = new URL(req.url, http://${req.headers.host});
    const sessionId = url.searchParams.get("sessionId");
    const transport = transports[sessionId];
    const server = servers[sessionId];

    if (transport && server) {
      await transport.handlePostMessage(req, res);
    } else {
      res.statusCode = 400;
      res.end("No transport/server found for sessionId");
    }
  } else {
    res.statusCode = 404;
    res.end("Not found");
  }
}
