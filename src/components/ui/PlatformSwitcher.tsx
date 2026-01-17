/**
 * PlatformSwitcher - 多平台内容切换组件
 *
 * 功能:
 * 1. 当用户选择多个目标平台时，显示在页面顶部
 * 2. 点击Tab可切换查看不同平台的内容
 * 3. 单平台时可以隐藏或显示为纯展示
 */
import React from 'react';
import { cn } from '@/lib/utils';

// 平台配置
export interface PlatformConfig {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  xiaohongshu: {
    id: 'xiaohongshu',
    name: 'xiaohongshu',
    displayName: '小红书',
    icon: '📕',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300'
  },
  douyin: {
    id: 'douyin',
    name: 'douyin',
    displayName: '抖音',
    icon: '🎵',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-300'
  },
  x: {
    id: 'x',
    name: 'x',
    displayName: 'X (Twitter)',
    icon: '𝕏',
    color: 'text-gray-800',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-300'
  },
  tiktok: {
    id: 'tiktok',
    name: 'tiktok',
    displayName: 'TikTok',
    icon: '🎬',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-300'
  },
  instagram: {
    id: 'instagram',
    name: 'instagram',
    displayName: 'Instagram',
    icon: '📷',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-300'
  },
  youtube: {
    id: 'youtube',
    name: 'youtube',
    displayName: 'YouTube',
    icon: '▶️',
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300'
  }
};

interface PlatformSwitcherProps {
  /** 用户选择的目标平台列表 */
  platforms: string[];
  /** 当前选中的平台 */
  activePlatform: string;
  /** 切换平台回调 */
  onPlatformChange: (platform: string) => void;
  /** 是否显示（单平台时可选择隐藏） */
  showSingle?: boolean;
  /** 额外样式 */
  className?: string;
}

export const PlatformSwitcher: React.FC<PlatformSwitcherProps> = ({
  platforms,
  activePlatform,
  onPlatformChange,
  showSingle = false,
  className
}) => {
  // 单平台且不显示时隐藏
  if (platforms.length <= 1 && !showSingle) {
    return null;
  }

  return (
    <div className={cn(
      'flex items-center gap-2 p-2 bg-white/80 backdrop-blur-sm rounded-lg border shadow-sm',
      className
    )}>
      <span className="text-xs text-gray-500 mr-1">平台:</span>
      <div className="flex items-center gap-1">
        {platforms.map((platformId) => {
          const config = PLATFORM_CONFIGS[platformId];
          if (!config) return null;

          const isActive = platformId === activePlatform;

          return (
            <button
              key={platformId}
              onClick={() => onPlatformChange(platformId)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200',
                isActive
                  ? `${config.bgColor} ${config.color} ${config.borderColor} border-2 shadow-sm`
                  : 'bg-gray-50 text-gray-600 border border-transparent hover:bg-gray-100'
              )}
            >
              <span className="text-base">{config.icon}</span>
              <span>{config.displayName}</span>
              {isActive && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
      {platforms.length > 1 && (
        <span className="text-xs text-gray-400 ml-2">
          {platforms.length} 个平台
        </span>
      )}
    </div>
  );
};

/**
 * 简化版平台徽章 - 用于紧凑显示
 */
interface PlatformBadgeProps {
  platformId: string;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

export const PlatformBadge: React.FC<PlatformBadgeProps> = ({
  platformId,
  size = 'md',
  showName = true
}) => {
  const config = PLATFORM_CONFIGS[platformId];
  if (!config) return null;

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full',
      config.bgColor,
      config.color,
      sizeClasses[size]
    )}>
      <span>{config.icon}</span>
      {showName && <span>{config.displayName}</span>}
    </span>
  );
};

export default PlatformSwitcher;
