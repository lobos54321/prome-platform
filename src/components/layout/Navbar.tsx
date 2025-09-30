import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Menu, X, User, Settings, LogOut, CreditCard, Activity, Coins, Shield, MessageSquare, Video } from 'lucide-react';
import { authService } from '@/lib/auth';
import { isAdmin } from '@/lib/admin';
import { User as UserType } from '@/types';
import PointsDisplay from '@/components/ui/PointsDisplay';
import { DifyMonitorStatus } from '@/components/DifyMonitorStatus';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<UserType | null>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    // 初始化时获取当前用户状态
    const initializeUser = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Failed to initialize user in navbar:', error);
        setUser(null);
      }
    };

    initializeUser();

    // 监听认证状态变化
    const handleAuthChange = (event: CustomEvent) => {
      console.log('Navbar received auth state change:', event.detail.user?.email);
      setUser(event.detail.user);
    };

    window.addEventListener('auth-state-changed', handleAuthChange as EventListener);

    return () => {
      window.removeEventListener('auth-state-changed', handleAuthChange as EventListener);
    };
  }, []);

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      // 即使退出失败，也清除本地状态
      authService.forceLogout();
      setUser(null);
      navigate('/login');
    }
  };

  const getInitials = (name: string | undefined | null): string => {
    if (!name || typeof name !== 'string') return 'U';
    return name
      .split(' ')
      .filter(Boolean)
      .map(part => (part && part[0]) || '')
      .join('')
      .toUpperCase()
      .substring(0, 2) || 'U';
  };

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto flex items-center justify-between p-4">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2">
          <div className="flex flex-col">
            <span className="font-bold text-xl">ProMe</span>
            <span className="text-xs text-gray-600">Feed your feed to your AI</span>
          </div>
        </Link>

        {/* Desktop Navigation - ProMe | Pricing | Dashboard | Prome AI | English | 100 points | login/sign up */}
        <nav className="hidden md:flex items-center space-x-6">
          <Link to="/pricing" className="text-gray-600 hover:text-gray-900">{t('nav.pricing', 'Pricing')}</Link>
          {user && (
            <>
              <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">{t('nav.dashboard', 'Dashboard')}</Link>
              <Link to="/chat/dify" className="text-gray-600 hover:text-gray-900">Deep-Copywriting</Link>
              <Link to="/chat/n8n" className="text-gray-600 hover:text-gray-900">Auto-Video</Link>
            </>
          )}
          
          {/* Language Switcher */}
          <LanguageSwitcher />
          
          {/* Points Display and Auth */}
          {user && user.balance && user.balance > 0 && (
            <PointsDisplay className="border-0 shadow-none bg-gray-50" showDetails={false} />
          )}
          
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="rounded-full h-9 w-9 p-0">
                  <Avatar>
                    <AvatarImage src={user.avatarUrl || ''} alt={user.name || 'User'} />
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('nav.myAccount', 'My Account')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                  <User className="mr-2 h-4 w-4" />
                  {t('nav.dashboard', 'Dashboard')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/chat/dify')}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Deep-Copywriting
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/chat/n8n')}>
                  <Video className="mr-2 h-4 w-4" />
                  Auto-Video
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/token-dashboard')}>
                  <Activity className="mr-2 h-4 w-4" />
                  {t('nav.usage', 'Usage')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  {t('nav.settings', 'Settings')}
                </DropdownMenuItem>
                {isAdmin(user) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/admin')}>
                      <Shield className="mr-2 h-4 w-4" />
                      {t('nav.admin', 'Admin')}
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('nav.logout', 'Logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex space-x-2">
              <Button variant="ghost" onClick={() => navigate('/login')}>
                {t('nav.login', 'Login')}
              </Button>
              <Button onClick={() => navigate('/register')}>
                {t('nav.signUp', 'Sign Up')}
              </Button>
            </div>
          )}
        </nav>

        {/* Mobile menu button */}
        <div className="md:hidden">
          <Button
            variant="ghost"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden border-t bg-white">
          <div className="container mx-auto p-4 space-y-2">
            <Link 
              to="/pricing" 
              className="block py-2 text-gray-600 hover:text-gray-900"
              onClick={() => setIsOpen(false)}
            >
              {t('nav.pricing', 'Pricing')}
            </Link>
            {user ? (
              <>
                <Link 
                  to="/dashboard" 
                  className="block py-2 text-gray-600 hover:text-gray-900"
                  onClick={() => setIsOpen(false)}
                >
                  {t('nav.dashboard', 'Dashboard')}
                </Link>
                <Link 
                  to="/chat/dify" 
                  className="block py-2 text-gray-600 hover:text-gray-900"
                  onClick={() => setIsOpen(false)}
                >
                  Deep-Copywriting
                </Link>
                <Link 
                  to="/chat/n8n" 
                  className="block py-2 text-gray-600 hover:text-gray-900"
                  onClick={() => setIsOpen(false)}
                >
                  Auto-Video
                </Link>
                <Link 
                  to="/token-dashboard" 
                  className="block py-2 text-gray-600 hover:text-gray-900"
                  onClick={() => setIsOpen(false)}
                >
                  {t('nav.usage', 'Usage')}
                </Link>
                <Link 
                  to="/settings" 
                  className="block py-2 text-gray-600 hover:text-gray-900"
                  onClick={() => setIsOpen(false)}
                >
                  {t('nav.settings', 'Settings')}
                </Link>
                {isAdmin(user) && (
                  <Link 
                    to="/admin" 
                    className="block py-2 text-blue-600 hover:text-blue-900 font-medium"
                    onClick={() => setIsOpen(false)}
                  >
                    {t('nav.admin', 'Admin')}
                  </Link>
                )}
                <div className="py-2">
                  <LanguageSwitcher />
                </div>
                {user.balance && user.balance > 0 && (
                  <div className="py-2">
                    <PointsDisplay className="border-0 shadow-none bg-gray-50" showDetails={false} />
                  </div>
                )}
                <div className="py-2">
                  <DifyMonitorStatus />
                </div>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start p-2"
                  onClick={() => {
                    setIsOpen(false);
                    logout();
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('nav.logout', 'Logout')}
                </Button>
              </>
            ) : (
              <div className="space-y-2">
                <div className="py-2">
                  <LanguageSwitcher />
                </div>
                <Button 
                  variant="ghost" 
                  className="w-full"
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/login');
                  }}
                >
                  {t('nav.login', 'Login')}
                </Button>
                <Button 
                  className="w-full"
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/register');
                  }}
                >
                  {t('nav.signUp', 'Sign Up')}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
