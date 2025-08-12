import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, InfoIcon, Loader2, Save, DollarSign, Bot, User, Workflow, Sparkles, Calculator, Activity } from 'lucide-react';
import { isDifyEnabled } from '@/api/dify-api';
import { authService } from '@/lib/auth';
import { db } from '@/lib/supabase';
import { ModelConfig } from '@/types';
import { toast } from 'sonner';

export default function ModelManagement() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [newModelName, setNewModelName] = useState('');
  const [newInputPrice, setNewInputPrice] = useState(0.05);
  const [newOutputPrice, setNewOutputPrice] = useState(0.1);
  const [newServiceType, setNewServiceType] = useState<'ai_model' | 'digital_human' | 'workflow' | 'custom'>('ai_model');
  const [newWorkflowCost, setNewWorkflowCost] = useState<number | undefined>(undefined);
  const [exchangeRate, setExchangeRate] = useState(10000);
  const [newExchangeRate, setNewExchangeRate] = useState(10000);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);
  // Token consumption calculator states
  const [calculatorTokens, setCalculatorTokens] = useState(1000);
  const [calculatorModel, setCalculatorModel] = useState<string>('');

  useEffect(() => {
    if (isDifyEnabled()) {
      loadData();
    }
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [modelConfigs, currentRate] = await Promise.all([
        db.getModelConfigs(),
        db.getCurrentExchangeRate()
      ]);
      
      setModels(modelConfigs);
      setExchangeRate(currentRate);
      setNewExchangeRate(currentRate);
      
      // Initialize calculator with first AI model
      const firstAiModel = modelConfigs.find(m => 
        (m.serviceType === 'ai_model' || m.serviceType === 'custom') && m.isActive
      ) || modelConfigs.find(m => m.serviceType === 'ai_model' || m.serviceType === 'custom');
      
      if (firstAiModel && !calculatorModel) {
        setCalculatorModel(firstAiModel.id);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('加载数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  const addModel = async () => {
    if (!newModelName.trim()) {
      toast.error('请输入模型名称');
      return;
    }

    // Validate based on service type
    if ((newServiceType === 'ai_model' || newServiceType === 'custom') && 
        (newInputPrice <= 0 || newOutputPrice <= 0)) {
      toast.error('AI模型和自定义服务需要输入有效的Token价格');
      return;
    }

    if ((newServiceType === 'workflow' || newServiceType === 'digital_human') && 
        (!newWorkflowCost || newWorkflowCost <= 0)) {
      toast.error('工作流和数字人服务需要输入有效的固定费用');
      return;
    }

    try {
      setIsAdding(true);
      const user = await authService.getCurrentUser();
      if (!user) {
        toast.error('用户认证失败');
        return;
      }

      const newModel = await db.addModelConfig(
        newModelName.trim(),
        newInputPrice,
        newOutputPrice,
        user.id,
        newServiceType,
        newWorkflowCost,
        false // Not auto-created since it's manually added by admin
      );

      if (newModel) {
        setModels([newModel, ...models]);
        setNewModelName('');
        setNewInputPrice(0.05);
        setNewOutputPrice(0.1);
        setNewServiceType('ai_model');
        setNewWorkflowCost(undefined);
        toast.success('模型添加成功');
      } else {
        toast.error('添加模型失败');
      }
    } catch (error) {
      console.error('Error adding model:', error);
      toast.error('添加模型失败');
    } finally {
      setIsAdding(false);
    }
  };

  const toggleModel = async (id: string) => {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        toast.error('用户认证失败');
        return;
      }

      const model = models.find(m => m.id === id);
      if (!model) return;

      const updatedModel = await db.updateModelConfig(
        id,
        { isActive: !model.isActive },
        user.id
      );

      if (updatedModel) {
        setModels(models.map(m => m.id === id ? updatedModel : m));
        toast.success(`模型已${updatedModel.isActive ? '启用' : '禁用'}`);
      } else {
        toast.error('更新模型状态失败');
      }
    } catch (error) {
      console.error('Error toggling model:', error);
      toast.error('更新模型状态失败');
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

  const getServiceTypeIcon = (serviceType: string) => {
    switch (serviceType) {
      case 'ai_model':
        return <Bot className="h-4 w-4" />;
      case 'digital_human':
        return <User className="h-4 w-4" />;
      case 'workflow':
        return <Workflow className="h-4 w-4" />;
      case 'custom':
        return <Sparkles className="h-4 w-4" />;
      default:
        return <Bot className="h-4 w-4" />;
    }
  };

  const getServiceTypeLabel = (serviceType: string) => {
    switch (serviceType) {
      case 'ai_model':
        return 'AI模型';
      case 'digital_human':
        return '数字人';
      case 'workflow':
        return '工作流';
      case 'custom':
        return '自定义服务';
      default:
        return 'AI模型';
    }
  };

  const getServiceTypeBadgeColor = (serviceType: string) => {
    switch (serviceType) {
      case 'ai_model':
        return 'bg-blue-100 text-blue-800';
      case 'digital_human':
        return 'bg-purple-100 text-purple-800';
      case 'workflow':
        return 'bg-green-100 text-green-800';
      case 'custom':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  // Token consumption calculation functions
  const calculateTokenCost = (inputTokens: number, outputTokens: number, model: ModelConfig) => {
    const inputCost = (inputTokens / 1000) * model.inputTokenPrice;
    const outputCost = (outputTokens / 1000) * model.outputTokenPrice;
    const totalCost = inputCost + outputCost;
    const creditsDeducted = Math.round(totalCost * exchangeRate);
    
    return {
      inputCost,
      outputCost,
      totalCost,
      creditsDeducted
    };
  };

  const getCalculatorModel = () => {
    return models.find(m => m.id === calculatorModel) || models.find(m => m.isActive) || models[0];
  };

  const calculatorResult = calculatorModel && getCalculatorModel() ? 
    calculateTokenCost(calculatorTokens * 0.7, calculatorTokens * 0.3, getCalculatorModel()!) : null;

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
          <p className="text-gray-500">管理AI模型配置和定价</p>
          
          {/* 自动模型统计 */}
          <div className="flex items-center gap-4 mt-2 text-sm">
            <div className="flex items-center gap-1">
              <Bot className="h-4 w-4 text-blue-500" />
              <span>总模型: {models.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <Sparkles className="h-4 w-4 text-green-500" />
              <span>自动识别: {models.filter(m => m.autoCreated).length}</span>
            </div>
            <div className="flex items-center gap-1">
              <User className="h-4 w-4 text-blue-500" />
              <span>手动设置: {models.filter(m => !m.autoCreated).length}</span>
            </div>
            <div className="flex items-center gap-1">
              <Activity className="h-4 w-4 text-orange-500" />
              <span>已启用: {models.filter(m => m.isActive).length}</span>
            </div>
          </div>
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

        {/* Token Consumption to Credits Conversion */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Token消费积分转换设置
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
                自动积分扣除逻辑
              </h4>
              <div className="text-sm text-gray-700 space-y-2">
                <p>• <strong>Token消费监听</strong>: 系统实时监听Dify iframe中的token消费事件</p>
                <p>• <strong>成本计算</strong>: 根据模型配置计算USD成本 = (输入tokens/1000 × 输入价格) + (输出tokens/1000 × 输出价格)</p>
                <p>• <strong>积分转换</strong>: 积分扣除 = USD成本 × 汇率({exchangeRate} 积分/USD)</p>
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
                  <div>
                    <Label htmlFor="calcModel">选择模型</Label>
                    <Select value={calculatorModel} onValueChange={setCalculatorModel}>
                      <SelectTrigger id="calcModel">
                        <SelectValue placeholder="选择模型进行计算" />
                      </SelectTrigger>
                      <SelectContent>
                        {models.filter(m => m.serviceType === 'ai_model' || m.serviceType === 'custom').map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.modelName} (${model.inputTokenPrice}/${model.outputTokenPrice}/1K)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {calculatorResult && (
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
                )}
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
                  <p className="font-medium">~{Math.round(0.001 * exchangeRate)} 积分</p>
                </div>
                <div>
                  <p className="text-gray-600">1K Token (输出)</p>
                  <p className="font-medium">~{Math.round(0.002 * exchangeRate)} 积分</p>
                </div>
                <div>
                  <p className="text-gray-600">活跃模型</p>
                  <p className="font-medium">{models.filter(m => m.isActive).length} 个</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 自动模型功能说明 */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <Sparkles className="h-5 w-5" />
              🚀 自动模型识别
            </CardTitle>
            <CardDescription className="text-green-600">
              系统会自动识别Dify工作流中使用的新模型，并自动添加25%利润空间
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-green-700 space-y-1">
              <p>• <strong>优先级：手动设置 > 自动识别 > Dify原价</strong></p>
              <p>• 您手动设置的价格始终优先于自动识别的价格</p>
              <p>• 当Dify返回新模型价格时，系统自动提取并计算25%利润</p>
              <p>• 自动创建的模型会标记为"自动识别"，您可以随时修改</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle className="h-5 w-5" />
                手动添加模型
              </CardTitle>
              <CardDescription>
                手动配置新的AI模型和定价 (价格单位: USD/1000 tokens)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="modelName">模型/服务名称</Label>
                <Input
                  id="modelName"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  placeholder="例如: GPT-4, 数字人服务, 自定义工作流"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceType">服务类型</Label>
                <Select value={newServiceType} onValueChange={(value: 'ai_model' | 'digital_human' | 'workflow' | 'custom') => setNewServiceType(value)}>
                  <SelectTrigger id="serviceType">
                    <SelectValue placeholder="选择服务类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai_model">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        AI模型 (按Token计费)
                      </div>
                    </SelectItem>
                    <SelectItem value="digital_human">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        数字人服务
                      </div>
                    </SelectItem>
                    <SelectItem value="workflow">
                      <div className="flex items-center gap-2">
                        <Workflow className="h-4 w-4" />
                        工作流 (固定费用)
                      </div>
                    </SelectItem>
                    <SelectItem value="custom">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        自定义服务
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {(newServiceType === 'ai_model' || newServiceType === 'custom') && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="inputPrice">输入价格 (USD/1000 tokens)</Label>
                    <Input
                      id="inputPrice"
                      type="number"
                      step="0.001"
                      min="0"
                      value={newInputPrice}
                      onChange={(e) => setNewInputPrice(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="outputPrice">输出价格 (USD/1000 tokens)</Label>
                    <Input
                      id="outputPrice"
                      type="number"
                      step="0.001"
                      min="0"
                      value={newOutputPrice}
                      onChange={(e) => setNewOutputPrice(Number(e.target.value))}
                    />
                  </div>
                </div>
              )}

              {(newServiceType === 'workflow' || newServiceType === 'digital_human') && (
                <div className="space-y-2">
                  <Label htmlFor="workflowCost">固定费用 (USD/次执行)</Label>
                  <Input
                    id="workflowCost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={newWorkflowCost || ''}
                    onChange={(e) => setNewWorkflowCost(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="例如: 0.10"
                  />
                  <p className="text-xs text-gray-500">
                    {newServiceType === 'workflow' ? '每次工作流执行的固定费用' : '每次数字人服务调用的费用'}
                  </p>
                </div>
              )}
              
              <Button onClick={addModel} className="w-full" disabled={isAdding}>
                {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                添加{getServiceTypeLabel(newServiceType)}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>现有模型</CardTitle>
              <CardDescription>
                管理已配置的AI模型 ({models.length} 个模型)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {models.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <p>暂无模型配置</p>
                    <p className="text-sm">请添加第一个模型配置</p>
                  </div>
                ) : (
                  models.map((model) => (
                    <div key={model.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {getServiceTypeIcon(model.serviceType)}
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {model.modelName}
                              {model.autoCreated ? (
                                <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                                  🤖 自动识别
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">
                                  🥇 手动设置
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Badge className={`text-xs ${getServiceTypeBadgeColor(model.serviceType)}`}>
                                {getServiceTypeLabel(model.serviceType)}
                              </Badge>
                            </div>
                            {(model.serviceType === 'ai_model' || model.serviceType === 'custom') ? (
                              <div className="text-sm text-gray-500">
                                输入: ${model.inputTokenPrice}/1K • 输出: ${model.outputTokenPrice}/1K
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500">
                                固定费用: ${model.workflowCost || 0}/次
                              </div>
                            )}
                            <div className="text-xs text-gray-400">
                              {(model.serviceType === 'ai_model' || model.serviceType === 'custom') ? (
                                <>
                                  <span>积分转换: </span>
                                  <span className="text-blue-600">
                                    {Math.round(model.inputTokenPrice * exchangeRate)} / {Math.round(model.outputTokenPrice * exchangeRate)} 积分/1K tokens
                                  </span>
                                  <br />
                                  <span>平均1K tokens ≈ </span>
                                  <span className="font-medium text-green-600">
                                    {Math.round(((model.inputTokenPrice + model.outputTokenPrice) / 2) * exchangeRate)} 积分
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span>积分转换: </span>
                                  <span className="text-blue-600">
                                    {Math.round((model.workflowCost || 0) * exchangeRate)} 积分/次
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={model.isActive ? "default" : "secondary"}>
                          {model.isActive ? '已启用' : '已禁用'}
                        </Badge>
                        <Switch
                          checked={model.isActive}
                          onCheckedChange={() => toggleModel(model.id)}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}