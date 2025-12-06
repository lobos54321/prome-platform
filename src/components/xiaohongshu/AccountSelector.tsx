/**
 * 小红书矩阵账号选择器
 * 支持用户管理多个小红书账号
 */

import React, { useState, useEffect } from 'react';
import { ChevronDown, Plus, Check, Trash2, Star, User } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

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

interface AccountSelectorProps {
    supabaseUuid: string;
    backendUrl?: string;
    onAccountChange?: (account: XhsAccount | null) => void;
    onAddAccount?: () => void;
}

export function AccountSelector({
    supabaseUuid,
    backendUrl = 'https://xiaohongshu-automation-ai.zeabur.app',
    onAccountChange,
    onAddAccount,
}: AccountSelectorProps) {
    const { toast } = useToast();
    const [accounts, setAccounts] = useState<AccountBinding[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<AccountBinding | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingAlias, setEditingAlias] = useState<string | null>(null);
    const [aliasInput, setAliasInput] = useState('');

    // 加载账号列表
    useEffect(() => {
        loadAccounts();
    }, [supabaseUuid]);

    const loadAccounts = async () => {
        try {
            setLoading(true);
            const response = await fetch(
                `${backendUrl}/agent/accounts/list?supabaseUuid=${supabaseUuid}`
            );
            const data = await response.json();

            if (data.success) {
                setAccounts(data.data.accounts);

                // 设置默认选中账号
                const defaultAccount = data.data.accounts.find((a: AccountBinding) => a.is_default);
                if (defaultAccount) {
                    setSelectedAccount(defaultAccount);
                    onAccountChange?.(defaultAccount.account || null);
                } else if (data.data.accounts.length > 0) {
                    setSelectedAccount(data.data.accounts[0]);
                    onAccountChange?.(data.data.accounts[0].account || null);
                }
            }
        } catch (error: any) {
            console.error('Failed to load accounts:', error);
            toast({
                title: '加载账号失败',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    // 切换账号
    const handleSelectAccount = async (binding: AccountBinding) => {
        setSelectedAccount(binding);
        onAccountChange?.(binding.account || null);

        toast({
            title: '账号已切换',
            description: `当前账号: ${getAccountDisplayName(binding)}`,
        });
    };

    // 设置默认账号
    const handleSetDefault = async (binding: AccountBinding) => {
        try {
            const response = await fetch(`${backendUrl}/agent/accounts/set-default`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    supabaseUuid,
                    xhsAccountId: binding.xhs_account_id,
                }),
            });

            const data = await response.json();
            if (data.success) {
                toast({ title: '默认账号设置成功' });
                loadAccounts();
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            toast({
                title: '设置失败',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    // 解绑账号
    const handleUnbind = async (binding: AccountBinding) => {
        if (!confirm('确定要解绑此账号吗？Cookie 将被删除。')) {
            return;
        }

        try {
            const response = await fetch(`${backendUrl}/agent/accounts/unbind`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    supabaseUuid,
                    xhsAccountId: binding.xhs_account_id,
                }),
            });

            const data = await response.json();
            if (data.success) {
                toast({ title: '账号已解绑' });
                loadAccounts();

                if (selectedAccount?.id === binding.id) {
                    setSelectedAccount(null);
                    onAccountChange?.(null);
                }
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            toast({
                title: '解绑失败',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    // 获取显示名称
    const getAccountDisplayName = (binding: AccountBinding): string => {
        if (binding.alias) return binding.alias;
        if (binding.account?.nickname) return binding.account.nickname;
        if (binding.account?.red_id) return `@${binding.account.red_id}`;
        return `账号 ${binding.xhs_account_id.substring(0, 8)}`;
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-gray-200" />
                <div className="w-24 h-4 bg-gray-200 rounded" />
            </div>
        );
    }

    if (accounts.length === 0) {
        return (
            <Button
                variant="outline"
                onClick={onAddAccount}
                className="flex items-center gap-2"
            >
                <Plus className="w-4 h-4" />
                添加小红书账号
            </Button>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 min-w-[180px]">
                    {selectedAccount?.account?.avatar_url ? (
                        <img
                            src={selectedAccount.account.avatar_url}
                            alt=""
                            className="w-6 h-6 rounded-full"
                        />
                    ) : (
                        <User className="w-5 h-5 text-gray-400" />
                    )}
                    <span className="flex-1 text-left truncate">
                        {selectedAccount ? getAccountDisplayName(selectedAccount) : '选择账号'}
                    </span>
                    {selectedAccount?.is_default && (
                        <Badge variant="secondary" className="text-xs">默认</Badge>
                    )}
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-64">
                {accounts.map((binding) => (
                    <DropdownMenuItem
                        key={binding.id}
                        className="flex items-center gap-2 p-2 cursor-pointer"
                        onClick={() => handleSelectAccount(binding)}
                    >
                        {binding.account?.avatar_url ? (
                            <img
                                src={binding.account.avatar_url}
                                alt=""
                                className="w-8 h-8 rounded-full"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-red-400 flex items-center justify-center">
                                <User className="w-4 h-4 text-white" />
                            </div>
                        )}

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                                <span className="font-medium truncate">
                                    {getAccountDisplayName(binding)}
                                </span>
                                {binding.is_default && (
                                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                )}
                            </div>
                            {binding.account?.red_id && (
                                <div className="text-xs text-gray-500">
                                    @{binding.account.red_id}
                                </div>
                            )}
                        </div>

                        {selectedAccount?.id === binding.id && (
                            <Check className="w-4 h-4 text-green-500" />
                        )}

                        <div className="flex items-center gap-1">
                            {!binding.is_default && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSetDefault(binding);
                                    }}
                                    title="设为默认"
                                >
                                    <Star className="w-3 h-3" />
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnbind(binding);
                                }}
                                title="解绑账号"
                            >
                                <Trash2 className="w-3 h-3" />
                            </Button>
                        </div>
                    </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                    className="flex items-center gap-2 text-purple-600 cursor-pointer"
                    onClick={onAddAccount}
                >
                    <Plus className="w-4 h-4" />
                    <span>添加新账号 ({accounts.length}/10)</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default AccountSelector;
