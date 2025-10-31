# Xiaohongshu Integration - Visual Architecture

## 🎨 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE                                 │
│                    /xiaohongshu (React Page)                            │
│                                                                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐          │
│  │  Backend       │  │   Database     │  │   Activity     │          │
│  │  Health        │  │   Status       │  │   Logs         │          │
│  │  Indicator     │  │   Indicator    │  │   Feed         │          │
│  └────────────────┘  └────────────────┘  └────────────────┘          │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────┐         │
│  │              Configuration Form                            │         │
│  │  • Product Name     • Post Frequency                      │         │
│  │  • Target Audience  • Brand Style                         │         │
│  │  • Marketing Goal   • Review Mode                         │         │
│  └───────────────────────────────────────────────────────────┘         │
│                                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐      │
│  │   Save     │  │   Start    │  │   Pause    │  │   Reset    │      │
│  │   Config   │  │   Auto     │  │   Auto     │  │   Config   │      │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘      │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   XiaohongshuAuto-  │
                    │   mationPage.tsx    │
                    └──────────┬──────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ↓                   ↓                   ↓
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   xiaohongshu-   │  │  xiaohongshu     │  │    Supabase      │
│   db.ts          │  │  api.ts          │  │    Auth          │
│  (Database       │  │  (Backend API)   │  │                  │
│   Service)       │  │                  │  │  auth.uid()      │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                     │
         │                     │                     │
         ↓                     ↓                     ↓
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  xhs_user_mapping                                    │  │
│  │  • supabase_uuid (PK, auth.uid())                    │  │
│  │  • xhs_user_id (unique)                              │  │
│  │  • created_at, updated_at                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  xhs_user_profiles                                   │  │
│  │  • id (PK, UUID)                                     │  │
│  │  • supabase_uuid (unique, FK to auth.users)         │  │
│  │  • product_name, target_audience                    │  │
│  │  • marketing_goal, post_frequency                   │  │
│  │  • brand_style, review_mode                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  xhs_automation_status                               │  │
│  │  • supabase_uuid (PK, auth.uid())                    │  │
│  │  • is_running, is_logged_in, has_config             │  │
│  │  • last_activity, uptime_seconds                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  xhs_activity_logs                                   │  │
│  │  • id (PK, UUID)                                     │  │
│  │  • supabase_uuid (auth.uid())                        │  │
│  │  • activity_type, message, metadata (JSONB)         │  │
│  │  • created_at (indexed DESC)                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  xhs_daily_tasks                                     │  │
│  │  • id, theme, title, content                         │  │
│  │  • scheduled_time, status, post_url                 │  │
│  │  • image_urls (JSONB), error_message                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  xhs_weekly_plans                                    │  │
│  │  • week_start_date, week_end_date                   │  │
│  │  • plan_data (JSONB)                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  xhs_content_strategies                              │  │
│  │  • key_themes, trending_topics (JSONB)              │  │
│  │  • hashtags, optimal_times (JSONB)                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  🔒 RLS: All tables enforce auth.uid() = supabase_uuid     │
└─────────────────────────────────────────────────────────────┘
                               │
                               │ (Optional, when available)
                               ↓
┌─────────────────────────────────────────────────────────────┐
│           BACKEND API SERVER (Zeabur)                        │
│    xiaohongshu-automation-ai.zeabur.app                     │
│                                                              │
│  GET  /health                    - Health check             │
│  GET  /agent/xiaohongshu/login/status?userId=xxx           │
│  POST /agent/xiaohongshu/auto-login                        │
│  GET  /agent/auto/strategy/{userId}                        │
│  POST /agent/auto/start                                    │
│  GET  /agent/auto/status/{userId}                          │
│  POST /agent/auto/pause                                    │
│  POST /agent/auto/resume                                   │
│  GET  /agent/auto/stats/{userId}                           │
│  GET  /agent/auto/activity/{userId}                        │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow Sequences

### Sequence 1: Initial User Setup

```
User                Frontend              DB Service          Supabase           Backend API
 │                     │                     │                   │                  │
 │──Navigate /xhs─────>│                     │                   │                  │
 │                     │                     │                   │                  │
 │                     │──Check Auth────────>│                   │                  │
 │                     │<──User UUID─────────│                   │                  │
 │                     │                     │                   │                  │
 │                     │──Generate XHS ID────>│                   │                  │
 │                     │<──user_xxx_prome────│                   │                  │
 │                     │                     │                   │                  │
 │                     │──Save Mapping──────>│────INSERT────────>│                  │
 │                     │<──Success───────────│<─────OK───────────│                  │
 │                     │                     │                   │                  │
 │                     │──Health Check───────┼───────────────────┼─────GET /health──>│
 │                     │<──Offline───────────┼───────────────────┼────Error─────────│
 │                     │                     │                   │                  │
 │<──Show Setup UI─────│                     │                   │                  │
 │<──Warning: Offline──│                     │                   │                  │
 │                     │                     │                   │                  │
```

### Sequence 2: Save Configuration (Backend Online)

```
User                Frontend              DB Service          Supabase           Backend API
 │                     │                     │                   │                  │
 │──Fill Form─────────>│                     │                   │                  │
 │──Click Save────────>│                     │                   │                  │
 │                     │                     │                   │                  │
 │                     │──Save Profile──────>│────UPSERT────────>│                  │
 │                     │<──Success───────────│<─────OK───────────│                  │
 │                     │                     │                   │                  │
 │                     │──Log Activity──────>│────INSERT────────>│                  │
 │                     │<──Success───────────│<─────OK───────────│                  │
 │                     │                     │                   │                  │
 │                     │──Start Auto────────────────────────────────POST /auto/start>│
 │                     │<──Running──────────────────────────────────────200 OK──────│
 │                     │                     │                   │                  │
 │                     │──Update Status─────>│────UPSERT────────>│                  │
 │                     │<──Success───────────│<─────OK───────────│                  │
 │                     │                     │                   │                  │
 │<──Toast: Started!───│                     │                   │                  │
 │                     │                     │                   │                  │
```

