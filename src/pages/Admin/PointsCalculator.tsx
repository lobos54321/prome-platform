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
            <div className="space-y-2">
              <Label htmlFor="exchangeRate">积分数量（对应1美元）</Label>
              <Input
                id="exchangeRate"
                type="number"
                min="1"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(parseInt(e.target.value) || 0)}
                placeholder="例如：10000"
              />
              <p className="text-sm text-gray-500">
                当前设置：{exchangeRate.toLocaleString()} 积分 = 1 美元
              </p>
            </div>
            <Button onClick={handleSaveExchangeRate} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              保存汇率设置
            </Button>
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
          </CardContent>
        </Card>
      </div>

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