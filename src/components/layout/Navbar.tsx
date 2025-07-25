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
import { Menu, X, User, Settings, LogOut, CreditCard, Activity } from 'lucide-react';
import { authService } from '@/lib/auth';
import { User as UserType } from '@/types';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<UserType | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // 获取当前用户状态
    const currentUser = authService.getCurrentUserSync();
    setUser(currentUser);

    // 监听认证状态变化
    const handleAuthChange = (event: CustomEvent) => {
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
    if (typeof name !== 'string') return '';
    return name
      .split(' ')
      .filter(Boolean)
      .map(part => (part && part[0]) || '')
      .join('')
      .toUpperCase()
      .substring(0, 2);
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

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          <Link to="/services" className="text-gray-600 hover:text-gray-900">服务目录</Link>
          <Link to="/pricing" className="text-gray-600 hover:text-gray-900">价格</Link>
          {user && (
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">控制台</Link>
          )}
        </nav>

        {/* User Menu or Auth Buttons */}
        <div className="hidden md:block">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="rounded-full h-9 w-9 p-0">
                  <Avatar>
                    <AvatarImage src={user.avatarUrl || ''} alt={user.name || ''} />
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>我的账户</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                  <User className="mr-2 h-4 w-4" />
                  控制台
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/token-dashboard')}>
                  <Activity className="mr-2 h-4 w-4" />
                  用量统计
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  设置
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex space-x-2">
              <Button variant="ghost" onClick={() => navigate('/login')}>
                登录
              </Button>
              <Button onClick={() => navigate('/register')}>
                注册
              </Button>
            </div>
          )}
        </div>

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
              to="/services" 
              className="block py-2 text-gray-600 hover:text-gray-900"
              onClick={() => setIsOpen(false)}
            >
              服务目录
            </Link>
            <Link 
              to="/pricing" 
              className="block py-2 text-gray-600 hover:text-gray-900"
              onClick={() => setIsOpen(false)}
            >
              价格
            </Link>
            {user ? (
              <>
                <Link 
                  to="/dashboard" 
                  className="block py-2 text-gray-600 hover:text-gray-900"
                  onClick={() => setIsOpen(false)}
                >
                  控制台
                </Link>
                <Link 
                  to="/token-dashboard" 
                  className="block py-2 text-gray-600 hover:text-gray-900"
                  onClick={() => setIsOpen(false)}
                >
                  用量统计
                </Link>
                <Link 
                  to="/settings" 
                  className="block py-2 text-gray-600 hover:text-gray-900"
                  onClick={() => setIsOpen(false)}
                >
                  设置
                </Link>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start p-2"
                  onClick={() => {
                    setIsOpen(false);
                    logout();
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </Button>
              </>
            ) : (
              <div className="space-y-2">
                <Button 
                  variant="ghost" 
                  className="w-full"
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/login');
                  }}
                >
                  登录
                </Button>
                <Button 
                  className="w-full"
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/register');
                  }}
                >
                  注册
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
