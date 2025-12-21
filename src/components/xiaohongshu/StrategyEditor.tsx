'use client';

import React, { useState, useCallback, useRef } from 'react';
import { X, Plus, Clock, Hash, TrendingUp, Save, Sparkles, GripVertical } from 'lucide-react';
import type { ContentStrategy } from '@/types/xiaohongshu';

interface StrategyEditorProps {
    strategy: ContentStrategy | null;
    onSave: (updates: Partial<ContentStrategy>) => Promise<void>;
    onClose: () => void;
    onRequestAISuggestions?: () => Promise<{
        key_themes?: string[];
        hashtags?: string[];
        optimal_times?: string[];
    }>;
}

const TIME_OPTIONS = [
    '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
    '19:00', '20:00', '21:00', '22:00', '23:00'
];

export const StrategyEditor: React.FC<StrategyEditorProps> = ({
    strategy,
    onSave,
    onClose,
    onRequestAISuggestions,
}) => {
    const [keyThemes, setKeyThemes] = useState<string[]>(strategy?.key_themes || []);
    const [hashtags, setHashtags] = useState<string[]>(strategy?.hashtags || []);
    const [optimalTimes, setOptimalTimes] = useState<string[]>(strategy?.optimal_times || []);
    const [newTheme, setNewTheme] = useState('');
    const [newHashtag, setNewHashtag] = useState('');
    const [saving, setSaving] = useState(false);
    const [loadingAI, setLoadingAI] = useState(false);

    // 拖拽状态
    const [draggedThemeIndex, setDraggedThemeIndex] = useState<number | null>(null);
    const [draggedHashtagIndex, setDraggedHashtagIndex] = useState<number | null>(null);
    const dragOverThemeRef = useRef<number | null>(null);
    const dragOverHashtagRef = useRef<number | null>(null);

    // 主题拖拽处理
    const handleThemeDragStart = (e: React.DragEvent, index: number) => {
        setDraggedThemeIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());
    };

    const handleThemeDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        dragOverThemeRef.current = index;
    };

    const handleThemeDragEnd = () => {
        if (draggedThemeIndex !== null && dragOverThemeRef.current !== null && draggedThemeIndex !== dragOverThemeRef.current) {
            const newThemes = [...keyThemes];
            const [draggedItem] = newThemes.splice(draggedThemeIndex, 1);
            newThemes.splice(dragOverThemeRef.current, 0, draggedItem);
            setKeyThemes(newThemes);
        }
        setDraggedThemeIndex(null);
        dragOverThemeRef.current = null;
    };

    // 标签拖拽处理
    const handleHashtagDragStart = (e: React.DragEvent, index: number) => {
        setDraggedHashtagIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());
    };

    const handleHashtagDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        dragOverHashtagRef.current = index;
    };

    const handleHashtagDragEnd = () => {
        if (draggedHashtagIndex !== null && dragOverHashtagRef.current !== null && draggedHashtagIndex !== dragOverHashtagRef.current) {
            const newTags = [...hashtags];
            const [draggedItem] = newTags.splice(draggedHashtagIndex, 1);
            newTags.splice(dragOverHashtagRef.current, 0, draggedItem);
            setHashtags(newTags);
        }
        setDraggedHashtagIndex(null);
        dragOverHashtagRef.current = null;
    };

    // 添加主题
    const addTheme = useCallback(() => {
        if (newTheme.trim() && !keyThemes.includes(newTheme.trim())) {
            setKeyThemes([...keyThemes, newTheme.trim()]);
            setNewTheme('');
        }
    }, [newTheme, keyThemes]);

    // 删除主题
    const removeTheme = useCallback((theme: string) => {
        setKeyThemes(keyThemes.filter(t => t !== theme));
    }, [keyThemes]);

    // 添加标签
    const addHashtag = useCallback(() => {
        const tag = newHashtag.trim().replace(/^#/, '');
        if (tag && !hashtags.includes(tag)) {
            setHashtags([...hashtags, tag]);
            setNewHashtag('');
        }
    }, [newHashtag, hashtags]);

    // 删除标签
    const removeHashtag = useCallback((tag: string) => {
        setHashtags(hashtags.filter(h => h !== tag));
    }, [hashtags]);

    // 切换发布时间
    const toggleTime = useCallback((time: string) => {
        if (optimalTimes.includes(time)) {
            setOptimalTimes(optimalTimes.filter(t => t !== time));
        } else {
            setOptimalTimes([...optimalTimes, time].sort());
        }
    }, [optimalTimes]);

    // 保存
    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave({
                key_themes: keyThemes,
                hashtags,
                optimal_times: optimalTimes,
                updated_at: new Date().toISOString(),
            });
            onClose();
        } catch (err) {
            console.error('保存策略失败:', err);
        } finally {
            setSaving(false);
        }
    };

    // AI 建议
    const handleRequestAI = async () => {
        if (!onRequestAISuggestions) return;

        setLoadingAI(true);
        try {
            const suggestions = await onRequestAISuggestions();
            if (suggestions.key_themes) {
                setKeyThemes(prev => [...new Set([...prev, ...suggestions.key_themes!])]);
            }
            if (suggestions.hashtags) {
                setHashtags(prev => [...new Set([...prev, ...suggestions.hashtags!])]);
            }
            if (suggestions.optimal_times) {
                setOptimalTimes(suggestions.optimal_times);
            }
        } catch (err) {
            console.error('获取AI建议失败:', err);
        } finally {
            setLoadingAI(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">📋 策略编辑器</h2>
                        <p className="text-xs text-slate-400">拖拽调整顺序，优化发布效果</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* 关键主题 */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingUp size={16} className="text-amber-500" />
                            <h3 className="text-sm font-bold text-slate-700">内容主题</h3>
                            <span className="text-xs text-slate-400">({keyThemes.length}) 拖拽排序</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {keyThemes.map((theme, i) => (
                                <div
                                    key={i}
                                    draggable
                                    onDragStart={(e) => handleThemeDragStart(e, i)}
                                    onDragOver={(e) => handleThemeDragOver(e, i)}
                                    onDragEnd={handleThemeDragEnd}
                                    className={`group flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-sm cursor-grab active:cursor-grabbing transition-transform ${draggedThemeIndex === i ? 'opacity-50 scale-95' : ''
                                        }`}
                                >
                                    <GripVertical size={12} className="text-amber-300" />
                                    <span>{theme}</span>
                                    <button
                                        onClick={() => removeTheme(theme)}
                                        className="ml-1 opacity-0 group-hover:opacity-100 transition"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newTheme}
                                onChange={(e) => setNewTheme(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addTheme()}
                                placeholder="添加新主题..."
                                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                            />
                            <button
                                onClick={addTheme}
                                className="px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>

                    {/* 推荐标签 */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Hash size={16} className="text-blue-500" />
                            <h3 className="text-sm font-bold text-slate-700">推荐标签</h3>
                            <span className="text-xs text-slate-400">({hashtags.length}) 拖拽排序</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {hashtags.map((tag, i) => (
                                <div
                                    key={i}
                                    draggable
                                    onDragStart={(e) => handleHashtagDragStart(e, i)}
                                    onDragOver={(e) => handleHashtagDragOver(e, i)}
                                    onDragEnd={handleHashtagDragEnd}
                                    className={`group flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm cursor-grab active:cursor-grabbing transition-transform ${draggedHashtagIndex === i ? 'opacity-50 scale-95' : ''
                                        }`}
                                >
                                    <GripVertical size={12} className="text-blue-300" />
                                    <span>#{tag}</span>
                                    <button
                                        onClick={() => removeHashtag(tag)}
                                        className="ml-1 opacity-0 group-hover:opacity-100 transition"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newHashtag}
                                onChange={(e) => setNewHashtag(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addHashtag()}
                                placeholder="添加标签（不需要 #）..."
                                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                            />
                            <button
                                onClick={addHashtag}
                                className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>

                    {/* 最佳发布时间 */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Clock size={16} className="text-emerald-500" />
                            <h3 className="text-sm font-bold text-slate-700">最佳发布时间</h3>
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                            {TIME_OPTIONS.map((time) => (
                                <button
                                    key={time}
                                    onClick={() => toggleTime(time)}
                                    className={`px-2 py-1.5 rounded-lg text-xs font-medium transition ${optimalTimes.includes(time)
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    {time}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-slate-50 flex items-center justify-between">
                    {onRequestAISuggestions && (
                        <button
                            onClick={handleRequestAI}
                            disabled={loadingAI}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition disabled:opacity-50"
                        >
                            {loadingAI ? (
                                <div className="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                            ) : (
                                <Sparkles size={16} />
                            )}
                            AI 优化建议
                        </button>
                    )}
                    <div className="flex gap-2 ml-auto">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50"
                        >
                            {saving ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Save size={16} />
                            )}
                            保存策略
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StrategyEditor;
