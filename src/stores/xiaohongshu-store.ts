import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { UserProfile, ContentStrategy, DailyTask, AutomationStatus } from '@/types/xiaohongshu';
import { XiaohongshuDataService } from '@/services/xiaohongshu-data-service';
import { WorkflowMode } from '@/types/workflow';

// 步骤类型
export type Step = 'setup' | 'dashboard';

interface XiaohongshuState {
  // 用户身份
  identity: {
    supabaseUuid: string | null;
    xhsUserId: string | null;
  };

  // 业务数据 (单一数据源)
  data: {
    profile: UserProfile | null;
    strategy: ContentStrategy | null;
    tasks: DailyTask[]; // 每日任务列表
    status: AutomationStatus | null;
    accounts: any[]; // 绑定的账号列表
  };

  // UI 状态
  ui: {
    step: Step;
    viewMode: 'single' | 'matrix';
    loading: boolean;
    error: string | null;
    initialized: boolean;
  };

  // 工作流状态 (控制 AgentProgressPanel)
  workflow: {
    isRunning: boolean;
    taskId: string | null;
    mode: WorkflowMode;
  };

  // Actions
  actions: {
    // 初始化
    initialize: (supabaseUuid: string, xhsUserId: string) => Promise<void>;

    // 数据操作
    loadAll: () => Promise<void>;
    refresh: () => Promise<void>;
    updateProfile: (profile: Partial<UserProfile>) => Promise<void>;

    // 步骤控制
    setStep: (step: Step) => void;
    setViewMode: (mode: 'single' | 'matrix') => void;

    // 工作流控制
    startWorkflow: (mode: WorkflowMode, taskId?: string) => void;
    completeWorkflow: () => void;
    cancelWorkflow: () => void;

    // 重置
    reset: () => void;
  };
}

export const useXiaohongshuStore = create<XiaohongshuState>()(
  immer((set, get) => ({
    // 初始状态
    identity: {
      supabaseUuid: null,
      xhsUserId: null,
    },
    data: {
      profile: null,
      strategy: null,
      tasks: [],
      status: null,
      accounts: [],
    },
    ui: {
      step: 'setup',
      viewMode: 'single',
      loading: false,
      error: null,
      initialized: false,
    },
    workflow: {
      isRunning: false,
      taskId: null,
      mode: WorkflowMode.IMAGE_TEXT,
    },

    actions: {
      initialize: async (supabaseUuid, xhsUserId) => {
        set((state) => {
          state.identity.supabaseUuid = supabaseUuid;
          state.identity.xhsUserId = xhsUserId;
        });

        // 初始化时不自动加载，由组件决定何时加载
      },

      loadAll: async () => {
        const { supabaseUuid, xhsUserId } = get().identity;
        if (!supabaseUuid || !xhsUserId) return;

        set((state) => { state.ui.loading = true; state.ui.error = null; });

        try {
          // 调用 DataService 加载所有数据
          const data = await XiaohongshuDataService.loadAll(supabaseUuid, xhsUserId);

          set((state) => {
             state.data.profile = data.profile;
             state.data.status = data.status;
             state.data.strategy = data.strategy;
             state.data.tasks = data.tasks;
             // 适配 accounts 数组
             state.data.accounts = data.account ? [data.account] : [];

             // 决定初始步骤
             const step = XiaohongshuDataService.determineInitialStep({
                 profile: data.profile,
                 account: data.account,
                 status: data.status,
                 strategy: data.strategy,
                 tasks: data.tasks
             });
             state.ui.step = step;
             state.ui.initialized = true;
          });
        } catch (error) {
          set((state) => {
            state.ui.error = error instanceof Error ? error.message : '加载失败';
          });
        } finally {
          set((state) => { state.ui.loading = false; });
        }
      },

      refresh: async () => {
        await get().actions.loadAll();
      },

      updateProfile: async (profile) => {
         set((state) => {
           if (state.data.profile) {
             state.data.profile = { ...state.data.profile, ...profile };
           }
         });
      },

      setStep: (step) => {
        set((state) => { state.ui.step = step; });
      },

      setViewMode: (mode) => {
        set((state) => { state.ui.viewMode = mode; });
      },

      startWorkflow: (mode, taskId) => {
        set((state) => {
          state.workflow.isRunning = true;
          state.workflow.mode = mode;
          if (taskId) state.workflow.taskId = taskId;
        });
      },

      completeWorkflow: () => {
        set((state) => {
          state.workflow.isRunning = false;
          state.workflow.taskId = null;
          // 工作流完成后通常切换到仪表盘
          state.ui.step = 'dashboard';
        });
        // 刷新数据
        get().actions.refresh();
      },

      cancelWorkflow: () => {
        set((state) => {
          state.workflow.isRunning = false;
          state.workflow.taskId = null;
        });
      },

      reset: () => {
        set((state) => {
          state.data = {
            profile: null,
            strategy: null,
            tasks: [],
            status: null,
            accounts: [],
          };
          state.ui = {
            step: 'setup',
            viewMode: 'single',
            loading: false,
            error: null,
            initialized: false,
          };
          state.workflow = {
            isRunning: false,
            taskId: null,
            mode: WorkflowMode.IMAGE_TEXT,
          };
        });
      },
    },
  }))
);
