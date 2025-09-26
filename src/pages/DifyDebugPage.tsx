import React, { useState } from 'react';

export default function DifyDebugPage() {
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [testMessage, setTestMessage] = useState('你好');
  const [isLoading, setIsLoading] = useState(false);
  const [lastConversationId, setLastConversationId] = useState<string>('');
  const [lastUserId, setLastUserId] = useState<string>('');

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const clearLogs = () => {
    setDebugLogs([]);
  };

  const testDifyDirectly = async () => {
    setIsLoading(true);
    addLog('🔍 开始直接测试Dify API');
    
    try {
      // 清除所有localStorage状态
      ['dify_conversation_id', 'dify_user_id', 'dify_session_timestamp'].forEach(key => {
        localStorage.removeItem(key);
      });
      addLog('🧹 已清除所有localStorage状态');
      
      // 生成新的用户ID
      const userId = 'debug-user-' + Date.now();
      addLog(`👤 生成测试用户ID: ${userId}`);
      
      const requestData = {
        query: testMessage,
        user: userId,
        response_mode: 'blocking',
        auto_generate_name: true,
        inputs: {}
      };
      
      addLog(`📤 发送请求数据: ${JSON.stringify(requestData, null, 2)}`);
      
      const response = await fetch('/api/dify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });
      
      addLog(`📥 响应状态: ${response.status} ${response.statusText}`);
      addLog(`📥 响应头: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}`);
      
      const responseData = await response.json();
      addLog(`📋 响应数据: ${JSON.stringify(responseData, null, 2)}`);
      
      if (responseData.conversation_id) {
        addLog(`🔑 获取到conversation_id: ${responseData.conversation_id}`);
        setLastConversationId(responseData.conversation_id);
        setLastUserId(userId);
        
        // 测试第二次请求（应该保持在同一对话）
        addLog('🔄 测试第二次请求（相同用户ID和conversation_id）');
        
        const secondRequest = {
          query: testMessage,
          user: userId,
          conversation_id: responseData.conversation_id,
          response_mode: 'blocking',
          auto_generate_name: true,
          inputs: {}
        };
        
        addLog(`📤 第二次请求: ${JSON.stringify(secondRequest, null, 2)}`);
        
        const secondResponse = await fetch('/api/dify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(secondRequest)
        });
        
        const secondData = await secondResponse.json();
        addLog(`📋 第二次响应: ${JSON.stringify(secondData, null, 2)}`);
        
        // 比较conversation_id是否一致
        if (secondData.conversation_id === responseData.conversation_id) {
          addLog('✅ 对话ID保持一致 - 这是好现象');
        } else {
          addLog(`❌ 对话ID不一致: ${responseData.conversation_id} -> ${secondData.conversation_id}`);
        }
      }
      
    } catch (error) {
      addLog(`❌ 测试失败: ${error}`);
      console.error('Dify debug test failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testStreamingMode = async () => {
    setIsLoading(true);
    addLog('🌊 开始测试流式模式');
    
    try {
      const userId = 'debug-stream-' + Date.now();
      addLog(`👤 生成流式测试用户ID: ${userId}`);
      
      const requestData = {
        query: testMessage,
        user: userId,
        response_mode: 'streaming',
        stream: true,
        auto_generate_name: true,
        inputs: {}
      };
      
      addLog(`📤 流式请求: ${JSON.stringify(requestData, null, 2)}`);
      
      const response = await fetch('/api/dify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });
      
      addLog(`📥 流式响应状态: ${response.status}`);
      addLog(`📥 Content-Type: ${response.headers.get('content-type')}`);
      
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let chunks = 0;
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          chunks++;
          addLog(`📦 Chunk ${chunks}: ${chunk.substring(0, 200)}${chunk.length > 200 ? '...' : ''}`);
          
          // 尝试解析每个chunk
          const lines = chunk.split('\n').filter(line => line.trim());
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                if (data.conversation_id) {
                  addLog(`🔑 流式响应中的conversation_id: ${data.conversation_id}`);
                }
                if (data.event) {
                  addLog(`🎯 事件类型: ${data.event}`);
                }
              } catch (parseError) {
                // 忽略解析错误
              }
            }
          }
        }
      }
      
    } catch (error) {
      addLog(`❌ 流式测试失败: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testContinueConversation = async () => {
    if (!lastConversationId || !lastUserId) {
      addLog('❌ 没有可继续的对话，请先运行一次阻塞模式测试');
      return;
    }

    setIsLoading(true);
    addLog('🔄 开始测试继续对话');
    
    try {
      addLog(`👤 使用相同用户ID: ${lastUserId}`);
      addLog(`🔑 使用相同conversation_id: ${lastConversationId}`);
      
      const requestData = {
        query: testMessage,
        user: lastUserId,
        conversation_id: lastConversationId,
        response_mode: 'blocking',
        auto_generate_name: true,
        inputs: {}
      };
      
      addLog(`📤 继续对话请求: ${JSON.stringify(requestData, null, 2)}`);
      
      const response = await fetch('/api/dify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });
      
      addLog(`📥 继续对话响应状态: ${response.status} ${response.statusText}`);
      
      const responseData = await response.json();
      addLog(`📋 继续对话响应: ${JSON.stringify(responseData, null, 2)}`);
      
      // 比较conversation_id是否保持一致
      if (responseData.conversation_id === lastConversationId) {
        addLog('✅ 对话ID保持一致 - 这证明对话连续性正常');
      } else {
        addLog(`❌ 对话ID发生变化: ${lastConversationId} -> ${responseData.conversation_id}`);
      }
      
    } catch (error) {
      addLog(`❌ 继续对话测试失败: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
          <h1 className="text-2xl font-bold mb-4">🔍 Dify API 调试工具</h1>
          
          <div className="flex items-center gap-4 mb-4">
            <input
              type="text"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="测试消息"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
            />
            <button
              onClick={testDifyDirectly}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? '测试中...' : '测试阻塞模式'}
            </button>
            <button
              onClick={testStreamingMode}
              disabled={isLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? '测试中...' : '测试流式模式'}
            </button>
            <button
              onClick={testContinueConversation}
              disabled={isLoading || !lastConversationId}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
            >
              {isLoading ? '测试中...' : '继续对话测试'}
            </button>
            <button
              onClick={clearLogs}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              清除日志
            </button>
          </div>
          
          <div className="bg-black text-green-400 p-4 rounded-md h-96 overflow-y-auto font-mono text-sm">
            {debugLogs.length === 0 ? (
              <div className="text-gray-500">点击测试按钮开始调试...</div>
            ) : (
              debugLogs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h2 className="font-semibold text-yellow-800 mb-2">🎯 调试目标</h2>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• 验证第一次请求是否正确获取到conversation_id</li>
            <li>• 验证第二次请求是否保持相同的conversation_id</li>
            <li>• 检查chatflow是否正确执行欢迎语逻辑</li>
            <li>• 分析为什么直接跳到LLM3节点</li>
            <li>• 对比阻塞模式和流式模式的行为差异</li>
          </ul>
        </div>
      </div>
    </div>
  );
}