import { useEffect, useState } from 'react';
import { User, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { xiaohongshuAPI } from '@/lib/xiaohongshu-backend-api';

interface AccountBadgeProps {
  xhsUserId: string;
  onSwitchAccount?: () => void;
}

interface ProfileData {
  nickname?: string;
  avatar?: string;
  userId?: string;
  redId?: string;
}

export function AccountBadge({ xhsUserId, onSwitchAccount }: AccountBadgeProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [xhsUserId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await xiaohongshuAPI.getUserProfile(xhsUserId);
      
      if (response.success && response.data) {
        setProfile(response.data);
      }
    } catch (error) {
      console.error('加载小红书账号信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Badge variant="outline" className="gap-2">
        <RefreshCw className="h-3 w-3 animate-spin" />
        <span>加载账号信息...</span>
      </Badge>
    );
  }

  if (!profile) {
    return (
      <Badge variant="outline" className="gap-2">
        <User className="h-3 w-3" />
        <span>未绑定小红书账号</span>
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="default" className="gap-2">
        {profile.avatar && (
          <img 
            src={profile.avatar} 
            alt={profile.nickname || '用户头像'} 
            className="h-4 w-4 rounded-full"
          />
        )}
        <User className="h-3 w-3" />
        <span>{profile.nickname || profile.redId || 'XHS用户'}</span>
      </Badge>
      {onSwitchAccount && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onSwitchAccount}
          className="h-7 px-2 text-xs"
        >
          切换账号
        </Button>
      )}
    </div>
  );
}
