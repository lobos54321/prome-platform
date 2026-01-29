'use client';

import React, { useCallback } from 'react';
import { AgentProgressPanel } from './AgentProgressPanel';
import { useWorkflowStatus, type GeneratedContent } from '@/hooks/useWorkflowStatus';
import { xiaohongshuAPI } from '@/lib/xiaohongshu-backend-api';
import type { WorkflowMode, WorkflowStatusResponse } from '@/types/workflow';

interface AgentProgressPanelConnectedProps {
    supabaseUuid: string;
    xhsUserId?: string;
    productName?: string;
    marketingGoal?: 'brand' | 'sales' | 'traffic' | 'community';
    postFrequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    taskId?: string;
    mode?: WorkflowMode;
    wsUrl?: string;
    backendUrl?: string;
    onClose?: () => void;
    onComplete?: (result: WorkflowStatusResponse) => void;
    onPublishSuccess?: () => void;
}

/**
 * AgentProgressPanel 的连接版本
 * 自动从后端获取状态、周计划、策略、生成内容
 */
export const AgentProgressPanelConnected: React.FC<AgentProgressPanelConnectedProps> = ({
    supabaseUuid,
    xhsUserId,
    productName,
    marketingGoal,
    postFrequency,
    taskId,
    mode,
    wsUrl,
    backendUrl = 'https://xiaohongshu-automation-ai.zeabur.app',
    onClose,
    onComplete,
    onPublishSuccess,
}) => {
    // 使用后端状态 hook
    const {
        status: workflowStatus,
        weeklyPlan,
        contentStrategy,
        isPolling,
        refresh,
    } = useWorkflowStatus({
        userId: xhsUserId || supabaseUuid,
        backendUrl,
        enabled: true,
        onComplete: (content) => {
            console.log('[AgentProgressPanelConnected] Content generation completed:', content);
        },
        onError: (error) => {
            console.error('[AgentProgressPanelConnected] Workflow error:', error);
        },
    });

    // 发布处理
    const handlePublish = useCallback(async () => {
        const userId = xhsUserId || supabaseUuid;
        if (!userId || !workflowStatus.generatedContent) {
            console.error('[Publish] No userId or content');
            return;
        }

        try {
            console.log('[Publish] Starting publish for:', userId);

            // 调用后端发布 API
            const response = await fetch(`${backendUrl}/api/publish/trigger`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    content: workflowStatus.generatedContent,
                }),
            });

            const result = await response.json();

            if (result.success) {
                console.log('[Publish] Success:', result);
                onPublishSuccess?.();
                // 刷新状态以更新内容状态
                await refresh();
            } else {
                console.error('[Publish] Failed:', result.error);
                throw new Error(result.error || '发布失败');
            }
        } catch (err) {
            console.error('[Publish] Error:', err);
            throw err;
        }
    }, [xhsUserId, supabaseUuid, workflowStatus.generatedContent, backendUrl, onPublishSuccess, refresh]);

    // 编辑内容
    const handleEditContent = useCallback(() => {
        console.log('[AgentProgressPanelConnected] Edit content requested');
        // TODO: 打开编辑模态框
    }, []);

    // 重新生成
    const handleRegenerateContent = useCallback(async () => {
        const userId = xhsUserId || supabaseUuid;
        if (!userId) return;

        try {
            console.log('[Regenerate] Triggering content regeneration for:', userId);

            const response = await fetch(`${backendUrl}/agent/auto/regenerate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });

            const result = await response.json();
            if (result.success) {
                // 刷新状态
                await refresh();
            } else {
                console.error('[Regenerate] Failed:', result.error);
            }
        } catch (err) {
            console.error('[Regenerate] Error:', err);
        }
    }, [xhsUserId, supabaseUuid, backendUrl, refresh]);

    // 转换生成内容格式
    const todayContent = workflowStatus.generatedContent ? {
        title: workflowStatus.generatedContent.title,
        text: workflowStatus.generatedContent.text,
        imageUrls: workflowStatus.generatedContent.imageUrls,
        hashtags: workflowStatus.generatedContent.hashtags,
        scheduledTime: workflowStatus.generatedContent.scheduledTime,
        status: workflowStatus.generatedContent.status || (
            workflowStatus.status === 'completed' ? 'draft' : undefined
        ),
        variants: workflowStatus.generatedContent.variants,
    } : null;

    return (
        <AgentProgressPanel
            taskId={taskId}
            mode={mode}
            wsUrl={wsUrl}
            onClose={onClose}
            onComplete={onComplete}
            supabaseUuid={supabaseUuid}
            productName={productName}
            marketingGoal={marketingGoal}
            postFrequency={postFrequency}
            contentStrategy={contentStrategy}
            weeklyPlan={weeklyPlan}
            todayContent={todayContent}
            onPublish={handlePublish}
            onEditContent={handleEditContent}
            onRegenerateContent={handleRegenerateContent}
            onRegeneratePlatformVariant={async (platform, prompt) => {
                console.log(`🔄 重新生成 ${platform} 平台变体...`);
                const result = await xiaohongshuAPI.regeneratePlatformVariant(platform, prompt);
                if (result.success && result.data) {
                    return result.data;
                }
                console.error('重新生成变体失败:', result.error);
                return null;
            }}
        />
    );
};

export default AgentProgressPanelConnected;
