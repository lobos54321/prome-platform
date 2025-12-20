'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    WorkflowMode,
    NodeStatus,
    WorkflowNode,
    WorkflowStatusResponse,
    MODE_THEMES
} from '@/types/workflow';
import { StatusIcon } from './StatusIcon';
import { LogDetail } from './LogDetail';
import {
    ChevronRight,
    Cpu,
    Image as ImageIcon,
    User as UserIcon,
    Video as VideoIcon,
    Play,
    Pause,
    RefreshCw,
    Terminal,
    Activity,
    Zap,
    X
} from 'lucide-react';

// 默认节点配置（使用自有品牌名）
const DEFAULT_NODES: Record<WorkflowMode, WorkflowNode[]> = {
    [WorkflowMode.IMAGE_TEXT]: [
        { id: 'copy-gen', title: '智能文案生成', agent: 'Prome Marketing Engine', desc: '基于产品信息生成高转化营销文案', status: NodeStatus.PENDING, details: {} },
        { id: 'copy-analyze', title: '文案策略分析', agent: 'Prome Content Analyzer', desc: '提取金句，计算权重，决定分发策略', status: NodeStatus.PENDING, details: {} },
        { id: 'image-adapt', title: '图片智能适配', agent: 'Prome Vision AI', desc: '分析图片与文案匹配度，规划补充素材', status: NodeStatus.PENDING, details: {} },
        { id: 'image-gen', title: '图片生成编排', agent: 'Prome Image Studio', desc: '根据需求生成高精图片并合成任务', status: NodeStatus.PENDING, details: {} },
        { id: 'task-save', title: '内容入库', agent: 'Prome Executor', desc: '发布至待审核任务列表', status: NodeStatus.PENDING, details: {} },
    ],
    [WorkflowMode.AVATAR_VIDEO]: [
        { id: 'script-gen', title: '脚本编排', agent: 'Prome Script Master', desc: '拆解口播节奏与分镜表情标注', status: NodeStatus.PENDING, details: {} },
        { id: 'voice-clone', title: '语音克隆合成', agent: 'Prome Voice Engine', desc: '合成带情感的真人克隆音轨', status: NodeStatus.PENDING, details: {} },
        { id: 'avatar-render', title: '数字人渲染', agent: 'Prome Avatar Renderer', desc: '唇形同步与身体姿态融合渲染', status: NodeStatus.PENDING, details: {} },
        { id: 'video-check', title: '视频质量检查', agent: 'Prome Inspector', desc: '检查画面瑕疵与音画同步率', status: NodeStatus.PENDING, details: {} },
    ],
    [WorkflowMode.UGC_VIDEO]: [
        { id: 'ugc-init', title: '工作流初始化', agent: 'Prome Orchestrator', desc: '建立会话，开启多模态分析链路', status: NodeStatus.PENDING, details: {} },
        { id: 'vision-analyze', title: '视觉特征分析', agent: 'Prome Visual AI', desc: '深度分析产品图：色彩、材质、光影', status: NodeStatus.PENDING, details: {} },
        { id: 'scene-gen', title: '场景图生成', agent: 'Prome Scene Studio', desc: '生成高度拟真的 UGC 手持拍摄背景图', status: NodeStatus.PENDING, details: {} },
        { id: 'video-gen', title: '动态视频生成', agent: 'Prome Video Engine', desc: '基于场景图与文案生成关键镜头', status: NodeStatus.PENDING, details: {} },
        { id: 'video-merge', title: '视频混剪', agent: 'Prome Media Processor', desc: '合成转场、背景音乐与输出', status: NodeStatus.PENDING, details: {} },
    ],
};

interface AgentProgressPanelProps {
    taskId?: string;
    mode?: WorkflowMode;
    wsUrl?: string;
    onClose?: () => void;
    onComplete?: (result: WorkflowStatusResponse) => void;
}

