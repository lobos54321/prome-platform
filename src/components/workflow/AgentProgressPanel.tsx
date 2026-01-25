'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    WorkflowMode,
    NodeStatus,
    WorkflowNode,
    WorkflowStatusResponse,
    MODE_THEMES
} from '@/types/workflow';
import type { WeeklyPlan, ContentStrategy } from '@/types/xiaohongshu';
import { StatusIcon } from './StatusIcon';
import { LogDetail } from './LogDetail';
import { StrategyOverview } from './StrategyOverview';
import { WeeklyPlanTimeline } from './WeeklyPlanTimeline';
import { TodayContentPreview } from './TodayContentPreview';
import {
    ChevronRight,
    Cpu,
    Calendar,
    Image as ImageIcon,
    User as UserIcon,
    Video as VideoIcon,
    Play,
    Pause,
    RefreshCw,
    Terminal,
    Activity,
    Zap,
    LayoutDashboard,
    Settings2
} from 'lucide-react';
import { PlatformSwitcher, PLATFORM_CONFIGS } from '@/components/ui/PlatformSwitcher';

// 🔥 已优化节点配置（v2.0）
// 1. 新增 sentiment 舆情热点节点（真实 BettaFish 数据）
// 2. 删除假节点: copy-analyze, detail-plan, image-adapt
const DEFAULT_NODES: Record<WorkflowMode, WorkflowNode[]> = {
    [WorkflowMode.IMAGE_TEXT]: [
        { id: 'sentiment', title: '舆情热点分析', agent: 'Prome BettaFish', desc: '获取实时市场舆情和热门话题趋势', status: NodeStatus.PENDING, details: {} },
        { id: 'market-strategy', title: '内容营销策略', agent: 'Prome Strategy Master', desc: '根据品牌定位生成长期内容营销策略', status: NodeStatus.PENDING, details: {} },
        { id: 'weekly-plan', title: '每周计划生成', agent: 'Prome Planner', desc: '基于营销策略制定 7 天发布规律与节奏', status: NodeStatus.PENDING, details: {} },
        { id: 'copy-gen', title: '智能文案生成', agent: 'Prome Marketing Engine', desc: '基于 Dify 工作流生成核心母文案', status: NodeStatus.PENDING, details: {} },
        { id: 'variant-gen', title: '变体文案生成', agent: 'Prome Copywriter', desc: '生成变体文案以适配图文内容形态', status: NodeStatus.PENDING, details: {} },
        { id: 'image-gen', title: '图片生成编排', agent: 'Prome Image Studio', desc: '根据需求生成高精图片并合成任务', status: NodeStatus.PENDING, details: {} },
        { id: 'task-save', title: '内容入库', agent: 'Prome Executor', desc: '完成生成并同步至待审任务列表', status: NodeStatus.PENDING, details: {} },
    ],
    [WorkflowMode.AVATAR_VIDEO]: [
        { id: 'sentiment', title: '舆情热点分析', agent: 'Prome BettaFish', desc: '获取实时市场舆情和热门话题趋势', status: NodeStatus.PENDING, details: {} },
        { id: 'market-strategy', title: '内容营销策略', agent: 'Prome Strategy Master', desc: '确定内容垂类与数字人营销策略', status: NodeStatus.PENDING, details: {} },
        { id: 'weekly-plan', title: '每周计划生成', agent: 'Prome Planner', desc: '生成本周视频发布频率与主题规划', status: NodeStatus.PENDING, details: {} },
        { id: 'script-gen', title: '口播脚本生成', agent: 'Prome Script Writer', desc: '生成高转化率的数字人口播文案脚本', status: NodeStatus.PENDING, details: {} },
        { id: 'voice-clone', title: '语音克隆合成', agent: 'Prome Voice Engine', desc: '合成带情感的真人克隆音轨', status: NodeStatus.PENDING, details: {} },
        { id: 'avatar-render', title: '数字人渲染', agent: 'Prome Avatar Renderer', desc: '唇形同步与身体姿态融合渲染', status: NodeStatus.PENDING, details: {} },
        { id: 'task-save', title: '内容入库', agent: 'Prome Executor', desc: '同步至待审视频任务列表', status: NodeStatus.PENDING, details: {} },
    ],
    [WorkflowMode.UGC_VIDEO]: [
        { id: 'sentiment', title: '舆情热点分析', agent: 'Prome BettaFish', desc: '获取实时市场舆情和热门话题趋势', status: NodeStatus.PENDING, details: {} },
        { id: 'market-strategy', title: '内容营销策略', agent: 'Prome Strategy Master', desc: '确定 UGC 真实感营销路径与主题', status: NodeStatus.PENDING, details: {} },
        { id: 'weekly-plan', title: '每周计划生成', agent: 'Prome Planner', desc: '规划本周 UGC 视频的发布节奏', status: NodeStatus.PENDING, details: {} },
        { id: 'copy-gen', title: '智能文案生成', agent: 'Prome Marketing Engine', desc: '基于 Dify 生成原生感母文案', status: NodeStatus.PENDING, details: {} },
        { id: 'variant-gen', title: '变体文案生成', agent: 'Prome Copywriter', desc: '适配手持拍摄感的文案变体', status: NodeStatus.PENDING, details: {} },
        { id: 'scene-gen', title: '场景图生成', agent: 'Prome Scene Studio', desc: '生成高度拟真的 UGC 拍摄背景图', status: NodeStatus.PENDING, details: {} },
        { id: 'video-gen', title: '动态视频生成', agent: 'Prome Video Engine', desc: '基于场景图与文案生成关键镜头', status: NodeStatus.PENDING, details: {} },
        { id: 'task-save', title: '内容入库', agent: 'Prome Executor', desc: '同步至待审 UGC 任务列表', status: NodeStatus.PENDING, details: {} },
    ],
};

