import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { xiaohongshuAPI } from '@/lib/xiaohongshu-backend-api';

interface ManualCookieFormProps {
  isOpen: boolean;
  xhsUserId: string;
  onSubmitSuccess: () => void;
  onCancel: () => void;
}

export function ManualCookieForm({
  isOpen,
  xhsUserId,
  onSubmitSuccess,
  onCancel,
}: ManualCookieFormProps) {
  const [cookies, setCookies] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const validateCookies = (value: string): boolean => {
    if (!value.trim()) {
      setError('请输入Cookie');
      return false;
    }
    
    if (!value.includes('web_session')) {
      setError('Cookie格式不正确，请确保包含 web_session');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    setError('');
    
    if (!validateCookies(cookies)) {
      return;
    }

    try {
      setSubmitting(true);
      const response = await xiaohongshuAPI.submitManualCookies(xhsUserId, cookies);
      
      if (response.success) {
        onSubmitSuccess();
        setCookies('');
      } else {
        setError(response.message || 'Cookie提交失败，请检查格式');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cookie提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setCookies('');
    setError('');
    onCancel();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">🔧 手动导入Cookie</DialogTitle>
          <DialogDescription>
            从浏览器开发者工具中复制小红书的Cookie并粘贴到下方
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Cookie 内容</label>
            <Textarea
              value={cookies}
              onChange={(e) => {
                setCookies(e.target.value);
                setError('');
              }}
              placeholder="粘贴从浏览器复制的完整Cookie..."
              className="min-h-[200px] font-mono text-xs"
              disabled={submitting}
            />
            <p className="text-xs text-gray-500">
              💡 提示：打开小红书网页 → F12 → Network → 找到请求 → 复制 Cookie
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleCancel}
              variant="outline"
              className="flex-1"
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  提交中...
                </>
              ) : (
                '提交'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
