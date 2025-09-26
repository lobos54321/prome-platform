import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DebugConversationVariablesProps {
  conversationVariables: Record<string, unknown>;
  conversationId?: string;
}

/**
 * 调试组件 - 显示当前对话变量状态
 * 帮助开发者了解营销文案工作流的执行阶段
 */
export function DebugConversationVariables({ 
  conversationVariables, 
  conversationId 
}: DebugConversationVariablesProps) {
  const infoCompleteness = conversationVariables.conversation_info_completeness || 0;
  const collectionCount = conversationVariables.conversation_collection_count || 0;

  const getStageDescription = (completeness: number) => {
    switch (completeness) {
      case 0:
        return "等待开始信息收集";
      case 1:
        return "已收集产品详情";
      case 2:
        return "已收集产品特色";
      case 3:
        return "已收集用户群体";
      case 4:
        return "信息收集完成，可以生成文案";
      default:
        return `信息收集阶段 (${completeness}/4)`;
    }
  };

  const getStageColor = (completeness: number) => {
    if (completeness === 0) return "secondary";
    if (completeness < 4) return "default";
    return "success";
  };

  return (
    <Card className="mb-4 border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          🔍 对话状态调试
          {conversationId && (
            <Badge variant="outline" className="text-xs">
              {conversationId.slice(0, 8)}...
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              信息完整度
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getStageColor(infoCompleteness)} className="text-xs">
                {infoCompleteness}/4
              </Badge>
              <span className="text-sm">{getStageDescription(infoCompleteness)}</span>
            </div>
          </div>
          
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              收集次数
            </div>
            <Badge variant="outline" className="text-xs">
              {collectionCount}
            </Badge>
          </div>
        </div>

        {/* 显示其他对话变量 */}
        {Object.keys(conversationVariables).length > 2 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">
              其他变量
            </div>
            <div className="text-xs space-y-1">
              {Object.entries(conversationVariables)
                .filter(([key]) => 
                  key !== 'conversation_info_completeness' && 
                  key !== 'conversation_collection_count'
                )
                .map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{key}:</span>
                    <span className="font-mono">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 状态说明 */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          💡 当信息完整度达到4时，工作流将开始生成营销文案
        </div>
      </CardContent>
    </Card>
  );
}

export default DebugConversationVariables;