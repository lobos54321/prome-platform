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

import DifyChat from './pages/DifyChat';
import DifyChatTest from './pages/DifyChatTest';
import DifyDebugPage from './pages/DifyDebugPage';

import SystemDiagnostics from './pages/SystemDiagnostics';
import SessionIdTest from './pages/SessionIdTest';
import TestWorkflowProgress from './pages/TestWorkflowProgress';
// import PricingTest from './pages/PricingTest';

import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

const App = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);


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
        
        console.log('✅ Application initialized successfully');
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
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/purchase" element={<Purchase />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/token-dashboard" element={<TokenDashboard />} />
              <Route path="/chat/:serviceId" element={<DifyChat />} />
              <Route path="/chat/dify" element={<DifyChat />} />
              <Route path="/ai-content/:serviceId" element={<AIContentGeneration />} />
              <Route path="/admin" element={<Admin />} />


              <Route path="/session-id-test" element={<SessionIdTest />} />
              <Route path="/system-diagnostics" element={<SystemDiagnostics />} />
              <Route path="/test-workflow-progress" element={<TestWorkflowProgress />} />
              {/* <Route path="/pricing-test" element={<PricingTest />} /> */}
              <Route path="/dify-chat-test" element={<DifyChatTest />} />
              <Route path="/dify-debug" element={<DifyDebugPage />} />
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
