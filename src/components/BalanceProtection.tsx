import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon, AlertTriangle } from 'lucide-react';
import { isDifyEnabled } from '@/lib/dify-api-client';

interface BalanceProtectionProps {
  modelName: string;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  onProceed?: () => void;
  onCancel?: () => void;
  showContinueButton?: boolean;
  className?: string;
}

export default function BalanceProtection({
  modelName,
  estimatedInputTokens = 1000,
  estimatedOutputTokens = 500,
  onProceed,
  onCancel,
  showContinueButton = true,
  className = ""
}: BalanceProtectionProps) {
  const [isLoading, setIsLoading] = useState(false);

  // If Dify integration is disabled, show a simple info message
  if (!isDifyEnabled()) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <InfoIcon className="h-5 w-5" />
            AI 服务准备就绪
          </CardTitle>
          <CardDescription>
            AI服务可以正常使用，无需余额检查
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              ProMe集成已禁用，AI服务使用基本配置运行
            </AlertDescription>
          </Alert>
          
          {showContinueButton && (
            <div className="flex gap-2 mt-4">
              {onProceed && (
                <Button 
                  onClick={onProceed} 
                  disabled={isLoading}
                  className="flex-1"
                >
                  继续使用 AI 服务
                </Button>
              )}
              {onCancel && (
                <Button 
                  variant="outline" 
                  onClick={onCancel}
                  disabled={isLoading}
                >
                  取消
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // If Dify is enabled, show a simplified balance check
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          余额检查
        </CardTitle>
        <CardDescription>
          使用模型: {modelName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            预计消耗: 输入 {estimatedInputTokens} tokens, 输出 {estimatedOutputTokens} tokens
          </AlertDescription>
        </Alert>
        
        {showContinueButton && (
          <div className="flex gap-2 mt-4">
            {onProceed && (
              <Button 
                onClick={onProceed} 
                disabled={isLoading}
                className="flex-1"
              >
                确认并继续
              </Button>
            )}
            {onCancel && (
              <Button 
                variant="outline" 
                onClick={onCancel}
                disabled={isLoading}
              >
                取消
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}