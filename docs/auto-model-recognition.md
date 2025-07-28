# ProMe Platform - Auto Model Recognition & Enhanced Features

## Overview

This document describes the enhanced ProMe platform with automatic model recognition, improved model management, and streamlined architecture focused on iframe monitoring.

## Key Features Implemented

### 1. Automatic Model Recognition

The `DifyIframeMonitor` now automatically detects and creates model configurations when new models are encountered in Dify `message_end` events.

#### How it works:
- When a `message_end` event contains an unknown model name
- The system automatically creates a model configuration with intelligent default pricing
- Default pricing is determined by model name patterns (GPT-4, Claude, Gemini, etc.)
- Auto-created models are marked with `autoCreated: true` flag
- Admins can later adjust pricing in the model management interface

#### Default Pricing Logic:
- **GPT-4 Turbo/4o**: $0.01 input, $0.03 output per 1K tokens
- **GPT-4**: $0.03 input, $0.06 output per 1K tokens  
- **GPT-3.5**: $0.001 input, $0.002 output per 1K tokens
- **Claude 3 Opus**: $0.015 input, $0.075 output per 1K tokens
- **Claude 3 Sonnet**: $0.003 input, $0.015 output per 1K tokens
- **Claude 3 Haiku**: $0.00025 input, $0.00125 output per 1K tokens
- **Gemini Pro**: $0.0005 input, $0.0015 output per 1K tokens
- **Local models** (Llama, Mistral, Qwen): $0.0002 input, $0.0006 output per 1K tokens
- **Unknown models**: $0.002 input, $0.006 output per 1K tokens (conservative default)

### 2. Enhanced Model Management

The model management system now supports multiple service types beyond AI models:

#### Service Types:
- **AI Model**: Traditional token-based AI models (default)
- **Digital Human**: Avatar/virtual human services
- **Workflow**: Fixed-cost workflow executions  
- **Custom**: Custom services with flexible pricing

#### Features:
- Service type categorization with icons and color coding
- Support for both token-based and fixed-cost pricing
- Auto-created model identification
- Enhanced UI with service type indicators

### 3. Simplified Architecture

#### Removed Components:
- Webhook-related code and configurations
- Redundant admin token calculator
- Complex webhook validation and processing
- Server-side webhook routes

#### Focused on:
- Iframe monitoring for real-time integration
- Direct client-side model detection
- Simplified admin interface
- Streamlined codebase

### 4. Admin Tools

#### Credit Management Script:
```bash
node admin-scripts/add-credits.js <email> <credits> [description]
```

Example:
```bash
node admin-scripts/add-credits.js lobos54321@gmail.com 10000 "Initial admin credits"
```

#### Testing Tools:
- Auto model recognition test script
- Console-based testing utilities
- Comprehensive logging and monitoring

## Database Schema Updates

### Enhanced model_configs table:
```sql
ALTER TABLE model_configs
ADD COLUMN service_type TEXT DEFAULT 'ai_model',
ADD COLUMN workflow_cost DECIMAL(10, 6) DEFAULT NULL,
ADD COLUMN auto_created BOOLEAN DEFAULT false;
```

### Service types constraint:
```sql
CHECK (service_type IN ('ai_model', 'digital_human', 'workflow', 'custom'))
```

## Configuration

### Environment Variables:
```bash
# Required for database access
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key

# Optional - enables Dify integration features  
VITE_ENABLE_DIFY_INTEGRATION=true
```

### Dify Setup:
1. Configure Dify to send `message_end` events via iframe postMessage
2. Ensure iframe origins are included in valid origins list
3. No webhook configuration needed

## Usage Workflow

### For End Users:
1. Use Dify services embedded in iframe
2. Token consumption is automatically monitored
3. Credits are deducted in real-time
4. New models are automatically supported

### For Admins:
1. Monitor new auto-detected models in admin panel
2. Adjust pricing for auto-created models as needed
3. Create custom service configurations
4. Monitor consumption and manage user credits

## API Integration Points

### DifyIframeMonitor Events:
- `onTokenConsumption`: Fired when tokens are consumed
- `onBalanceUpdate`: Fired when user balance changes  
- `onNewModelDetected`: Fired when new model is auto-created

### Model Configuration:
- Automatic model detection and creation
- Real-time price updates
- Service type management
- Active/inactive model toggles

## Testing

### Manual Testing:
1. Load the platform with Dify iframe integration
2. Use different AI models in Dify
3. Verify auto-detection in admin panel
4. Check token consumption monitoring

### Automated Testing:
```javascript
// Run in browser console
testAutoModelRecognition()
```

## Monitoring & Logging

### Console Logs:
- Model detection events
- Token consumption processing
- Balance updates
- Error conditions

### Admin Dashboard:
- Real-time consumption monitoring
- Model usage statistics
- Auto-created model alerts
- Credit balance tracking

## Troubleshooting

### Common Issues:

1. **Models not auto-detected**:
   - Check iframe origin permissions
   - Verify VITE_ENABLE_DIFY_INTEGRATION=true
   - Check console for errors

2. **Credit deduction failures**:
   - Verify user has sufficient balance
   - Check model configuration exists
   - Review token consumption logs

3. **Admin access issues**:
   - Ensure user has admin role in database
   - Check authentication state
   - Verify environment configuration

### Debug Tools:
- Browser console logs
- Network request monitoring
- Database query logs
- Admin panel diagnostics