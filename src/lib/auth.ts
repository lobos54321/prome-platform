import { User } from '@/types';
import { db } from './supabase';

// Authentication service using Supabase
class AuthService {
  private currentUser: User | null = null;
  
  // Login with email and password
  async login(email: string, password: string): Promise<User> {
    const user = await db.signIn(email, password);
    
    if (!user) {
      throw new Error('Login failed. Please check your credentials.');
    }
    
    this.currentUser = user;
    // Store minimal user info in localStorage for UI state persistence
    localStorage.setItem('currentUser', JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      balance: user.balance
    }));
    
    return user;
  }
  
  // Register new user
  async register(name: string, email: string, password: string): Promise<User> {
    const user = await db.signUp(email, password, name);
    
    if (!user) {
      throw new Error('Registration failed. Please try again later.');
    }
    
    this.currentUser = user;
    // Store minimal user info in localStorage for UI state persistence
    localStorage.setItem('currentUser', JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      balance: user.balance
    }));
    
    return user;
  }
  
  // Get current user - checks Supabase session first
  async getCurrentUser(): Promise<User | null> {
    // Try to get from Supabase session first
    try {
      const user = await db.getCurrentUser();
      if (user) {
        this.currentUser = user;
        // Update localStorage with fresh data
        localStorage.setItem('currentUser', JSON.stringify({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          balance: user.balance
        }));
        return user;
      }
    } catch (error) {
      console.warn('Failed to get user from Supabase:', error);
      // Clear invalid session data
      this.currentUser = null;
      localStorage.removeItem('currentUser');
      return null;
    }
    
    // If no valid session, clear stored data
    this.currentUser = null;
    localStorage.removeItem('currentUser');
    return null;
  }
  
  // Synchronous version - only returns user if we have a valid session
  getCurrentUserSync(): User | null {
    // Only return cached user if we have a current session
    if (this.currentUser) return this.currentUser;
    
    // Don't rely on localStorage alone - it might be stale
    return null;
  }
  
  // Check if user is authenticated (synchronous)
  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }
  
  // Initialize auth state on app startup
  async initializeAuth(): Promise<User | null> {
    try {
      const user = await this.getCurrentUser();
      return user;
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      return null;
    }
  }
  
  // Logout
  async logout(): Promise<void> {
    try {
      await db.signOut();
    } catch (error) {
      console.warn('Error during logout:', error);
    }
    
    this.currentUser = null;
    localStorage.removeItem('currentUser');
  }
  
  // Update user balance
  async updateBalance(amount: number): Promise<number> {
    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error('No user is logged in');
    }
    
    const newBalance = await db.updateUserBalance(user.id, amount);
    
    // Update current user in memory
    if (this.currentUser) {
      this.currentUser.balance = newBalance;
      // Update localStorage
      localStorage.setItem('currentUser', JSON.stringify({
        id: this.currentUser.id,
        name: this.currentUser.name,
        email: this.currentUser.email,
        role: this.currentUser.role,
        balance: newBalance
      }));
    }
    
    return newBalance;
  }
  
  // Get user by ID - useful for admin functions or webhook processing
  async getUserById(userId: string): Promise<User | null> {
    return await db.getUserById(userId);
  }
}

export const authService = new AuthService();