interface AgentProgressPanelProps {
    taskId?: string;
    mode?: WorkflowMode;
    wsUrl?: string;
    onClose?: () => void;
    onComplete?: (result: WorkflowStatusResponse) => void;
    // 🔥 重新配置回调
    onReconfigure?: () => void;
    // 新增 Props
    supabaseUuid?: string;
    productName?: string;
    marketingGoal?: 'brand' | 'sales' | 'traffic' | 'community';
    postFrequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    // 🔥 目标平台列表
    targetPlatforms?: string[];
    contentStrategy?: ContentStrategy | null;
    weeklyPlan?: WeeklyPlan | null;
    todayContent?: {
        title: string;
        text: string;
        imageUrls?: string[];
        hashtags?: string[];
        scheduledTime?: string;
        status?: 'draft' | 'approved' | 'publishing' | 'published' | 'failed';
        variants?: Array<{ type: string; platform?: string; platformName?: string; title: string; text: string; hashtags?: string[] }>;
    } | null;
    onPublish?: () => Promise<void>;
    onEditContent?: () => void;
    onRegenerateContent?: () => void;
    // 🔥 重新生成平台变体的回调
    onRegeneratePlatformVariant?: (platform: string, prompt: string) => Promise<{ platform: string; platformName: string; title: string; text: string; hashtags?: string[] } | null>;
}

