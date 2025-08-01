import type { NextApiRequest, NextApiResponse } from 'next';

// Configure your Dify API details
const DIFY_API_URL = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';
const DIFY_API_KEY = process.env.DIFY_API_KEY;

// Timeout configurations
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const WORKFLOW_TIMEOUT = 120000; // 2 minutes

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!DIFY_API_KEY) {
    return res.status(500).json({ error: 'Dify API key not configured' });
  }

  try {
    // Extract the necessary data from the request
    const { conversation_id, query, user, inputs = {}, mode = 'chat', stream = false } = req.body;

    console.log('[Dify API] Processing request:', {
      mode,
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

    // Prepare request body
    const requestBody = {
      inputs,
      query,
      response_mode: stream ? "streaming" : "blocking",
      user: user || 'default-user',
      ...(conversation_id && { conversation_id })
    };

    // Choose timeout based on mode
    const timeoutMs = mode === 'workflow' ? WORKFLOW_TIMEOUT : DEFAULT_TIMEOUT;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (stream) {
        // Handle streaming response
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const response = await fetch(`${DIFY_API_URL}/chat-messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Dify API] Streaming error:', response.status, errorText);
          res.write(`data: ${JSON.stringify({ 
            error: `Chat API error: ${response.status} - ${errorText}`
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
            buffer = lines.pop() || '';

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
                  res.write(`data: ${JSON.stringify(parsed)}\n\n`);
                } catch (parseError) {
                  console.warn('[Dify API] Parse error:', parseError);
                  res.write(`data: ${data}\n\n`);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        // Handle client disconnect
        req.on('close', () => {
          console.log('[Dify API] Client disconnected');
          reader.releaseLock();
          res.end();
        });

      } else {
        // Handle non-streaming response
        const response = await fetch(`${DIFY_API_URL}/chat-messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Dify API] Error response:', response.status, errorText);
          
          // Parse error details if possible
          let errorDetails = errorText;
          try {
            const errorJson = JSON.parse(errorText);
            errorDetails = errorJson.message || errorJson.error || errorText;
          } catch (e) {
            // Keep original error text
          }

          return res.status(response.status).json({ 
            error: `Chat API error: ${response.status} - ${errorDetails}`,
            status: response.status,
            details: errorDetails
          });
        }

        const data = await response.json();
        console.log('[Dify API] Success response received');
        
        res.status(200).json(data);
      }

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('[Dify API] Request timeout:', timeoutMs + 'ms');
        const timeoutError = mode === 'workflow' 
          ? 'Workflow execution timed out. Please try again or contact support.'
          : 'Request timed out. Please try again.';
        
        if (res.headersSent) {
          res.write(`data: ${JSON.stringify({ error: timeoutError })}\n\n`);
          res.end();
        } else {
          return res.status(408).json({ error: timeoutError });
        }
      } else {
        throw fetchError; // Re-throw other errors
      }
    }

  } catch (error) {
    console.error('[Dify API] Unexpected error:', error);
    
    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const statusCode = 500;
    
    if (res.headersSent) {
      // If streaming, send error through stream
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
    } else {
      // If not streaming, send JSON error
      res.status(statusCode).json({ 
        error: errorMessage,
        details: 'Failed to process request to Dify API'
      });
    }
  }
}
