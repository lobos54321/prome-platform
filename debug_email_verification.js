// Email Verification Diagnostics Script
// Run this in browser console during registration to debug

console.log('🔍 Email Verification Diagnostics');

// Check Supabase settings
fetch('https://lfjslsygnitdgdnfboiy.supabase.co/auth/v1/settings', {
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmanNsc3lnbml0ZGdkbmZib2l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxODI5NjksImV4cCI6MjA2ODc1ODk2OX0.VpgSYmwW6mJ0iSaART16Ptb96zACJVJIdlskwBmIRsM'
  }
})
.then(r => r.json())
.then(settings => {
  console.log('📧 Supabase Auth Settings:', settings);
  console.log('Email enabled:', settings.external.email);
  console.log('Auto-confirm emails:', settings.mailer_autoconfirm);
  console.log('Signup disabled:', settings.disable_signup);
});

// Monitor registration attempts
const originalSignUp = window.supabaseClient?.auth.signUp;
if (originalSignUp) {
  window.supabaseClient.auth.signUp = function(...args) {
    console.log('🚀 SignUp called with:', args[0]);
    return originalSignUp.apply(this, args).then(result => {
      console.log('✅ SignUp result:', result);
      console.log('User confirmed?:', result.data?.user?.email_confirmed_at);
      console.log('Confirmation sent?:', result.data?.user?.confirmation_sent_at);
      return result;
    }).catch(error => {
      console.error('❌ SignUp error:', error);
      throw error;
    });
  };
}

// Check current session
setTimeout(() => {
  if (window.supabaseClient) {
    window.supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        console.log('🔐 Current session:', session);
        console.log('Email confirmed?:', session.user.email_confirmed_at);
        console.log('User metadata:', session.user.user_metadata);
      } else {
        console.log('🔓 No active session');
      }
    });
  }
}, 1000);