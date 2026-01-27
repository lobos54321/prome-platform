import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DatabaseStatusIndicator } from '@/components/ui/DatabaseStatusIndicator';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Layout } from './components/layout/Layout';
import { authService } from './lib/auth';
import { isDifyEnabled } from './lib/dify-api-client';
import { environmentValidator } from './lib/environment-validator';
import { databaseTester } from './lib/database-tester';
import { User } from './types';
import { useTranslation } from 'react-i18next';
import './lib/i18n'; // Initialize i18n

// Declare Prome Config for extension
declare global {
  interface Window {
    __PROME_CONFIG__?: {
      supabaseUrl: string;
      supabaseKey: string;
      userId?: string;
    };
  }
}
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import TokenDashboard from './pages/TokenDashboard';
import Admin from './pages/Admin';
import Pricing from './pages/Pricing';
import Purchase from './pages/Purchase';
import Settings from './pages/Settings';
import AIContentGeneration from './pages/AIContentGeneration';
import N8nChat from './pages/N8nChat';
import N8nTest from './pages/N8nTest';
import N8nDiagnostic from './pages/N8nDiagnostic';

import DifyChat from './pages/DifyChat';
import DifyChatTest from './pages/DifyChatTest';
import DifyDebugPage from './pages/DifyDebugPage';
import DifyApiDebugPage from './pages/DifyApiDebugPage';
import DifyFlowTest from './pages/DifyFlowTest';
import DigitalHumanVideo from './pages/DigitalHumanVideo';
import DigitalHumanVideoTest from './pages/DigitalHumanVideoTest';
import DigitalHumanVideoSimple from './pages/DigitalHumanVideoSimple';
import DigitalHumanVideoComplete3 from './pages/DigitalHumanVideoComplete3';

import SystemDiagnostics from './pages/SystemDiagnostics';
import SessionIdTest from './pages/SessionIdTest';
import TestWorkflowProgress from './pages/TestWorkflowProgress';
// import PricingTest from './pages/PricingTest';

import NotFound from './pages/NotFound';
import AuthCallback from './pages/AuthCallback';
import XiaohongshuAutomation from './pages/XiaohongshuAutomation';
import XiaohongshuMarketing from './pages/XiaohongshuMarketing';
import XiaohongshuAutoManager from './pages/XiaohongshuAutoManager';
import Analytics from './pages/Analytics';
import PrivacyPolicy from './pages/PrivacyPolicy';
import AutoMarketing from './pages/AutoMarketing';
import VideoHistory from './pages/VideoHistory';
import XManager from './pages/XManager';
import PlatformManager from './pages/PlatformManager';

const queryClient = new QueryClient();

