import type { NextApiRequest, NextApiResponse } from 'next';

// Configure your Dify API details
const DIFY_API_URL = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';
const DIFY_API_KEY = process.env.DIFY_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!DIFY_API_KEY) {
    return res.status(500).json({ error: 'Dify API key not configured' });
  }

  const { conversationId } = req.query;

  try {
    const { message, user, inputs = {} } = req.body;

    console.log(`[Workflow Stream ${conversationId}] Processing request:`, {
      conversationId,
      user,
      message: message?.substring(0, 100) + '...',
      timestamp: new Date().toISOString()
    });

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Prepare headers for Dify API request
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DIFY_API_KEY}`
    };

    // Prepare request body for workflow endpoint
    const requestBody = {
      inputs: {
        ...inputs,
        query: message // Ensure query is in inputs for workflow
      },
      response_mode: "streaming",
      user: user || 'default-user',
      ...(conversationId && conversationId !== 'default' && { conversation_id: conversationId })
    };

    const timeoutMs = 120000; // 2 minutes for workflows
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${DIFY_API_URL}/workflows/run`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Workflow Stream ${conversationId}] Error:`, response.status, errorText);
        res.write(`data: ${JSON.stringify({ 
          error: `Workflow API error: ${response.status} - ${errorText}`
        })}\n\n`);
        res.end();
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        res.write(`data: ${JSON.stringify({ error: 'Failed to get response reader' })}\n\n`);
        res.end();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              
              if (data === '[DONE]') {
                res.write('data: [DONE]\n\n');
                res.end();
                return;
              }

              try {
                const parsed = JSON.parse(data);
                
                // Log workflow events for debugging
                if (parsed.event && parsed.event.startsWith('node_')) {
                  console.log(`[Workflow Stream ${conversationId}] Node event:`, {
                    event: parsed.event,
                    node_id: parsed.node_id,
                    node_name: parsed.node_name,
                    timestamp: new Date().toISOString()
                  });
                }

                // Forward the parsed data to client
                res.write(`data: ${JSON.stringify(parsed)}\n\n`);
              } catch (parseError) {
                console.warn(`[Workflow Stream ${conversationId}] Parse error:`, parseError);
                // Still forward the raw data
                res.write(`data: ${data}\n\n`);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error(`[Workflow Stream ${conversationId}] Timeout:`, timeoutMs + 'ms');
        res.write(`data: ${JSON.stringify({ 
          error: 'Workflow execution timed out. Please try again.' 
        })}\n\n`);
        res.end();
      } else {
        throw fetchError;
      }
    }

    // Handle client disconnect
    req.on('close', () => {
      console.log(`[Workflow Stream ${conversationId}] Client disconnected`);
      res.end();
    });

  } catch (error) {
    console.error(`[Workflow Stream ${conversationId}] Unexpected error:`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ 
        error: errorMessage,
        details: 'Workflow streaming failed'
      });
    }
  }
}