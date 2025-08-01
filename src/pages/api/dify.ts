import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// Configure your Dify API details
const DIFY_API_URL = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';
const DIFY_API_KEY = process.env.DIFY_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract the necessary data from the request
    const { conversation_id, user_input, query_params, stream = true } = req.body;

    // Prepare headers for Dify API request
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DIFY_API_KEY}`
    };

    // Prepare request body
    const requestBody = {
      conversation_id,
      inputs: { user_input },
      query: query_params || {},
      response_mode: stream ? "streaming" : "blocking",
      user: req.body.user || undefined
    };

    if (stream) {
      // Handle streaming response
      const response = await axios.post(
        `${DIFY_API_URL}/chat-messages`,
        requestBody,
        {
          headers,
          responseType: 'stream'
        }
      );

      // Set appropriate headers for streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Pipe the stream directly to the response
      response.data.pipe(res);
      
      // Handle errors in the stream
      response.data.on('error', (err: Error) => {
        console.error('Stream error:', err);
        res.end(`data: ${JSON.stringify({ error: 'Stream error occurred' })}\n\n`);
      });
    } else {
      // Handle non-streaming response
      const response = await axios.post(
        `${DIFY_API_URL}/chat-messages`,
        requestBody,
        { headers }
      );
      
      res.status(200).json(response.data);
    }
  } catch (error) {
    console.error('Dify API error:', error);
    
    // Provide more detailed error information
    const errorMessage = error.response?.data?.message || 'Failed to process request to Dify API';
    const statusCode = error.response?.status || 500;
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: error.message
    });
  }
}
