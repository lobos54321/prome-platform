import React from 'react';
import { DifyChatInterface } from '@/components/chat/DifyChatInterface';

export default function ChatTestPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
          <h1 className="text-2xl font-bold mb-4">聊天功能测试页面</h1>
          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>测试计划：</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>发送消息测试流式响应</li>
              <li>刷新页面测试消息恢复</li>
              <li>测试工作流节点显示</li>
              <li>测试新对话创建</li>
              <li>测试历史对话管理</li>
            </ul>
            <p className="mt-4"><strong>调试工具：</strong> 打开控制台，使用 <code>window.debugChat.checkLocalStorage()</code> 查看存储状态</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm">
          <DifyChatInterface 
            welcomeMessage="🧪 测试页面：欢迎使用聊天功能测试！您可以在这里测试所有聊天相关功能。"
            showWorkflowProgress={true}
            enableRetry={true}
          />
        </div>
      </div>
    </div>
  );
}