import { useEffect, useRef } from 'react';
import '@n8n/chat/style.css';
import { createChat } from '@n8n/chat';

interface N8nChatSimpleProps {
  webhookUrl: string;
  className?: string;
}

export default function N8nChatSimple({ webhookUrl, className = '' }: N8nChatSimpleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chatInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!webhookUrl) {
      console.log('Missing webhook URL');
      return;
    }

    // Add a small delay to ensure DOM is ready and avoid duplicate initialization
    const initTimer = setTimeout(() => {
      if (!containerRef.current) {
        console.log('Container ref not available');
        return;
      }

      // Check if chat is already initialized
      if (chatInstanceRef.current) {
        console.log('Chat already initialized, skipping...');
        return;
      }

      console.log('Initializing N8n chat with webhook:', webhookUrl);

      try {
        // Initialize chat according to @n8n/chat documentation
        chatInstanceRef.current = createChat({
          webhookUrl,
          target: containerRef.current
        });
        
        console.log('N8n chat initialized successfully');
      } catch (error) {
        console.error('Failed to initialize N8n chat:', error);
        chatInstanceRef.current = null;
      }
    }, 100);

    // Cleanup
    return () => {
      clearTimeout(initTimer);
      if (chatInstanceRef.current && typeof chatInstanceRef.current.destroy === 'function') {
        console.log('Destroying chat instance');
        try {
          chatInstanceRef.current.destroy();
        } catch (error) {
          console.error('Error destroying chat:', error);
        }
        chatInstanceRef.current = null;
      }
    };
  }, [webhookUrl]);

  if (!webhookUrl) {
    return (
      <div className={`p-4 bg-yellow-50 border border-yellow-200 rounded-lg ${className}`}>
        <p className="text-yellow-800">N8n webhook URL is not configured</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`n8n-chat-simple ${className}`}
      style={{
        width: '100%',
        height: '500px',
        minHeight: '400px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px'
      }}
    >
      {/* N8n chat will be injected here */}
    </div>
  );
}