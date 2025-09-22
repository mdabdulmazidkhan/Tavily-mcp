#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { discoverTools } from "./lib/tools.js";

// Load environment variables
dotenv.config();

const SERVER_NAME = "Tavily MCP Server";
const SERVER_VERSION = "1.0.0";

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

async function main() {
  const tools = await discoverTools();
  
  // Check command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--sse')) {
    // Run SSE server
    const app = express();
    app.use(cors());
    app.use(express.json());

    const server = new Server(
      { name: SERVER_NAME, version: SERVER_VERSION },
      { capabilities: { tools: {} } }
    );

    server.onerror = (error) => console.error("[SSE Server Error]", error);
    await setupServerHandlers(server, tools);

    app.get('/sse', async (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const transport = new SSEServerTransport("/messages", res);
      await server.connect(transport);
    });

    app.post('/messages', async (req, res) => {
      // Handle SSE messages
      res.json({ status: 'received' });
    });

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`SSE MCP Server running on port ${port}`);
    });

  } else if (args.includes('--streamable-http')) {
    // Run HTTP server
    const app = express();
    app.use(cors());
    app.use(express.json());

    const server = new Server(
      { name: SERVER_NAME, version: SERVER_VERSION },
      { capabilities: { tools: {} } }
    );

    server.onerror = (error) => console.error("[HTTP Server Error]", error);
    await setupServerHandlers(server, tools);

    app.post('/mcp', async (req, res) => {
      try {
        const result = await server.handleRequest(req.body);
        res.json(result);
      } catch (error) {
        console.error("Error handling request:", error);
        res.status(500).json({ error: error.message });
      }
    });

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`HTTP MCP Server running on port ${port}`);
    });

  } else {
    // Default: Run STDIO server
    const server = new Server(
      { name: SERVER_NAME, version: SERVER_VERSION },
      { capabilities: { tools: {} } }
    );

    server.onerror = (error) => console.error("[STDIO Server Error]", error);
    await setupServerHandlers(server, tools);

    const transport = new StdioServerTransport();
    await server.connect(transport);

    // Keep the process running
    process.stdin.resume();
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the server
main().catch(error => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
