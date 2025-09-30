import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, MessageCircle, Video, X } from 'lucide-react';
import { authService } from '@/lib/auth';
import { User } from '@/types';
import { useTranslation } from 'react-i18next';

export default function Home() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showVideoModal, setShowVideoModal] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const currentUser = authService.getCurrentUserSync();
        setUser(currentUser);
      } catch (error) {
        console.error('Failed to get current user:', error);
        setUser(null);
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
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section with ProMe branding */}
      <section className="relative py-16 overflow-hidden">
        {/* Artistic background elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
          {/* Kusama dots pattern */}
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `
                radial-gradient(circle at 20% 30%, #3B82F6 3px, transparent 3px),
                radial-gradient(circle at 80% 20%, #A855F7 2px, transparent 2px),
                radial-gradient(circle at 40% 70%, #F59E0B 1.5px, transparent 1.5px),
                radial-gradient(circle at 90% 80%, #EF4444 2.5px, transparent 2.5px),
                radial-gradient(circle at 10% 90%, #22C55E 2px, transparent 2px)
              `,
              backgroundSize: '100px 100px, 120px 120px, 80px 80px, 140px 140px, 90px 90px'
            }}
          ></div>
          
          {/* Kandinsky geometric shapes */}
          <div className="absolute top-20 left-16 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-full animate-pulse"></div>
          <div className="absolute top-40 right-20 w-24 h-24 bg-gradient-to-br from-yellow-400/15 to-red-400/15 transform rotate-45 animate-bounce"></div>
          <div className="absolute bottom-32 left-1/4 w-40 h-20 bg-gradient-to-br from-green-400/15 to-teal-400/15 rounded-full animate-pulse delay-1000"></div>
          <div className="absolute bottom-40 right-1/3 w-28 h-28 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-lg transform rotate-12 animate-bounce delay-500"></div>
        </div>
        
        <div className="relative container mx-auto px-4 text-center z-10">
          <div className="max-w-5xl mx-auto">
            {/* Main ProMe branding */}
            <h1 className="text-7xl md:text-8xl font-bold mb-8 leading-tight">
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                ProMe
              </span>
            </h1>
            
            <p className="text-3xl md:text-4xl text-gray-700 mb-8 font-light leading-relaxed">
              <span className="bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent">
                Feed your feed to your AI
              </span>
            </p>
            
            {/* Artistic divider */}
            <div className="flex justify-center mb-8 space-x-3">
              {[...Array(7)].map((_, i) => (
                <div 
                  key={i}
                  className="w-4 h-4 rounded-full animate-bounce"
                  style={{
                    backgroundColor: ['#3B82F6', '#A855F7', '#F59E0B', '#EF4444', '#22C55E', '#EC4899', '#06B6D4'][i],
                    animationDelay: `${i * 150}ms`
                  }}
                ></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Kusama × Kandinsky Artistic AI Services */}
      <section className="relative py-12 overflow-hidden bg-white">
          {/* Kandinsky-inspired dynamic background */}
          <div className="absolute inset-0">
            {/* Geometric shapes in motion */}
            <div className="absolute top-20 left-16 w-32 h-32 bg-gradient-to-br from-blue-400/30 to-cyan-400/30 rounded-full animate-pulse"></div>
            <div className="absolute top-40 right-20 w-24 h-24 bg-gradient-to-br from-yellow-400/25 to-red-400/25 transform rotate-45 animate-bounce"></div>
            <div className="absolute bottom-32 left-1/4 w-40 h-20 bg-gradient-to-br from-green-400/20 to-teal-400/20 rounded-full animate-pulse delay-1000"></div>
            <div className="absolute bottom-40 right-1/3 w-28 h-28 bg-gradient-to-br from-purple-400/25 to-pink-400/25 rounded-lg transform rotate-12 animate-bounce delay-500"></div>
            
            {/* Kusama infinite dots pattern */}
            <div 
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `
                  radial-gradient(circle at 15% 25%, #3B82F6 2px, transparent 2px),
                  radial-gradient(circle at 85% 15%, #A855F7 1.5px, transparent 1.5px),
                  radial-gradient(circle at 45% 75%, #F59E0B 1px, transparent 1px),
                  radial-gradient(circle at 75% 85%, #EF4444 2.5px, transparent 2.5px),
                  radial-gradient(circle at 25% 65%, #22C55E 1.8px, transparent 1.8px),
                  radial-gradient(circle at 65% 35%, #EC4899 1.2px, transparent 1.2px)
                `,
                backgroundSize: '120px 120px, 80px 80px, 100px 100px, 140px 140px, 90px 90px, 110px 110px'
              }}
            ></div>
          </div>

          <div className="relative container mx-auto px-4 z-10">
            {/* Simplified header with just divider */}
            <div className="text-center mb-8">
              {/* Artistic divider only */}
              <div className="flex justify-center space-x-2">
                {[...Array(7)].map((_, i) => (
                  <div 
                    key={i}
                    className={`w-3 h-3 rounded-full animate-bounce`}
                    style={{
                      backgroundColor: ['#3B82F6', '#A855F7', '#F59E0B', '#EF4444', '#22C55E', '#EC4899', '#06B6D4'][i],
                      animationDelay: `${i * 150}ms`
                    }}
                  ></div>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
              {/* Deep Copywriting - Kandinsky Geometric Style */}
              <div className="group relative transform hover:scale-105 transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-100/50 to-cyan-50/50 rounded-3xl rotate-2 group-hover:rotate-3 transition-transform duration-300"></div>
                
                {/* Kusama dots overlay for this card */}
                <div 
                  className="absolute inset-0 rounded-3xl opacity-20"
                  style={{
                    backgroundImage: `
                      radial-gradient(circle at 20% 20%, #3B82F6 3px, transparent 3px),
                      radial-gradient(circle at 80% 80%, #06B6D4 2px, transparent 2px)
                    `,
                    backgroundSize: '50px 50px, 70px 70px'
                  }}
                ></div>
                
                <div className="relative bg-white/95 backdrop-blur-sm rounded-3xl p-12 shadow-2xl hover:shadow-3xl transition-all duration-300">
                  {/* Kandinsky-inspired icon */}
                  <div className="relative w-28 h-28 mx-auto mb-8">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-3xl rotate-12 group-hover:rotate-45 transition-transform duration-700"></div>
                    <div className="absolute inset-3 bg-white rounded-2xl flex items-center justify-center shadow-inner">
                      <MessageCircle className="h-12 w-12 text-blue-600" />
                    </div>
                    
                    {/* Floating artistic elements */}
                    <div className="absolute -top-3 -right-3 w-6 h-6 bg-yellow-400 rounded-full animate-bounce"></div>
                    <div className="absolute -bottom-3 -left-3 w-4 h-4 bg-pink-400 rounded-full animate-bounce delay-300"></div>
                    <div className="absolute top-2 -right-6 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  </div>
                  
                  <h3 className="text-4xl font-bold text-gray-900 mb-6">Deep Copywriting</h3>
                  <p className="text-gray-600 mb-10 text-lg leading-relaxed">
                    AI-powered marketing content generation with advanced creative workflows
                  </p>
                  
                  <Button 
                    size="lg" 
                    onClick={() => navigate('/chat/dify')}
                    className="w-full bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 hover:from-blue-600 hover:via-cyan-600 hover:to-blue-700 text-white rounded-2xl py-5 text-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:-translate-y-1"
                  >
                    Start Creating
                    <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-2 transition-transform" />
                  </Button>
                </div>
              </div>

              {/* Automated Video - Kusama Organic Style */}
              <div className="group relative transform hover:scale-105 transition-all duration-500">
                {/* Video Preview Circle - Clickable */}
                <div className="flex flex-col items-center mb-8 relative z-20">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Video button clicked!');
                      setShowVideoModal(true);
                    }}
                    className="relative z-30 group/preview transform hover:scale-110 transition-all duration-300 cursor-pointer bg-transparent border-0 outline-none focus:outline-none"
                  >
                    {/* Kusama floating dots around circle */}
                    <div className="absolute -top-4 -right-4 w-8 h-8 bg-orange-400 rounded-full animate-pulse"></div>
                    <div className="absolute -top-2 right-12 w-6 h-6 bg-pink-400 rounded-full animate-pulse delay-300"></div>
                    <div className="absolute top-16 -left-6 w-7 h-7 bg-green-400 rounded-full animate-pulse delay-500"></div>
                    <div className="absolute bottom-8 right-16 w-5 h-5 bg-blue-400 rounded-full animate-pulse delay-700"></div>
                    
                    {/* Main circle with gradient border and video inside */}
                    <div className="relative w-48 h-48">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full animate-pulse"></div>
                      <div className="absolute inset-3 rounded-full overflow-hidden shadow-lg group-hover/preview:shadow-2xl transition-all">
                        <video 
                          className="w-full h-full object-cover pointer-events-none"
                          muted
                          loop
                          playsInline
                          autoPlay
                        >
                          <source src="/videos/product-demo.mp4" type="video/mp4" />
                        </video>
                        {/* Play overlay icon */}
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover/preview:bg-black/30 transition-all pointer-events-none">
                          <div className="bg-white/90 rounded-full p-4 shadow-xl">
                            <Video className="h-8 w-8 text-purple-600" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                  
                  <p className="mt-4 text-sm font-medium text-gray-700">{t('home.video_demo_label')}</p>
                </div>
                
                <div className="absolute inset-0 bg-gradient-to-br from-purple-100/50 to-pink-50/50 rounded-3xl -rotate-2 group-hover:-rotate-3 transition-transform duration-300 pointer-events-none"></div>
                
                {/* Kusama dots overlay for this card */}
                <div 
                  className="absolute inset-0 rounded-3xl opacity-20 pointer-events-none"
                  style={{
                    backgroundImage: `
                      radial-gradient(circle at 30% 70%, #A855F7 3px, transparent 3px),
                      radial-gradient(circle at 70% 30%, #EC4899 2px, transparent 2px)
                    `,
                    backgroundSize: '55px 55px, 75px 75px'
                  }}
                ></div>
                
                <div className="relative bg-white/95 backdrop-blur-sm rounded-3xl p-12 shadow-2xl hover:shadow-3xl transition-all duration-300">
                  <h3 className="text-4xl font-bold text-gray-900 mb-6">{t('home.automated_video')}</h3>
                  <p className="text-gray-600 mb-10 text-lg leading-relaxed">
                    {t('home.automated_video_desc')}
                  </p>
                  
                  <Button 
                    size="lg" 
                    onClick={() => navigate('/chat/n8n')}
                    className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 hover:from-purple-600 hover:via-pink-600 hover:to-purple-700 text-white rounded-2xl py-5 text-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:-translate-y-1"
                  >
                    Start Creating
                    <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-2 transition-transform" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Artistic footer inspiration */}
            <div className="mt-16 text-center">
              <div className="flex justify-center space-x-3 mb-8">
                {[...Array(9)].map((_, i) => (
                  <div 
                    key={i}
                    className="w-4 h-4 rounded-full animate-bounce"
                    style={{
                      backgroundColor: ['#3B82F6', '#A855F7', '#F59E0B', '#EF4444', '#22C55E', '#EC4899', '#06B6D4', '#8B5CF6', '#F97316'][i],
                      animationDelay: `${i * 100}ms`
                    }}
                  ></div>
                ))}
              </div>
              <blockquote className="text-2xl text-gray-600 italic font-light max-w-2xl mx-auto">
                "Infinity mirrors infinite creativity"
                <br />
                <span className="text-lg text-gray-400 not-italic">- Inspired by Kusama & Kandinsky</span>
              </blockquote>
            </div>
          </div>
        </section>

      {/* Video Modal */}
      {showVideoModal && (
        <div 
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowVideoModal(false)}
        >
          <div 
            className="relative w-full max-w-md bg-white rounded-lg overflow-hidden shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowVideoModal(false)}
              className="absolute top-2 right-2 z-10 bg-white hover:bg-gray-100 rounded-full p-1 shadow transition-all"
            >
              <X className="h-4 w-4 text-gray-600" />
            </button>
            
            <video 
              className="w-full aspect-video"
              controls
              autoPlay
            >
              <source src="/videos/product-demo.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            
            <div className="px-3 py-2 bg-gradient-to-br from-purple-50 to-pink-50 border-t border-purple-100">
              <p className="text-xs font-medium text-gray-700">{t('home.video_demo_label')}</p>
            </div>
          </div>
        </div>
      )}

      {/* CTA Section for non-logged users */}
      {!user && (
        <section className="bg-gradient-to-r from-blue-600 to-purple-600 py-16">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold text-white mb-6">
              Ready to unleash your creativity?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Join thousands of creators who are already using ProMe AI to transform their ideas into reality
            </p>
            <div className="space-x-4">
              <Button 
                size="lg" 
                onClick={() => navigate('/register')}
                className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-3 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all"
              >
                Get Started Free
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => navigate('/login')}
                className="border-2 border-white text-white hover:bg-white hover:text-blue-600 px-8 py-3 text-lg rounded-xl"
              >
                Sign In
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}