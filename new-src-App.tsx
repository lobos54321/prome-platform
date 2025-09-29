import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { DifyChatInterface } from './components/chat/DifyChatInterface';
import { authService } from './lib/auth';

// Simple loading component
const LoadingScreen: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-4 text-gray-600">Loading ProMe...</p>
    </div>
  </div>
);

// Chat page component
const ChatPage: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
        console.log('🔐 User authentication status:', currentUser ? 'Authenticated' : 'Anonymous');
      } catch (error) {
        console.warn('⚠️ Authentication initialization failed:', error);
        // Continue with anonymous user
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <DifyChatInterface
            className="h-[80vh] shadow-xl"
            welcomeMessage="欢迎使用ProMe AI营销内容生成平台！请提供您的产品信息，我将帮您生成专业的营销内容。"
            mode="workflow"
            showWorkflowProgress={true}
            enableRetry={true}
            user={user}
          />
        </div>
      </div>
    </div>
  );
};

// Home page component (redirect to chat)
const HomePage: React.FC = () => {
  return <Navigate to="/chat/dify" replace />;
};

// Main App component
function App() {
  const location = useLocation();

  useEffect(() => {
    console.log('🧭 Route changed to:', location.pathname);
  }, [location]);

  return (
    <div className="App">
      <Routes>
        {/* Home route - redirect to chat */}
        <Route path="/" element={<HomePage />} />
        
        {/* Main chat interface route */}
        <Route path="/chat/dify" element={<ChatPage />} />
        
        {/* Fallback route - redirect to chat */}
        <Route path="*" element={<Navigate to="/chat/dify" replace />} />
      </Routes>
    </div>
  );
}

export default App;