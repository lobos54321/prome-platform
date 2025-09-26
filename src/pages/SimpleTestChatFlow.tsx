import React, { useState } from 'react';
import useDifyChat from '@/hooks/useDifyChat';

/**
 * 简化测试页面 - 验证营销文案工作流修复
 */
export default function SimpleTestChatFlow() {
  const [input, setInput] = useState('');
  const {
    messages,
    conversationId,
    isLoading,
    error,
    sendMessage,
    resetConversation,
    conversationVariables,
  } = useDifyChat();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    await sendMessage(input.trim());
    setInput('');
  };

  const testMessages = [
    "你好",
    "我要做营销文案",
    "我的产品是AI编程助手",
    "主要特色是代码生成和bug修复",
    "目标用户是程序员",
    "需要500字的文案"
  ];

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>营销文案工作流测试</h1>
      <p>测试修复后的Dify chatflow是否正确执行信息收集阶段</p>

      {/* 调试信息 */}
      <div style={{ 
        background: '#f5f5f5', 
        padding: '15px', 
        margin: '20px 0', 
        border: '1px solid #ddd',
        borderRadius: '8px'
      }}>
        <h3>🔍 对话状态调试</h3>
        {conversationId && (
          <p><strong>对话ID:</strong> {conversationId.slice(0, 12)}...</p>
        )}
        <p><strong>信息完整度:</strong> {conversationVariables.conversation_info_completeness || 0}/4</p>
        <p><strong>收集次数:</strong> {conversationVariables.conversation_collection_count || 0}</p>
        
        <div style={{ marginTop: '10px', fontSize: '12px' }}>
          {JSON.stringify(conversationVariables, null, 2)}
        </div>
      </div>

      {/* 快速测试按钮 */}
      <div style={{ marginBottom: '20px' }}>
        <h3>快速测试</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '10px' }}>
          {testMessages.map((msg, index) => (
            <button
              key={index}
              onClick={() => sendMessage(msg)}
              disabled={isLoading}
              style={{
                padding: '10px',
                background: isLoading ? '#ccc' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {index + 1}. {msg}
            </button>
          ))}
        </div>
        <button
          onClick={resetConversation}
          style={{
            padding: '10px 20px',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🔄 重置对话
        </button>
      </div>

      {/* 聊天界面 */}
      <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px' }}>
        <h3>对话记录</h3>
        
        {/* 消息列表 */}
        <div style={{ 
          maxHeight: '400px', 
          overflowY: 'auto', 
          marginBottom: '20px',
          border: '1px solid #eee',
          padding: '10px',
          borderRadius: '4px'
        }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
              开始对话来测试工作流...
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              style={{
                marginBottom: '15px',
                padding: '10px',
                borderRadius: '8px',
                background: message.role === 'user' ? '#e3f2fd' : '#f5f5f5',
                marginLeft: message.role === 'user' ? '20%' : '0',
                marginRight: message.role === 'user' ? '0' : '20%'
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                {message.role === 'user' ? '👤 用户' : '🤖 AI助手'}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
              {message.metadata?.loading && (
                <div style={{ fontSize: '12px', marginTop: '5px', color: '#666' }}>
                  正在处理...
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 错误显示 */}
        {error && (
          <div style={{ 
            background: '#fee', 
            border: '1px solid #fcc', 
            padding: '10px', 
            borderRadius: '4px',
            marginBottom: '15px',
            color: '#c00'
          }}>
            错误: {error}
          </div>
        )}

        {/* 输入区域 */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入消息..."
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            style={{
              padding: '10px 20px',
              background: (isLoading || !input.trim()) ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (isLoading || !input.trim()) ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? '⏳' : '📤'}
          </button>
        </form>

        {/* 状态指示 */}
        <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
          {isLoading && '🤖 AI正在处理...'}
          {!isLoading && messages.length > 0 && '✅ 就绪'}
          {!isLoading && messages.length === 0 && '🚀 开始对话'}
        </div>
      </div>

      {/* 测试说明 */}
      <div style={{ 
        marginTop: '20px', 
        background: '#f9f9f9', 
        padding: '15px', 
        borderRadius: '8px',
        fontSize: '14px'
      }}>
        <h3>测试说明</h3>
        <p><strong>期望行为：</strong></p>
        <ol style={{ paddingLeft: '20px' }}>
          <li>首次对话时，AI应该询问产品信息（信息完整度 0/4）</li>
          <li>依次收集：产品详情 → 产品特色 → 用户群体 → 文案字数</li>
          <li>每次回答后，信息完整度应该增加（1/4, 2/4, 3/4, 4/4）</li>
          <li>当达到4/4时，AI开始生成营销文案</li>
          <li>不应该直接跳到LLM0或LLM3阶段</li>
        </ol>
        <div style={{ 
          marginTop: '15px', 
          padding: '10px', 
          background: '#e7f3ff', 
          borderRadius: '4px'
        }}>
          <strong>💡 提示：</strong> 使用快速测试按钮依次点击，观察信息完整度的变化
        </div>
      </div>
    </div>
  );
}