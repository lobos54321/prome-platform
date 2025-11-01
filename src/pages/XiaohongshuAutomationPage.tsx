// 临时占位文件 - 重定向到新版本
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function XiaohongshuAutomationPage() {
  const navigate = useNavigate();
  
  useEffect(() => {
    // 自动重定向到新页面
    navigate('/xiaohongshu', { replace: true });
  }, [navigate]);

  return null;
}
