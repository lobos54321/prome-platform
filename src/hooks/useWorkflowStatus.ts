'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { WeeklyPlan, ContentStrategy } from '@/types/xiaohongshu';

export interface GeneratedContent {
    title: string;
    text: string;
    imageUrls?: string[];
    hashtags?: string[];
    scheduledTime?: string;
    status?: 'draft' | 'approved' | 'publishing' | 'published' | 'failed';
    variants?: Array<{ type: string; title: string; text: string }>;
}

export interface WorkflowExecutionStatus {
    status: 'idle' | 'generating' | 'completed' | 'failed';
    progress: number;
    currentStep?: string;
    generatedContent?: GeneratedContent;
    error?: string;
}

interface UseWorkflowStatusOptions {
    userId: string;
    backendUrl?: string;
    pollingInterval?: number;
    enabled?: boolean;
    onComplete?: (content: GeneratedContent) => void;
    onError?: (error: string) => void;
}

export function useWorkflowStatus({
    userId,
    backendUrl = 'https://xiaohongshu-automation-ai.zeabur.app',
    pollingInterval = 5000,
    enabled = true,
    onComplete,
    onError,
}: UseWorkflowStatusOptions) {
    const [status, setStatus] = useState<WorkflowExecutionStatus>({
        status: 'idle',
        progress: 0,
    });
    const [isPolling, setIsPolling] = useState(false);
    const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
    const [contentStrategy, setContentStrategy] = useState<ContentStrategy | null>(null);

    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const mountedRef = useRef(true);

    // 获取执行状态
    const fetchStatus = useCallback(async () => {
        if (!userId || !enabled) return;

        try {
            const response = await fetch(`${backendUrl}/agent/auto/status/${userId}`);
            const data = await response.json();

            if (!mountedRef.current) return;

            if (data.success && data.data) {
                const apiStatus = data.data.status || data.data.generationStatus || 'idle';
                const progress = data.data.progress || 0;

                setStatus({
                    status: apiStatus as WorkflowExecutionStatus['status'],
                    progress,
                    currentStep: data.data.currentStep,
                    generatedContent: data.data.generatedContent,
                    error: data.data.error,
                });

                // 完成时回调
                if (apiStatus === 'completed' && data.data.generatedContent) {
                    onComplete?.(data.data.generatedContent);
                    stopPolling();
                }

                // 失败时回调
                if (apiStatus === 'failed' && data.data.error) {
                    onError?.(data.data.error);
                    stopPolling();
                }

                return data.data;
            }
        } catch (err) {
            console.error('[useWorkflowStatus] Fetch error:', err);
        }
    }, [userId, backendUrl, enabled, onComplete, onError]);

    // 获取周计划和策略
    const fetchPlanAndStrategy = useCallback(async () => {
        if (!userId) return;

        try {
            // 获取周计划
            const planResponse = await fetch(`${backendUrl}/agent/auto/weekly-plan/${userId}`);
            const planData = await planResponse.json();
            if (planData.success && planData.data) {
                setWeeklyPlan(planData.data);
            }

            // 获取策略
            const strategyResponse = await fetch(`${backendUrl}/agent/auto/strategy/${userId}`);
            const strategyData = await strategyResponse.json();
            if (strategyData.success && strategyData.data) {
                setContentStrategy(strategyData.data);
            }
        } catch (err) {
            console.error('[useWorkflowStatus] Fetch plan/strategy error:', err);
        }
    }, [userId, backendUrl]);

    // 开始轮询
    const startPolling = useCallback(() => {
        if (isPolling) return;

        console.log('[useWorkflowStatus] Starting polling for:', userId);
        setIsPolling(true);

        // 立即获取一次
        fetchStatus();
        fetchPlanAndStrategy();

        // 设置轮询
        pollingRef.current = setInterval(() => {
            fetchStatus();
        }, pollingInterval);
    }, [isPolling, userId, pollingInterval, fetchStatus, fetchPlanAndStrategy]);

    // 停止轮询
    const stopPolling = useCallback(() => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
        setIsPolling(false);
        console.log('[useWorkflowStatus] Stopped polling');
    }, []);

    // 手动刷新
    const refresh = useCallback(async () => {
        await Promise.all([fetchStatus(), fetchPlanAndStrategy()]);
    }, [fetchStatus, fetchPlanAndStrategy]);

    // 自动开始轮询（当生成中时）
    useEffect(() => {
        if (enabled && userId) {
            // 首次加载
            refresh();
        }

        return () => {
            mountedRef.current = false;
            stopPolling();
        };
    }, [enabled, userId]);

    // 状态变为 generating 时自动开始轮询
    useEffect(() => {
        if (status.status === 'generating' && !isPolling) {
            startPolling();
        }
    }, [status.status, isPolling, startPolling]);

    return {
        status,
        weeklyPlan,
        contentStrategy,
        isPolling,
        startPolling,
        stopPolling,
        refresh,
    };
}

export default useWorkflowStatus;
