import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

// Store active transports and servers
const transports = {};
const servers = {};

const SERVER_NAME = "My MCP Server"; // replace with your server name

// Function to setup server handlers (replace with your tool discovery logic)
async function setupServerHandlers(server, tools) {
  for (const tool of tools) {
    server.registerTool(tool);
  }
}

// Example placeholder for tools discovery
async function discoverTools() {
  return []; // replace with your actual tools
}

// Vercel handler
export default async function handler(req, res) {
  if (req.method === "GET" && req.url.startsWith("/sse")) {
    const server = new Server(
      { name: SERVER_NAME, version: "0.1.0" },
      { capabilities: { tools: {} } }
    );

    server.onerror = (error) => console.error("[Error]", error);

    const tools = await discoverTools();
    await setupServerHandlers(server, tools);

    const transport = new SSEServerTransport("/messages", res);
    transports[transport.sessionId] = transport;
    servers[transport.sessionId] = server;

    res.on("close", async () => {
      delete transports[transport.sessionId];
      await server.close();
      delete servers[transport.sessionId];
    });

    await server.connect(transport);
  } else if (req.method === "POST" && req.url.startsWith("/messages")) {
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
