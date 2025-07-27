import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit2, Trash2, Package, Star } from 'lucide-react';
import { adminServicesAPI } from '@/lib/admin-services';
import { RechargePackage } from '@/types';

export default function RechargePackageManagement() {
  const [packages, setPackages] = useState<RechargePackage[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(10000);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<RechargePackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    usdAmount: '',
    creditsAmount: '',
    isPopular: false,
    discount: '',
    isActive: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [packagesData, rate] = await Promise.all([
        adminServicesAPI.getAllRechargePackages(),
        adminServicesAPI.getExchangeRate()
      ]);
      setPackages(packagesData);
      setExchangeRate(rate);
    } catch (error) {
      console.error('Failed to load recharge packages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      usdAmount: '',
      creditsAmount: '',
      isPopular: false,
      discount: '',
      isActive: true
    });
  };

  const handleEdit = (pkg: RechargePackage) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      usdAmount: pkg.usdAmount.toString(),
      creditsAmount: pkg.creditsAmount.toString(),
      isPopular: pkg.isPopular || false,
      discount: pkg.discount?.toString() || '',
      isActive: pkg.isActive
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个充值方案吗？')) return;

    try {
      await adminServicesAPI.deleteRechargePackage(id);
      await loadData();
    } catch (error) {
      console.error('Failed to delete package:', error);
      alert('删除失败，请重试');
    }
  };

  const handleSubmit = async (isEdit: boolean) => {
    const usdAmount = parseFloat(formData.usdAmount);
    const creditsAmount = parseInt(formData.creditsAmount);
    const discount = formData.discount ? parseFloat(formData.discount) : undefined;

    if (!formData.name || isNaN(usdAmount) || isNaN(creditsAmount) || usdAmount <= 0 || creditsAmount <= 0) {
      alert('请填写所有必填字段，并确保金额大于0');
      return;
    }

    try {
      const packageData = {
        name: formData.name,
        usdAmount,
        creditsAmount,
        isPopular: formData.isPopular,
        discount,
        isActive: formData.isActive
      };

      if (isEdit && editingPackage) {
        await adminServicesAPI.updateRechargePackage(editingPackage.id, packageData);
        setIsEditDialogOpen(false);
        setEditingPackage(null);
      } else {
        await adminServicesAPI.addRechargePackage(packageData);
        setIsAddDialogOpen(false);
      }

      resetForm();
      await loadData();
    } catch (error) {
      console.error('Failed to save package:', error);
      alert('保存失败，请重试');
    }
  };

  // Auto-calculate credits based on USD amount and exchange rate
  const handleUsdAmountChange = (value: string) => {
    setFormData(prev => {
      const usdAmount = parseFloat(value);
      const calculatedCredits = !isNaN(usdAmount) ? Math.floor(usdAmount * (exchangeRate / 10)) : '';
      
      return {
        ...prev,
        usdAmount: value,
        creditsAmount: calculatedCredits.toString()
      };
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">加载中...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                充值方案管理
              </CardTitle>
              <CardDescription>
                管理预设充值方案，当前汇率：1 USD = {(exchangeRate / 10).toLocaleString()} 积分
              </CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  添加方案
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>添加充值方案</DialogTitle>
                  <DialogDescription>
                    创建新的预设充值方案
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">方案名称 *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="例如：基础套餐"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="usdAmount">美元金额 *</Label>
                      <Input
                        id="usdAmount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.usdAmount}
                        onChange={(e) => handleUsdAmountChange(e.target.value)}
                        placeholder="10.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="creditsAmount">积分数量 *</Label>
                      <Input
                        id="creditsAmount"
                        type="number"
                        min="0"
                        value={formData.creditsAmount}
                        onChange={(e) => setFormData(prev => ({ ...prev, creditsAmount: e.target.value }))}
                        placeholder="10000"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discount">折扣百分比（可选）</Label>
                    <Input
                      id="discount"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.discount}
                      onChange={(e) => setFormData(prev => ({ ...prev, discount: e.target.value }))}
                      placeholder="5"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isPopular"
                        checked={formData.isPopular}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPopular: checked }))}
                      />
                      <Label htmlFor="isPopular">推荐方案</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isActive"
                        checked={formData.isActive}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                      />
                      <Label htmlFor="isActive">启用</Label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={() => handleSubmit(false)}>
                    添加方案
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
                <TableHead>方案名称</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>积分</TableHead>
                <TableHead>折扣</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {pkg.isPopular && <Star className="h-4 w-4 text-yellow-500" />}
                      {pkg.name}
                    </div>
                  </TableCell>
                  <TableCell>${pkg.usdAmount}</TableCell>
                  <TableCell>{pkg.creditsAmount.toLocaleString()}</TableCell>
                  <TableCell>
                    {pkg.discount ? `${pkg.discount}%` : '-'}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      pkg.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {pkg.isActive ? '启用' : '禁用'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {new Date(pkg.createdAt).toLocaleDateString('zh-CN')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(pkg)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(pkg.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {packages.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    暂无充值方案
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑充值方案</DialogTitle>
            <DialogDescription>
              修改充值方案信息
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">方案名称 *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例如：基础套餐"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-usdAmount">美元金额 *</Label>
                <Input
                  id="edit-usdAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.usdAmount}
                  onChange={(e) => handleUsdAmountChange(e.target.value)}
                  placeholder="10.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-creditsAmount">积分数量 *</Label>
                <Input
                  id="edit-creditsAmount"
                  type="number"
                  min="0"
                  value={formData.creditsAmount}
                  onChange={(e) => setFormData(prev => ({ ...prev, creditsAmount: e.target.value }))}
                  placeholder="10000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-discount">折扣百分比（可选）</Label>
              <Input
                id="edit-discount"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formData.discount}
                onChange={(e) => setFormData(prev => ({ ...prev, discount: e.target.value }))}
                placeholder="5"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-isPopular"
                  checked={formData.isPopular}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPopular: checked }))}
                />
                <Label htmlFor="edit-isPopular">推荐方案</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                />
                <Label htmlFor="edit-isActive">启用</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              setEditingPackage(null);
              resetForm();
            }}>
              取消
            </Button>
            <Button onClick={() => handleSubmit(true)}>
              保存修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}