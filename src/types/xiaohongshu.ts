// 小红书自动化相关类型定义

export interface UserConfiguration {
  userId: string;
  productName: string;
  targetAudience: string;
  marketingGoal: 'brand' | 'sales' | 'engagement' | 'traffic';
  postFrequency: 'daily' | 'twice-daily' | 'high-freq';
  brandStyle: 'warm' | 'professional' | 'trendy' | 'funny';
  reviewMode: 'auto' | 'review' | 'edit';
}

export interface AutomationStatus {
  isRunning: boolean;
  isLoggedIn: boolean;
  hasConfig: boolean;
  lastActivity?: string;
  uptime: number;
}

export interface PerformanceStats {
  todayPosts: number;
  plannedPosts: number;
  weeklyReads: number;
  newFollowers: number;
  engagementRate: number;
}

export interface Activity {
  message: string;
  timestamp: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}
