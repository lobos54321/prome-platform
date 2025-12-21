// ============================================
// 小红书自动化系统 TypeScript 类型定义
// ============================================

// ============================================
// 用户映射
// ============================================
export interface UserMapping {
  supabase_uuid: string;
  xhs_user_id: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// 用户配置
// ============================================
export interface UserProfile {
  id: string;
  supabase_uuid: string;
  xhs_user_id: string;
  product_name: string;
  target_audience: string | null;
  marketing_goal: 'brand' | 'sales' | 'traffic' | 'community';
  post_frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  brand_style: 'professional' | 'warm' | 'humorous' | 'minimalist';
  review_mode: 'auto' | 'manual';
  // 素材上传字段
  material_images?: string[];     // 产品图片URL列表
  material_documents?: string[];  // 文档URL列表
  material_analysis?: string;     // AI分析结果
  // 地区字段 (支持全球市场)
  region?: string;                // 用户自填: "武汉", "Sydney", "California" 等
  // 内容形式偏好
  content_mode_preference?: 'IMAGE_TEXT' | 'UGC_VIDEO' | 'AVATAR_VIDEO';
  // 数字人视频素材 (AVATAR_VIDEO 模式需要)
  avatar_photo_url?: string;      // 数字人照片 URL
  voice_sample_url?: string;      // 语音样本 URL
  avatar_video_duration?: number; // 数字人视频时长（秒），默认150秒(2.5分钟)
  // UGC 视频参数 (UGC_VIDEO 模式)
  ugc_gender?: 'male' | 'female';
  ugc_age_range?: 'young' | 'middle' | 'senior';
  ugc_language?: string;          // "zh-CN", "en-US" 等
  ugc_duration?: number;          // 视频时长秒数，默认 60
  created_at: string;
  updated_at: string;
}

// ============================================
// 全局产品配置 (所有平台共享)
// ============================================
export interface GlobalProductProfile {
  id: string;
  supabase_uuid: string;
  product_name: string;
  product_description?: string;
  product_features?: string;        // 产品特色
  target_audience?: string;
  material_images?: string[];
  material_documents?: string[];
  material_analysis?: string;
  region?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// 登录状态
// ============================================
export interface LoginStatus {
  success: boolean;
  isLoggedIn: boolean;
  message?: string;
  needsQRCode?: boolean;
}

// ============================================
// 二维码数据
// ============================================
export interface QRCodeData {
  success: boolean;
  qrCode?: string;
  qrId?: string;
  message?: string;
  // 验证二维码相关字段（预登录人机验证）
  hasVerification?: boolean;
  verificationQrCode?: string;
}

// ============================================
// 自动化状态
// ============================================
export interface AutomationStatus {
  supabase_uuid: string;
  xhs_user_id: string;
  is_running: boolean;
  is_logged_in: boolean;
  has_config: boolean;
  last_activity: string | null;
  uptime_seconds: number;
  next_scheduled_task: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// 内容策略
// ============================================
export interface ContentStrategy {
  id: string;
  supabase_uuid: string;
  xhs_user_id: string;
  key_themes: string[];
  trending_topics: string[];
  hashtags: string[];
  optimal_times: string[];
  created_at: string;
  updated_at: string;
}

// ============================================
// 周计划
// ============================================
export interface WeeklyPlan {
  id: string;
  supabase_uuid: string;
  xhs_user_id: string;
  week_start_date: string;
  week_end_date: string;
  plan_data: {
    monday?: DayPlan;
    tuesday?: DayPlan;
    wednesday?: DayPlan;
    thursday?: DayPlan;
    friday?: DayPlan;
    saturday?: DayPlan;
    sunday?: DayPlan;
  };
  created_at: string;
  updated_at: string;
}

export interface DayPlan {
  theme: string;
  title: string;
  content: string;
  scheduled_time: string;
  status: 'planned' | 'generating' | 'pending' | 'published' | 'failed';
}

// ============================================
// 每日任务
// ============================================
export interface DailyTask {
  id: string;
  supabase_uuid: string;
  xhs_user_id: string;
  theme: string;
  title: string | null;
  content: string | null;
  scheduled_time: string | null;
  status: 'planned' | 'generating' | 'pending' | 'published' | 'failed';
  image_urls: string[];
  cover_image_url: string | null;
  post_url: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// 活动日志
// ============================================
export interface ActivityLog {
  id: string;
  supabase_uuid: string;
  xhs_user_id: string;
  activity_type: 'login' | 'config' | 'start' | 'stop' | 'publish' | 'error';
  message: string;
  metadata: Record<string, any>;
  created_at: string;
}

// ============================================
// API 请求/响应
// ============================================
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// ============================================
// 产品配置表单数据
// ============================================
export interface ProductConfig {
  productName: string;
  targetAudience: string;
  marketingGoal: 'brand' | 'sales' | 'traffic' | 'community';
  postFrequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  brandStyle: 'professional' | 'warm' | 'humorous' | 'minimalist';
  reviewMode: 'auto' | 'manual';
}
