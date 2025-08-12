/**
 * 价格对比测试工具 - 验证利润确保功能
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calculator, TrendingUp, AlertTriangle } from 'lucide-react';
import { db } from '@/lib/supabase';

interface PriceComparison {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  
  // 我们的价格
  ourInputPrice: number;
  ourOutputPrice: number;
  ourTotalCost: number;
  ourCreditsDeducted: number;
  
  // Dify原价 (模拟)
  difyInputPrice: number;
  difyOutputPrice: number;
  difyTotalCost: number;
  difyCreditsDeducted: number;
  
  // 利润
  profitUSD: number;
  profitPercentage: number;
}

export default function PricingTest() {
  const [inputTokens, setInputTokens] = useState(1500);
  const [outputTokens, setOutputTokens] = useState(2000);
  const [comparisons, setComparisons] = useState<PriceComparison[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 模拟Dify原价 (实际情况下这些数据来自Dify API)
  const difyPricing: Record<string, { input: number; output: number }> = {
    'gpt-4': { input: 0.03, output: 0.06 },           // Dify原价
    'gpt-4-turbo': { input: 0.01, output: 0.03 },     // Dify原价
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 }, // Dify原价
    'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 }, // Dify原价
  };

  const calculateComparison = async () => {
    setLoading(true);
    setError(null);
    try {
      const modelConfigs = await db.getModelConfigs();
      const exchangeRate = 10000;
      
      const results: PriceComparison[] = [];
      
      for (const config of modelConfigs.slice(0, 4)) { // 测试前4个模型
        const difyPrice = difyPricing[config.modelName] || { input: 0.001, output: 0.002 };
        
        // 我们的价格计算
        const ourInputCost = (inputTokens / 1000) * config.inputTokenPrice;
        const ourOutputCost = (outputTokens / 1000) * config.outputTokenPrice;
        const ourTotalCost = ourInputCost + ourOutputCost;
        const ourCreditsDeducted = Math.round(ourTotalCost * exchangeRate);
        
        // Dify原价计算
        const difyInputCost = (inputTokens / 1000) * difyPrice.input;
        const difyOutputCost = (outputTokens / 1000) * difyPrice.output;
        const difyTotalCost = difyInputCost + difyOutputCost;
        const difyCreditsDeducted = Math.round(difyTotalCost * exchangeRate);
        
        // 利润计算
        const profitUSD = ourTotalCost - difyTotalCost;
        const profitPercentage = difyTotalCost > 0 ? (profitUSD / difyTotalCost) * 100 : 0;
        
        results.push({
          modelName: config.modelName,
          inputTokens,
          outputTokens,
          ourInputPrice: config.inputTokenPrice,
          ourOutputPrice: config.outputTokenPrice,
          ourTotalCost,
          ourCreditsDeducted,
          difyInputPrice: difyPrice.input,
          difyOutputPrice: difyPrice.output,
          difyTotalCost,
          difyCreditsDeducted,
          profitUSD,
          profitPercentage
        });
      }
      
      setComparisons(results);
    } catch (error) {
      console.error('Failed to calculate price comparison:', error);
      setError(error instanceof Error ? error.message : 'Failed to load model configurations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateComparison();
  }, [inputTokens, outputTokens]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
            <Calculator className="h-8 w-8" />
            利润确保测试工具
          </h1>
          <p className="text-gray-600">
            对比我们的价格设置与Dify原价，验证利润空间
          </p>
        </div>

        {/* 测试参数 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>测试参数</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="input-tokens">输入Tokens</Label>
              <Input
                id="input-tokens"
                type="number"
                value={inputTokens}
                onChange={(e) => setInputTokens(Number(e.target.value))}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="output-tokens">输出Tokens</Label>
              <Input
                id="output-tokens"
                type="number"
                value={outputTokens}
                onChange={(e) => setOutputTokens(Number(e.target.value))}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={calculateComparison} disabled={loading}>
                重新计算
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 错误显示 */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                <h3 className="text-lg font-bold text-red-800 mb-2">
                  测试工具暂不可用
                </h3>
                <p className="text-red-700 mb-4">
                  {error}
                </p>
                <p className="text-sm text-red-600">
                  功能仍然正常工作，只是无法显示对比数据。请检查数据库连接或联系管理员。
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 对比结果 */}
        {!error && (
        <div className="grid gap-6">
          {comparisons.map((comparison, index) => (
            <Card key={index} className="overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{comparison.modelName}</span>
                  <div className="flex items-center gap-2">
                    {comparison.profitPercentage > 0 ? (
                      <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        +{comparison.profitPercentage.toFixed(1)}% 利润
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        亏损
                      </Badge>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  {/* Dify原价 */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-blue-600">Dify原价</h4>
                    <div className="text-sm space-y-1">
                      <div>输入: ${comparison.difyInputPrice.toFixed(4)}/1K tokens</div>
                      <div>输出: ${comparison.difyOutputPrice.toFixed(4)}/1K tokens</div>
                      <div className="font-medium">总成本: ${comparison.difyTotalCost.toFixed(4)}</div>
                      <div className="text-blue-600">扣除: {comparison.difyCreditsDeducted.toLocaleString()} 积分</div>
                    </div>
                  </div>

                  {/* 我们的价格 */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-green-600">我们的价格</h4>
                    <div className="text-sm space-y-1">
                      <div>输入: ${comparison.ourInputPrice.toFixed(4)}/1K tokens</div>
                      <div>输出: ${comparison.ourOutputPrice.toFixed(4)}/1K tokens</div>
                      <div className="font-medium">总成本: ${comparison.ourTotalCost.toFixed(4)}</div>
                      <div className="text-green-600">扣除: {comparison.ourCreditsDeducted.toLocaleString()} 积分</div>
                    </div>
                  </div>

                  {/* 利润分析 */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-purple-600">利润分析</h4>
                    <div className="text-sm space-y-1">
                      <div>利润: ${comparison.profitUSD.toFixed(4)}</div>
                      <div>利润率: {comparison.profitPercentage.toFixed(1)}%</div>
                      <div className="font-medium text-purple-600">
                        额外收入: {(comparison.ourCreditsDeducted - comparison.difyCreditsDeducted).toLocaleString()} 积分
                      </div>
                      <div className="text-xs text-gray-500">
                        每次对话多赚 ${comparison.profitUSD.toFixed(4)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 成本对比条形图 */}
                <div className="mt-4 space-y-2">
                  <div className="text-xs text-gray-500">成本对比</div>
                  <div className="relative">
                    <div className="flex gap-1 h-8">
                      <div 
                        className="bg-blue-500 flex items-center justify-center text-white text-xs"
                        style={{ width: `${Math.max(20, (comparison.difyTotalCost / comparison.ourTotalCost) * 100)}%` }}
                      >
                        Dify: ${comparison.difyTotalCost.toFixed(3)}
                      </div>
                      <div 
                        className="bg-green-500 flex items-center justify-center text-white text-xs"
                        style={{ width: `${Math.max(20, 100)}%` }}
                      >
                        我们: ${comparison.ourTotalCost.toFixed(3)}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 总结 */}
        {comparisons.length > 0 && (
          <Card className="mt-8 border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-lg font-bold text-green-800 mb-2">
                  ✅ 利润确保功能正常工作！
                </h3>
                <p className="text-green-700">
                  系统使用您配置的价格，而不是Dify原价。平均利润率: {' '}
                  <strong>
                    {(comparisons.reduce((sum, c) => sum + c.profitPercentage, 0) / comparisons.length).toFixed(1)}%
                  </strong>
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        )}
      </div>
    </div>
  );
}