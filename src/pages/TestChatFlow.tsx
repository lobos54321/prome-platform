import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, RotateCcw } from 'lucide-react';
import useDifyChat from '@/hooks/useDifyChat';
import DebugConversationVariables from '@/components/DebugConversationVariables';

/**
 * 测试页面 - 验证营销文案工作流修复
 */
export default function TestChatFlow() {
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
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">营销文案工作流测试</h1>
        <p className="text-muted-foreground">
          测试修复后的Dify chatflow是否正确执行信息收集阶段
        </p>
      </div>

      {/* 调试信息 */}
      <DebugConversationVariables 
        conversationVariables={conversationVariables}
        conversationId={conversationId}
      />

      {/* 快速测试按钮 */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg">快速测试</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
            {testMessages.map((msg, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => sendMessage(msg)}
                disabled={isLoading}
                className="text-left justify-start"
              >
                {index + 1}. {msg}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={resetConversation}
              variant="destructive"
              size="sm"
              className="flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              重置对话
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 聊天界面 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            对话记录
            {conversationId && (
              <Badge variant="outline" className="text-xs">
                {conversationId.slice(0, 12)}...
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* 消息列表 */}
          <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                开始对话来测试工作流...
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <div className="text-sm font-medium mb-1">
                    {message.role === 'user' ? '用户' : 'AI助手'}
                  </div>
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  {message.metadata?.loading && (
                    <div className="text-xs mt-1 opacity-70">正在处理...</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 错误显示 */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-4">
              <div className="text-destructive text-sm">{error}</div>
            </div>
          )}

          {/* 输入区域 */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入消息..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>

          {/* 状态指示 */}
          <div className="mt-4 text-xs text-muted-foreground">
            {isLoading && '🤖 AI正在处理...'}
            {!isLoading && messages.length > 0 && '✅ 就绪'}
            {!isLoading && messages.length === 0 && '🚀 开始对话'}
          </div>
        </CardContent>
      </Card>

      {/* 测试说明 */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-lg">测试说明</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div>
            <strong>期望行为：</strong>
          </div>
          <ol className="list-decimal list-inside space-y-1 ml-4">
            <li>首次对话时，AI应该询问产品信息（信息完整度 0/4）</li>
            <li>依次收集：产品详情 → 产品特色 → 用户群体 → 文案字数</li>
            <li>每次回答后，信息完整度应该增加（1/4, 2/4, 3/4, 4/4）</li>
            <li>当达到4/4时，AI开始生成营销文案</li>
            <li>不应该直接跳到LLM0或LLM3阶段</li>
          </ol>
          <div className="mt-4 p-2 bg-blue-50 rounded">
            <strong>💡 提示：</strong> 使用快速测试按钮依次点击，观察信息完整度的变化
          </div>
        </CardContent>
      </Card>
    </div>
  );
}