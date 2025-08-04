import axios from 'axios';

export interface DifyRequestParams {
  conversation_id?: string;
  user_input: string;
  query_params?: Record<string, unknown>;
  stream?: boolean;
  user?: {
    user_id?: string;
    name?: string;
  };
}

export interface DifyResponse {
  answer: string;
  conversation_id: string;
  created_at: string;
  id: string;
  metadata?: Record<string, unknown>;
}

export interface DifyStreamChunk {
  event: string;
  data: unknown;
}

export const sendDifyRequest = async (params: DifyRequestParams): Promise<DifyResponse> => {
  try {
    // Use the correct route with conversation_id
    const endpoint = params.conversation_id 
      ? `/api/dify/${params.conversation_id}` 
      : '/api/dify';
    
    const response = await axios.post(endpoint, params, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('Error calling Dify API:', error);
    throw error;
  }
};

export const streamDifyRequest = (
  params: DifyRequestParams,
  onChunk: (chunk: DifyStreamChunk) => void,
  onComplete: (fullResponse: DifyResponse) => void,
  onError: (error: Error) => void
): () => void => {
  // Set stream to true
  const streamParams = { ...params, stream: true };
  
  // Use the correct streaming endpoint
  const endpoint = params.conversation_id 
    ? `/api/dify/${params.conversation_id}/stream`
    : '/api/dify/default/stream';
  
  // Create EventSource for SSE connection
  const eventSource = new EventSource(endpoint);
  
  // Process events
  eventSource.onmessage = (event) => {
    try {
      const chunk = JSON.parse(event.data);
      onChunk(chunk);
      
      // If we have a complete response, call onComplete
      if (chunk.event === 'done') {
        onComplete(chunk.data);
        eventSource.close();
      }
    } catch (error) {
      onError(new Error(`Failed to parse stream chunk: ${error.message}`));
      eventSource.close();
    }
  };
  
  // Handle errors
  eventSource.onerror = (event) => {
    onError(new Error('Stream connection error'));
    eventSource.close();
  };
  
  // Return a function to close the connection
  return () => eventSource.close();
};
