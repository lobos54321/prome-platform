/**
 * EmailSettingsPanel.tsx
 * 邮件通知设置面板
 * 
 * 添加到 prome-platform 前端
 */

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface EmailSettings {
    email: string;
    email_enabled: boolean;
    email_frequency: 'daily' | 'weekly' | 'never';
    notify_performance_drop: boolean;
    notify_viral_content: boolean;
    notify_weekly_summary: boolean;
}

interface Props {
    userId: string;
}

export default function EmailSettingsPanel({ userId }: Props) {
    const [settings, setSettings] = useState<EmailSettings>({
        email: '',
        email_enabled: true,
        email_frequency: 'weekly',
        notify_performance_drop: true,
        notify_viral_content: true,
        notify_weekly_summary: true
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadSettings();
    }, [userId]);

    const loadSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (data) {
                setSettings({
                    email: data.email || '',
                    email_enabled: data.email_enabled ?? true,
                    email_frequency: data.email_frequency || 'weekly',
                    notify_performance_drop: data.notify_performance_drop ?? true,
                    notify_viral_content: data.notify_viral_content ?? true,
                    notify_weekly_summary: data.notify_weekly_summary ?? true
                });
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        setSaving(true);
        setMessage(null);

        try {
            const { error } = await supabase
                .from('user_profiles')
                .upsert({
                    user_id: userId,
                    ...settings,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                });

            if (error) throw error;

            setMessage({ type: 'success', text: '设置已保存' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || '保存失败' });
        } finally {
            setSaving(false);
        }
    };

    const sendTestEmail = async () => {
        if (!settings.email) {
            setMessage({ type: 'error', text: '请先填写邮箱地址' });
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            const response = await fetch('/api/admin/test-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: settings.email })
            });

            const result = await response.json();

            if (result.success) {
                setMessage({ type: 'success', text: '测试邮件已发送，请查收' });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || '发送失败' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="animate-pulse bg-gray-100 rounded-lg h-64"></div>
        );
    }

    return (
        <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                📧 邮件通知设置
            </h2>

            {message && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                    {message.text}
                </div>
            )}

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        接收邮箱
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="email"
                            value={settings.email}
                            onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                            placeholder="your@email.com"
                            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <button
                            onClick={sendTestEmail}
                            disabled={saving || !settings.email}
                            className="px-4 py-2 text-sm text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 disabled:opacity-50"
                        >
                            发送测试
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <div className="font-medium text-gray-800">启用邮件通知</div>
                        <div className="text-sm text-gray-500">开启后将收到数据报告和重要提醒</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.email_enabled}
                            onChange={(e) => setSettings({ ...settings, email_enabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-purple-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        报告频率
                    </label>
                    <div className="flex gap-3">
                        {[
                            { value: 'daily', label: '每日' },
                            { value: 'weekly', label: '每周' },
                            { value: 'never', label: '从不' }
                        ].map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setSettings({ ...settings, email_frequency: option.value as any })}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${settings.email_frequency === option.value
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="text-sm font-medium text-gray-700">通知类型</div>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.notify_weekly_summary}
                            onChange={(e) => setSettings({ ...settings, notify_weekly_summary: e.target.checked })}
                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <div>
                            <div className="text-sm text-gray-800">📊 数据周报</div>
                            <div className="text-xs text-gray-500">每周发送数据汇总和 AI 分析建议</div>
                        </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.notify_viral_content}
                            onChange={(e) => setSettings({ ...settings, notify_viral_content: e.target.checked })}
                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <div>
                            <div className="text-sm text-gray-800">🔥 爆款提醒</div>
                            <div className="text-xs text-gray-500">当内容表现突出时立即通知</div>
                        </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.notify_performance_drop}
                            onChange={(e) => setSettings({ ...settings, notify_performance_drop: e.target.checked })}
                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <div>
                            <div className="text-sm text-gray-800">⚠️ 异常预警</div>
                            <div className="text-xs text-gray-500">数据大幅下降时提醒关注</div>
                        </div>
                    </label>
                </div>

                <div className="pt-4 border-t">
                    <button
                        onClick={saveSettings}
                        disabled={saving}
                        className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <span className="animate-spin">⏳</span>
                                保存中...
                            </>
                        ) : (
                            <>
                                ✓ 保存设置
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
