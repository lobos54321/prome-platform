/**
 * 账号管理器 - 管理多账号人设和AI策略
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Users,
    Plus,
    Settings,
    Sparkles,
    Loader2,
    Check,
    User,
    Target,
    Pencil,
    Trash2,
    Star,
} from 'lucide-react';
import { PERSONA_TEMPLATES, CONTENT_STYLES, AccountPersona } from '@/types/matrix';

interface XhsAccount {
    id: string;
    xhs_session_hash: string;
    nickname?: string;
    red_id?: string;
    avatar_url?: string;
}

interface AccountBinding {
    id: string;
    supabase_uuid: string;
    xhs_account_id: string;
    alias?: string;
    is_default: boolean;
    account?: XhsAccount;
}

interface AccountManagerProps {
    supabaseUuid: string;
    productName?: string;
    targetAudience?: string;
    marketingGoal?: string;
    materialAnalysis?: string;
    onAddAccount: () => void;
    onStrategyGenerated?: (personas: AccountPersona[]) => void;
}

export function AccountManager({
    supabaseUuid,
    productName,
    targetAudience,
    marketingGoal,
    materialAnalysis,
    onAddAccount,
    onStrategyGenerated,
}: AccountManagerProps) {
    const [accounts, setAccounts] = useState<AccountBinding[]>([]);
    const [personas, setPersonas] = useState<Map<string, AccountPersona>>(new Map());
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');

    // 编辑人设对话框
    const [editingAccount, setEditingAccount] = useState<AccountBinding | null>(null);
    const [editPersona, setEditPersona] = useState({
        persona: '',
        content_style: '',
        target_audience: '',
        weekly_post_count: 3,
    });

    const BACKEND_URL = (import.meta as any).env?.VITE_XHS_API_URL || 'https://xiaohongshu-automation-ai.zeabur.app';

    // 加载账号列表
    useEffect(() => {
        loadAccounts();
    }, [supabaseUuid]);

    const loadAccounts = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${BACKEND_URL}/agent/accounts/list?supabaseUuid=${supabaseUuid}`);
            const data = await response.json();

            if (data.success) {
                setAccounts(data.data.accounts || []);

                // 加载已保存的人设
                for (const binding of data.data.accounts || []) {
                    loadPersona(binding.xhs_account_id);
                }
            }
        } catch (err) {
            console.error('加载账号失败:', err);
            setError('加载账号失败');
        } finally {
            setLoading(false);
        }
    };

    // 加载单个账号人设
    const loadPersona = async (accountId: string) => {
        try {
            const response = await fetch(`${BACKEND_URL}/agent/matrix/persona/${accountId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.persona) {
                    setPersonas(prev => new Map(prev).set(accountId, data.persona));
                }
            }
        } catch (err) {
            // 人设可能不存在，忽略错误
        }
    };

    // AI 生成策略
    const handleGenerateStrategy = async () => {
        if (accounts.length === 0) {
            setError('请先添加至少一个小红书账号');
            return;
        }

        if (!productName) {
            setError('请先配置产品信息');
            return;
        }

        setGenerating(true);
        setError('');

        try {
            const response = await fetch('/api/dify/matrix/generate-strategy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    supabase_uuid: supabaseUuid,
                    product_name: productName,
                    target_audience: targetAudience,
                    marketing_goal: marketingGoal,
                    material_analysis: materialAnalysis,
                    accounts: accounts.map(b => ({
                        id: b.xhs_account_id,
                        nickname: b.account?.nickname || b.alias,
                    })),
                }),
            });

            const data = await response.json();

            if (data.success && data.account_personas) {
                // 更新人设
                const newPersonas = new Map<string, AccountPersona>();
                for (const persona of data.account_personas) {
                    newPersonas.set(persona.xhs_account_id, persona);
                    // 保存到后端
                    await savePersona(persona);
                }
                setPersonas(newPersonas);
                onStrategyGenerated?.(data.account_personas);
            } else {
                throw new Error(data.error || 'AI策略生成失败');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'AI策略生成失败');
        } finally {
            setGenerating(false);
        }
    };

    // 保存人设
    const savePersona = async (persona: AccountPersona) => {
        try {
            await fetch(`${BACKEND_URL}/agent/matrix/persona`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(persona),
            });
        } catch (err) {
            console.error('保存人设失败:', err);
        }
    };

    // 打开编辑对话框
    const openEditDialog = (binding: AccountBinding) => {
        const existing = personas.get(binding.xhs_account_id);
        setEditingAccount(binding);
        setEditPersona({
            persona: existing?.persona || '',
            content_style: existing?.content_style || '',
            target_audience: existing?.target_audience || '',
            weekly_post_count: existing?.weekly_post_count || 3,
        });
    };

    // 保存编辑的人设
    const handleSavePersona = async () => {
        if (!editingAccount) return;

        const persona: AccountPersona = {
            id: `persona-${editingAccount.xhs_account_id}`,
            xhs_account_id: editingAccount.xhs_account_id,
            supabase_uuid: supabaseUuid,
            persona: editPersona.persona,
            content_style: editPersona.content_style,
            target_audience: editPersona.target_audience,
            weekly_post_count: editPersona.weekly_post_count,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        await savePersona(persona);
        setPersonas(prev => new Map(prev).set(editingAccount.xhs_account_id, persona));
        setEditingAccount(null);
    };

    // 获取显示名称
    const getDisplayName = (binding: AccountBinding) => {
        return binding.alias || binding.account?.nickname || binding.account?.red_id || '未命名账号';
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    加载中...
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* 头部 */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            账号矩阵管理
                            <Badge variant="secondary">{accounts.length} 个账号</Badge>
                        </CardTitle>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleGenerateStrategy}
                                disabled={generating || accounts.length === 0}
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                        生成中...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 mr-1" />
                                        AI 生成策略
                                    </>
                                )}
                            </Button>
                            <Button size="sm" onClick={onAddAccount}>
                                <Plus className="w-4 h-4 mr-1" />
                                添加账号
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {error && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {accounts.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>还没有绑定小红书账号</p>
                            <Button className="mt-4" onClick={onAddAccount}>
                                <Plus className="w-4 h-4 mr-2" />
                                添加第一个账号
                            </Button>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {accounts.map((binding) => {
                                const persona = personas.get(binding.xhs_account_id);

                                return (
                                    <div
                                        key={binding.id}
                                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* 头像 */}
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-red-400 flex items-center justify-center text-white font-medium">
                                                {binding.account?.avatar_url ? (
                                                    <img
                                                        src={binding.account.avatar_url}
                                                        alt=""
                                                        className="w-full h-full rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <User className="w-5 h-5" />
                                                )}
                                            </div>

                                            {/* 账号信息 */}
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{getDisplayName(binding)}</span>
                                                    {binding.is_default && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            <Star className="w-3 h-3 mr-1" />
                                                            默认
                                                        </Badge>
                                                    )}
                                                </div>

                                                {/* 人设标签 */}
                                                {persona ? (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Badge variant="outline" className="text-xs">
                                                            <Target className="w-3 h-3 mr-1" />
                                                            {persona.persona}
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground">
                                                            {persona.weekly_post_count} 篇/周
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">
                                                        未设置人设
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* 操作按钮 */}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openEditDialog(binding)}
                                        >
                                            <Pencil className="w-4 h-4 mr-1" />
                                            编辑人设
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 编辑人设对话框 */}
            <Dialog open={!!editingAccount} onOpenChange={() => setEditingAccount(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            编辑账号人设 - {editingAccount && getDisplayName(editingAccount)}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* 人设选择 */}
                        <div className="space-y-2">
                            <Label>账号人设</Label>
                            <Select
                                value={editPersona.persona}
                                onValueChange={(v) => setEditPersona(prev => ({ ...prev, persona: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="选择人设类型" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PERSONA_TEMPLATES.map((template) => (
                                        <SelectItem key={template.id} value={template.name}>
                                            <div>
                                                <div className="font-medium">{template.name}</div>
                                                <div className="text-xs text-muted-foreground">{template.description}</div>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 内容风格 */}
                        <div className="space-y-2">
                            <Label>内容风格</Label>
                            <Select
                                value={editPersona.content_style}
                                onValueChange={(v) => setEditPersona(prev => ({ ...prev, content_style: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="选择内容风格" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CONTENT_STYLES.map((style) => (
                                        <SelectItem key={style.id} value={style.name}>
                                            {style.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 目标受众 */}
                        <div className="space-y-2">
                            <Label>细分受众</Label>
                            <Input
                                value={editPersona.target_audience}
                                onChange={(e) => setEditPersona(prev => ({ ...prev, target_audience: e.target.value }))}
                                placeholder="例如：25-35岁都市女性"
                            />
                        </div>

                        {/* 发布频率 */}
                        <div className="space-y-2">
                            <Label>每周发布数</Label>
                            <Select
                                value={String(editPersona.weekly_post_count)}
                                onValueChange={(v) => setEditPersona(prev => ({ ...prev, weekly_post_count: Number(v) }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1 篇/周</SelectItem>
                                    <SelectItem value="2">2 篇/周</SelectItem>
                                    <SelectItem value="3">3 篇/周</SelectItem>
                                    <SelectItem value="5">5 篇/周</SelectItem>
                                    <SelectItem value="7">7 篇/周（每天）</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingAccount(null)}>
                            取消
                        </Button>
                        <Button onClick={handleSavePersona}>
                            <Check className="w-4 h-4 mr-1" />
                            保存
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