const App = () => {
  console.log('🚀 [App.tsx] Component rendering...');
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { t } = useTranslation();


  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Starting application initialization...');

        // 简化初始化流程 - 只做最关键的步骤
        console.log('Starting critical initialization...');

        // 关键步骤1: 环境验证（同步）
        environmentValidator.logValidationResults();

        // 关键步骤2: 认证初始化（带超时保护）
        try {
          await Promise.race([
            authService.initializeAuth(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Auth initialization timeout')), 3000)
            )
          ]);
          console.log('Auth initialization completed');
        } catch (authError) {
          console.warn('Auth initialization failed, using fallback...', authError);
        }

        // 关键步骤3: 获取当前用户状态
        const user = authService.getCurrentUserSync();
        setCurrentUser(user);

        console.log('✅ Critical initialization completed');

        // 非关键步骤：后台执行数据库连接测试
        setTimeout(() => {
          const isTestMode = import.meta.env.VITE_TEST_MODE === 'true' ||
            import.meta.env.VITE_NON_ADMIN_TEST === 'true' ||
            import.meta.env.VITE_PROBLEMATIC_USER_TEST === 'true';

          if (!isTestMode) {
            databaseTester.testBasicConnection().catch(dbError => {
              console.warn('Background database test failed:', dbError);
            });
          }
        }, 100);
      } catch (error) {
        console.error('Application initialization failed:', error);
        // 确保应用仍能启动，即使初始化失败
        console.warn('Continuing app initialization despite errors');
        setCurrentUser(null);
      } finally {
        // 确保无论如何都标记为已初始化
        setIsInitialized(true);
      }
    };

    // 防止React严格模式的双重执行导致问题
    let cancelled = false;
    initializeApp().catch(error => {
      if (!cancelled) {
        console.error('Unhandled initialization error:', error);
        setIsInitialized(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Push Supabase config to extension

  useEffect(() => {
    // Expose global config
    const updateConfig = () => {
      window.__PROME_CONFIG__ = {
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
        supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        userId: currentUser?.id || ''
      };
    };

    updateConfig();

    // Listen for config requests from extension
    const handleConfigRequest = (event: MessageEvent) => {
      if (event.data?.type === 'PROME_REQUEST_SUPABASE_CONFIG') {
        console.log('[Prome] Extension requested config, pushing...');
        updateConfig(); // Ensure latest config
        window.postMessage({
          type: 'PROME_SET_SUPABASE_CONFIG',
          data: window.__PROME_CONFIG__
        }, '*');
      }
    };

    window.addEventListener('message', handleConfigRequest);

    // Proactively push if extension detected
    const checkAndPush = () => {
      const extensionMarker = document.getElementById('prome-extension-installed');
      if (extensionMarker && window.__PROME_CONFIG__) {
        // Only push if we have a user ID, otherwise it might be premature
        if (window.__PROME_CONFIG__.userId) {
          console.log('[Prome] Extension detected, pushing config...');
          window.postMessage({
            type: 'PROME_SET_SUPABASE_CONFIG',
            data: window.__PROME_CONFIG__
          }, '*');
        }
      }
    };

    // Delayed checks to ensure extension is loaded
    const t1 = setTimeout(checkAndPush, 1000);
    const t2 = setTimeout(checkAndPush, 3000);
    const t3 = setTimeout(checkAndPush, 5000);

    return () => {
      window.removeEventListener('message', handleConfigRequest);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [currentUser]);

  // Listen for auth state changes
  useEffect(() => {
    const handleAuthStateChange = (event: CustomEvent) => {
      try {
        const { user } = event.detail;
        setCurrentUser(user);
      } catch (error) {
        console.error('Error handling auth state change:', error);
      }
    };

    window.addEventListener('auth-state-changed', handleAuthStateChange as EventListener);

    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateChange as EventListener);
    };
  }, []);

  // Expose services globally for debugging
  useEffect(() => {
    // Make services available globally for console debugging
    (window as Record<string, unknown>).authService = authService;

    console.log('[App] Services exposed globally for debugging:');
    console.log('  - window.authService');
  }, []);



  // 启动超时检测
  useEffect(() => {
    const startupTimeout = setTimeout(() => {
      if (!isInitialized) {
        console.error('Application startup timeout detected - forcing initialization');
        setIsInitialized(true);
        setCurrentUser(null);
      }
    }, 15000); // 15秒超时

    if (isInitialized) {
      clearTimeout(startupTimeout);
    }

    return () => clearTimeout(startupTimeout);
  }, [isInitialized]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('common.loading')}</p>
          <p className="text-gray-400 text-sm mt-2">初始化应用中...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <DatabaseStatusIndicator />
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/purchase" element={<Purchase />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/token-dashboard" element={<TokenDashboard />} />
              <Route path="/chat/:serviceId" element={<DifyChat />} />
              <Route path="/chat/dify" element={<DifyChat />} />
              <Route path="/chat/n8n" element={<N8nChat />} />
              <Route path="/digital-human-video" element={<DigitalHumanVideoComplete3 />} />
              <Route path="/digital-human-video-original" element={<DigitalHumanVideo />} />
              <Route path="/n8n-test" element={<N8nTest />} />
              <Route path="/n8n-diagnostic" element={<N8nDiagnostic />} />
              <Route path="/ai-content/:serviceId" element={<AIContentGeneration />} />
              <Route path="/xiaohongshu" element={<XiaohongshuAutomation />} />
              <Route path="/xiaohongshu-manager" element={<XiaohongshuAutoManager />} />
              <Route path="/xiaohongshu-api" element={<XiaohongshuMarketing />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/auto" element={<AutoMarketing />} />
              <Route path="/x" element={<XManager />} />
              <Route path="/tiktok" element={<PlatformManager platformId="tiktok" />} />
              <Route path="/youtube" element={<PlatformManager platformId="youtube" />} />
              <Route path="/threads" element={<PlatformManager platformId="threads" />} />
              <Route path="/instagram" element={<PlatformManager platformId="instagram" />} />
              <Route path="/video-history" element={<VideoHistory />} />
              <Route path="/admin" element={<Admin />} />


              <Route path="/session-id-test" element={<SessionIdTest />} />
              <Route path="/system-diagnostics" element={<SystemDiagnostics />} />
              <Route path="/test-workflow-progress" element={<TestWorkflowProgress />} />
              {/* <Route path="/pricing-test" element={<PricingTest />} /> */}
              <Route path="/dify-chat-test" element={<DifyChatTest />} />
              <Route path="/dify-debug" element={<DifyApiDebugPage />} />
              <Route path="/dify-debug-old" element={<DifyDebugPage />} />
              <Route path="/dify-flow-test" element={<DifyFlowTest />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
