import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Calculator,
  Coins,
  Zap,
  RefreshCw
} from 'lucide-react';
import { CostEstimation, BalanceCheck, User } from '@/types';
import { checkBalanceBeforeAI, estimateAICost } from '@/api/dify-api';
import { authService } from '@/lib/auth';
import { toast } from '@/hooks/use-toast';

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
  className = ''
}: BalanceProtectionProps) {
  const [user, setUser] = useState<User | null>(null);
  const [balanceCheck, setBalanceCheck] = useState<BalanceCheck | null>(null);
  const [estimation, setEstimation] = useState<CostEstimation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Get current user
    const currentUser = authService.getCurrentUserSync();
    setUser(currentUser);
    
    if (!currentUser || !modelName) {
      setIsLoading(false);
      return;
    }
    
    checkBalance();
  }, [modelName, estimatedInputTokens, estimatedOutputTokens]);

  const checkBalance = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Get balance check and cost estimation
      const [balanceResult, estimationResult] = await Promise.all([
        checkBalanceBeforeAI(modelName, estimatedInputTokens, estimatedOutputTokens),
        estimateAICost(modelName, estimatedInputTokens, estimatedOutputTokens)
      ]);

      if (!balanceResult.canProceed && balanceResult.message) {
        setError(balanceResult.message);
      }

      // Extract balance check from the pre-consumption check result
      if (balanceResult.estimation) {
        setEstimation(balanceResult.estimation);
        
        // Simulate balance check data
        setBalanceCheck({
          hasEnoughBalance: balanceResult.canProceed,
          currentBalance: user?.balance || 50, // Default demo balance
          estimatedCost: balanceResult.estimation.estimatedPoints,
          requiredBalance: balanceResult.estimation.estimatedPoints,
          message: balanceResult.message
        });
      }

      if (estimationResult.success && estimationResult.data) {
        setEstimation(estimationResult.data);
      }

    } catch (err) {
      setError('余额检查失败: ' + (err as Error).message);
      toast({
        title: "余额检查失败",
        description: (err as Error).message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceed = () => {
    if (balanceCheck?.hasEnoughBalance && onProceed) {
      onProceed();
    }
  };

  const getBalanceStatusIcon = () => {
    if (!balanceCheck) return <RefreshCw className="h-5 w-5 animate-spin text-gray-500" />;
    
    return balanceCheck.hasEnoughBalance 
      ? <CheckCircle className="h-5 w-5 text-green-500" />
      : <XCircle className="h-5 w-5 text-red-500" />;
  };

  const getBalanceStatusColor = () => {
    if (!balanceCheck) return 'text-gray-500';
    return balanceCheck.hasEnoughBalance ? 'text-green-600' : 'text-red-600';
  };

  if (!user) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>请先登录以查看余额信息</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>检查余额中...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-blue-500" />
              余额检查
            </CardTitle>
            <CardDescription>
              使用 {modelName} 模型前的余额和费用预估
            </CardDescription>
          </div>
          {getBalanceStatusIcon()}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Balance Status */}
        {balanceCheck && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">当前余额</span>
              <Badge variant="outline" className="font-mono">
                {balanceCheck.currentBalance} 积分
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-medium">预估消耗</span>
              <Badge variant="outline" className="font-mono">
                {balanceCheck.estimatedCost} 积分
              </Badge>
            </div>

            {!balanceCheck.hasEnoughBalance && (
              <div className="flex items-center justify-between">
                <span className="font-medium text-red-600">所需余额</span>
                <Badge variant="destructive" className="font-mono">
                  {balanceCheck.requiredBalance} 积分
                </Badge>
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <span className="font-semibold">余额状态</span>
              <span className={`font-semibold ${getBalanceStatusColor()}`}>
                {balanceCheck.hasEnoughBalance ? '充足' : '不足'}
              </span>
            </div>
          </div>
        )}

        {/* Cost Estimation Details */}
        {estimation && (
          <div className="space-y-3">
            <Separator />
            
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="h-4 w-4 text-blue-500" />
              <span className="font-medium">费用明细</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">输入 Tokens</span>
                <div className="font-mono">{estimation.estimatedInputTokens}</div>
              </div>
              <div>
                <span className="text-muted-foreground">输出 Tokens</span>
                <div className="font-mono">{estimation.estimatedOutputTokens}</div>
              </div>
              <div>
                <span className="text-muted-foreground">输入费用</span>
                <div className="font-mono">{estimation.estimatedInputCost} 积分</div>
              </div>
              <div>
                <span className="text-muted-foreground">输出费用</span>
                <div className="font-mono">{estimation.estimatedOutputCost} 积分</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="font-semibold">总计费用</span>
              <Badge className="font-mono bg-blue-100 text-blue-800">
                {estimation.estimatedTotalCost} 积分
              </Badge>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {showContinueButton && (
          <div className="flex gap-2 pt-4">
            {balanceCheck?.hasEnoughBalance ? (
              <Button 
                onClick={handleProceed} 
                className="flex-1"
                size="lg"
              >
                <Zap className="h-4 w-4 mr-2" />
                继续使用 AI
              </Button>
            ) : (
              <Button 
                onClick={() => window.location.href = '/purchase'} 
                className="flex-1"
                size="lg"
              >
                <Coins className="h-4 w-4 mr-2" />
                充值积分
              </Button>
            )}
            
            {onCancel && (
              <Button 
                onClick={onCancel} 
                variant="outline"
                size="lg"
              >
                取消
              </Button>
            )}
          </div>
        )}

        {/* Refresh Button */}
        <div className="flex justify-center pt-2">
          <Button 
            onClick={checkBalance} 
            variant="ghost" 
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新检查
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}