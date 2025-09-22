import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { discoverTools } from "../lib/tools.js";

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

    const tools = await discoverTools();

    if (req.method === 'GET') {
      // Return server information
      res.status(200).json({
        server: SERVER_NAME,
        version: "1.0.0",
        status: "running",
        capabilities: ["tools"],
        tools: tools.map(tool => ({
          name: tool.definition.function.name,
          description: tool.definition.function.description,
          parameters: tool.definition.function.parameters
        }))
      });
      return;
    }

    if (req.method === 'POST') {
      // Handle MCP requests
      const mcpRequest = req.body;
      
      if (!mcpRequest || !mcpRequest.method) {
        res.status(400).json({ error: "Invalid MCP request" });
        return;
      }

      // Create a temporary server for this request
      const server = new Server(
        { name: SERVER_NAME, version: "1.0.0" },
        { capabilities: { tools: {} } }
      );

      await setupServerHandlers(server, tools);

      try {
        const result = await server.handleRequest(mcpRequest);
        res.status(200).json(result);
      } catch (error) {
        console.error("Error handling MCP request:", error);
        res.status(500).json({
          error: "MCP request failed",
          details: error.message
        });
      }
      return;
    }

    res.status(405).json({ error: "Method not allowed" });

  } catch (error) {
    console.error("MCP endpoint error:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message
    });
  }
}
