import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DatabaseStatusIndicator } from '@/components/ui/DatabaseStatusIndicator';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Layout } from './components/layout/Layout';
import { authService } from './lib/auth';
import { difyIframeMonitor } from './lib/dify-iframe-monitor';
import { isDifyEnabled } from './api/dify-api';
import { environmentValidator } from './lib/environment-validator';
import { databaseTester } from './lib/database-tester';
import { User } from './types';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Services from './pages/Services';
import Dashboard from './pages/Dashboard';
import TokenDashboard from './pages/TokenDashboard';
import Chat from './pages/Chat';
import Admin from './pages/Admin';
import Pricing from './pages/Pricing';
import Purchase from './pages/Purchase';
import Settings from './pages/Settings';
import AIContentGeneration from './pages/AIContentGeneration';
import DifyTestPage from './pages/DifyTestPage';
import DifyChat from './pages/DifyChat';
import TokenMonitorTest from './pages/TokenMonitorTest';
import SystemDiagnostics from './pages/SystemDiagnostics';
import SessionIdTest from './pages/SessionIdTest';
import TestWorkflowProgress from './pages/TestWorkflowProgress';

import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

const App = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isDifyMonitorActive, setIsDifyMonitorActive] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Starting application initialization...');
        
        // Validate environment configuration
        environmentValidator.logValidationResults();
        
        // Test database connection if not in test mode
        const isTestMode = import.meta.env.VITE_TEST_MODE === 'true' ||
                           import.meta.env.VITE_NON_ADMIN_TEST === 'true' ||
                           import.meta.env.VITE_PROBLEMATIC_USER_TEST === 'true';
        
        if (!isTestMode) {
          console.log('Testing database connection...');
          await databaseTester.testBasicConnection();
        }
        
        console.log('Starting auth initialization...');
        // 使用同步方法避免时间死区错误
        await authService.initializeAuth();
        console.log('Auth initialization completed');
        
        // Get initial user state synchronously
        const user = authService.getCurrentUserSync();
        setCurrentUser(user);
        
        // Initialize Dify monitoring if enabled and user is valid
        if (isDifyEnabled() && user && user.id && typeof user.id === 'string' && user.id.trim() !== '') {
          console.log('Initializing Dify iframe monitoring for user:', user.id);
          try {
            initializeDifyMonitoring(user);
          } catch (error) {
            console.error('Failed to initialize Dify monitoring during app startup:', error);
            // 继续应用启动，不因 Dify 监控失败而中断
          }
        } else if (isDifyEnabled()) {
          console.log('Dify enabled but no valid user for monitoring');
        }
      } catch (error) {
        console.error('Application initialization failed:', error);
        // 不强制登出，可能只是网络问题
        console.warn('Continuing app initialization despite auth error');
      } finally {
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const handleAuthStateChange = (event: CustomEvent) => {
      try {
        const { user } = event.detail;
        setCurrentUser(user);
        
        if (isDifyEnabled()) {
          if (user && user.id && typeof user.id === 'string' && user.id.trim() !== '') {
            console.log('User logged in, starting Dify monitoring:', user.id);
            initializeDifyMonitoring(user);
          } else {
            console.log('User logged out or invalid, stopping Dify monitoring');
            stopDifyMonitoring();
          }
        }
      } catch (error) {
        console.error('Error handling auth state change:', error);
      }
    };

    window.addEventListener('auth-state-changed', handleAuthStateChange as EventListener);
    
    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateChange as EventListener);
    };
  }, []);

  const initializeDifyMonitoring = (user: User) => {
    if (!isDifyEnabled() || !user?.id) {
      console.log('Dify monitoring disabled or user invalid');
      return;
    }

    try {
      // 检查 difyIframeMonitor 是否可用
      if (!difyIframeMonitor || typeof difyIframeMonitor.startListening !== 'function') {
        console.warn('Dify iframe monitor not available, skipping initialization');
        return;
      }

      // Set up event handlers with error boundaries
      difyIframeMonitor.setOnTokenConsumption((event) => {
        try {
          console.log('Token consumption detected:', event);
          window.dispatchEvent(new CustomEvent('token-consumed', { 
            detail: { event } 
          }));
        } catch (error) {
          console.error('Error handling token consumption event:', error);
        }
      });

      difyIframeMonitor.setOnBalanceUpdate((newBalance) => {
        try {
          console.log('Balance updated:', newBalance);
          setCurrentUser(prev => prev ? { ...prev, balance: newBalance } : null);
          
          window.dispatchEvent(new CustomEvent('balance-updated', { 
            detail: { balance: newBalance } 
          }));
        } catch (error) {
          console.error('Error handling balance update event:', error);
        }
      });

      difyIframeMonitor.setOnNewModelDetected((model) => {
        try {
          console.log('New model detected:', model);
        } catch (error) {
          console.error('Error handling new model detection event:', error);
        }
      });

      // Start monitoring with additional validation
      if (typeof user.id === 'string' && user.id.trim() !== '') {
        difyIframeMonitor.startListening(user.id);
        setIsDifyMonitorActive(true);
        console.log('Dify iframe monitoring started successfully for user:', user.id);
      } else {
        console.warn('Invalid user ID for Dify monitoring:', user.id);
      }
    } catch (error) {
      console.error('Failed to initialize Dify monitoring:', error);
      setIsDifyMonitorActive(false);
      // 继续运行应用，不让 Dify 监控失败阻止应用启动
    }
  };

  const stopDifyMonitoring = () => {
    try {
      if (difyIframeMonitor && typeof difyIframeMonitor.stopListening === 'function') {
        difyIframeMonitor.stopListening();
        console.log('Dify iframe monitoring stopped');
      }
      setIsDifyMonitorActive(false);
    } catch (error) {
      console.error('Error stopping Dify monitoring:', error);
      // 确保状态被重置，即使停止失败
      setIsDifyMonitorActive(false);
    }
  };

  // Expose services globally for debugging
  useEffect(() => {
    // Make services available globally for console debugging
    (window as Record<string, unknown>).difyIframeMonitor = difyIframeMonitor;
    (window as Record<string, unknown>).authService = authService;
    
    console.log('[App] Services exposed globally for debugging:');
    console.log('  - window.difyIframeMonitor');
    console.log('  - window.authService');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isDifyMonitorActive) {
        stopDifyMonitoring();
      }
    };
  }, [isDifyMonitorActive]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">初始化应用...</p>
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
              <Route path="/services" element={<Services />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/purchase" element={<Purchase />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/token-dashboard" element={<TokenDashboard />} />
              <Route path="/chat/:serviceId" element={<Chat />} />
              <Route path="/chat/dify" element={<DifyChat />} />
              <Route path="/ai-content/:serviceId" element={<AIContentGeneration />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/dify-test" element={<DifyTestPage />} />
              <Route path="/token-monitor-test" element={<TokenMonitorTest />} />
              <Route path="/session-id-test" element={<SessionIdTest />} />
              <Route path="/system-diagnostics" element={<SystemDiagnostics />} />
              <Route path="/test-workflow-progress" element={<TestWorkflowProgress />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
