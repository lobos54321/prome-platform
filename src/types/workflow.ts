/**
 * Workflow 类型定义
 * 
 * 用于 Agent Progress Tree UI
 */

// 内容生成模式
export enum WorkflowMode {
    IMAGE_TEXT = 'IMAGE_TEXT',
    AVATAR_VIDEO = 'AVATAR_VIDEO',
    UGC_VIDEO = 'UGC_VIDEO'
}

// 节点状态
export enum NodeStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed'
}

// 工作流节点
export interface WorkflowNode {
    id: string;
    title: string;
    agent: string;         // Agent 名称（使用自有品牌名）
    desc: string;          // 节点描述
    status: NodeStatus;
    icon?: React.ComponentType<{ size?: number; className?: string }>;
    details: {
        input?: string;
        output?: string;
        strategy?: string;
        goldenQuotes?: string[];
        readabilityScore?: number;
        timeTaken?: string;
        progress?: number;
        currentAction?: string;
        sessionId?: string;
        promptDraft?: string;
        features?: string[];
        audioUrl?: string;
        videoUrl?: string;
        usableImages?: number;
        eta?: string;
        error?: string;
    };
}

// 工作流状态响应
export interface WorkflowStatusResponse {
    taskId: string;
    mode: WorkflowMode;
    overallStatus: 'pending' | 'processing' | 'completed' | 'failed';
    overallProgress: number;
    nodes: WorkflowNode[];
    startedAt?: string;
    completedAt?: string;
}

// WebSocket 消息类型
export interface WorkflowWSMessage {
    type: 'status_update' | 'node_update' | 'completed' | 'error';
    taskId: string;
    data: Partial<WorkflowStatusResponse> | WorkflowNode | { error: string };
}

// 模式主题
export interface ModeTheme {
    color: string;
    bg: string;
    label: string;
}

// 模式主题配置
export const MODE_THEMES: Record<WorkflowMode, ModeTheme> = {
    [WorkflowMode.IMAGE_TEXT]: { color: 'text-blue-600', bg: 'bg-blue-600', label: '图文种草' },
    [WorkflowMode.AVATAR_VIDEO]: { color: 'text-indigo-600', bg: 'bg-indigo-600', label: '数字人讲解' },
    [WorkflowMode.UGC_VIDEO]: { color: 'text-violet-600', bg: 'bg-violet-600', label: '真人UGC' },
};
