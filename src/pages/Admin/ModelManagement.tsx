import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DollarSign, InfoIcon, Loader2, Save, Calculator, Sparkles, Activity, CreditCard, Settings } from 'lucide-react';
import { isDifyEnabled } from '@/api/dify-api';
import { authService } from '@/lib/auth';
import { db } from '@/lib/supabase';
import { toast } from 'sonner';

export default function ModelManagement() {
  const [exchangeRate, setExchangeRate] = useState(10000);
  const [newExchangeRate, setNewExchangeRate] = useState(10000);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);
  
  // 利润比例控制
  const [profitMargin, setProfitMargin] = useState(25);
  const [newProfitMargin, setNewProfitMargin] = useState(25);
  const [isUpdatingMargin, setIsUpdatingMargin] = useState(false);
  
  // 管理员充值功能
  const [rechargeAmount, setRechargeAmount] = useState(10000);
  const [isRecharging, setIsRecharging] = useState(false);
  
  // Token consumption calculator states
  const [calculatorTokens, setCalculatorTokens] = useState(1000);

  useEffect(() => {
    if (isDifyEnabled()) {
      loadData();
    }
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const currentRate = await db.getCurrentExchangeRate();
      setExchangeRate(currentRate);
      setNewExchangeRate(currentRate);
      
      // 加载利润比例设置（从localStorage或设置API）
      const savedMargin = localStorage.getItem('profit_margin');
      if (savedMargin) {
        const margin = parseInt(savedMargin);
        setProfitMargin(margin);
        setNewProfitMargin(margin);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('加载数据失败');
    } finally {
      setIsLoading(false);
    }
  };


  const updateExchangeRate = async () => {
    if (newExchangeRate <= 0) {
      toast.error('汇率必须大于0');
      return;
    }

    try {
      setIsUpdatingRate(true);
      const user = await authService.getCurrentUser();
      if (!user) {
        toast.error('用户认证失败');
        return;
      }

      const updatedRate = await db.updateExchangeRate(
        newExchangeRate,
        user.id,
        '管理员手动更新汇率'
      );

      setExchangeRate(updatedRate);
      toast.success('汇率更新成功');
    } catch (error) {
      console.error('Error updating exchange rate:', error);
      toast.error('更新汇率失败');
    } finally {
      setIsUpdatingRate(false);
    }
  };

  const updateProfitMargin = async () => {
    if (newProfitMargin < 0 || newProfitMargin > 100) {
      toast.error('利润比例必须在0-100之间');
      return;
    }

    try {
      setIsUpdatingMargin(true);
      // 保存到localStorage（也可以保存到数据库）
      localStorage.setItem('profit_margin', newProfitMargin.toString());
      setProfitMargin(newProfitMargin);
      
      // 通知全局系统更新利润比例
      window.dispatchEvent(new CustomEvent('profit-margin-updated', {
        detail: { margin: newProfitMargin }
      }));
      
      toast.success(`利润比例更新为 ${newProfitMargin}%`);
    } catch (error) {
      console.error('Error updating profit margin:', error);
      toast.error('更新利润比例失败');
    } finally {
      setIsUpdatingMargin(false);
    }
  };

  const adminRecharge = async () => {
    if (rechargeAmount <= 0) {
      toast.error('充值金额必须大于0');
      return;
    }

    try {
      setIsRecharging(true);
      const user = await authService.getCurrentUser();
      if (!user) {
        toast.error('用户认证失败');
        return;
      }

      // 管理员充值
      const result = await db.addCreditsToAdmin(
        user.email,
        rechargeAmount,
        `管理员充值: ${rechargeAmount}积分`
      );

      if (result.success) {
        toast.success(`充值成功！当前余额: ${result.newBalance} 积分`);
        // 触发余额更新事件
        window.dispatchEvent(new CustomEvent('balance-updated', {
          detail: { balance: result.newBalance }
        }));
      } else {
        toast.error(result.message || '充值失败');
      }
    } catch (error) {
      console.error('Error recharging:', error);
      toast.error('充值失败');
    } finally {
      setIsRecharging(false);
    }
  };

  // Token consumption calculation functions using standard pricing
  const calculateTokenCost = (inputTokens: number, outputTokens: number) => {
    // 使用标准定价：输入$0.002/1K, 输出$0.006/1K (加25%利润后的价格)
    const standardInputPrice = 0.002;
    const standardOutputPrice = 0.006;
    
    const inputCost = (inputTokens / 1000) * standardInputPrice;
    const outputCost = (outputTokens / 1000) * standardOutputPrice;
    const totalCost = inputCost + outputCost;
    const creditsDeducted = Math.round(totalCost * exchangeRate);
    
    return {
      inputCost,
      outputCost,
      totalCost,
      creditsDeducted
    };
  };

  const calculatorResult = calculateTokenCost(calculatorTokens * 0.7, calculatorTokens * 0.3);

  if (!isDifyEnabled()) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">模型管理</h2>
            <p className="text-gray-500">Dify集成已禁用</p>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <InfoIcon className="h-5 w-5" />
              模型管理不可用
            </CardTitle>
            <CardDescription>
              Dify集成功能已禁用，无法管理模型配置
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                要启用此功能，请在环境变量中设置 VITE_ENABLE_DIFY_INTEGRATION=true
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">模型管理</h2>
            <p className="text-gray-500">加载中...</p>
          </div>
        </div>
        
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">模型管理</h2>
          <p className="text-gray-500">汇率配置和自动积分扣除系统</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Exchange Rate Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              汇率配置
            </CardTitle>
            <CardDescription>
              设置1美元等于多少积分 (当前: 1 USD = {exchangeRate} 积分)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="exchangeRate">新汇率 (积分/美元)</Label>
                <Input
                  id="exchangeRate"
                  type="number"
                  min="1"
                  step="100"
                  value={newExchangeRate}
                  onChange={(e) => setNewExchangeRate(Number(e.target.value))}
                  placeholder="10000"
                />
              </div>
              <Button 
                onClick={updateExchangeRate} 
                disabled={isUpdatingRate || newExchangeRate === exchangeRate}
              >
                {isUpdatingRate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                更新汇率
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              汇率变更将影响所有后续的Token消费计算
            </p>
          </CardContent>
        </Card>

        {/* Profit Margin Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              利润比例配置
            </CardTitle>
            <CardDescription>
              设置在Dify原价基础上的利润比例 (当前: {profitMargin}%)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="profitMargin">利润比例 (%)</Label>
                <Input
                  id="profitMargin"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={newProfitMargin}
                  onChange={(e) => setNewProfitMargin(Number(e.target.value))}
                  placeholder="25"
                />
              </div>
              <Button 
                onClick={updateProfitMargin} 
                disabled={isUpdatingMargin || newProfitMargin === profitMargin}
              >
                {isUpdatingMargin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                更新利润比例
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              利润比例变更将影响所有后续的计费计算。例如：25% = Dify原价 × 1.25
            </p>
          </CardContent>
        </Card>

        {/* Admin Recharge */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              管理员充值
            </CardTitle>
            <CardDescription>
              为当前管理员账号充值积分
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="rechargeAmount">充值金额 (积分)</Label>
                <Input
                  id="rechargeAmount"
                  type="number"
                  min="1"
                  step="100"
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(Number(e.target.value))}
                  placeholder="10000"
                />
              </div>
              <Button 
                onClick={adminRecharge} 
                disabled={isRecharging}
                className="bg-green-600 hover:bg-green-700"
              >
                {isRecharging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <CreditCard className="mr-2 h-4 w-4" />
                立即充值
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              管理员可以直接为自己的账号充值积分用于测试
            </p>
          </CardContent>
        </Card>

        {/* Token Consumption to Credits Conversion */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              自动积分扣除逻辑
            </CardTitle>
            <CardDescription>
              Token消费自动扣除积分的完整转换逻辑和计算器
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Conversion Logic Explanation */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <InfoIcon className="h-4 w-4" />
                核心计费逻辑
              </h4>
              <div className="text-sm text-gray-700 space-y-2">
                <p>• <strong>价格获取</strong>: 从Dify的message_end事件中获取真实的usage价格信息</p>
                <p>• <strong>利润计算</strong>: 在Dify原价基础上加{profitMargin}%作为利润 (Dify原价 × {(1 + profitMargin/100).toFixed(2)})</p>
                <p>• <strong>积分转换</strong>: 积分扣除 = 加利润后的USD成本 × 汇率({exchangeRate} 积分/USD)</p>
                <p>• <strong>余额扣除</strong>: 自动从用户账户扣除对应积分，余额不足时停止服务</p>
                <p>• <strong>记录追踪</strong>: 所有消费记录保存到数据库，支持审计和查询</p>
              </div>
            </div>

            {/* Token Cost Calculator */}
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-4 flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Token消费积分计算器
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="calcTokens">Token数量</Label>
                    <Input
                      id="calcTokens"
                      type="number"
                      min="1"
                      step="100"
                      value={calculatorTokens}
                      onChange={(e) => setCalculatorTokens(Number(e.target.value))}
                      placeholder="1000"
                    />
                    <p className="text-xs text-gray-500 mt-1">假设输入70%, 输出30%</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm font-medium text-gray-700">动态定价模型</p>
                    <p className="text-xs text-gray-600">基于Dify真实价格 + 25%利润</p>
                    <p className="text-xs text-gray-500">示例显示保守估算价格</p>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h5 className="font-medium mb-2">计算结果</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>输入Tokens ({Math.round(calculatorTokens * 0.7)}):</span>
                      <span>${calculatorResult.inputCost.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>输出Tokens ({Math.round(calculatorTokens * 0.3)}):</span>
                      <span>${calculatorResult.outputCost.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-medium">
                      <span>总成本:</span>
                      <span>${calculatorResult.totalCost.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-blue-600 font-medium">
                      <span>扣除积分:</span>
                      <span>{calculatorResult.creditsDeducted} 积分</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Current Rate Summary */}
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">当前转换率总览</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">汇率</p>
                  <p className="font-medium">{exchangeRate} 积分/USD</p>
                </div>
                <div>
                  <p className="text-gray-600">1K Token (输入)</p>
                  <p className="font-medium">{Math.round(0.002 * exchangeRate)} 积分</p>
                </div>
                <div>
                  <p className="text-gray-600">1K Token (输出)</p>
                  <p className="font-medium">{Math.round(0.006 * exchangeRate)} 积分</p>
                </div>
                <div>
                  <p className="text-gray-600">系统状态</p>
                  <p className="font-medium text-green-600">自动运行</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 自动模型管理说明 */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <Sparkles className="h-5 w-5" />
              🚀 自动模型管理
            </CardTitle>
            <CardDescription className="text-green-600">
              系统自动识别Dify工作流中使用的模型，并自动添加{profitMargin}%利润空间
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-green-700 space-y-2">
              <p>• <strong>动态定价</strong>: 基于Dify返回的真实usage价格信息 + {profitMargin}%利润</p>
              <p>• <strong>自动计费</strong>: 从message_end事件中提取真实成本，加利润后扣除积分</p>
              <p>• <strong>透明计费</strong>: 用户只看到扣除的积分数量，系统自动处理价格计算</p>
              <p>• <strong>完整审计</strong>: 记录Dify原价、加利润后价格和积分扣除，支持完整审计</p>
              <p>• <strong>实时调控</strong>: 利润比例修改立即生效，影响所有后续计费</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}