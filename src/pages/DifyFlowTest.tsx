import React, { useState } from 'react';

export default function DifyFlowTest() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const sendMessage = async (message: string) => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/dify/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          conversationId: conversationId,
          userId: 'test-user-' + Date.now()
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('DIFY Response:', data);
      
      // 更新对话ID
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }
      
      // 添加消息到列表
      setMessages(prev => [
        ...prev,
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: data.answer, timestamp: new Date(), metadata: data.metadata }
      ]);
      
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [
        ...prev,
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: `Error: ${error}`, timestamp: new Date() }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    sendMessage(input.trim());
    setInput('');
  };

  const startNewConversation = () => {
    setMessages([]);
    setConversationId(null);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">DIFY Chatflow 测试页面</h1>
      
      <div className="mb-4 flex gap-4">
        <button 
          onClick={startNewConversation}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          新对话
        </button>
        
        <button 
          onClick={() => sendMessage('biubiu')}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          disabled={loading}
        >
          发送触发词 (biubiu)
        </button>
        
        <button 
          onClick={() => sendMessage('我想生成营销文案')}
          className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
          disabled={loading}
        >
          直接开始
        </button>
      </div>

      <div className="mb-4 p-2 bg-gray-100 rounded">
        <strong>对话ID:</strong> {conversationId || '未开始'}
      </div>
      
      <div className="border rounded-lg h-96 overflow-y-auto mb-4 p-4 bg-gray-50">
        {messages.map((msg, index) => (
          <div key={index} className={`mb-3 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
            <div className={`inline-block p-3 rounded-lg max-w-xs lg:max-w-md ${
              msg.role === 'user' 
                ? 'bg-blue-500 text-white' 
                : 'bg-white border'
            }`}>
              <div className="font-semibold text-sm mb-1">
                {msg.role === 'user' ? '用户' : 'AI助手'}
              </div>
              <div>{msg.content}</div>
              {msg.metadata && (
                <div className="text-xs mt-2 opacity-70">
                  <pre>{JSON.stringify(msg.metadata, null, 2)}</pre>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {msg.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-center text-gray-500">
            AI正在思考中...
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入消息..."
          className="flex-1 border rounded-lg px-3 py-2"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          发送
        </button>
      </form>
      
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="font-semibold mb-2">测试指导：</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>点击"新对话"开始新的测试</li>
          <li>点击"发送触发词"测试biubiu触发条件</li>
          <li>点击"直接开始"测试正常对话流程</li>
          <li>观察AI的响应是否按照收集信息→LLM处理的正确流程</li>
          <li>检查是否绕过了信息收集阶段直接进入LLM0/LLM3</li>
        </ol>
      </div>
    </div>
  );
}