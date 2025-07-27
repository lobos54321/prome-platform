import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calculator, InfoIcon } from 'lucide-react';
import { isDifyEnabled } from '@/api/dify-api';

export default function PointsCalculator() {
  const [inputTokens, setInputTokens] = useState(1000);
  const [outputTokens, setOutputTokens] = useState(500);
  const [estimatedCost, setEstimatedCost] = useState(0);

  const calculateCost = () => {
    // Simple calculation: 1 token = 0.1 points
    const cost = (inputTokens * 0.05) + (outputTokens * 0.1);
    setEstimatedCost(Math.round(cost));
  };

  if (!isDifyEnabled()) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">积分计算器</h2>
            <p className="text-gray-500">Dify集成已禁用</p>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <InfoIcon className="h-5 w-5" />
              计算器功能不可用
            </CardTitle>
            <CardDescription>
              Dify集成功能已禁用，无法计算Token费用
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">积分计算器</h2>
          <p className="text-gray-500">简单的Token费用计算</p>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Token费用计算
            </CardTitle>
            <CardDescription>
              估算Token使用的积分费用
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inputTokens">输入Tokens</Label>
                <Input
                  id="inputTokens"
                  type="number"
                  value={inputTokens}
                  onChange={(e) => setInputTokens(Number(e.target.value))}
                  placeholder="1000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outputTokens">输出Tokens</Label>
                <Input
                  id="outputTokens"
                  type="number"
                  value={outputTokens}
                  onChange={(e) => setOutputTokens(Number(e.target.value))}
                  placeholder="500"
                />
              </div>
            </div>
            
            <Button onClick={calculateCost} className="w-full">
              计算费用
            </Button>
            
            {estimatedCost > 0 && (
              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  预估费用: {estimatedCost} 积分
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>计费规则</CardTitle>
            <CardDescription>
              基本的Token计费规则
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>输入Token</span>
                <span>0.05 积分/token</span>
              </div>
              <div className="flex justify-between">
                <span>输出Token</span>
                <span>0.1 积分/token</span>
              </div>
            </div>
            
            <Alert className="mt-4">
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                实际费用会根据所使用的AI模型有所不同
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}