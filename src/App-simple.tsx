import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DatabaseStatusIndicator } from '@/components/ui/DatabaseStatusIndicator';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Layout } from './components/layout/Layout';
import { User } from './types';
import { useTranslation } from 'react-i18next';
import './lib/i18n'; // Initialize i18n
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
import DifyFlowTest from './pages/DifyFlowTest';
import DigitalHumanVideo from './pages/DigitalHumanVideo';
import DigitalHumanVideoTest from './pages/DigitalHumanVideoTest';
import DigitalHumanVideoSimple from './pages/DigitalHumanVideoSimple';
import DigitalHumanVideoComplete3 from './pages/DigitalHumanVideoComplete3';
import DigitalHumanCreation from './pages/DigitalHumanCreation';

import SystemDiagnostics from './pages/SystemDiagnostics';
import SessionIdTest from './pages/SessionIdTest';
import TestWorkflowProgress from './pages/TestWorkflowProgress';

import NotFound from './pages/NotFound';
import AuthCallback from './pages/AuthCallback';

const queryClient = new QueryClient();

const App = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    // 简化初始化 - 立即设置为已初始化
    console.log('Simple initialization - skipping all checks');
    setIsInitialized(true);
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

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('common.loading')}</p>
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
              <Route path="/digital-human-creation" element={<DigitalHumanCreation />} />
              <Route path="/digital-human-video-original" element={<DigitalHumanVideo />} />
              <Route path="/n8n-test" element={<N8nTest />} />
              <Route path="/n8n-diagnostic" element={<N8nDiagnostic />} />
              <Route path="/ai-content/:serviceId" element={<AIContentGeneration />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/session-id-test" element={<SessionIdTest />} />
              <Route path="/system-diagnostics" element={<SystemDiagnostics />} />
              <Route path="/test-workflow-progress" element={<TestWorkflowProgress />} />
              <Route path="/dify-chat-test" element={<DifyChatTest />} />
              <Route path="/dify-debug" element={<DifyDebugPage />} />
              <Route path="/dify-flow-test" element={<DifyFlowTest />} />
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