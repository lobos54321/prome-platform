import { User } from '@/types';

// Admin configuration
export const ADMIN_EMAIL = 'lobos54321@gmail.com';

/**
 * Check if a user is an administrator
 * Only the hardcoded admin email has admin privileges
 */
export function isAdmin(user: User | null): boolean {
  if (!user || !user.email) {
    return false;
  }
  
  return user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

/**
 * Check if the current email is an admin email
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

/**
 * Require admin privileges or throw an error
 */
export function requireAdmin(user: User | null): void {
  if (!isAdmin(user)) {
    throw new Error('Admin privileges required');
  }
}

/**
 * Check if the current user should have access to admin routes
 */
export function canAccessAdmin(user: User | null): boolean {
  return isAdmin(user);
}