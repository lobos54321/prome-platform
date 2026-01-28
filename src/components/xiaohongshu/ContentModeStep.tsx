/**
 * ContentModeStep - 内容形式偏好设置步骤
 * 
 * 用户设置内容形式偏好后，点击启动运营
 * 显示 AgentProgressPanel，完成后进入 Dashboard
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { ContentModeConfig } from './ContentModeConfig';
import { AgentProgressPanel } from '@/components/workflow';
import { WorkflowMode } from '@/types/workflow';
import type { UserProfile } from '@/types/xiaohongshu';
import { xiaohongshuAPI } from '@/lib/xiaohongshu-backend-api';
import { xiaohongshuSupabase } from '@/lib/xiaohongshu-supabase';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ContentModeStepProps {
    supabaseUuid: string;
    xhsUserId: string;
    userProfile?: UserProfile | null;
    /** 🔥 当前激活的平台（多平台切换时由父组件传入） */
    activePlatform?: string;
    /** 🔥 是否启用舆情分析（默认 true） */
    enableSentiment?: boolean;
    /** 🔥 目标平台列表（由父组件直接传入，优先于 userProfile） */
    targetPlatforms?: string[];
    /** 🔥 返回上一步回调 */
    onBack?: () => void;
    onComplete: () => void;
    onViewDashboard: () => void;
    /** 🔥 重新配置回调 - 跳转到配置页面 */
    onReconfigure?: () => void;
}

