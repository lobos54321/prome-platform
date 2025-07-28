import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Layout } from './components/layout/Layout';
import { authService } from './lib/auth';
import { difyIframeMonitor } from './lib/dify-iframe-monitor';
import { isDifyEnabled } from './api/dify-api';
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

import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

const App = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isDifyMonitorActive, setIsDifyMonitorActive] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Starting auth initialization on page load...');
        // 只在这里初始化认证状态，避免重复调用
        await authService.initializeAuth();
        console.log('Auth initialization completed');
        
        // Get initial user state
        const user = authService.getCurrentUserSync();
        setCurrentUser(user);
        
        // Initialize Dify monitoring if enabled and user is logged in
        if (isDifyEnabled() && user) {
          console.log('Initializing Dify iframe monitoring for user:', user.id);
          initializeDifyMonitoring(user);
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        authService.forceLogout();
      } finally {
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const handleAuthStateChange = (event: CustomEvent) => {
      const { user } = event.detail;
      setCurrentUser(user);
      
      if (isDifyEnabled()) {
        if (user) {
          console.log('User logged in, starting Dify monitoring:', user.id);
          initializeDifyMonitoring(user);
        } else {
          console.log('User logged out, stopping Dify monitoring');
          stopDifyMonitoring();
        }
      }
    };

    window.addEventListener('auth-state-changed', handleAuthStateChange as EventListener);
    
    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateChange as EventListener);
    };
  }, []);

  const initializeDifyMonitoring = (user: User) => {
    if (!isDifyEnabled() || !user?.id) {
      return;
    }

    try {
      // Set up event handlers
      difyIframeMonitor.setOnTokenConsumption((event) => {
        console.log('Token consumption detected:', event);
        // Update user balance in the UI if needed
        // You could emit another custom event here for other components to listen to
        window.dispatchEvent(new CustomEvent('token-consumed', { 
          detail: { event } 
        }));
      });

      difyIframeMonitor.setOnBalanceUpdate((newBalance) => {
        console.log('Balance updated:', newBalance);
        // Update the current user's balance in state
        setCurrentUser(prev => prev ? { ...prev, balance: newBalance } : null);
        
        // Emit balance update event
        window.dispatchEvent(new CustomEvent('balance-updated', { 
          detail: { balance: newBalance } 
        }));
      });

      difyIframeMonitor.setOnNewModelDetected((model) => {
        console.log('New model detected:', model);
        // Could show a notification to admin users
      });

      // Start monitoring
      difyIframeMonitor.startListening(user.id);
      setIsDifyMonitorActive(true);
      
      console.log('Dify iframe monitoring started successfully');
    } catch (error) {
      console.error('Failed to initialize Dify monitoring:', error);
      setIsDifyMonitorActive(false);
    }
  };

  const stopDifyMonitoring = () => {
    try {
      difyIframeMonitor.stopListening();
      setIsDifyMonitorActive(false);
      console.log('Dify iframe monitoring stopped');
    } catch (error) {
      console.error('Error stopping Dify monitoring:', error);
    }
  };

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
              <Route path="/ai-content/:serviceId" element={<AIContentGeneration />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/dify-test" element={<DifyTestPage />} />
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
