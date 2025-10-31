import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertCircle, Loader2, Send, Sparkles, QrCode, CheckCircle, Upload, Eye } from 'lucide-react';
import { authService } from '@/lib/auth';

const API_BASE_URL = 'https://xiaohongshu-proxy-k8j5.zeabur.app/api/v1/xiaohongshu';
const API_KEY = 'xhp_dca32d31-cfa4-4dac-bf7f-a14e8ae8f6f9';

export default function XiaohongshuMarketing() {
  const navigate = useNavigate();
  const user = authService.getCurrentUserSync();

  // 内容生成相关状态
  const [prompt, setPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // 小红书登录相关状态
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);
  const [checkingLogin, setCheckingLogin] = useState(false);

  // 发布相关状态
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [publishMode, setPublishMode] = useState<'preview' | 'auto'>('preview'); // 预览模式或自动发布
  const [publishing, setPublishing] = useState(false);

  // 任务状态
  const [currentTaskId, setCurrentTaskId] = useState<string>('');
  const [taskStatus, setTaskStatus] = useState<string>('');
  const [taskProgress, setTaskProgress] = useState<number>(0);
  const [queuePosition, setQueuePosition] = useState<number>(0);

  // 预览相关
  const [showPreview, setShowPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  // 如果用户未登录，跳转到登录页
  if (!user) {
    navigate('/login');
    return null;
  }

  // 定期检查登录状态
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showQRCode && !isLoggedIn) {
      interval = setInterval(() => {
        checkXiaohongshuLoginStatus();
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showQRCode, isLoggedIn]);

  // 轮询任务状态
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentTaskId && !['completed', 'failed'].includes(taskStatus)) {
      interval = setInterval(async () => {
        await pollTaskStatus(currentTaskId);
      }, 2000); // 每2秒查询一次
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentTaskId, taskStatus]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setError('');
    setGeneratedContent('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error('请求失败');
      }

      const data = await response.json();

      if (data.code === 200) {
        setGeneratedContent(data.data.content);
      } else {
        setError(data.message || '生成失败');
      }
    } catch (err: any) {
      setError(err.message || '生成失败，请重试');
    } finally {
      setGenerating(false);
    }
  };

  // 获取小红书登录二维码
  const getLoginQRCode = async () => {
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/playwright/login/qrcode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
      });

      if (!response.ok) {
        throw new Error('获取二维码失败');
      }

      const data = await response.json();
      if (data.code === 200) {
        setQrCode(data.data.qrcode);
        setShowQRCode(true);
      } else {
        setError(data.message || '获取二维码失败');
      }
    } catch (err: any) {
      setError(err.message || '获取二维码失败，请重试');
    }
  };

  // 检查小红书登录状态
  const checkXiaohongshuLoginStatus = async () => {
    if (checkingLogin) return;

    setCheckingLogin(true);
    try {
      const response = await fetch(`${API_BASE_URL}/playwright/login/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (data.code === 200 && data.data.status === 'logged_in') {
        setIsLoggedIn(true);
        setShowQRCode(false);
        setError('');
      }
    } catch (err: any) {
      console.error('检查登录状态失败:', err);
    } finally {
      setCheckingLogin(false);
    }
  };

  // 提交发布任务
  const submitPublishTask = async (mode: 'preview' | 'publish') => {
    if (!title || !content) {
      setError('请先填写标题和内容');
      return;
    }

    if (!isLoggedIn) {
      setError('请先登录小红书');
      return;
    }

    setPublishing(true);
    setError('');
    setTaskStatus('');
    setTaskProgress(0);

    try {
      const response = await fetch(`${API_BASE_URL}/playwright/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify({
          mode,
          title,
          content,
          images: [],
          tags: [],
        }),
      });

      if (!response.ok) {
        throw new Error('提交任务失败');
      }

      const data = await response.json();
      if (data.code === 200) {
        setCurrentTaskId(data.data.taskId);
        setTaskStatus(data.data.status);
      } else {
        setError(data.message || '提交失败');
        setPublishing(false);
      }
    } catch (err: any) {
      setError(err.message || '提交失败，请重试');
      setPublishing(false);
    }
  };

  // 轮询任务状态
  const pollTaskStatus = async (taskId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/playwright/task/${taskId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (data.code === 200) {
        const status = data.data;
        setTaskStatus(status.status);
        setTaskProgress(status.progress || 0);
        setQueuePosition(status.position || 0);

        // 任务完成
        if (status.status === 'completed') {
          setPublishing(false);

          // 预览模式：显示截图
          if (status.result?.mode === 'preview' && status.result?.screenshot) {
            setPreviewImage(status.result.screenshot);
            setShowPreview(true);
          }

          // 发布模式：显示成功消息
          if (status.result?.mode === 'publish') {
            alert('发布成功！');
            setTitle('');
            setContent('');
          }
        }

        // 任务失败
        if (status.status === 'failed') {
          setPublishing(false);
          setError(status.error || '任务执行失败');
        }
      }
    } catch (err: any) {
      console.error('查询任务状态失败:', err);
    }
  };

  // 预览模式
  const handlePreview = () => {
    submitPublishTask('preview');
  };

  // 确认发布（从预览弹窗）
  const handleConfirmPublish = () => {
    setShowPreview(false);
    submitPublishTask('publish');
  };

  // 自动发布
  const handleAutoPublish = () => {
    submitPublishTask('publish');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // 渲染任务状态
  const renderTaskStatus = () => {
    if (!publishing) return null;

    let statusText = '';
    if (taskStatus === 'waiting') {
      statusText = `排队中...前面还有 ${queuePosition} 个任务`;
    } else if (taskStatus === 'active') {
      statusText = `处理中 ${taskProgress}%`;
    } else if (taskStatus === 'completed') {
      statusText = '完成';
    }

    return (
      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <span className="text-sm text-blue-700">{statusText}</span>
        </div>
        {taskProgress > 0 && (
          <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${taskProgress}%` }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent">
          小红书自动运营
        </h1>
        <p className="text-muted-foreground">
          AI 驱动的小红书内容创作平台 - 支持预览和自动发布
        </p>
      </div>

      <div className="grid gap-6">
        {/* 小红书登录卡片 */}
        <Card className="border-2 border-red-100">
          <CardHeader className="bg-gradient-to-r from-red-50 to-pink-50">
            <CardTitle className="flex items-center gap-2">
              {isLoggedIn ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <QrCode className="h-5 w-5 text-red-500" />
              )}
              小红书账号登录
            </CardTitle>
            <CardDescription>
              {isLoggedIn ? '已登录小红书账号' : '扫描二维码登录您的小红书账号'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {!isLoggedIn && !showQRCode && (
              <Button
                onClick={getLoginQRCode}
                className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600"
                size="lg"
              >
                <QrCode className="mr-2 h-5 w-5" />
                获取登录二维码
              </Button>
            )}

            {showQRCode && !isLoggedIn && (
              <div className="flex flex-col items-center space-y-4">
                <div className="p-4 bg-white rounded-lg border-2 border-red-200">
                  <img
                    src={`data:image/png;base64,${qrCode}`}
                    alt="小红书登录二维码"
                    className="w-64 h-64"
                  />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  请使用小红书 App 扫描上方二维码登录
                </p>
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                  <span className="text-sm text-muted-foreground">等待扫码中...</span>
                </div>
              </div>
            )}

            {isLoggedIn && (
              <div className="flex items-center justify-center space-x-2 p-4 bg-green-50 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-500" />
                <span className="text-green-700 font-medium">已成功登录小红书账号</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI 内容生成卡片 */}
        <Card className="border-2 border-red-100">
          <CardHeader className="bg-gradient-to-r from-red-50 to-pink-50">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-red-500" />
              AI 内容生成
            </CardTitle>
            <CardDescription>
              输入您的需求，AI 将为您生成优质的小红书内容
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleGenerate} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="prompt" className="text-base font-semibold">
                  内容需求描述
                </Label>
                <Textarea
                  id="prompt"
                  placeholder="例如：帮我生成一篇关于秋季护肤的小红书笔记，要包含产品推荐和使用技巧..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={5}
                  required
                  className="resize-none"
                />
                <p className="text-sm text-muted-foreground">
                  💡 提示：描述越详细，生成的内容越精准
                </p>
              </div>

              <Button
                type="submit"
                disabled={generating}
                className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600"
                size="lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    AI 正在创作中...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-5 w-5" />
                    开始生成内容
                  </>
                )}
              </Button>
            </form>

            {error && (
              <Alert variant="destructive" className="mt-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {generatedContent && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">生成的内容</Label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        copyToClipboard(generatedContent);
                      }}
                    >
                      复制内容
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setContent(generatedContent);
                        setTitle('');
                      }}
                    >
                      使用此内容发布
                    </Button>
                  </div>
                </div>
                <Card className="bg-gradient-to-br from-red-50 to-pink-50">
                  <CardContent className="pt-6">
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
                      {generatedContent}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 一键发布卡片 */}
        <Card className="border-2 border-green-100">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-green-500" />
              发布到小红书
            </CardTitle>
            <CardDescription>
              填写标题和内容，选择发布模式
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-base font-semibold">
                  笔记标题
                </Label>
                <Input
                  id="title"
                  placeholder="请输入笔记标题"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!isLoggedIn || publishing}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content" className="text-base font-semibold">
                  笔记内容
                </Label>
                <Textarea
                  id="content"
                  placeholder="请输入笔记内容"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={10}
                  disabled={!isLoggedIn || publishing}
                  className="resize-none"
                />
              </div>

              {/* 发布模式选择 */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">发布模式</Label>
                <RadioGroup value={publishMode} onValueChange={(value: any) => setPublishMode(value)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="preview" id="preview" />
                    <Label htmlFor="preview" className="font-normal cursor-pointer">
                      预览模式（推荐）- 先预览效果再确认发布
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="auto" id="auto" />
                    <Label htmlFor="auto" className="font-normal cursor-pointer">
                      自动发布 - 直接发布无需确认
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* 发布按钮 */}
              {publishMode === 'preview' ? (
                <Button
                  onClick={handlePreview}
                  disabled={publishing || !isLoggedIn || !title || !content}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                  size="lg"
                >
                  {publishing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      生成预览中...
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-5 w-5" />
                      生成预览
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleAutoPublish}
                  disabled={publishing || !isLoggedIn || !title || !content}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                  size="lg"
                >
                  {publishing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      发布中...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-5 w-5" />
                      一键发布
                    </>
                  )}
                </Button>
              )}

              {/* 任务状态显示 */}
              {renderTaskStatus()}

              {!isLoggedIn && (
                <p className="text-sm text-muted-foreground text-center text-yellow-600">
                  ⚠️ 请先登录小红书账号后再发布
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 预览弹窗 */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>发布预览</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {previewImage && (
              <img
                src={`data:image/png;base64,${previewImage}`}
                alt="发布预览"
                className="w-full rounded-lg border"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              返回修改
            </Button>
            <Button onClick={handleConfirmPublish} className="bg-gradient-to-r from-green-500 to-emerald-500">
              <CheckCircle className="mr-2 h-4 w-4" />
              确认发布
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