export const AgentProgressPanel: React.FC<AgentProgressPanelProps> = ({
    taskId,
    mode: initialMode = WorkflowMode.IMAGE_TEXT,
    wsUrl,
    onClose,
    onComplete,
    // 🔥 重新配置
    onReconfigure,
    // 新增 Props
    supabaseUuid,
    productName,
    marketingGoal,
    postFrequency,
    // 🔥 目标平台
    targetPlatforms,
    contentStrategy,
    weeklyPlan,
    todayContent,
    onPublish,
    onEditContent,
    onRegenerateContent,
    // 🔥 平台变体重新生成
    onRegeneratePlatformVariant,
}) => {
    const [activeMode, setActiveMode] = useState<WorkflowMode>(initialMode);
    const [nodes, setNodes] = useState<WorkflowNode[]>(DEFAULT_NODES[initialMode]);
    const [activeNodeId, setActiveNodeId] = useState<string>(DEFAULT_NODES[initialMode][0].id);
    const [isConnected, setIsConnected] = useState(false);
    const [overallProgress, setOverallProgress] = useState(0);
    const [isPublishing, setIsPublishing] = useState(false);
    const [rightPanelView, setRightPanelView] = useState<'logs' | 'content'>('content');
    // 🔥 从 localStorage 恢复结果
    const [localResult, setLocalResultState] = useState<any>(() => {
        try {
            const saved = localStorage.getItem(`prome_workflow_result_${taskId}`);
            if (saved) {
                console.log('[AgentProgressPanel] Restored result from localStorage');
                return JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Failed to restore result from localStorage:', e);
        }
        return null;
    });
    const [localContentStrategy, setLocalContentStrategy] = useState<ContentStrategy | null>(contentStrategy || null);
    const [localWeeklyPlan, setLocalWeeklyPlan] = useState<WeeklyPlan | null>(weeklyPlan || null);
    // 🔥 从 localStorage 恢复完成状态
    const [isWorkflowCompleted, setIsWorkflowCompleted] = useState(() => {
        try {
            return localStorage.getItem(`prome_workflow_completed_${taskId}`) === 'true';
        } catch {
            return false;
        }
    });
    // 🔥 多平台切换 - 默认选中第一个平台
    const [activePlatform, setActivePlatform] = useState<string>(targetPlatforms?.[0] || 'xiaohongshu');

    // 🔥 包装 setLocalResult 以同步保存到 localStorage
    const setLocalResult = useCallback((value: any) => {
        setLocalResultState((prev: any) => {
            const newValue = typeof value === 'function' ? value(prev) : value;
            // 保存到 localStorage
            if (newValue && taskId) {
                try {
                    localStorage.setItem(`prome_workflow_result_${taskId}`, JSON.stringify(newValue));
                    console.log('[AgentProgressPanel] Saved result to localStorage');
                } catch (e) {
                    console.warn('Failed to save result to localStorage:', e);
                }
            }
            return newValue;
        });
    }, [taskId]);

    // 🔥 包装 setIsWorkflowCompleted 以同步保存
    const markWorkflowCompleted = useCallback((completed: boolean) => {
        setIsWorkflowCompleted(completed);
        if (taskId) {
            try {
                localStorage.setItem(`prome_workflow_completed_${taskId}`, String(completed));
            } catch (e) {
                console.warn('Failed to save completion status:', e);
            }
        }
    }, [taskId]);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    // 🔥 节点状态缓存 - 切换模式时保存当前节点状态
    const nodesCacheRef = useRef<Record<WorkflowMode, WorkflowNode[]>>({
        [WorkflowMode.IMAGE_TEXT]: DEFAULT_NODES[WorkflowMode.IMAGE_TEXT],
        [WorkflowMode.AVATAR_VIDEO]: DEFAULT_NODES[WorkflowMode.AVATAR_VIDEO],
        [WorkflowMode.UGC_VIDEO]: DEFAULT_NODES[WorkflowMode.UGC_VIDEO],
    });

    // 🔥 从 localStorage 恢复节点状态（在组件挂载时）
    useEffect(() => {
        if (taskId) {
            try {
                const savedNodes = localStorage.getItem(`prome_workflow_nodes_${taskId}`);
                const savedProgress = localStorage.getItem(`prome_workflow_progress_${taskId}`);
                if (savedNodes) {
                    const parsedNodes = JSON.parse(savedNodes);
                    setNodes(parsedNodes);
                    console.log('[AgentProgressPanel] Restored nodes from localStorage');
                }
                if (savedProgress) {
                    setOverallProgress(parseInt(savedProgress, 10));
                }
            } catch (e) {
                console.warn('Failed to restore nodes from localStorage:', e);
            }
        }
    }, [taskId]);

    // 🔥 保存节点状态到 localStorage
    useEffect(() => {
        if (taskId && nodes.length > 0) {
            try {
                localStorage.setItem(`prome_workflow_nodes_${taskId}`, JSON.stringify(nodes));
                localStorage.setItem(`prome_workflow_progress_${taskId}`, String(overallProgress));
            } catch (e) {
                console.warn('Failed to save nodes to localStorage:', e);
            }
        }
    }, [taskId, nodes, overallProgress]);

    // 当 mode 发生变化时更新 nodes
    useEffect(() => {
        if (initialMode && initialMode !== activeMode) {
            setActiveMode(initialMode);
            setNodes(DEFAULT_NODES[initialMode]);
            setActiveNodeId(DEFAULT_NODES[initialMode][0].id);
        }
    }, [initialMode]);

    // WebSocket 连接
    const connectWebSocket = useCallback(() => {
        // 🔥 获取默认 WebSocket URL
        const defaultWsUrl = ((import.meta as any).env?.VITE_XHS_API_URL || 'https://xiaohongshu-automation-ai.zeabur.app')
            .replace(/^http/, 'ws')
            .replace(/\/$/, '') + '/ws/workflow';

        const finalWsUrl = wsUrl || defaultWsUrl;

        if (!taskId) {
            console.warn('[AgentProgressPanel] Missing taskId, skipping WebSocket connection');
            return;
        }

        console.log(`🔌 [AgentProgressPanel] Connecting to WebSocket: ${finalWsUrl}?taskId=${taskId}`);
        const ws = new WebSocket(`${finalWsUrl}?taskId=${taskId}`);

        ws.onopen = () => {
            console.log('[AgentProgressPanel] WebSocket connected');
            setIsConnected(true);
            // 连接成功后可以请求同步当前状态
            ws.send(JSON.stringify({ type: 'get_status', taskId }));
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                if (message.type === 'status_update') {
                    const data = message.data as WorkflowStatusResponse;
                    setNodes(data.nodes);
                    setOverallProgress(data.overallProgress);
                    setActiveMode(data.mode);

                    // 自动选中正在处理的节点
                    const processingNode = data.nodes.find(n => n.status === NodeStatus.PROCESSING);
                    if (processingNode) {
                        setActiveNodeId(processingNode.id);
                    }
                } else if (message.type === 'node_update') {
                    const updatedNode = message.data as WorkflowNode;
                    setNodes(prev => prev.map(n => n.id === updatedNode.id ? updatedNode : n));

                    if (updatedNode.status === NodeStatus.PROCESSING) {
                        setActiveNodeId(updatedNode.id);
                    }

                    // 如果是最后一个节点任务保存完成，提取内容结果
                    if (updatedNode.id === 'task-save' && updatedNode.status === NodeStatus.COMPLETED && updatedNode.details.output) {
                        try {
                            const output = typeof updatedNode.details.output === 'string'
                                ? JSON.parse(updatedNode.details.output)
                                : updatedNode.details.output;
                            if (output.result) {
                                console.log('[AgentProgressPanel] Extracted result from task-save:', output.result);
                                setLocalResult(output.result);
                            }
                        } catch (e) {
                            console.warn('Failed to parse node result:', e);
                        }
                    }

                    // 🔥 提取舆情分析结果 (sentiment node)
                    if (updatedNode.id === 'sentiment' && updatedNode.status === NodeStatus.COMPLETED && updatedNode.details.output) {
                        try {
                            const output = typeof updatedNode.details.output === 'string'
                                ? JSON.parse(updatedNode.details.output)
                                : updatedNode.details.output;
                            console.log('[AgentProgressPanel] Extracted sentiment data:', output);
                            // 舆情数据会被 market-strategy 使用，这里只做日志记录
                        } catch (e) {
                            console.warn('Failed to parse sentiment result:', e);
                        }
                    }

                    // 提取文案生成结果 (中间产物)
                    if (updatedNode.id === 'copy-gen' && updatedNode.status === NodeStatus.COMPLETED && updatedNode.details.output) {
                        try {
                            const output = typeof updatedNode.details.output === 'string'
                                ? JSON.parse(updatedNode.details.output)
                                : updatedNode.details.output;
                            if (output.title || output.content) {
                                console.log('[AgentProgressPanel] Extracted partial result from copy-gen:', output);
                                setLocalResult((prev: any) => ({
                                    ...prev,
                                    title: output.title || prev?.title,
                                    text: output.content || prev?.text || output.text,
                                    hashtags: output.hashtags || prev?.hashtags
                                }));
                            }
                        } catch (e) {
                            console.warn('Failed to parse copy-gen result:', e);
                        }
                    }

                    // 提取变体文案结果
                    if (updatedNode.id === 'variant-gen' && updatedNode.status === NodeStatus.COMPLETED && updatedNode.details.output) {
                        try {
                            const output = typeof updatedNode.details.output === 'string'
                                ? JSON.parse(updatedNode.details.output)
                                : updatedNode.details.output;
                            if (output.variants) {
                                console.log('[AgentProgressPanel] Extracted variants from variant-gen:', output.variants);
                                setLocalResult((prev: any) => ({
                                    ...prev,
                                    variants: output.variants,
                                    engine: output.engine || prev?.engine // 保留 engine 属性
                                }));
                            }
                        } catch (e) {
                            console.warn('Failed to parse variant-gen result:', e);
                        }
                    }

                    // 提取策略结果
                    if (updatedNode.id === 'market-strategy' && updatedNode.status === NodeStatus.COMPLETED && updatedNode.details.output) {
                        try {
                            const output = typeof updatedNode.details.output === 'string'
                                ? JSON.parse(updatedNode.details.output)
                                : updatedNode.details.output;
                            if (output.key_themes) {
                                console.log('[AgentProgressPanel] Extracted strategy:', output);
                                setLocalContentStrategy({
                                    key_themes: output.key_themes,
                                    hashtags: output.hashtags || [],
                                    trending_topics: output.trending_topics || [],
                                    optimal_times: output.optimal_times || []
                                } as ContentStrategy);
                            }
                        } catch (e) {
                            console.warn('Failed to parse strategy result:', e);
                        }
                    }

                    // 提取周计划结果
                    if (updatedNode.id === 'weekly-plan' && updatedNode.status === NodeStatus.COMPLETED && updatedNode.details.output) {
                        try {
                            const output = typeof updatedNode.details.output === 'string'
                                ? JSON.parse(updatedNode.details.output)
                                : updatedNode.details.output;
                            if (output.plan_data) {
                                console.log('[AgentProgressPanel] Extracted weekly plan:', output);
                                setLocalWeeklyPlan({
                                    plan_data: output.plan_data,
                                    week_start_date: output.week_start_date,
                                    week_end_date: output.week_end_date
                                } as WeeklyPlan);
                            }
                        } catch (e) {
                            console.warn('Failed to parse weekly plan result:', e);
                        }
                    }
                } else if (message.type === 'completed') {
                    const data = message.data as any;
                    setOverallProgress(100);
                    if (data.nodes) {
                        setNodes(data.nodes);
                        // 尝试从完成消息中同步所有状态
                        data.nodes.forEach((n: any) => {
                            if (n.id === 'market-strategy' && n.status === NodeStatus.COMPLETED && n.details.output) {
                                try {
                                    const out = typeof n.details.output === 'string' ? JSON.parse(n.details.output) : n.details.output;
                                    if (out.key_themes) setLocalContentStrategy(out);
                                } catch (e) { }
                            }
                            if (n.id === 'weekly-plan' && n.status === NodeStatus.COMPLETED && n.details.output) {
                                try {
                                    const out = typeof n.details.output === 'string' ? JSON.parse(n.details.output) : n.details.output;
                                    if (out.plan_data) setLocalWeeklyPlan(out);
                                } catch (e) { }
                            }
                        });
                    }
                    if (data.result) {
                        console.log('[AgentProgressPanel] Got final result from completed message:', data.result);
                        setLocalResult(data.result);
                    }
                    markWorkflowCompleted(true);

                    // 🔔 发送浏览器通知
                    if ('Notification' in window) {
                        if (Notification.permission === 'granted') {
                            new Notification('🎉 视频生成完成！', {
                                body: '您的数字人视频已生成完成，可以预览和下载了。',
                                icon: '/logo.png',
                                tag: 'video-completed'
                            });
                        } else if (Notification.permission !== 'denied') {
                            Notification.requestPermission().then(permission => {
                                if (permission === 'granted') {
                                    new Notification('🎉 视频生成完成！', {
                                        body: '您的数字人视频已生成完成，可以预览和下载了。',
                                        icon: '/logo.png',
                                        tag: 'video-completed'
                                    });
                                }
                            });
                        }
                    }
                } else if (message.type === 'error') {
                    console.error('[AgentProgressPanel] Error:', message.data);
                }
            } catch (err) {
                console.error('[AgentProgressPanel] Parse error:', err);
            }
        };

        ws.onclose = () => {
            console.log('[AgentProgressPanel] WebSocket closed');
            setIsConnected(false);

            // 自动重连
            reconnectTimeoutRef.current = setTimeout(() => {
                connectWebSocket();
            }, 3000);
        };

        ws.onerror = (err) => {
            console.error('[AgentProgressPanel] WebSocket error:', err);
        };

        wsRef.current = ws;
    }, [wsUrl, taskId, onComplete]);

    useEffect(() => {
        connectWebSocket();

        return () => {
            wsRef.current?.close();
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [connectWebSocket]);

    // 🔥 切换模式时保存当前节点状态并恢复目标模式的缓存
    // 共用节点（相同ID）的状态会同步到目标模式
    const handleModeSwitch = useCallback((newMode: WorkflowMode) => {
        if (newMode === activeMode) return;

        // 保存当前模式的节点状态到缓存
        nodesCacheRef.current[activeMode] = nodes;

        // 获取目标模式的缓存节点
        const cachedNodes = nodesCacheRef.current[newMode];

        // 🔥 同步共用节点的状态（按ID匹配）
        const syncedNodes = cachedNodes.map(targetNode => {
            // 在当前模式中查找相同ID的节点
            const sourceNode = nodes.find(n => n.id === targetNode.id);
            if (sourceNode) {
                // 共用节点：保持状态同步
                return {
                    ...targetNode,
                    status: sourceNode.status,
                    details: sourceNode.details,
                };
            }
            // 非共用节点：保持原状态
            return targetNode;
        });

        setNodes(syncedNodes);
        setActiveNodeId(syncedNodes[0]?.id || '');
        setActiveMode(newMode);
    }, [activeMode, nodes]);

    const activeNode = nodes.find(n => n.id === activeNodeId) || nodes[0];
    const modeTheme = MODE_THEMES[activeMode] || MODE_THEMES[WorkflowMode.IMAGE_TEXT];

    return (
        <div className="flex h-full bg-[#F8FAFC] text-slate-800 overflow-hidden font-sans">

            {/* 1. 左侧：模式轨道 */}
            <aside className="w-20 bg-white border-r border-slate-200 flex flex-col items-center py-8 space-y-10 z-30 shadow-sm">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 mb-4 transition-transform hover:scale-105 cursor-pointer">
                    <Zap size={24} fill="white" />
                </div>

                <div className="flex-1 flex flex-col space-y-8">
                    {Object.values(WorkflowMode).map(mode => {
                        const theme = MODE_THEMES[mode as WorkflowMode] || MODE_THEMES[WorkflowMode.IMAGE_TEXT];
                        const isActive = activeMode === mode;
                        const isProcessing = nodes.some(n => n.status === NodeStatus.PROCESSING) && activeMode === mode;
                        const ModeIcon = mode === WorkflowMode.IMAGE_TEXT ? ImageIcon :
                            mode === WorkflowMode.AVATAR_VIDEO ? UserIcon : VideoIcon;

                        return (
                            <div key={mode} className="relative group flex flex-col items-center">
                                <button
                                    onClick={() => handleModeSwitch(mode as WorkflowMode)}
                                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${isActive
                                        ? 'border-blue-200 shadow-md scale-110 bg-white'
                                        : 'border-transparent bg-slate-50 hover:bg-slate-100'
                                        }`}
                                >
                                    <ModeIcon size={22} className={isActive ? theme.color : 'text-slate-400'} />
                                    {isProcessing && (
                                        <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500 border-2 border-white"></span>
                                        </span>
                                    )}
                                </button>
                                <div className="absolute left-16 px-2 py-1 rounded bg-slate-800 text-white text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                    {theme.label}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* 🔥 重新配置按钮 */}
                {onReconfigure && (
                    <button
                        onClick={onReconfigure}
                        className="p-3 rounded-xl text-slate-400 hover:bg-slate-50 transition-colors group"
                        title="重新配置"
                    >
                        <Settings2 size={20} className="group-hover:text-blue-500 transition-colors" />
                    </button>
                )}
            </aside>

            {/* 2. 中间：策略+计划+编排 */}
            <section className="w-[420px] bg-white border-r border-slate-100 flex flex-col shadow-sm">
                <header className="p-4 border-b border-slate-50 flex items-center justify-between">
                    <div>
                        <h2 className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-1">智能编排引擎</h2>
                        <span className={`text-lg font-extrabold tracking-tight ${modeTheme.color}`}>
                            {modeTheme.label}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        {overallProgress > 0 && overallProgress < 100 && (
                            <span className="text-sm font-bold text-blue-600">{overallProgress}%</span>
                        )}
                        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {/* 策略概览 */}
                    <StrategyOverview
                        productName={productName}
                        marketingGoal={marketingGoal}
                        postFrequency={postFrequency}
                        keyThemes={localContentStrategy?.key_themes}
                        hashtags={localContentStrategy?.hashtags}
                    />

                    {/* 本周计划 */}
                    <WeeklyPlanTimeline weeklyPlan={localWeeklyPlan} compact />

                    {/* 任务节点列表 */}
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <Activity size={14} className="text-blue-500" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                ⚡ 执行进度
                            </h3>
                        </div>

                        {/* Connector Line */}
                        <div className="absolute left-[11px] top-16 bottom-4 w-0.5 bg-slate-100 z-0"></div>

                        <div className="space-y-2">
                            {nodes.map((node) => {
                                const isSelected = activeNodeId === node.id;
                                const isDone = node.status === NodeStatus.COMPLETED;
                                const isWorking = node.status === NodeStatus.PROCESSING;
                                const isFailed = node.status === NodeStatus.FAILED;

                                return (
                                    <div
                                        key={node.id}
                                        onClick={() => setActiveNodeId(node.id)}
                                        className={`group relative z-10 cursor-pointer flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${isSelected
                                            ? 'bg-white border-blue-100 shadow-md ring-1 ring-blue-500/10'
                                            : 'bg-white border-slate-50 hover:border-slate-100 hover:shadow-sm'
                                            }`}
                                    >
                                        {/* Node Orb */}
                                        <div className={`flex-shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${isDone ? 'bg-emerald-50 border-emerald-100 text-emerald-500' :
                                            isWorking ? 'bg-blue-50 border-blue-100 text-blue-500' :
                                                isFailed ? 'bg-rose-50 border-rose-100 text-rose-500' :
                                                    'bg-slate-50 border-slate-100 text-slate-300'
                                            }`}>
                                            <StatusIcon status={node.status} size={16} />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-slate-800' : 'text-slate-500'}`}>
                                                    {node.title}
                                                </h4>
                                                {(node.details.output as any)?.engine && (
                                                    <span className="flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 font-medium scale-90 origin-right">
                                                        {(node.details.output as any).engine}
                                                    </span>
                                                )}
                                            </div>
                                            {isWorking && (
                                                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mt-1">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all"
                                                        style={{ width: `${node.details.progress || 0}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {isWorking && (
                                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                                {node.details.progress || 0}%
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Completion Message */}
                        {isWorkflowCompleted && (
                            <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl animate-in zoom-in-95 duration-500">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-2 bg-white/20 rounded-full">
                                        <Zap size={24} className="text-white fill-white" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-lg">全流程执行完毕</h4>
                                        <p className="text-emerald-50 opacity-90 text-xs">内容已成功同步至待审任务列表</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onComplete?.({ nodes, result: localResult })}
                                    className="w-full py-3 bg-white text-emerald-600 font-black rounded-xl shadow-lg hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                                >
                                    <LayoutDashboard size={18} />
                                    进入运营仪表盘
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* 3. 右侧：内容产出 / 日志切换 */}
            <main className="flex-1 flex flex-col bg-slate-50/30">
                {/* 🔥 多平台切换器 - 当有多个目标平台时显示 */}
                {targetPlatforms && targetPlatforms.length > 1 && (
                    <div className="px-6 pt-4 pb-2 bg-white border-b border-slate-100">
                        <PlatformSwitcher
                            platforms={targetPlatforms}
                            activePlatform={activePlatform}
                            onPlatformChange={setActivePlatform}
                        />
                    </div>
                )}
                <header className="h-14 px-6 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md">
                    <div className="flex items-center gap-2">
                        {/* Tab 切换 */}
                        <button
                            onClick={() => setRightPanelView('content')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${rightPanelView === 'content'
                                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            📝 内容产出
                        </button>
                        <button
                            onClick={() => setRightPanelView('logs')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${rightPanelView === 'logs'
                                ? 'bg-blue-500 text-white shadow-md'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            <Terminal size={12} className="inline mr-1" />
                            执行日志
                        </button>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                        <span className="font-mono">TASK: {taskId?.slice(0, 8) || 'N/A'}</span>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden p-4">
                    <div className="h-full bg-white rounded-2xl border border-slate-100 shadow-lg overflow-hidden flex flex-col">
                        {rightPanelView === 'content' ? (
                            activeNodeId === 'sentiment' ? (
                                <div className="p-8 h-full overflow-y-auto">
                                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                        🔥 舆情热点分析
                                    </h2>
                                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-6 mb-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                                                <Activity className="text-orange-600" size={20} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-orange-800">BettaFish 实时舆情</h3>
                                                <p className="text-sm text-orange-600">获取市场热点与话题趋势</p>
                                            </div>
                                        </div>
                                        {(activeNode?.details?.output as any)?.topics ? (
                                            <div className="space-y-4">
                                                <div>
                                                    <h4 className="text-sm font-semibold text-orange-700 mb-2">热门话题</h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {((activeNode?.details?.output as any)?.topics || []).slice(0, 5).map((topic: string, i: number) => (
                                                            <span key={i} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                                                                {topic}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-semibold text-orange-700 mb-2">关键词</h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {((activeNode?.details?.output as any)?.keywords || []).slice(0, 10).map((kw: string, i: number) => (
                                                            <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                                                                #{kw}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-orange-600 text-sm">正在获取舆情数据...</p>
                                        )}
                                    </div>
                                    <div className="mt-6 border-t border-slate-100 pt-6">
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">执行详情</h3>
                                        <LogDetail node={activeNode as WorkflowNode} />
                                    </div>
                                </div>
                            ) : activeNodeId === 'market-strategy' ? (
                                <div className="p-8 h-full overflow-y-auto">
                                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                        <Zap className="text-amber-500" /> 内容营销策略分析
                                    </h2>
                                    <StrategyOverview
                                        productName={productName}
                                        marketingGoal={marketingGoal}
                                        postFrequency={postFrequency}
                                        keyThemes={localContentStrategy?.key_themes || (activeNode?.details?.output as any)?.key_themes}
                                        hashtags={localContentStrategy?.hashtags || (activeNode?.details?.output as any)?.goldenQuotes}
                                    />
                                    <div className="mt-8 border-t border-slate-100 pt-8">
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">执行详情</h3>
                                        <LogDetail node={activeNode as WorkflowNode} />
                                    </div>
                                </div>
                            ) : activeNodeId === 'weekly-plan' ? (
                                <div className="p-8 h-full overflow-y-auto">
                                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                        <Calendar className="text-blue-500" /> 每周内容计划
                                    </h2>
                                    <WeeklyPlanTimeline weeklyPlan={localWeeklyPlan} />
                                    <div className="mt-8 border-t border-slate-100 pt-8">
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">编排详情</h3>
                                        <LogDetail node={activeNode as WorkflowNode} />
                                    </div>
                                </div>
                            ) : (
                                <TodayContentPreview
                                    content={localResult || todayContent}
                                    targetPlatforms={targetPlatforms}
                                    activePlatform={activePlatform}
                                    onRegeneratePlatformVariant={onRegeneratePlatformVariant}
                                    onPublish={async () => {
                                        if (onPublish) {
                                            setIsPublishing(true);
                                            try {
                                                await onPublish();
                                            } finally {
                                                setIsPublishing(false);
                                            }
                                        }
                                    }}
                                    onEdit={onEditContent}
                                    onRegenerate={onRegenerateContent}
                                    isPublishing={isPublishing}
                                />
                            )
                        ) : (
                            activeNode && <LogDetail node={activeNode} />
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AgentProgressPanel;
