# Xiaohongshu Integration - Developer Quick Reference

## 🚀 Quick Start

### Access the Page
```
http://localhost:5173/xiaohongshu
```

### Key Components

1. **Database Service** - `src/lib/xiaohongshu-db.ts`
   ```typescript
   import { xiaohongshuDb } from '@/lib/xiaohongshu-db';
   
   // Get/create user mapping
   await xiaohongshuDb.getOrCreateUserMapping(uuid, xhsUserId);
   
   // Save user profile
   await xiaohongshuDb.upsertUserProfile(profile);
   
   // Log activity
   await xiaohongshuDb.logActivity(log);
   ```

2. **API Service** - `src/api/xiaohongshu.ts`
   ```typescript
   import { xiaohongshuApi } from '@/api/xiaohongshu';
   
   // Health check
   const isHealthy = await xiaohongshuApi.healthCheck();
   
   // Check login status
   const status = await xiaohongshuApi.checkLoginStatus(userId);
   
   // Start automation
   await xiaohongshuApi.startAutomation(config);
   ```

3. **Page Component** - `src/pages/XiaohongshuAutomationPage.tsx`
   - Main UI component
   - Handles user interactions
   - Manages state and data flow

## 📊 Database Tables

### User Mapping
```sql
SELECT * FROM xhs_user_mapping 
WHERE supabase_uuid = 'xxx';
```

### User Profile
```sql
SELECT * FROM xhs_user_profiles 
WHERE supabase_uuid = 'xxx';
```

### Automation Status
```sql
SELECT * FROM xhs_automation_status 
WHERE supabase_uuid = 'xxx';
```

### Activity Logs
```sql
SELECT * FROM xhs_activity_logs 
WHERE supabase_uuid = 'xxx' 
ORDER BY created_at DESC 
LIMIT 20;
```

## 🔧 Common Operations

### Add New Activity Type
```typescript
await xiaohongshuDb.logActivity({
  supabase_uuid: user.id,
  xhs_user_id: userId,
  activity_type: 'new_type',  // e.g., 'post', 'like', 'comment'
  message: 'Activity description',
  metadata: { additional: 'data' },
});
```

### Update Automation Status
```typescript
await xiaohongshuDb.upsertAutomationStatus({
  supabase_uuid: user.id,
  xhs_user_id: userId,
  is_running: true,
  is_logged_in: true,
  has_config: true,
  last_activity: new Date().toISOString(),
});
```

### Query Tasks
```typescript
const tasks = await xiaohongshuDb.getDailyTasks(
  user.id, 
  new Date()  // specific date
);
```

## 🎯 Testing Scenarios

### Test 1: First Time User
1. Clear browser storage
2. Navigate to `/xiaohongshu`
3. Should see setup wizard
4. Check database for new mapping

### Test 2: Returning User
1. Login as existing user
2. Navigate to `/xiaohongshu`
3. Should see saved configuration
4. Check database for existing profile

### Test 3: Offline Mode
1. Stop backend service
2. Navigate to `/xiaohongshu`
3. Should see warning banner
4. Save config should still work
5. Check database for saved data

### Test 4: Backend Recovery
1. While in offline mode
2. Start backend service
3. Click "Re-check" button
4. Should remove warning banner
5. Features should be enabled

## 🐛 Debug Tips

### Enable Verbose Logging
Open browser console and check for:
```
🔍 初始化小红书自动化
📝 Supabase UUID: ...
📝 小红书用户ID: ...
✅ 用户映射已创建/获取
```

### Check RLS Policies
```sql
-- Test SELECT policy
SELECT * FROM xhs_user_mapping 
WHERE supabase_uuid = auth.uid();

-- Test INSERT policy
INSERT INTO xhs_user_mapping 
VALUES (auth.uid(), 'test_id');
```

### Verify Backend Health
```bash
curl https://xiaohongshu-automation-ai.zeabur.app/health
```

## 🔐 Security Notes

### RLS Enforcement
- All tables have RLS enabled
- Users can only access their own data
- `auth.uid()` automatically enforced
- No manual user filtering needed

### API Authentication
- Backend API may require authentication
- User ID passed in requests
- Consider adding API keys if needed

## 📝 Code Patterns

### Error Handling Pattern
```typescript
try {
  // Optimistic: try backend first
  const result = await xiaohongshuApi.someOperation();
  // Save to database for persistence
  await xiaohongshuDb.saveResult(result);
} catch (error) {
  console.error('Operation failed:', error);
  toast.error('Operation failed', {
    description: error instanceof Error ? error.message : 'Unknown error',
  });
}
```

### Dual-Source Data Loading
```typescript
// Always load from database first (fast)
const dbData = await xiaohongshuDb.getUserProfile(user.id);
setData(dbData);

// Then try to sync with backend (may be slow/fail)
if (backendHealth.available) {
  try {
    const liveData = await xiaohongshuApi.getProfile(userId);
    // Update database with latest
    await xiaohongshuDb.upsertUserProfile(liveData);
    setData(liveData);
  } catch (error) {
    // Fallback to database data (already set)
    console.warn('Backend sync failed, using database data');
  }
}
```

## 🌐 Environment Variables

### Required
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

### Optional
```env
VITE_XIAOHONGSHU_API_BASE=https://xiaohongshu-automation-ai.zeabur.app
```

## 📦 Dependencies

### New Dependencies Added
- None! Uses existing packages:
  - `@supabase/supabase-js` (already in package.json)
  - React hooks (already in use)
  - UI components (shadcn/ui)

### Type Definitions
All types defined in:
- `src/lib/xiaohongshu-db.ts`
- `src/api/xiaohongshu.ts`
- `src/types/xiaohongshu.ts`

## 🚦 Status Indicators

### Backend Health States
- ✅ Available: Full features enabled
- ⚠️ Unavailable: Database-only mode
- 🔄 Checking: Health check in progress

### Automation States
- 🟢 Running: Automation active
- ⏸️ Paused: Automation paused
- ⏹️ Stopped: No configuration

### Login States
- ✅ Logged In: XHS account connected
- ❌ Not Logged In: Need to scan QR

## 📞 Support

### Questions?
- Check console logs for detailed flow
- Verify database tables exist in Supabase
- Test backend health endpoint
- Review RLS policies in Supabase

### Common Fixes
1. **"Cannot read properties of null"**
   - Check user authentication
   - Verify Supabase connection

2. **"RLS policy violation"**
   - Check auth.uid() matches supabase_uuid
   - Verify user is logged in

3. **"Backend unavailable"**
   - Expected if backend not deployed
   - Use database-only features
   - Re-check when backend available

---

**Last Updated:** 2025-10-31
**Maintained By:** Development Team
