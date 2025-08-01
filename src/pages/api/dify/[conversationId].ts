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
  const isWorkflowEndpoint = req.url?.includes('/workflow');

  try {
    const { message, user, inputs = {} } = req.body;

    console.log(`[Dify API ${conversationId}] Processing ${isWorkflowEndpoint ? 'workflow' : 'chat'} request:`, {
      conversationId,
      user,
      message: message?.substring(0, 100) + '...',
      timestamp: new Date().toISOString()
    });

    // Prepare headers for Dify API request
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DIFY_API_KEY}`
    };

    // Prepare request body
    const requestBody = isWorkflowEndpoint ? {
      inputs: {
        ...inputs,
        query: message // For workflows, message goes in inputs.query
      },
      response_mode: "streaming",
      user: user || 'default-user',
      ...(conversationId && conversationId !== 'default' && { conversation_id: conversationId })
    } : {
      inputs,
      query: message,
      response_mode: "blocking",
      user: user || 'default-user',
      ...(conversationId && conversationId !== 'default' && { conversation_id: conversationId })
    };

    const endpoint = isWorkflowEndpoint ? 'workflows/run' : 'chat-messages';
    const timeoutMs = isWorkflowEndpoint ? 120000 : 30000; // 2 minutes for workflows, 30s for chat

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${DIFY_API_URL}/${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Dify API ${conversationId}] Error:`, response.status, errorText);
        
        // Parse error details if possible
        let errorDetails = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorDetails = errorJson.message || errorJson.error || errorText;
        } catch (e) {
          // Keep original error text
        }

        return res.status(response.status).json({ 
          error: `${isWorkflowEndpoint ? 'Workflow' : 'Chat'} API error: ${response.status} - ${errorDetails}`,
          status: response.status,
          details: errorDetails
        });
      }

      const data = await response.json();
      console.log(`[Dify API ${conversationId}] Success response received`);
      
      res.status(200).json(data);

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error(`[Dify API ${conversationId}] Request timeout:`, timeoutMs + 'ms');
        const timeoutError = isWorkflowEndpoint 
          ? 'Workflow execution timed out. Please try again or contact support.'
          : 'Request timed out. Please try again.';
        
        return res.status(408).json({ error: timeoutError });
      } else {
        throw fetchError; // Re-throw other errors
      }
    }

  } catch (error) {
    console.error(`[Dify API ${conversationId}] Unexpected error:`, error);
    
    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    res.status(500).json({ 
      error: errorMessage,
      details: `Failed to process ${isWorkflowEndpoint ? 'workflow' : 'chat'} request`
    });
  }
}