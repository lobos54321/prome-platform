import React, { useState, useEffect, useRef } from 'react';
import { sendDifyRequest, streamDifyRequest, DifyRequestParams, DifyResponse, DifyStreamChunk } from '../services/difyService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const messageEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const generateMessageId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  const handleNonStreamingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    const userMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      const requestParams: DifyRequestParams = {
        conversation_id: conversationId,
        user_input: input,
        stream: false
      };
      
      const response = await sendDifyRequest(requestParams);
      
      if (response.conversation_id && !conversationId) {
        setConversationId(response.conversation_id);
      }
      
      const assistantMessage: Message = {
        id: generateMessageId(),
        role: 'assistant',
        content: response.answer,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      
      const errorMessage: Message = {
        id: generateMessageId(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStreamingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    const userMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingMessage('');
    
    try {
      const requestParams: DifyRequestParams = {
        conversation_id: conversationId,
        user_input: input,
        stream: true
      };
      
      // Use streaming approach
      const closeStream = streamDifyRequest(
        requestParams,
        // On each chunk
        (chunk: DifyStreamChunk) => {
          if (chunk.event === 'message') {
            setStreamingMessage(prev => prev + chunk.data.content);
          }
          
          if (chunk.event === 'metadata' && chunk.data.conversation_id && !conversationId) {
            setConversationId(chunk.data.conversation_id);
          }
        },
        // On complete
        (fullResponse: DifyResponse) => {
          const assistantMessage: Message = {
            id: generateMessageId(),
            role: 'assistant',
            content: fullResponse.answer || streamingMessage,
            timestamp: new Date()
          };
          
          setMessages(prev => [...prev, assistantMessage]);
          setStreamingMessage('');
          setIsLoading(false);
        },
        // On error
        (error: Error) => {
          console.error('Stream error:', error);
          
          const errorMessage: Message = {
            id: generateMessageId(),
            role: 'assistant',
            content: 'Sorry, I encountered an error during streaming. Please try again.',
            timestamp: new Date()
          };
          
          setMessages(prev => [...prev, errorMessage]);
          setStreamingMessage('');
          setIsLoading(false);
        }
      );
      
      // Clean up stream on component unmount
      return () => closeStream();
    } catch (error) {
      console.error('Chat error:', error);
      
      const errorMessage: Message = {
        id: generateMessageId(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
      setStreamingMessage('');
      setIsLoading(false);
    }
  };

  // Choose which submit handler to use based on your preference
  const handleSubmit = handleStreamingSubmit; // or handleNonStreamingSubmit

  return (
    <div className="chat-container">
      <div className="messages-container">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="message-content">{msg.content}</div>
            <div className="message-timestamp">
              {msg.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
        
        {streamingMessage && (
          <div className="message assistant streaming">
            <div className="message-content">{streamingMessage}</div>
          </div>
        )}
        
        <div ref={messageEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={isLoading}
          className="chat-input"
        />
        <button 
          type="submit" 
          disabled={isLoading || !input.trim()}
          className="chat-submit-button"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
