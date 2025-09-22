import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { discoverTools } from "./lib/tools.js";

// Store active transports and servers for SSE
const transports = new Map();
const servers = new Map();
const SERVER_NAME = "Tavily MCP Server";

// Setup server handlers
async function setupServerHandlers(server, tools) {
  // Register list tools capability
  server.setRequestHandler("tools/list", async () => {
    return {
      tools: tools.map(tool => tool.definition)
    };
  });

  // Register tool call handler
  server.setRequestHandler("tools/call", async (request) => {
    const { name, arguments: args } = request.params;
    
    const tool = tools.find(t => t.definition.function.name === name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    try {
      const result = await tool.function(args || {});
      return {
        content: [
          {
            type: "text",
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      console.error(`Error executing tool ${name}:`, error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`
          }
        ],
        isError: true
      };
    }
  });
}

// Generate a simple session ID
function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Main Vercel serverless function handler
export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // Discover available tools
    const tools = await discoverTools();

    if (req.method === "GET") {
      // SSE endpoint
      const sessionId = req.query.sessionId || generateSessionId();
      
      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const server = new Server(
        { name: SERVER_NAME, version: "1.0.0" },
        { capabilities: { tools: {} } }
      );

      server.onerror = (error) => console.error("[SSE Server Error]", error);
      await setupServerHandlers(server, tools);

      try {
        const transport = new SSEServerTransport("/messages", res);
        transports.set(sessionId, transport);
        servers.set(sessionId, server);

        // Cleanup when connection closes
        req.on("close", async () => {
          transports.delete(sessionId);
          try {
            await server.close();
          } catch (e) {
            console.error("Error closing server:", e);
          }
          servers.delete(sessionId);
        });

        await server.connect(transport);
      } catch (error) {
        console.error("Error setting up SSE transport:", error);
        res.status(500).json({ error: "Failed to setup SSE connection" });
      }

    } else if (req.method === "POST") {
      // Handle POST messages for SSE
      const sessionId = req.query.sessionId;
      
      if (!sessionId) {
        res.status(400).json({ error: "sessionId is required" });
        return;
      }

      const transport = transports.get(sessionId);
      const server = servers.get(sessionId);

      if (transport && server) {
        try {
          await transport.handlePostMessage(req, res);
        } catch (error) {
          console.error("Error handling POST message:", error);
          res.status(500).json({ error: "Failed to handle message" });
        }
      } else {
        res.status(400).json({ error: "No active session found for sessionId" });
      }

    } else {
      res.status(405).json({ error: "Method not allowed" });
    }

  } catch (error) {
    console.error("Handler error:", error);
    res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  }
}