### Sequence 3: Save Configuration (Backend Offline)

```
User                Frontend              DB Service          Supabase           Backend API
 │                     │                     │                   │                  │
 │──Fill Form─────────>│                     │                   │                  │
 │──Click Save────────>│                     │                   │                  │
 │                     │                     │                   │                  │
 │                     │──Save Profile──────>│────UPSERT────────>│                  │
 │                     │<──Success───────────│<─────OK───────────│                  │
 │                     │                     │                   │                  │
 │                     │──Log Activity──────>│────INSERT────────>│                  │
 │                     │<──Success───────────│<─────OK───────────│                  │
 │                     │                     │                   │                  │
 │                     │──Start Auto────────────────────────────────POST (timeout)──X│
 │                     │<──Error─────────────────────────────────────────────────────│
 │                     │                     │                   │                  │
 │                     │──Update Status─────>│────UPSERT────────>│                  │
 │                     │  (not running)      │                   │                  │
 │                     │<──Success───────────│<─────OK───────────│                  │
 │                     │                     │                   │                  │
 │<──Toast: Saved,─────│                     │                   │                  │
 │   Backend Offline   │                     │                   │                  │
 │                     │                     │                   │                  │
```

### Sequence 4: Load Existing Configuration

```
User                Frontend              DB Service          Supabase           Backend API
 │                     │                     │                   │                  │
 │──Navigate /xhs─────>│                     │                   │                  │
 │                     │                     │                   │                  │
 │                     │──Load Profile──────>│────SELECT────────>│                  │
 │                     │<──Config Data───────│<────Result────────│                  │
 │                     │                     │                   │                  │
 │                     │──Load Status───────>│────SELECT────────>│                  │
 │                     │<──Status Data───────│<────Result────────│                  │
 │                     │                     │                   │                  │
 │                     │──Load Activities───>│────SELECT────────>│                  │
 │                     │<──Activity List─────│<────Result────────│                  │
 │                     │                     │                   │                  │
 │<──Show Dashboard────│                     │                   │                  │
 │   (with saved data) │                     │                   │                  │
 │                     │                     │                   │                  │
 │                     │──Health Check───────┼───────────────────┼─────GET /health──>│
 │                     │<──Available─────────┼───────────────────┼────200 OK────────│
 │                     │                     │                   │                  │
 │                     │──Sync Status────────┼───────────────────┼──GET /status/xxx─>│
 │                     │<──Live Data─────────┼───────────────────┼────200 OK────────│
 │                     │                     │                   │                  │
 │                     │──Update DB─────────>│────UPSERT────────>│                  │
 │                     │<──Success───────────│<─────OK───────────│                  │
 │                     │                     │                   │                  │
 │<──Refresh UI────────│                     │                   │                  │
 │   (with live data)  │                     │                   │                  │
 │                     │                     │                   │                  │
```

## 🎭 State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTOMATION STATES                         │
└─────────────────────────────────────────────────────────────┘

    ┌─────────────┐
    │   Initial   │
    │   Loading   │
    └──────┬──────┘
           │
           ↓
    ┌─────────────┐
    │   Not       │←──────────────────────┐
    │ Configured  │                       │
    └──────┬──────┘                       │
           │                              │
           │ User fills config            │
           │ Click "Save"                 │ handleResetConfig()
           ↓                              │
    ┌─────────────┐                       │
    │ Config      │                       │
    │ Saved       │                       │
    │ (Not Login) │                       │
    └──────┬──────┘                       │
           │                              │
           │ Scan QR code                 │
           │ Login success                │
           ↓                              │
    ┌─────────────┐                       │
    │  Logged In  │                       │
    │  Ready      │                       │
    └──────┬──────┘                       │
           │                              │
           │ Click "Start"                │
           ↓                              │
    ┌─────────────┐                       │
    │  Running    │───────────────────────┘
    │  Active     │
    └──────┬──────┘
           │
           │ Click "Pause"
           ↓
    ┌─────────────┐
    │  Paused     │
    └──────┬──────┘
           │
           │ Click "Resume"
           └───────────┐
                       │
           ┌───────────┘
           ↓
    (Back to Running)
```

## 🛡️ Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   SECURITY LAYERS                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Frontend Authentication Check                      │
│  • useAuth() hook validates user                            │
│  • Redirects to /login if not authenticated                 │
│  • User object contains UUID                                │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Automatic UUID Association                         │
│  • All DB operations use user.id (Supabase UUID)            │
│  • No manual user ID input required                         │
│  • XHS user ID generated deterministically                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Row Level Security (RLS)                           │
│  • Enabled on all xhs_* tables                              │
│  • Policy: supabase_uuid = auth.uid()                       │
│  • Enforced at database level                               │
│  • Impossible to bypass from client                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Type Safety                                         │
│  • TypeScript interfaces for all data                       │
│  • Compile-time checks                                      │
│  • No raw SQL in frontend                                   │
│  • Parameterized queries via Supabase client                │
└─────────────────────────────────────────────────────────────┘

Result: Each user can ONLY access their own data
        Cross-user data access is impossible
        Admin access requires separate service account
```

---

**Visual Guide Version:** 1.0
**Last Updated:** 2025-10-31
