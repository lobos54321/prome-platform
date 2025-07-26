import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, DollarSign, Calculator, Save, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { PointsConfig, PointsConsumptionRule, ExchangeRateHistory } from '@/types';
import { adminServicesAPI } from '@/lib/admin-services';
import { toast } from '@/hooks/use-toast';

export default function PointsCalculator() {
  const [exchangeRate, setExchangeRate] = useState<number>(10000); // 10000 points = 1 USD
  const [newExchangeRate, setNewExchangeRate] = useState<number>(10000);
  const [exchangeRateReason, setExchangeRateReason] = useState<string>('');
  const [exchangeRateHistory, setExchangeRateHistory] = useState<ExchangeRateHistory[]>([]);
  const [consumptionRules, setConsumptionRules] = useState<PointsConsumptionRule[]>([]);
  const [newRule, setNewRule] = useState<Partial<PointsConsumptionRule>>({
    functionName: '',
    pointsPerToken: 1,
    description: '',
    isActive: true
  });
  const [editingRule, setEditingRule] = useState<PointsConsumptionRule | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isExchangeRateDialogOpen, setIsExchangeRateDialogOpen] = useState(false);

  // 计算预览数据
  const [previewTokens, setPreviewTokens] = useState<number>(1000);
  const [selectedFunction, setSelectedFunction] = useState<string>('');
  const [previewUSD, setPreviewUSD] = useState<number>(10);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rate, history] = await Promise.all([
        adminServicesAPI.getExchangeRate(),
        adminServicesAPI.getExchangeRateHistory()
      ]);
      
      setExchangeRate(rate);
      setNewExchangeRate(rate);
      setExchangeRateHistory(history);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    
    // Load consumption rules (mock data for now)
    loadConsumptionRules();
  };

  const loadConsumptionRules = () => {
    // 模拟消耗规则数据
    const mockRules: PointsConsumptionRule[] = [
      {
        id: '1',
        functionName: '直播口播文案生成',
        pointsPerToken: 1,
        description: '每个token消耗1积分',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '2',
        functionName: '短视频脚本生成',
        pointsPerToken: 1.2,
        description: '每个token消耗1.2积分',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '3',
        functionName: '智能写作助手',
        pointsPerToken: 0.8,
        description: '每个token消耗0.8积分',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    setConsumptionRules(mockRules);
    if (mockRules.length > 0) {
      setSelectedFunction(mockRules[0].id);
    }
  };

  const handleSaveExchangeRate = async () => {
    if (newExchangeRate <= 0) {
      toast({
        title: "无效的汇率",
        description: "汇率必须大于0",
        variant: "destructive"
      });
      return;
    }

    try {
      const updatedRate = await adminServicesAPI.updateExchangeRate(
        newExchangeRate, 
        exchangeRateReason || undefined
      );
      
      setExchangeRate(updatedRate);
      setExchangeRateReason('');
      setIsExchangeRateDialogOpen(false);
      
      // Reload history
      const history = await adminServicesAPI.getExchangeRateHistory();
      setExchangeRateHistory(history);
      
      toast({
        title: "汇率设置已保存",
        description: `新汇率：${updatedRate.toLocaleString()} 积分 = 1 美元`,
      });
    } catch (error) {
      toast({
        title: "保存失败",
        description: (error as Error).message,
        variant: "destructive"
      });
    }
  };

  const handleAddRule = () => {
    if (!newRule.functionName || !newRule.pointsPerToken) {
      toast({
        title: "请填写完整信息",
        description: "功能名称和积分消耗不能为空",
        variant: "destructive"
      });
      return;
    }

    const rule: PointsConsumptionRule = {
      id: Date.now().toString(),
      functionName: newRule.functionName!,
      pointsPerToken: newRule.pointsPerToken!,
      description: newRule.description || '',
      isActive: newRule.isActive || true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setConsumptionRules(prev => [...prev, rule]);
    setNewRule({
      functionName: '',
      pointsPerToken: 1,
      description: '',
      isActive: true
    });
    setIsAddDialogOpen(false);
    toast({
      title: "消耗规则已添加",
      description: `已为 ${rule.functionName} 设置消耗规则`,
    });
  };

  const handleEditRule = () => {
    if (!editingRule) return;

    setConsumptionRules(prev => 
      prev.map(rule => 
        rule.id === editingRule.id 
          ? { ...editingRule, updatedAt: new Date().toISOString() }
          : rule
      )
    );
    setEditingRule(null);
    setIsEditDialogOpen(false);
    toast({
      title: "消耗规则已更新",
      description: `${editingRule.functionName} 的规则已更新`,
    });
  };

  const handleDeleteRule = (id: string) => {
    setConsumptionRules(prev => prev.filter(rule => rule.id !== id));
    toast({
      title: "消耗规则已删除",
      description: "规则已从系统中移除",
    });
  };

  const calculatePreview = () => {
    const rule = consumptionRules.find(r => r.id === selectedFunction);
    if (!rule) return { points: 0, usd: 0 };
    
    const totalPoints = previewTokens * rule.pointsPerToken;
    const totalUSD = totalPoints / exchangeRate;
    
    return { points: totalPoints, usd: totalUSD };
  };

  const calculatePointsFromUSD = (usdAmount: number) => {
    return Math.floor(usdAmount * exchangeRate);
  };

  const calculateUSDFromPoints = (points: number) => {
    return points / exchangeRate;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const preview = calculatePreview();
  const pointsFromUSD = calculatePointsFromUSD(previewUSD);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* 汇率设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              积分汇率设置
            </CardTitle>
            <CardDescription>
              设置积分与美元的兑换比例
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-2">当前汇率</div>
              <div className="text-2xl font-bold text-blue-600">
                {exchangeRate.toLocaleString()} 积分 = 1 美元
              </div>
              <div className="text-xs text-gray-500 mt-1">
                1 积分 = ${calculateUSDFromPoints(1).toFixed(6)}
              </div>
            </div>
            <Dialog open={isExchangeRateDialogOpen} onOpenChange={setIsExchangeRateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  更新汇率
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>更新积分汇率</DialogTitle>
                  <DialogDescription>
                    修改积分与美元的兑换比例，此操作将影响所有定价计算
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newExchangeRate">新汇率（积分/美元）</Label>
                    <Input
                      id="newExchangeRate"
                      type="number"
                      min="1"
                      value={newExchangeRate}
                      onChange={(e) => setNewExchangeRate(parseInt(e.target.value) || 0)}
                      placeholder="例如：10000"
                    />
                    <div className="text-sm text-gray-500">
                      即：{newExchangeRate.toLocaleString()} 积分 = 1 美元
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exchangeRateReason">变更原因（可选）</Label>
                    <Textarea
                      id="exchangeRateReason"
                      value={exchangeRateReason}
                      onChange={(e) => setExchangeRateReason(e.target.value)}
                      placeholder="描述此次汇率调整的原因..."
                      rows={3}
                    />
                  </div>
                  {newExchangeRate !== exchangeRate && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        汇率从 {exchangeRate.toLocaleString()} 变更为 {newExchangeRate.toLocaleString()}，
                        变化幅度：{(((newExchangeRate - exchangeRate) / exchangeRate) * 100).toFixed(1)}%
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsExchangeRateDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleSaveExchangeRate}>
                    确认更新
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* 费用预览 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              费用预览计算器
            </CardTitle>
            <CardDescription>
              预览不同使用量的积分消耗
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="token-calc" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="token-calc">Token计算</TabsTrigger>
                <TabsTrigger value="usd-calc">美元换算</TabsTrigger>
              </TabsList>
              
              <TabsContent value="token-calc" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="previewTokens">Token数量</Label>
                  <Input
                    id="previewTokens"
                    type="number"
                    min="0"
                    value={previewTokens}
                    onChange={(e) => setPreviewTokens(parseInt(e.target.value) || 0)}
                    placeholder="输入token数量"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="selectedFunction">选择功能</Label>
                  <select
                    id="selectedFunction"
                    value={selectedFunction}
                    onChange={(e) => setSelectedFunction(e.target.value)}
                    className="w-full p-2 border rounded-md"
                  >
                    {consumptionRules.map(rule => (
                      <option key={rule.id} value={rule.id}>
                        {rule.functionName}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedFunction && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">预估费用</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-gray-600">积分消耗</p>
                        <p className="font-medium">{preview.points.toLocaleString()} 积分</p>
                      </div>
                      <div>
                        <p className="text-gray-600">美元等值</p>
                        <p className="font-medium">${preview.usd.toFixed(4)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="usd-calc" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="previewUSD">美元金额</Label>
                  <Input
                    id="previewUSD"
                    type="number"
                    min="0"
                    step="0.01"
                    value={previewUSD}
                    onChange={(e) => setPreviewUSD(parseFloat(e.target.value) || 0)}
                    placeholder="输入美元金额"
                  />
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">充值结果</h4>
                  <div className="text-lg">
                    <span className="text-gray-600">可获得：</span>
                    <span className="font-bold text-blue-600">
                      {pointsFromUSD.toLocaleString()} 积分
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    按当前汇率 {exchangeRate.toLocaleString()} 积分/美元 计算
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* 汇率变更历史 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            汇率变更历史
          </CardTitle>
          <CardDescription>
            查看汇率调整的历史记录
          </CardDescription>
        </CardHeader>
        <CardContent>
          {exchangeRateHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              暂无汇率变更记录
            </div>
          ) : (
            <div className="space-y-3">
              {exchangeRateHistory.map((record) => (
                <div key={record.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="text-sm">
                          <span className="font-medium">
                            {record.oldRate.toLocaleString()} → {record.newRate.toLocaleString()}
                          </span>
                          <span className="ml-2 text-gray-500">积分/美元</span>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs ${
                          record.newRate > record.oldRate 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {record.newRate > record.oldRate ? '汇率上调' : '汇率下调'}
                          {' '}
                          {(((record.newRate - record.oldRate) / record.oldRate) * 100).toFixed(1)}%
                        </div>
                      </div>
                      {record.reason && (
                        <div className="text-sm text-gray-600 mb-2">
                          {record.reason}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>调整人: {record.adminEmail}</span>
                        <span>{formatDateTime(record.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 消耗规则管理 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>积分消耗规则</CardTitle>
              <CardDescription>
                管理不同功能的积分消耗规则
              </CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  添加规则
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>添加消耗规则</DialogTitle>
                  <DialogDescription>
                    为新功能设置积分消耗规则
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="functionName">功能名称</Label>
                    <Input
                      id="functionName"
                      value={newRule.functionName || ''}
                      onChange={(e) => setNewRule(prev => ({ ...prev, functionName: e.target.value }))}
                      placeholder="例如：直播口播文案生成"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pointsPerToken">每Token积分消耗</Label>
                    <Input
                      id="pointsPerToken"
                      type="number"
                      step="0.1"
                      min="0"
                      value={newRule.pointsPerToken || 0}
                      onChange={(e) => setNewRule(prev => ({ ...prev, pointsPerToken: parseFloat(e.target.value) || 0 }))}
                      placeholder="例如：1.0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">描述</Label>
                    <Input
                      id="description"
                      value={newRule.description || ''}
                      onChange={(e) => setNewRule(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="简短描述这个规则"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleAddRule}>
                    添加规则
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>功能名称</TableHead>
                <TableHead>积分/Token</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consumptionRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.functionName}</TableCell>
                  <TableCell>{rule.pointsPerToken}</TableCell>
                  <TableCell>{rule.description}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      rule.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {rule.isActive ? '活跃' : '停用'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingRule(rule);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteRule(rule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑消耗规则</DialogTitle>
            <DialogDescription>
              修改现有的积分消耗规则
            </DialogDescription>
          </DialogHeader>
          {editingRule && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editFunctionName">功能名称</Label>
                <Input
                  id="editFunctionName"
                  value={editingRule.functionName}
                  onChange={(e) => setEditingRule(prev => prev ? { ...prev, functionName: e.target.value } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPointsPerToken">每Token积分消耗</Label>
                <Input
                  id="editPointsPerToken"
                  type="number"
                  step="0.1"
                  min="0"
                  value={editingRule.pointsPerToken}
                  onChange={(e) => setEditingRule(prev => prev ? { ...prev, pointsPerToken: parseFloat(e.target.value) || 0 } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editDescription">描述</Label>
                <Input
                  id="editDescription"
                  value={editingRule.description}
                  onChange={(e) => setEditingRule(prev => prev ? { ...prev, description: e.target.value } : null)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  id="editIsActive"
                  type="checkbox"
                  checked={editingRule.isActive}
                  onChange={(e) => setEditingRule(prev => prev ? { ...prev, isActive: e.target.checked } : null)}
                  className="rounded"
                />
                <Label htmlFor="editIsActive">启用此规则</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleEditRule}>
              保存更改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}