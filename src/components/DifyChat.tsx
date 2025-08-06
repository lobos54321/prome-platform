import React, { useState, useEffect } from 'react';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export function DifyChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userId] = useState(() => {
    // Get or generate user ID
    const stored = localStorage.getItem('dify-user-id');
    if (stored) return stored;
    
    const newId = `user-${Date.now()}`;
    localStorage.setItem('dify-user-id', newId);
    return newId;
  });
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      content: input,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Use mock endpoint for testing when Dify API is not available
      const endpoint = process.env.NODE_ENV === 'development' ? '/api/dify/chat/mock' : '/api/dify/chat';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify({
          message: input,
          conversationId,
          userId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send message');
      }

      const data = await response.json();
      
      // Update conversation ID (first conversation will return new ID)
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }

      // Add AI response
      const aiMessage: Message = {
        id: data.message_id || `msg-${Date.now()}-ai`,
        content: data.answer || data.text || '',
        role: 'assistant',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);

      // Check if special handling needed (e.g. workflow node changes)
      if (data.metadata?.node_status) {
        console.log('Current node:', data.metadata.node_status);
        // Perform specific actions based on node status
      }

    } catch (error) {
      console.error('Error sending message:', error);
      // Show error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        content: `Error: ${error instanceof Error ? error.message : 'Send failed'}`,
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset conversation
  const resetConversation = () => {
    setMessages([]);
    setConversationId(null);
  };

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto border border-gray-300 rounded-lg shadow-lg bg-white">
      <div className="flex items-center justify-between p-4 border-b bg-blue-50">
        <h3 className="text-lg font-semibold text-gray-800">Dify Chat</h3>
        <div className="text-sm text-gray-600">
          User: {userId.substring(0, 8)}...
          {conversationId && <span className="ml-2">Conv: {conversationId.substring(0, 8)}...</span>}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[400px]">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : msg.id.startsWith('error-')
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              <span className={`text-xs mt-2 block ${
                msg.role === 'user' ? 'text-blue-200' : 'text-gray-500'
              }`}>
                {msg.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-3 max-w-[70%]">
              <div className="flex items-center gap-2 text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                <span>AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-4 border-t bg-gray-50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Enter message..."
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button 
            onClick={sendMessage} 
            disabled={isLoading || !input.trim()}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
          <button 
            onClick={resetConversation}
            className="px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            New Chat
          </button>
        </div>
        
        <div className="mt-2 text-xs text-gray-500 text-right">
          {input.length} / 2000 characters
        </div>
      </div>
    </div>
  );
}