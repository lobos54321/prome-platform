# Admin Script Usage Guide

## Prerequisites

1. Set up environment variables in `.env`:
```bash
VITE_SUPABASE_URL=your_actual_supabase_url
VITE_SUPABASE_ANON_KEY=your_actual_supabase_anon_key
VITE_ENABLE_DIFY_INTEGRATION=true
```

## Adding Credits to Admin Account

To add 10000 credits to lobos54321@gmail.com:

```bash
cd admin-scripts
node add-credits.js lobos54321@gmail.com 10000 "Initial admin credits"
```

## Expected Output

✅ **Success Case:**
```
🚀 Adding credits to admin account...
📧 Email: lobos54321@gmail.com
💎 Credits: 10000
📝 Description: Initial admin credits

🔍 Looking for user with email: lobos54321@gmail.com
✅ Found user: [User Name] (ID: [user-id])
💰 Current balance: [current_balance] credits
✅ Balance updated to: [new_balance] credits
✅ Billing record created successfully
🎉 Successfully added 10000 credits to lobos54321@gmail.com
📊 New balance: [new_balance] credits

✅ Credits added successfully!
```

❌ **Error Cases:**
```
❌ Supabase configuration missing!
Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env

❌ User with email lobos54321@gmail.com not found

❌ Failed to update balance: [error_message]
```

## Testing the System

1. **Verify Pricing Page**: Navigate to `/pricing` - should show only recharge packages, no token calculator
2. **Test Model Management**: Go to `/admin` - should allow adding models with proper validation
3. **Test Token Monitoring**: Go to `/dify-test` - should show monitoring interface when Dify integration is enabled

## Troubleshooting

- If environment variables are not loading, check that `.env` file is in the root directory
- If Supabase connection fails, verify URL and key are correct
- If user not found, ensure the user has registered in the system first