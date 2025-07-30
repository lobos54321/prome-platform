import { useState, useEffect } from 'react';

export function DifyChat() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // 从 localStorage 获取已有的对话ID
    const storedId = localStorage.getItem('dify-conversation-id');
    if (storedId) {
      setConversationId(storedId);
    }
    // 不要预先生成 UUID，让 Dify 在首次对话时生成
  }, []);
  
  const sendMessage = async (message: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/chat/dify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          conversationId: conversationId || undefined, // 传递 undefined 而不是空字符串
          user: 'user-123'
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }
      
      const data = await response.json();
      setMessages([...messages, data]);
      
      // 从响应中获取 Dify 生成的 conversation_id
      if (data.conversation_id && !conversationId) {
        setConversationId(data.conversation_id);
        localStorage.setItem('dify-conversation-id', data.conversation_id);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      setError(error.message);
      
      // 如果是 404 错误，可能是对话已过期，清除本地存储
      if (error.message.includes('404') || error.message.includes('Not Exists')) {
        localStorage.removeItem('dify-conversation-id');
        setConversationId(null);
        console.log('Conversation expired, will create new one on next message');
        // 可以选择自动重试
        // return sendMessage(message);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const clearConversation = () => {
    localStorage.removeItem('dify-conversation-id');
    setConversationId(null);
    setMessages([]);
    setError(null);
  };
  
  return (
    <div className="dify-chat">
      {/* UI 组件代码 */}
      {error && (
        <div className="error-message">
          {error}
          {error.includes('Not Exists') && (
            <button onClick={clearConversation}>开始新对话</button>
          )}
        </div>
      )}
    </div>
  );
}
