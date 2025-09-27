import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  FileText,
  User,
  Video,
  Download,
  MessageSquare,
  ArrowRight
} from 'lucide-react';

interface WorkflowStep {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed';
  icon: any;
}

export default function DigitalHumanVideoWorking() {
  const [copywritingContent, setCopywritingContent] = useState('');
  const [steps, setSteps] = useState<WorkflowStep[]>([
    { id: 1, title: '准备文案', description: '导入或编写视频文案', status: 'active', icon: FileText },
    { id: 2, title: '训练数字人', description: '上传素材训练数字人模型', status: 'pending', icon: User },
    { id: 3, title: '生成视频', description: '使用数字人生成最终视频', status: 'pending', icon: Video },
    { id: 4, title: '完成', description: '下载生成的视频', status: 'pending', icon: Download }
  ]);

  // 加载Deep Copywriting结果
  useEffect(() => {
    const loadCopywriting = () => {
      try {
        const conversationId = localStorage.getItem('dify_conversation_id');
        if (conversationId) {
          const messages = localStorage.getItem(`dify_messages_${conversationId}`);
          if (messages) {
            const parsedMessages = JSON.parse(messages);
            const lastAssistantMessage = parsedMessages
              .filter((msg: any) => msg.role === 'assistant')
              .pop();
            
            if (lastAssistantMessage && lastAssistantMessage.content) {
              setCopywritingContent(lastAssistantMessage.content);
            }
          }
        }
      } catch (error) {
        console.error('加载文案失败:', error);
      }
    };

    loadCopywriting();
  }, []);

  const handleImportCopywriting = () => {
    const conversationId = localStorage.getItem('dify_conversation_id');
    if (conversationId) {
      const messages = localStorage.getItem(`dify_messages_${conversationId}`);
      if (messages) {
        try {
          const parsedMessages = JSON.parse(messages);
          const lastAssistantMessage = parsedMessages
            .filter((msg: any) => msg.role === 'assistant')
            .pop();
          
          if (lastAssistantMessage && lastAssistantMessage.content) {
            setCopywritingContent(lastAssistantMessage.content);
          }
        } catch (error) {
          console.error('导入文案失败:', error);
        }
      }
    }
  };

  const renderStepIcon = (step: WorkflowStep) => {
    const IconComponent = step.icon;
    const statusColor = step.status === 'completed' ? 'text-green-600' : 
                       step.status === 'active' ? 'text-blue-600' : 'text-gray-400';
    
    return <IconComponent className={`h-6 w-6 ${statusColor}`} />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">数字人视频创作</h1>
          <p className="text-lg text-gray-600">从文案到视频，一键生成专属数字人内容</p>
        </div>

        {/* 工作流程步骤 */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center border-2
                    ${step.status === 'completed' ? 'bg-green-100 border-green-500' : 
                      step.status === 'active' ? 'bg-blue-100 border-blue-500' : 'bg-gray-100 border-gray-300'}
                  `}>
                    {renderStepIcon(step)}
                  </div>
                  <div className="text-center mt-2">
                    <div className="text-sm font-medium text-gray-900">{step.title}</div>
                    <div className="text-xs text-gray-500">{step.description}</div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <ArrowRight className="h-6 w-6 text-gray-400 mx-4" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {/* 主要内容区域 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 文案准备 */}
            <Card className="shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  步骤 1: 准备视频文案
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      视频文案内容
                    </label>
                    <Textarea
                      value={copywritingContent}
                      onChange={(e) => setCopywritingContent(e.target.value)}
                      placeholder="请输入或导入您的视频文案内容..."
                      className="min-h-[200px] resize-none"
                    />
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      onClick={handleImportCopywriting}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <MessageSquare className="h-4 w-4" />
                      从 Deep Copywriting 导入
                    </Button>
                    
                    {copywritingContent && (
                      <Button
                        onClick={() => {
                          setSteps(prev => prev.map(step => 
                            step.id === 1 ? { ...step, status: 'completed' } :
                            step.id === 2 ? { ...step, status: 'active' } : step
                          ));
                        }}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      >
                        确认文案，下一步
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 数字人训练 */}
            {steps[1].status !== 'pending' && (
              <Card className="shadow-lg border-0">
                <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-lg">
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    步骤 2: 训练数字人
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <Alert>
                    <AlertDescription>
                      数字人训练功能正在开发中，敬请期待！
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 侧边栏 */}
          <div className="space-y-6">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-lg">Deep Copywriting 结果</CardTitle>
              </CardHeader>
              <CardContent>
                {copywritingContent ? (
                  <div className="space-y-3">
                    <Badge variant="secondary" className="mb-2">
                      AI 生成内容
                    </Badge>
                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg max-h-40 overflow-y-auto">
                      {copywritingContent.substring(0, 200)}
                      {copywritingContent.length > 200 && '...'}
                    </div>
                    <Button 
                      onClick={handleImportCopywriting}
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                    >
                      导入此内容
                    </Button>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-4">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">暂无 Deep Copywriting 结果</p>
                    <p className="text-xs text-gray-400 mt-1">
                      请先使用 Deep Copywriting 生成内容
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}