import { User } from '@/types';

// Admin configuration
export const ADMIN_EMAIL = 'lobos54321@gmail.com';

/**
 * Check if a user is an administrator
 * Only the hardcoded admin email has admin privileges
 */
export function isAdmin(user: User | null): boolean {
  if (!user || !user.email) {
    console.log('isAdmin: No user or email provided');
    return false;
  }
  
  // Normalize email by trimming whitespace and converting to lowercase
  const userEmail = user.email.trim().toLowerCase();
  const adminEmail = ADMIN_EMAIL.trim().toLowerCase();
  
  const result = userEmail === adminEmail;
  console.log('isAdmin: Checking user email:', userEmail, 'against admin email:', adminEmail, 'Result:', result);
  
  return result;
}

/**
 * Check if the current email is an admin email
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  
  // Normalize email by trimming whitespace and converting to lowercase
  const normalizedEmail = email.trim().toLowerCase();
  const adminEmail = ADMIN_EMAIL.trim().toLowerCase();
  
  return normalizedEmail === adminEmail;
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