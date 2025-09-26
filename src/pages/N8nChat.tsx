import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MessageSquare, 
  Zap, 
  Settings, 
  AlertCircle, 
  ArrowLeft,
  Workflow,
  Bot,
  Users,
  Activity,
  Video
} from 'lucide-react';
import { authService } from '@/lib/auth';
import { User } from '@/types';
import { useTranslation } from 'react-i18next';
import N8nFormOnlyNew from '@/components/chat/N8nFormOnlyNew';
// import SimpleFormTest from '@/components/debug/SimpleFormTest';

export default function N8nChat() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get N8n configuration from environment variables
  const n8nWebhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://n8n-worker-k4m9.zeabur.app/webhook/9d5986f5-fcba-42bf-b3d7-5fd94660943a/chat';
  const n8nEnabled = import.meta.env.VITE_ENABLE_N8N_INTEGRATION === 'true' || true; // 强制启用用于调试

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const currentUser = authService.getCurrentUserSync();
        setUser(currentUser);
        
        // 暂时跳过身份验证用于调试
        // if (!currentUser) {
        //   navigate('/login');
        //   return;
        // }
      } catch (error) {
        console.error('Failed to get current user:', error);
        // navigate('/login'); // 暂时注释用于调试
      } finally {
        setIsLoading(false);
      }
    };

    const handleAuthChange = (event: CustomEvent) => {
      setUser(event.detail.user);
    };

    window.addEventListener('auth-state-changed', handleAuthChange as EventListener);
    
    initializeAuth();

    return () => {
      window.removeEventListener('auth-state-changed', handleAuthChange as EventListener);
    };
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Check if N8n integration is enabled
  if (!n8nEnabled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <div className="flex items-center mb-4">
                  <Button 
                    variant="ghost" 
                    onClick={() => navigate('/')}
                    className="mr-4"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {t('common.back')}
                  </Button>
                  <div className="flex items-center">
                    <Workflow className="h-8 w-8 text-blue-600 mr-3" />
                    <div>
                      <CardTitle>{t('n8n.integration_disabled')}</CardTitle>
                      <CardDescription>{t('n8n.integration_disabled_desc')}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {t('n8n.enable_instruction')}
                  </AlertDescription>
                </Alert>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">{t('n8n.required_env_vars')}</h4>
                  <code className="text-sm bg-white p-2 rounded block">
                    VITE_ENABLE_N8N_INTEGRATION=true<br/>
                    VITE_N8N_WEBHOOK_URL=your_n8n_webhook_url
                  </code>
                </div>

                <div className="flex space-x-4">
                  <Button onClick={() => navigate('/dashboard')}>
                    {t('n8n.back_to_dashboard')}
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/settings')}>
                    <Settings className="h-4 w-4 mr-2" />
                    {t('n8n.manage_settings')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 relative">
      <div className="container mx-auto px-4 py-4">
        {/* Back button */}
        <div className="flex justify-start mb-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="bg-white hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back')}
          </Button>
        </div>
        
        {/* Simplified Header */}
        <div className="text-center mb-6">
          {/* Simple icon */}
          <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-2xl flex items-center justify-center">
            <Video className="h-8 w-8 text-purple-600" />
          </div>

          <h1 className="text-3xl font-bold mb-2 text-gray-900">
            Auto-Video
          </h1>
          <p className="text-gray-600 mb-4 max-w-xl mx-auto">
            Let your product speak through real voices
          </p>
        </div>

        {/* User Info */}
        {user && (
          <div className="mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Users className="h-5 w-5 text-blue-600 mr-2" />
                    <span className="font-medium">{t('n8n.welcome_user', { name: user.name })}</span>
                  </div>
                  <Badge variant="secondary">
                    {t('n8n.user_id')}: {user.id?.slice(0, 8)}...
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Artistic Video Creation Form */}
        <div className="relative mb-12">
          {/* Kusama dots overlay for form area */}
          <div 
            className="absolute inset-0 rounded-3xl opacity-10 pointer-events-none"
            style={{
              backgroundImage: `
                radial-gradient(circle at 30% 70%, #A855F7 3px, transparent 3px),
                radial-gradient(circle at 70% 30%, #EC4899 2px, transparent 2px)
              `,
              backgroundSize: '55px 55px, 75px 75px'
            }}
          ></div>
          
          <div className="relative bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 p-8">
            <N8nFormOnlyNew
              webhookUrl={n8nWebhookUrl}
              className=""
            />
          </div>
        </div>

        {/* Artistic Features Section */}
        <div className="mt-16">
          {/* Artistic divider */}
          <div className="flex justify-center mb-12 space-x-2">
            {[...Array(9)].map((_, i) => (
              <div 
                key={i}
                className="w-3 h-3 rounded-full animate-bounce"
                style={{
                  backgroundColor: ['#A855F7', '#EC4899', '#F59E0B', '#EF4444', '#22C55E', '#06B6D4', '#8B5CF6', '#F97316', '#84CC16'][i],
                  animationDelay: `${i * 100}ms`
                }}
              ></div>
            ))}
          </div>
          
          <h2 className="text-3xl font-bold text-center mb-12">
            <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 bg-clip-text text-transparent">
              Why Choose Auto-Video?
            </span>
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 - Kandinsky Style */}
            <div className="group relative transform hover:scale-105 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-100/50 to-pink-50/50 rounded-3xl rotate-2 group-hover:rotate-3 transition-transform duration-300"></div>
              
              <div className="relative bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300">
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl rotate-12 group-hover:rotate-45 transition-transform duration-700"></div>
                  <div className="absolute inset-2 bg-white rounded-xl flex items-center justify-center shadow-inner">
                    <Users className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-4 h-4 bg-yellow-400 rounded-full animate-bounce"></div>
                </div>
                <h3 className="text-xl font-bold mb-3 text-center">Authentic Voices</h3>
                <p className="text-gray-600 text-center leading-relaxed">Generate realistic testimonials from diverse real people to build trust</p>
              </div>
            </div>

            {/* Feature 2 - Kusama Style */}
            <div className="group relative transform hover:scale-105 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-100/50 to-red-50/50 rounded-3xl -rotate-2 group-hover:-rotate-3 transition-transform duration-300"></div>
              
              <div className="relative bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300">
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-500 rounded-full group-hover:animate-pulse"></div>
                  <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center shadow-inner">
                    <Zap className="h-8 w-8 text-orange-600" />
                  </div>
                  <div className="absolute -top-3 -right-1 w-5 h-5 bg-green-400 rounded-full animate-pulse"></div>
                  <div className="absolute -bottom-1 -left-3 w-3 h-3 bg-blue-400 rounded-full animate-pulse delay-500"></div>
                </div>
                <h3 className="text-xl font-bold mb-3 text-center">Quick Creation</h3>
                <p className="text-gray-600 text-center leading-relaxed">Create professional feedback videos in minutes, not hours</p>
              </div>
            </div>

            {/* Feature 3 - Mixed Style */}
            <div className="group relative transform hover:scale-105 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-green-100/50 to-blue-50/50 rounded-3xl rotate-1 group-hover:rotate-2 transition-transform duration-300"></div>
              
              <div className="relative bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300">
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-blue-500 rounded-2xl rotate-45 group-hover:rotate-12 transition-transform duration-700"></div>
                  <div className="absolute inset-2 bg-white rounded-xl flex items-center justify-center shadow-inner">
                    <Bot className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="absolute -top-2 -left-2 w-4 h-4 bg-pink-400 rounded-full animate-bounce delay-300"></div>
                  <div className="absolute -bottom-2 -right-2 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                </div>
                <h3 className="text-xl font-bold mb-3 text-center">AI-Powered</h3>
                <p className="text-gray-600 text-center leading-relaxed">Advanced AI creates natural-sounding feedback tailored to your product</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Final artistic footer */}
        <div className="mt-20 text-center">
          <div className="flex justify-center space-x-2 mb-6">
            {[...Array(11)].map((_, i) => (
              <div 
                key={i}
                className="w-3 h-3 rounded-full animate-bounce"
                style={{
                  backgroundColor: ['#A855F7', '#EC4899', '#F59E0B', '#EF4444', '#22C55E', '#06B6D4', '#8B5CF6', '#F97316', '#84CC16', '#3B82F6', '#10B981'][i],
                  animationDelay: `${i * 80}ms`
                }}
              ></div>
            ))}
          </div>
          <blockquote className="text-xl text-gray-600 italic font-light max-w-2xl mx-auto">
            "Infinite creativity through infinite possibilities"
            <br />
            <span className="text-lg text-gray-400 not-italic">- ProMe Auto-Video</span>
          </blockquote>
        </div>
      </div>
    </div>
  );
}