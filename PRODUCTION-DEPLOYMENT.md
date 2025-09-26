# Production Deployment Guide

This guide helps you deploy the Prome Platform to production with all the necessary configurations for stable authentication, database connectivity, and token monitoring.

## ✅ Pre-Deployment Checklist

### 1. Environment Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Configure the following variables:

```env
# Required for Production
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional Features
VITE_ENABLE_DIFY_INTEGRATION=true
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_key

# Test Mode (DISABLE in production)
# VITE_TEST_MODE=false
# VITE_NON_ADMIN_TEST=false
# VITE_PROBLEMATIC_USER_TEST=false
```

⚠️ **Important**: Ensure all test mode flags are disabled or removed in production.

### 2. Database Setup

#### Apply Database Schema

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the SQL migration from `supabase/schema.sql`:

```sql
-- Copy and paste the contents of supabase/schema.sql
-- This creates all necessary tables and default data
```

#### Verify Required Tables

Ensure these tables exist:
- `users` (with INTEGER balance field)
- `model_configs` 
- `exchange_rates`
- `token_usage` (with created_at field)
- `billing_records` (with created_at field)
- `exchange_rate_history`

#### Configure Row Level Security (RLS)

Basic RLS policies are included in the schema. Review and adjust as needed:

```sql
-- Example: Allow users to read their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Example: Allow authenticated users to read model configs
CREATE POLICY "Authenticated users can read model configs" ON model_configs
  FOR SELECT TO authenticated USING (true);
```

### 3. Authentication Setup

The system includes comprehensive authentication with fallback mechanisms:

- ✅ Session recovery and validation
- ✅ Automatic fallback to mock data when database unavailable
- ✅ User-friendly error handling
- ✅ Persistent session management

No additional configuration needed - the auth service handles production scenarios automatically.

### 4. Content Security Policy (CSP)

For Dify integration and Stripe payments, ensure your CSP allows:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://js.stripe.com https://*.udify.app;
  frame-src https://js.stripe.com https://*.udify.app;
  connect-src 'self' https://api.stripe.com https://*.supabase.co https://*.udify.app;
  img-src 'self' data: https:;
  style-src 'self' 'unsafe-inline';
">
```

## 🚀 Deployment Steps

### 1. Build the Application

```bash
npm install
npm run build
```

### 2. Deploy Static Files

Deploy the `dist/` folder to your hosting platform:

- **Vercel**: Connect your GitHub repo
- **Netlify**: Drag and drop `dist/` folder
- **AWS S3/CloudFront**: Upload `dist/` contents
- **Any static hosting**: Upload `dist/` contents

### 3. Configure Environment Variables

Set the production environment variables on your hosting platform:

**Vercel/Netlify:**
- Add environment variables in the dashboard
- Ensure they start with `VITE_` to be included in the build

**Other platforms:**
- Set variables before running `npm run build`

### 4. Test the Deployment

Visit your deployed application and go to `/system-diagnostics` to run automated tests:

```
https://your-domain.com/system-diagnostics
```

This page will validate:
- ✅ Environment configuration
- ✅ Database connectivity
- ✅ Authentication system
- ✅ Model configurations
- ✅ Payment integration

## 🔧 Troubleshooting

### Common Issues

#### 1. "Database connection failed" 
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Check Supabase project status
- Ensure database schema is applied

#### 2. "Auth session missing" errors
- This is normal - the system has fallback mechanisms
- Users will be prompted to log in
- Check browser console for detailed error messages

#### 3. "Model configs not found"
- Run the SQL migration from `supabase/schema.sql`
- Verify `model_configs` table has default data

#### 4. Token monitoring not working
- Ensure `VITE_ENABLE_DIFY_INTEGRATION=true`
- Check CSP settings allow Dify iframe access
- Verify model configurations are properly set up

### Debug Tools

In development mode, use browser console commands:

```javascript
// Check authentication status
window.checkAuth()

// Test database connection
window.testDatabase()

// Force logout
window.forceLogout()

// Validate environment
environmentValidator.logValidationResults()
```

## 📊 Production Monitoring

### Health Checks

The system provides real-time health monitoring:

1. **Database Status Indicator**: Shows in UI when database issues occur
2. **System Diagnostics Page**: Comprehensive health checks at `/system-diagnostics`
3. **Console Logging**: Detailed logs for debugging

### Expected Behavior

#### Normal Operation
- ✅ Users can authenticate and maintain sessions
- ✅ Database operations work with automatic fallbacks
- ✅ Token monitoring tracks usage accurately
- ✅ Balance updates reflect in real-time

#### Graceful Degradation
- 🔄 **Database offline**: Uses mock data, shows user notification
- 🔄 **Auth issues**: Prompts re-authentication, maintains UX
- 🔄 **Payment issues**: Disables payment features gracefully

## 🛡️ Security Considerations

### Production Settings
- Disable all test mode flags
- Use HTTPS for all external requests
- Implement proper CSP headers
- Regular security updates for dependencies

### Database Security
- RLS policies properly configured
- API keys have minimal required permissions
- Regular backups configured in Supabase

### Authentication Security
- Session timeout configured appropriately
- Secure token storage in localStorage
- Proper logout clearing all session data

## 📈 Performance Optimization

### Build Optimization
```bash
# Analyze bundle size
npm run build -- --analyze

# Pre-compression for static hosting
npm run build && gzip -9 dist/assets/*.js
```

### Database Performance
- Indexes created for common queries
- Connection pooling in Supabase
- Efficient queries with minimal data transfer

## 🔍 Verification

After deployment, verify these work:

1. **User Registration/Login** ✅
2. **Balance Management** ✅ 
3. **Token Monitoring** ✅
4. **Model Configuration Loading** ✅
5. **Database Fallback Mechanisms** ✅
6. **Error Handling and User Feedback** ✅

Your Prome Platform is now ready for production! 🎉

## Support

If you encounter issues:
1. Check the System Diagnostics page first
2. Review browser console logs
3. Verify environment variables
4. Test database connection manually in Supabase dashboard