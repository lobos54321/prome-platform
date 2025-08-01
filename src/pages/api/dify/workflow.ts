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

  try {
    const { conversation_id, query, user, inputs = {}, stream = true } = req.body;

    console.log('[Workflow API] Processing request:', {
      conversation_id,
      user,
      query: query?.substring(0, 100) + '...',
      stream,
      timestamp: new Date().toISOString()
    });

    // Prepare headers for Dify API request
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DIFY_API_KEY}`
    };

    // Prepare request body for workflow endpoint
    const requestBody = {
      inputs: {
        ...inputs,
        query: query // Ensure query is in inputs for workflow
      },
      response_mode: stream ? "streaming" : "blocking",
      user: user || 'default-user',
      ...(conversation_id && { conversation_id })
    };

    console.log('[Workflow API] Sending to Dify:', {
      url: `${DIFY_API_URL}/workflows/run`,
      body: { ...requestBody, inputs: { query: requestBody.inputs.query?.substring(0, 50) + '...' } }
    });

    if (stream) {
      // Handle streaming response for workflow progress
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

      const response = await fetch(`${DIFY_API_URL}/workflows/run`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Workflow API] Dify error:', response.status, errorText);
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
                  console.log('[Workflow API] Node event:', {
                    event: parsed.event,
                    node_id: parsed.node_id,
                    node_name: parsed.node_name,
                    timestamp: new Date().toISOString()
                  });
                }

                // Forward the parsed data to client
                res.write(`data: ${JSON.stringify(parsed)}\n\n`);
              } catch (parseError) {
                console.warn('[Workflow API] Parse error:', parseError, 'Data:', data);
                // Still forward the raw data in case client can handle it
                res.write(`data: ${data}\n\n`);
              }
            }
          }
        }
      } catch (streamError) {
        console.error('[Workflow API] Stream error:', streamError);
        res.write(`data: ${JSON.stringify({ 
          error: 'Stream processing error: ' + streamError.message 
        })}\n\n`);
        res.end();
      } finally {
        reader.releaseLock();
      }

      // Handle client disconnect
      req.on('close', () => {
        console.log('[Workflow API] Client disconnected');
        reader.releaseLock();
        res.end();
      });

    } else {
      // Handle non-streaming response
      const response = await fetch(`${DIFY_API_URL}/workflows/run`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Workflow API] Dify error:', response.status, errorText);
        return res.status(response.status).json({ 
          error: `Workflow API error: ${response.status} - ${errorText}`
        });
      }

      const data = await response.json();
      console.log('[Workflow API] Success response received');
      
      res.status(200).json(data);
    }

  } catch (error) {
    console.error('[Workflow API] Unexpected error:', error);
    
    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    if (res.headersSent) {
      // If streaming, send error through stream
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
    } else {
      // If not streaming, send JSON error
      res.status(500).json({ 
        error: errorMessage,
        details: 'Workflow processing failed'
      });
    }
  }
}