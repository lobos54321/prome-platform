import { useEffect, useRef } from 'react';
import '@n8n/chat/style.css';
import { createChat } from '@n8n/chat';

interface N8nChatEmbeddedProps {
  webhookUrl: string;
  className?: string;
}

export default function N8nChatEmbedded({ webhookUrl, className = '' }: N8nChatEmbeddedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chatInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!webhookUrl) {
      console.log('Missing webhook URL');
      return;
    }

    // Add a small delay to ensure DOM is ready
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

      console.log('Initializing embedded N8n chat with webhook:', webhookUrl);

      try {
        // Try different configuration options for embedded mode
        chatInstanceRef.current = createChat({
          webhookUrl,
          target: containerRef.current,
          mode: 'fullscreen', // Try fullscreen mode for embedded display
          initialMessages: ['Hello! How can I help you today?'],
          // Additional options that might help with embedding
          displayMode: 'embedded'
        });
        
        console.log('N8n embedded chat initialized successfully');
      } catch (error) {
        console.error('Failed to initialize N8n embedded chat:', error);
        chatInstanceRef.current = null;
      }
    }, 100);

    // Cleanup
    return () => {
      clearTimeout(initTimer);
      if (chatInstanceRef.current && typeof chatInstanceRef.current.destroy === 'function') {
        console.log('Destroying embedded chat instance');
        try {
          chatInstanceRef.current.destroy();
        } catch (error) {
          console.error('Error destroying embedded chat:', error);
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
    <div className={`n8n-chat-embedded-container ${className}`}>
      {/* Custom style to force embedded display */}
      <style>{`
        .n8n-chat-embedded-container .n8n-chat {
          position: relative !important;
          position: static !important;
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          border-radius: 8px !important;
          box-shadow: none !important;
        }
        
        .n8n-chat-embedded-container .n8n-chat-window {
          position: relative !important;
          position: static !important;
          width: 100% !important;
          height: 500px !important;
          border-radius: 8px !important;
        }

        .n8n-chat-embedded-container .chat-window-transition {
          transform: none !important;
        }

        .n8n-chat-embedded-container .chat-toggle {
          display: none !important;
        }
      `}</style>
      
      <div 
        ref={containerRef}
        className="n8n-chat-embedded-target"
        style={{
          width: '100%',
          height: '500px',
          minHeight: '400px',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* N8n chat will be injected here */}
      </div>
    </div>
  );
}