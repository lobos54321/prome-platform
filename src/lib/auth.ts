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
    }));
    
    return user;
  }
  
  // Get current user - checks Supabase session first, falls back to localStorage for UI purposes
  async getCurrentUser(): Promise<User | null> {
    // If we have current user in memory, return it
    if (this.currentUser) return this.currentUser;
    
    // Try to get from Supabase session
    const user = await db.getCurrentUser();
    if (user) {
      this.currentUser = user;
      return user;
    }
    
    // Fall back to localStorage (only for UI state - will require re-auth for API calls)
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        // Important: Since this is just from localStorage, it's not verified
        // We'll use it for UI purposes only, but any API calls will need to re-auth
        return parsedUser as User;
      } catch (e) {
        console.error('Error parsing stored user', e);
        localStorage.removeItem('currentUser');
      }
    }
    
    return null;
  }
  
  // Synchronous version for components that can't use async/await
  getCurrentUserSync(): User | null {
    if (this.currentUser) return this.currentUser;
    
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        return JSON.parse(storedUser) as User;
      } catch (e) {
        console.error('Error parsing stored user', e);
      }
    }
    
    return null;
  }
  
  // Logout
  async logout(): Promise<void> {
    await db.signOut();
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
    }
    
    return newBalance;
  }
  
  // Get user by ID - useful for admin functions or webhook processing
  async getUserById(userId: string): Promise<User | null> {
    return await db.getUserById(userId);
  }
}

export const authService = new AuthService();