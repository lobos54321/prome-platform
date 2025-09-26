import { useState, useEffect } from 'react';
import { User } from '@/types';
import { authService } from '@/lib/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize user state
    const initializeAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Failed to get current user in useAuth:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth state changes using the custom event
    const handleAuthChange = (event: CustomEvent) => {
      console.log('useAuth received auth state change:', event.detail.user?.email);
      setUser(event.detail.user);
      setIsLoading(false);
    };

    window.addEventListener('auth-state-changed', handleAuthChange as EventListener);

    return () => {
      window.removeEventListener('auth-state-changed', handleAuthChange as EventListener);
    };
  }, []);

  const login = async (email: string, password: string) => {
    return await authService.login(email, password);
  };

  const logout = async () => {
    return await authService.logout();
  };

  const register = async (email: string, password: string, name: string) => {
    return await authService.register(email, password, name);
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    register
  };
}