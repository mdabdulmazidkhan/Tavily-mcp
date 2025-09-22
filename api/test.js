import { discoverTools } from "../lib/tools.js";

export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    const tools = await discoverTools();
    
    // Test if we can load tools
    const toolsInfo = tools.map(tool => ({
      name: tool.definition.function.name,
      description: tool.definition.function.description,
      parameters: Object.keys(tool.definition.function.parameters?.properties || {}),
      hasFunction: typeof tool.function === 'function'
    }));

    // Test environment variables
    const hasApiKey = !!process.env.TAVILY_API_KEY;
    
    res.status(200).json({
      status: 'MCP Server is running',
      timestamp: new Date().toISOString(),
      environment: {
        hasApiKey: hasApiKey,
        apiKeyPreview: hasApiKey ? process.env.TAVILY_API_KEY.substring(0, 8) + '...' : 'Not set'
      },
      tools: {
        count: tools.length,
        available: toolsInfo
      },
      request: {
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent']
      }
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({
      error: 'Test failed',
      details: error.message,
      stack: error.stack
    });
  }
}
