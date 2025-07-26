import { useState, useEffect } from 'react';
import { User } from '@/types';
import { authService } from '@/lib/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial user state
    const currentUser = authService.getCurrentUserSync();
    setUser(currentUser);
    setIsLoading(false);

    // Listen for auth state changes
    const handleAuthChange = (newUser: User | null) => {
      setUser(newUser);
      setIsLoading(false);
    };

    // Subscribe to auth changes if available
    if (authService.onAuthStateChange) {
      authService.onAuthStateChange(handleAuthChange);
    }

    // Cleanup subscription
    return () => {
      // In a real implementation, you'd return an unsubscribe function
      // For now, we'll just cleanup
    };
  }, []);

  const login = async (email: string, password: string) => {
    return await authService.signIn(email, password);
  };

  const logout = async () => {
    return await authService.signOut();
  };

  const register = async (email: string, password: string, name: string) => {
    return await authService.signUp(email, password, name);
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