import { xiaohongshuAPI } from '@/lib/xiaohongshu-backend-api';
import { xiaohongshuSupabase } from '@/lib/xiaohongshu-supabase';
import type { UserProfile, ContentStrategy, DailyTask, AutomationStatus } from '@/types/xiaohongshu';

export class XiaohongshuDataService {
  /**
   * 一次性加载所有数据
   * @param supabaseUuid Supabase 用户 ID
   * @param xhsUserId 小红书用户 ID
   */
  static async loadAll(supabaseUuid: string, xhsUserId: string) {
    // 并行请求所有必要数据
    const [profile, statusRes, strategyRes, tasksRes, accountRes] = await Promise.all([
      // 1. 用户配置 (Supabase)
      xiaohongshuSupabase.getUserProfile(supabaseUuid).catch((err) => {
        console.warn('Load profile failed:', err);
        return null;
      }),

      // 2. 自动化状态 (Backend)
      xiaohongshuAPI.getAutomationStatus(xhsUserId).catch(() => ({ success: false, data: null })),

      // 3. 内容策略 (Backend)
      xiaohongshuAPI.getContentStrategy(xhsUserId).catch(() => ({ success: false, data: null })),

      // 4. 每日任务 (Backend) - 替代原来的周计划
      xiaohongshuAPI.getDailyTasks(xhsUserId).catch(() => ({ success: false, data: [] })),

      // 5. 绑定的账号信息 (Backend Worker)
      xiaohongshuAPI.getUserProfile(xhsUserId).catch(() => ({ success: false, data: null })),
    ]);

    return {
      profile,
      status: (statusRes.success ? statusRes.data : null) as AutomationStatus | null,
      strategy: (strategyRes.success ? strategyRes.data : null) as ContentStrategy | null,
      tasks: (tasksRes.success ? (tasksRes.data as unknown as DailyTask[]) : []) as DailyTask[],
      // 如果获取到了账号信息，说明账号有效
      account: accountRes.success ? accountRes.data : null,
    };
  }

  /**
   * 判断初始步骤
   * 根据数据完整性决定用户是进入 Setup 还是 Dashboard
   */
  static determineInitialStep(data: {
    profile: UserProfile | null;
    account: any;
    status: AutomationStatus | null;
    strategy: ContentStrategy | null;
    tasks: DailyTask[];
  }): 'setup' | 'dashboard' {
    // 1. 检查是否有产品配置
    const hasProfile = !!data.profile?.product_name;

    // 2. 检查是否绑定了账号
    // 注意：如果后端 API 暂时无法获取 account (例如 worker 挂了)，
    // 但 supabase profile 里有 xhsUserId，我们也认为已绑定，避免卡在 setup
    const hasAccount = !!data.account || (!!data.profile?.xhs_user_id && data.profile.xhs_user_id !== 'temp_user');

    // 3. 检查是否正在运行
    const isRunning = data.status?.is_running;

    // 4. 检查是否有业务数据 (策略或任务)
    const hasData = !!data.strategy || data.tasks.length > 0;

    // 逻辑判定:
    // 如果没有配置或没有账号 -> Setup
    if (!hasProfile || !hasAccount) {
      return 'setup';
    }

    // 如果正在运行 或 已经有数据 -> Dashboard
    if (isRunning || hasData) {
      return 'dashboard';
    }

    // 默认进入 Setup
    return 'setup';
  }
}
