

```tsx
import { useState } from 'react';
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
// 修复：导入 Activity 图标
import { Menu, X, User, Settings, LogOut, CreditCard, Activity } from 'lucide-react';
import { authService } from '@/lib/auth';
import { User as UserType } from '@/types'; // 导入 User 类型以获得更好的类型安全

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  // 增强类型安全性：明确 user 的类型可能为 UserType 或 null
  const user: UserType | null = authService.getCurrentUser();

  const logout = () => {
    authService.logout();
    navigate('/');
  };

  // 修改后的 getInitials 函数，增加了健壮性检查
  const getInitials = (name: string | undefined | null) => {
    // 检查 name 是否为有效字符串
    if (typeof name !== 'string') {
      return ''; // 如果不是字符串，返回空字符串作为 fallback
    }
    return name
      .split(' ') // 现在可以安全地调用 .split()
      .map(part => part[0])
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
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                    {/* 将 getInitials 应用于 user.name */}
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>我的账户</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                  <User className="mr-2 h-4 w-4" />
                  <span>控制台</span>
                </DropdownMenuItem>
                {/* 修复：添加了 Activity 图标 */}
                <DropdownMenuItem onClick={() => navigate('/token-dashboard')}>
                  <Activity className="mr-2 h-4 w-4" />
                  <span>Token 分析</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>设置</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {/* 安全地访问 user.balance */}
                  <span>余额: ¥{user.balance !== undefined ? user.balance.toFixed(2) : '0.00'}</span>
                </DropdownMenuItem>
                {/* 安全地访问 user.role */}
                {user.role === 'admin' && (
                  <DropdownMenuItem onClick={() => navigate('/admin')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>管理后台</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>退出</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center space-x-2">
              <Button variant="ghost" onClick={() => navigate('/login')}>登录</Button>
              <Button onClick={() => navigate('/register')}>注册</Button>
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button 
          className="md:hidden p-2" 
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t p-4">
          <nav className="flex flex-col space-y-4">
            <Link 
              to="/services" 
              className="text-gray-600 hover:text-gray-900"
              onClick={() => setIsOpen(false)}
            >
              服务目录
            </Link>
            <Link 
              to="/pricing" 
              className="text-gray-600 hover:text-gray-900"
              onClick={() => setIsOpen(false)}
            >
              价格
            </Link>
            {user && (
              <>
                <Link 
                  to="/dashboard" 
                  className="text-gray-600 hover:text-gray-900"
                  onClick={() => setIsOpen(false)}
                >
                  控制台
                </Link>
                <Link 
                  to="/token-dashboard" 
                  className="text-gray-600 hover:text-gray-900"
                  onClick={() => setIsOpen(false)}
                >
                  Token 分析
                </Link>
              </>
            )}
            {user ? (
              <>
                <div className="pt-2 border-t">
                  <div className="flex items-center space-x-3 mb-3">
                    <Avatar>
                      <AvatarImage src={user.avatarUrl} alt={user.name} />
                      {/* 将 getInitials 应用于 user.name */}
                      <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      {/* 安全地访问 user.name 和 user.balance */}
                      <p className="font-medium">{user.name || '用户'}</p>
                      <p className="text-sm text-gray-500">余额: ¥{user.balance !== undefined ? user.balance.toFixed(2) : '0.00'}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start" 
                      onClick={() => {
                        setIsOpen(false);
                        navigate('/settings');
                      }}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      设置
                    </Button>
                    {/* 安全地访问 user.role */}
                    {user.role === 'admin' && (
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start" 
                        onClick={() => {
                          setIsOpen(false);
                          navigate('/admin');
                        }}
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        管理后台
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start text-red-600" 
                      onClick={() => {
                        logout();
                        setIsOpen(false);
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      退出
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="pt-2 border-t flex flex-col space-y-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/login');
                  }}
                >
                  登录
                </Button>
                <Button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/register');
                  }}
                >
                  注册
                </Button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

```
