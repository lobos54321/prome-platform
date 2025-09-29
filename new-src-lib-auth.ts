import { useState } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  balance: number;
}

class AuthService {
  private currentUser: User | null = null;

  async getCurrentUser(): Promise<User | null> {
    if (this.currentUser) return this.currentUser;
    
    // Try to get user from localStorage
    try {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
        return this.currentUser;
      }
    } catch (error) {
      console.error('Failed to parse stored user:', error);
    }
    
    return null;
  }

  getCurrentUserSync(): User | null {
    if (this.currentUser) return this.currentUser;
    
    try {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
        return this.currentUser;
      }
    } catch (error) {
      console.error('Failed to parse stored user:', error);
    }
    
    return null;
  }

  async signIn(email: string, password: string): Promise<User> {
    // Implementation would call actual auth API
    // For now, return mock user
    const user: User = {
      id: `user_${Date.now()}`,
      email,
      name: email.split('@')[0],
      balance: 1000
    };
    
    this.currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
    return user;
  }

  async signOut(): Promise<void> {
    this.currentUser = null;
    localStorage.removeItem('currentUser');
  }

  async updateUserBalance(newBalance: number): Promise<void> {
    if (this.currentUser) {
      this.currentUser.balance = newBalance;
      localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
    }
  }
}

export const authService = new AuthService();