export function ContentModeStep({
    supabaseUuid,
    xhsUserId,
    userProfile,
    activePlatform,
    enableSentiment = true,
    targetPlatforms: propTargetPlatforms,
    onBack,
    onComplete,
    onViewDashboard,
    onReconfigure,
}: ContentModeStepProps) {
    const [showProgressPanel, setShowProgressPanel] = useState(false);
    const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
    const [selectedWorkflowMode, setSelectedWorkflowMode] = useState<WorkflowMode>(() => {
        const pref = userProfile?.content_mode_preference;
        if (pref === 'UGC_VIDEO') return WorkflowMode.UGC_VIDEO;
        if (pref === 'AVATAR_VIDEO') return WorkflowMode.AVATAR_VIDEO;
        return WorkflowMode.IMAGE_TEXT;
    });
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // 🔥 目标发布平台 - 优先使用 prop 传入的值，其次是 userProfile，最后是默认值
    const selectedPlatforms = propTargetPlatforms || userProfile?.target_platforms || ['xiaohongshu'];

    // 平台显示名称映射 - 只保留小红书和 X
    const platformDisplayNames: Record<string, { name: string; icon: string }> = {
        xiaohongshu: { name: '小红书', icon: '📕' },
        x: { name: 'X (Twitter)', icon: '𝕏' },
    };

    // 🔥 在组件加载时检查是否有正在进行的任务，并恢复进度面板
    useEffect(() => {
        try {
            const savedTask = localStorage.getItem('prome_active_task');
            if (savedTask) {
                const task = JSON.parse(savedTask);
                // 检查任务是否属于当前用户
                if (task.supabaseUuid === supabaseUuid && task.taskId) {
                    console.log('🔄 恢复进行中的任务:', task);
                    setCurrentTaskId(task.taskId);
                    // 恢复工作流模式
                    if (task.mode) {
                        setSelectedWorkflowMode(task.mode);
                    }
                    setShowProgressPanel(true);
                }
            }
        } catch (e) {
            console.warn('Failed to restore active task:', e);
        }
    }, [supabaseUuid]);

    // 同步配置变化
    useEffect(() => {
        if (userProfile?.content_mode_preference) {
            const pref = userProfile.content_mode_preference;
            if (pref === 'UGC_VIDEO') setSelectedWorkflowMode(WorkflowMode.UGC_VIDEO);
            else if (pref === 'AVATAR_VIDEO') setSelectedWorkflowMode(WorkflowMode.AVATAR_VIDEO);
            else setSelectedWorkflowMode(WorkflowMode.IMAGE_TEXT);
        }
    }, [userProfile?.content_mode_preference]);

    const handleStartOperation = async () => {
        if (!userProfile?.product_name) {
            setError('产品信息不完整，请返回重新配置');
            return;
        }

        // 🔥 使用 UUID 格式的 taskId，以便后端可以持久化工作流状态到数据库
        // 后端 WorkflowProgressService 只对 UUID 格式的 taskId 进行数据库持久化
        const taskId = crypto.randomUUID();

        try {
            console.log('🚀 [ContentModeStep] Starting operation sequence...', { xhsUserId, taskId });
            setStarting(true);
            setError(null);

            // 1. 调用后端 API 启动工作流
            console.log('📡 [ContentModeStep] Step 1: Calling Backend API...');
            console.log('🎯 [ContentModeStep] Selected Workflow Mode:', selectedWorkflowMode);
            const response = await xiaohongshuAPI.startAutoOperation(xhsUserId, {
                productName: userProfile.product_name,
                targetAudience: userProfile.target_audience || '',
                marketingGoal: userProfile.marketing_goal as any,
                postFrequency: userProfile.post_frequency as any,
                postsPerDay: userProfile.posts_per_day || 1, // 🔥 每日发布篇数，用于周计划详细内容生成
                brandStyle: userProfile.brand_style || 'warm',
                reviewMode: (userProfile.review_mode as any) || 'manual',
                taskId, // 传递任务ID
                contentModePreference: selectedWorkflowMode, // 🔥 使用当前选择的模式而非 userProfile 中的旧值
                targetPlatforms: selectedPlatforms, // 🔥 传递选择的目标平台
                enableSentiment, // 🔥 舆情开关
            });

            if (!response.success) {
                console.error('❌ [ContentModeStep] Backend API returned error:', response);
                throw new Error(response.message || '启动失败');
            }
            console.log('✅ [ContentModeStep] Backend API Success:', response);

            // 2. 更新 Supabase 中的运营状态
            console.log('💾 [ContentModeStep] Step 2: Saving Automation Status...');
            await xiaohongshuSupabase.saveAutomationStatus({
                supabase_uuid: supabaseUuid,
                xhs_user_id: xhsUserId,
                is_running: true,
                is_logged_in: true,
                has_config: true,
                last_activity: new Date().toISOString(),
                uptime_seconds: 0,
            });

            // 3. 记录活动日志
            console.log('📝 [ContentModeStep] Step 3: Adding Activity Log...');
            await xiaohongshuSupabase.addActivityLog({
                supabase_uuid: supabaseUuid,
                xhs_user_id: xhsUserId,
                activity_type: 'start',
                message: '从偏好设置页面启动自动运营',
                metadata: {
                    productName: userProfile.product_name,
                    mode: selectedWorkflowMode,
                    taskId
                },
            });

            // 4. 显示进度面板
            console.log('🏁 [ContentModeStep] Step 4: Activating Progress Panel...');
            setCurrentTaskId(taskId);
            setShowProgressPanel(true);

            // 🔥 更新 URL 到对应平台（不触发路由跳转，只更新显示）
            const platform = activePlatform || selectedPlatforms[0] || 'xiaohongshu';
            const platformUrls: Record<string, string> = {
                xiaohongshu: '/xiaohongshu',
                x: '/x',
                tiktok: '/tiktok',
                instagram: '/instagram',
                youtube: '/youtube',
            };
            window.history.replaceState(null, '', platformUrls[platform] || '/xiaohongshu');

            // 🔥 保存任务状态到 localStorage，刷新页面后可恢复
            localStorage.setItem('prome_active_task', JSON.stringify({
                taskId,
                platform,
                mode: selectedWorkflowMode,
                supabaseUuid,
                xhsUserId,
                startedAt: new Date().toISOString(),
            }));
        } catch (err) {
            console.error('❌ [ContentModeStep] Operation failed:', err);
            setError(err instanceof Error ? err.message : '启动失败，请稍后重试');
        } finally {
            setStarting(false);
        }
    };

    // 如果显示进度面板，渲染全屏进度视图
    if (showProgressPanel) {
        return (
            <div className="fixed inset-0 z-50 bg-white">
                <AgentProgressPanel
                    taskId={currentTaskId || undefined}
                    mode={selectedWorkflowMode}
                    // 🔥 传递完整的用户配置信息
                    supabaseUuid={supabaseUuid}
                    productName={userProfile?.product_name}
                    marketingGoal={userProfile?.marketing_goal as 'brand' | 'sales' | 'traffic' | 'community' | undefined}
                    postFrequency={userProfile?.post_frequency as 'daily' | 'weekly' | 'biweekly' | 'monthly' | undefined}
                    // 🔥 传递目标平台列表
                    targetPlatforms={selectedPlatforms}
                    // 🔥 重新配置回调
                    onReconfigure={onReconfigure}
                    onClose={() => {
                        setShowProgressPanel(false);
                        setCurrentTaskId(null);
                        // 🔥 清除任务状态
                        localStorage.removeItem('prome_active_task');
                        onComplete();
                    }}
                    onComplete={(result) => {
                        console.log('Workflow completed:', result);
                        setShowProgressPanel(false);
                        setCurrentTaskId(null);
                        // 🔥 清除任务状态
                        localStorage.removeItem('prome_active_task');
                        onComplete();
                    }}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {/* 头部说明 */}
            <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
                <CardContent className="p-6">
                    <h2 className="text-xl font-bold text-purple-800 mb-2">
                        🎨 设置内容形式偏好
                    </h2>
                    <p className="text-purple-700">
                        选择您希望系统生成的内容类型，然后点击"启动运营"开始自动创作流程
                    </p>
                </CardContent>
            </Card>

            {/* 内容形式偏好配置 */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">内容形式偏好</CardTitle>
                </CardHeader>
                <CardContent>
                    <ContentModeConfig
                        supabaseUuid={supabaseUuid}
                        initialModes={userProfile?.content_mode_preference ? [userProfile.content_mode_preference as 'IMAGE_TEXT' | 'UGC_VIDEO' | 'AVATAR_VIDEO'] : ['IMAGE_TEXT']}
                        initialAvatarPhoto={userProfile?.avatar_photo_url}
                        initialVoiceSample={userProfile?.voice_sample_url}
                        initialAvatarVideoDuration={userProfile?.avatar_video_duration}
                        initialUgcGender={userProfile?.ugc_gender as 'male' | 'female' | undefined}
                        initialUgcLanguage={userProfile?.ugc_language}
                        initialUgcDuration={userProfile?.ugc_duration}
                        onConfigChange={(config) => {
                            console.log('内容形式偏好已更新:', config);
                            // 更新 selectedWorkflowMode 用于 AgentProgressPanel
                            if (config.selectedModes.length > 0) {
                                const mode = config.selectedModes[0];
                                switch (mode) {
                                    case 'UGC_VIDEO':
                                        setSelectedWorkflowMode(WorkflowMode.UGC_VIDEO);
                                        break;
                                    case 'AVATAR_VIDEO':
                                        setSelectedWorkflowMode(WorkflowMode.AVATAR_VIDEO);
                                        break;
                                    default:
                                        setSelectedWorkflowMode(WorkflowMode.IMAGE_TEXT);
                                }
                            }
                        }}
                    />
                </CardContent>
            </Card>

            {/* 🔥 目标发布平台展示 (只读，在 /auto 页面已选择) */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">目标发布平台</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-500 mb-4">
                        系统将为以下平台生成符合其特性的变体文案（可在「自动化配置」页面修改）
                    </p>
                    <div className="flex flex-wrap gap-3">
                        {selectedPlatforms.map((platformId) => {
                            const platform = platformDisplayNames[platformId];
                            if (!platform) return null;
                            return (
                                <div
                                    key={platformId}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-purple-500 bg-purple-50 text-purple-700"
                                >
                                    <span className="text-xl">{platform.icon}</span>
                                    <span className="font-medium">{platform.name}</span>
                                    <span className="text-xs text-purple-500">✓</span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                        已选择 {selectedPlatforms.length} 个平台
                    </p>
                </CardContent>
            </Card>

            {/* 操作按钮 */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex justify-between items-center">
                        {/* 返回上一步按钮 */}
                        {onBack && (
                            <Button
                                variant="outline"
                                onClick={onBack}
                                disabled={starting}
                                className="px-6"
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                返回上一步
                            </Button>
                        )}
                        {!onBack && <div />}

                        {/* 启动运营按钮 */}
                        <Button
                            onClick={handleStartOperation}
                            disabled={starting}
                            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-8"
                        >
                            {starting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    正在启动...
                                </>
                            ) : (
                                <>
                                    <Play className="h-4 w-4 mr-2" />
                                    启动运营
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
