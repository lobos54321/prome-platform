import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// Configure your Dify API details
const DIFY_API_URL = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';
const DIFY_API_KEY = process.env.DIFY_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Transfer-Encoding', 'chunked');

  try {
    // Extract the necessary data from the request
    const { conversation_id, user_input, query_params, user } = req.body;

    // Create request to Dify API
    const response = await axios.post(
      `${DIFY_API_URL}/chat-messages`,
      {
        conversation_id,
        inputs: { user_input },
        query: query_params || {},
        response_mode: "streaming",
        user
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DIFY_API_KEY}`
        },
        responseType: 'stream'
      }
    );

    // Process and forward the stream
    response.data.on('data', (chunk: Buffer) => {
      const data = chunk.toString();
      res.write(`data: ${data}\n\n`);
    });

    // Handle stream end
    response.data.on('end', () => {
      res.write('data: [DONE]\n\n');
      res.end();
    });

    // Handle errors in the stream
    response.data.on('error', (err: Error) => {
      console.error('Stream error:', err);
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    });

    // Handle client disconnect
    req.on('close', () => {
      response.data.destroy();
      res.end();
    });
  } catch (error) {
    console.error('Dify API error:', error);
    res.write(`data: ${JSON.stringify({ error: 'Failed to connect to Dify API' })}\n\n`);
    res.end();
  }
}
