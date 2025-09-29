import React from 'react';
import { RefreshCw, Play, CheckCircle, FileText } from 'lucide-react';
import { Message } from '../../hooks/usePainPointBranches';

interface PainPointBranchContentProps {
  messages: Message[];
  onWorkflowButtonClick: (message: string) => void;
  onRegenerateResponse: (messageIndex: number) => void;
  isLoading: boolean;
  isLLM3Stage: (message: Message) => boolean;
  isContentStrategyStage: (message: Message) => boolean;
  isFinalContentStage: (message: Message) => boolean;
  extractPainPointContent: (content: string, painPointNumber: number) => string;
}

export const PainPointBranchContent: React.FC<PainPointBranchContentProps> = ({
  messages,
  onWorkflowButtonClick,
  onRegenerateResponse,
  isLoading,
  isLLM3Stage,
  isContentStrategyStage,
  isFinalContentStage,
  extractPainPointContent
}) => {
  if (messages.length === 0) return null;

  return (
    <div className="space-y-4">
      {messages.map((message, index) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] p-3 rounded-lg ${
              message.role === 'user'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-900'
            }`}
          >
            <div className="whitespace-pre-wrap">{message.content}</div>
            
            {/* 时间戳 */}
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs opacity-70">
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>
            
            {/* 按钮区域 - 只为assistant消息显示 */}
            {message.role === 'assistant' && message.id !== 'welcome' && (
              <div className="mt-2 flex gap-2">
                {/* Regenerate按钮 - 为非特殊阶段显示 */}
                {!message.content.includes('COMPLETENESS: 4') && 
                 !isLLM3Stage(message) && 
                 !isContentStrategyStage(message) && (
                  <button
                    onClick={() => onRegenerateResponse(index)}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded transition-all disabled:opacity-50"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Regenerate
                  </button>
                )}
                
                {/* 开始生成痛点按钮 */}
                {message.content.includes('COMPLETENESS: 4') && !message.metadata?.isRegenerated && (
                  <button
                    onClick={() => onWorkflowButtonClick('开始生成痛点')}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1 text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded transition-all disabled:opacity-50"
                  >
                    <Play className="w-3 h-3" />
                    Start Generating Pain Points
                  </button>
                )}
                
                {/* 痛点选择按钮 - 不在LLM3阶段显示 */}
                {message.content.includes('"problem":') && 
                 message.content.includes('"justification":') && 
                 !isLLM3Stage(message) && (
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        const painPointContent = extractPainPointContent(message.content, 1);
                        onWorkflowButtonClick(painPointContent || '痛点1');
                      }}
                      disabled={isLoading}
                      className="inline-flex items-center gap-1 text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded transition-all disabled:opacity-50"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Pain Point 1
                    </button>
                    <button
                      onClick={() => {
                        const painPointContent = extractPainPointContent(message.content, 2);
                        onWorkflowButtonClick(painPointContent || '痛点2');
                      }}
                      disabled={isLoading}
                      className="inline-flex items-center gap-1 text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded transition-all disabled:opacity-50"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Pain Point 2
                    </button>
                    <button
                      onClick={() => {
                        const painPointContent = extractPainPointContent(message.content, 3);
                        onWorkflowButtonClick(painPointContent || '痛点3');
                      }}
                      disabled={isLoading}
                      className="inline-flex items-center gap-1 text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded transition-all disabled:opacity-50"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Pain Point 3
                    </button>
                  </div>
                )}
                
                {/* Generate Content Strategy按钮 - LLM3阶段且非内容策略消息 */}
                {isLLM3Stage(message) && !isContentStrategyStage(message) && (
                  <div className="mt-2">
                    <button
                      onClick={() => onWorkflowButtonClick('biubiu')}
                      disabled={isLoading}
                      className="inline-flex items-center gap-1 text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded transition-all disabled:opacity-50"
                    >
                      <FileText className="w-3 h-3" />
                      Generate Content Strategy
                    </button>
                  </div>
                )}
                
                {/* 确认按钮 - 内容策略阶段 */}
                {isContentStrategyStage(message) && (
                  <div className="mt-2">
                    <button
                      onClick={() => onWorkflowButtonClick('确认')}
                      disabled={isLoading}
                      className="inline-flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition-all disabled:opacity-50"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Confirm & Continue
                    </button>
                  </div>
                )}
                
                {/* 最终文案Regenerate按钮 */}
                {isFinalContentStage(message) && (
                  <div className="mt-2">
                    <button
                      onClick={() => onRegenerateResponse(index)}
                      disabled={isLoading}
                      className="inline-flex items-center gap-1 text-xs bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded transition-all disabled:opacity-50"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Regenerate Content
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};