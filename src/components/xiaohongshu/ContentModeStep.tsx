/**
 * ContentModeStep - 内容形式偏好设置步骤
 * 
 * 用户设置内容形式偏好后，点击启动运营
 * 显示 AgentProgressPanel，完成后进入 Dashboard
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Eye, Loader2 } from 'lucide-react';
import { ContentModeConfig } from './ContentModeConfig';
import { AgentProgressPanel } from '@/components/workflow';
import { WorkflowMode } from '@/types/workflow';
import type { UserProfile } from '@/types/xiaohongshu';

interface ContentModeStepProps {
    supabaseUuid: string;
    xhsUserId: string;
    userProfile?: UserProfile | null;
    onComplete: () => void;
    onViewDashboard: () => void;
}

export function ContentModeStep({
    supabaseUuid,
    xhsUserId,
    userProfile,
    onComplete,
    onViewDashboard,
}: ContentModeStepProps) {
    const [showProgressPanel, setShowProgressPanel] = useState(false);
    const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
    const [selectedWorkflowMode, setSelectedWorkflowMode] = useState<WorkflowMode>(WorkflowMode.IMAGE_TEXT);
    const [starting, setStarting] = useState(false);

    const handleStartOperation = () => {
        setStarting(true);
        const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        setCurrentTaskId(taskId);
        setShowProgressPanel(true);
        setStarting(false);
    };

    // 如果显示进度面板，渲染全屏进度视图
    if (showProgressPanel) {
        return (
            <div className="fixed inset-0 z-50 bg-white">
                <AgentProgressPanel
                    taskId={currentTaskId || undefined}
                    mode={selectedWorkflowMode}
                    onClose={() => {
                        setShowProgressPanel(false);
                        setCurrentTaskId(null);
                        onComplete();
                    }}
                    onComplete={(result) => {
                        console.log('Workflow completed:', result);
                        setShowProgressPanel(false);
                        setCurrentTaskId(null);
                        onComplete();
                    }}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
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

            {/* 操作按钮 */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex justify-between items-center">
                        <Button
                            variant="outline"
                            onClick={onViewDashboard}
                        >
                            <Eye className="h-4 w-4 mr-2" />
                            查看运营仪表盘
                        </Button>
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
