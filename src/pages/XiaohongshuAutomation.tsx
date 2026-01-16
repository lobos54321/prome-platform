/**
 * XiaohongshuAutomation - 重定向到 /auto
 *
 * 所有功能已合并到 AutoMarketing 页面
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function XiaohongshuAutomation() {
  const navigate = useNavigate();

  useEffect(() => {
    // 重定向到新的 /auto 页面
    navigate('/auto', { replace: true });
  }, [navigate]);

  return null;
}