export const AgentProgressPanel: React.FC<AgentProgressPanelProps> = ({
    taskId,
    mode: initialMode = WorkflowMode.IMAGE_TEXT,
    wsUrl,
    onClose,
    onComplete,
}) => {
    const [activeMode, setActiveMode] = useState<WorkflowMode>(initialMode);
    const [nodes, setNodes] = useState<WorkflowNode[]>(DEFAULT_NODES[initialMode]);
    const [activeNodeId, setActiveNodeId] = useState<string>(DEFAULT_NODES[initialMode][0].id);
    const [isConnected, setIsConnected] = useState(false);
    const [overallProgress, setOverallProgress] = useState(0);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // WebSocket 连接
    const connectWebSocket = useCallback(() => {
        if (!wsUrl || !taskId) return;

        const ws = new WebSocket(`${wsUrl}?taskId=${taskId}`);

        ws.onopen = () => {
            console.log('[AgentProgressPanel] WebSocket connected');
            setIsConnected(true);
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
                } else if (message.type === 'completed') {
                    const data = message.data as WorkflowStatusResponse;
                    setNodes(data.nodes);
                    setOverallProgress(100);
                    onComplete?.(data);
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

    // 切换模式时更新节点
    useEffect(() => {
        setNodes(DEFAULT_NODES[activeMode]);
        setActiveNodeId(DEFAULT_NODES[activeMode][0].id);
    }, [activeMode]);

    const activeNode = nodes.find(n => n.id === activeNodeId) || nodes[0];
    const modeTheme = MODE_THEMES[activeMode];

    return (
        <div className="flex h-full bg-[#F8FAFC] text-slate-800 overflow-hidden font-sans">

            {/* 1. 左侧：模式轨道 */}
            <aside className="w-20 bg-white border-r border-slate-200 flex flex-col items-center py-8 space-y-10 z-30 shadow-sm">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 mb-4 transition-transform hover:scale-105 cursor-pointer">
                    <Zap size={24} fill="white" />
                </div>

                <div className="flex-1 flex flex-col space-y-8">
                    {Object.values(WorkflowMode).map(mode => {
                        const theme = MODE_THEMES[mode];
                        const isActive = activeMode === mode;
                        const isProcessing = nodes.some(n => n.status === NodeStatus.PROCESSING) && activeMode === mode;
                        const ModeIcon = mode === WorkflowMode.IMAGE_TEXT ? ImageIcon :
                            mode === WorkflowMode.AVATAR_VIDEO ? UserIcon : VideoIcon;

                        return (
                            <div key={mode} className="relative group flex flex-col items-center">
                                <button
                                    onClick={() => setActiveMode(mode)}
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

                <button onClick={onClose} className="p-3 rounded-xl text-slate-400 hover:bg-slate-50 transition-colors">
                    <X size={20} />
                </button>
            </aside>

            {/* 2. 中间：任务序列 */}
            <section className="w-[400px] bg-white border-r border-slate-100 flex flex-col shadow-sm">
                <header className="p-6 border-b border-slate-50 flex items-center justify-between">
                    <div>
                        <h2 className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-1">智能编排引擎</h2>
                        <span className={`text-xl font-extrabold tracking-tight ${modeTheme.color}`}>
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

                <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
                    {/* Connector Line */}
                    <div className="absolute left-[38px] top-12 bottom-12 w-[2px] bg-slate-50 z-0"></div>

                    {nodes.map((node) => {
                        const isSelected = activeNodeId === node.id;
                        const isDone = node.status === NodeStatus.COMPLETED;
                        const isWorking = node.status === NodeStatus.PROCESSING;
                        const isFailed = node.status === NodeStatus.FAILED;

                        return (
                            <div
                                key={node.id}
                                onClick={() => setActiveNodeId(node.id)}
                                className={`group relative z-10 cursor-pointer flex items-center gap-5 p-5 rounded-3xl border transition-all duration-300 ${isSelected
                                        ? 'bg-white border-blue-100 shadow-xl shadow-blue-900/5 ring-1 ring-blue-500/5'
                                        : 'bg-white border-slate-50 hover:border-slate-100 hover:shadow-sm'
                                    }`}
                            >
                                {/* Node Orb */}
                                <div className={`flex-shrink-0 w-12 h-12 rounded-2xl border flex items-center justify-center transition-all duration-500 ${isDone ? 'bg-emerald-50 border-emerald-100 text-emerald-500' :
                                        isWorking ? 'bg-blue-50 border-blue-100 text-blue-500 shadow-inner' :
                                            isFailed ? 'bg-rose-50 border-rose-100 text-rose-500' :
                                                'bg-slate-50 border-slate-100 text-slate-300'
                                    }`}>
                                    <StatusIcon status={node.status} size={22} />
                                </div>

                                {/* Info & Progress */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className={`text-sm font-bold truncate ${isSelected ? 'text-slate-800' : 'text-slate-500'}`}>
                                            {node.title}
                                        </h3>
                                        {isWorking && (
                                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{node.details.progress || 0}%</span>
                                        )}
                                    </div>

                                    {isWorking ? (
                                        <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500"
                                                style={{ width: `${node.details.progress || 0}%` }}
                                            />
                                        </div>
                                    ) : (
                                        <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
                                            <Cpu size={10} /> {node.agent}
                                        </p>
                                    )}
                                </div>

                                <div className={`transition-all duration-300 ${isSelected ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'}`}>
                                    <ChevronRight size={18} className="text-blue-400" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* 3. 右侧：终端监控 */}
            <main className="flex-1 flex flex-col bg-slate-50/30">
                <header className="h-16 px-8 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                            <Terminal size={18} />
                        </div>
                        <h1 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">执行监控</h1>
                        <div className="h-1 w-1 rounded-full bg-slate-300"></div>
                        <span className="text-[10px] font-mono text-slate-400">NODE: {activeNode?.id}</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                            <span className="text-[10px] font-bold text-slate-600">{isConnected ? '已连接' : '未连接'}</span>
                        </div>
                        <div className="h-4 w-px bg-slate-100"></div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                            <Activity size={12} className="text-blue-500" />
                            <span>TASK: {taskId?.slice(0, 8) || 'N/A'}</span>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden p-8">
                    <div className="h-full bg-white rounded-[2rem] border border-slate-100 shadow-2xl shadow-blue-900/5 overflow-hidden flex flex-col">
                        {activeNode && <LogDetail node={activeNode} />}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AgentProgressPanel;
