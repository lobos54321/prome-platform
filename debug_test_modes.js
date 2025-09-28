// Debug Environment Variables in Browser Console
// Paste this in browser console to check if test modes are accidentally enabled

console.log('🔍 Environment Variables Check:');
console.log('VITE_TEST_MODE:', import.meta.env?.VITE_TEST_MODE);
console.log('VITE_NON_ADMIN_TEST:', import.meta.env?.VITE_NON_ADMIN_TEST); 
console.log('VITE_PROBLEMATIC_USER_TEST:', import.meta.env?.VITE_PROBLEMATIC_USER_TEST);

console.log('All environment variables:', import.meta.env);

// Check current user source
if (window.authService) {
  const currentUser = window.authService.getCurrentUserSync();
  if (currentUser) {
    console.log('🔐 Current user source analysis:');
    console.log('User ID:', currentUser.id);
    console.log('User Email:', currentUser.email);
    
    // Check if it's one of the test users
    const testUserIds = [
      '9dee4891-89a6-44ee-8fe8-69097846e97d',
      'user-123', 
      'admin-user-123'
    ];
    
    if (testUserIds.includes(currentUser.id)) {
      console.warn('⚠️ DETECTED TEST USER IN PRODUCTION!');
      console.warn('This user is hardcoded and bypasses all authentication!');
    } else {
      console.log('✅ User appears to be real (not a hardcoded test user)');
    }
  }
}

// Check localStorage for cached user
const storedUser = localStorage.getItem('currentUser');
if (storedUser) {
  console.log('💾 Cached user in localStorage:', JSON.parse(storedUser));
}