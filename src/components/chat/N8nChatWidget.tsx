import { useEffect, useRef, useState } from 'react';
import '@n8n/chat/style.css';
import { createChat } from '@n8n/chat';

interface N8nChatWidgetProps {
  webhookUrl: string;
  mode?: 'window' | 'fullscreen';
  enableStreaming?: boolean;
  allowFileUploads?: boolean;
  initialMessages?: string[];
  target?: string; // CSS selector for container element
  className?: string;
}

export default function N8nChatWidget({
  webhookUrl,
  mode = 'window',
  enableStreaming = true,
  allowFileUploads = true,
  initialMessages,
  target,
  className = ''
}: N8nChatWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chatInstanceRef = useRef<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if webhook URL is provided
    if (!webhookUrl) {
      setError('N8n webhook URL is not configured');
      return;
    }

    // Initialize N8n chat
    const initializeChat = async () => {
      try {
        console.log('Initializing N8n chat with webhook:', webhookUrl);
        
        // Wait for container to be available
        if (!containerRef.current) {
          console.error('Container ref not available');
          setError('Container not available for N8n chat');
          return;
        }

        const chatConfig = {
          webhookUrl,
          target: `#${containerRef.current.id}`,
          mode,
          enableStreaming,
          allowFileUploads,
          ...(initialMessages && { initialMessages })
        };

        console.log('Chat config:', chatConfig);
        console.log('Container element:', containerRef.current);
        
        chatInstanceRef.current = createChat(chatConfig);
        setIsInitialized(true);
        setError(null);
        
        console.log('N8n chat initialized successfully');
      } catch (err) {
        console.error('Failed to initialize N8n chat:', err);
        setError(`Failed to initialize N8n chat: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };

    // Add a small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      initializeChat();
    }, 100);

    // Cleanup function
    return () => {
      clearTimeout(timer);
      if (chatInstanceRef.current && typeof chatInstanceRef.current.destroy === 'function') {
        chatInstanceRef.current.destroy();
      }
    };
  }, [webhookUrl, mode, enableStreaming, allowFileUploads, initialMessages, target]);

  // Generate unique ID for container
  const containerId = `n8n-chat-container-${Math.random().toString(36).substr(2, 9)}`;

  if (error) {
    return (
      <div className={`p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <div className="flex items-center mb-2">
          <div className="w-4 h-4 bg-red-500 rounded-full mr-2"></div>
          <h3 className="text-red-800 font-semibold">N8n Chat Error</h3>
        </div>
        <p className="text-red-700 text-sm">{error}</p>
        <p className="text-red-600 text-xs mt-2">
          Please check your N8n webhook configuration in environment variables.
        </p>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className={`p-4 bg-blue-50 border border-blue-200 rounded-lg ${className}`}>
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
          <p className="text-blue-700">Initializing N8n chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      id={containerId}
      className={`n8n-chat-container ${className}`}
      style={{
        width: '100%',
        height: mode === 'fullscreen' ? '100vh' : '500px',
        minHeight: '400px'
      }}
    >
      {/* N8n chat will be injected here */}
    </div>
  );
}