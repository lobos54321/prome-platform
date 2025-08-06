# DIFY ChatFlow Conversation Fix

## Problem Fixed
- DIFY ChatFlow `dialogue_count` was always 0, preventing progression to the second node
- Each message created a new conversation instead of continuing the existing one

## Root Cause
DIFY ChatFlow streaming responses don't send `message_end` or `[DONE]` events, but the existing code only saved `conversation_id` when these events were received. Without a saved `conversation_id`, each request started a new DIFY conversation.

## Solution Applied
1. **Capture conversation_id from any stream event** (node_started, message, etc.)
2. **Save conversation_id after stream completion** even without message_end event
3. **Applied to both streaming endpoints** for consistency

## Code Changes Made
- Added `currentConversationId` tracking variable in streaming response handlers
- Added conversation_id capture: `if (parsed.conversation_id) { currentConversationId = parsed.conversation_id; }`
- Added fallback save after stream completion in both streaming API endpoints

## How to Test
1. Set up proper environment variables (DIFY_API_URL, DIFY_API_KEY, Supabase config)
2. Send first message to `/api/dify/{conversationId}/stream`
3. Check server logs for: "Saving conversation_id after stream completion"  
4. Send second message with same conversationId
5. Check server logs for: "Using existing Dify conversation ID"
6. Verify in DIFY response that `dialogue_count` is now > 0

## Expected Behavior
- **First message**: Creates new conversation, saves conversation_id to database
- **Second message**: Reuses saved conversation_id, DIFY returns `dialogue_count: 1`
- **ChatFlow**: Can now progress from first node to second node based on dialogue_count

## File Modified
- `server.js` - Both streaming API endpoints around lines 820 and 1130

## Testing Script
Run `node test-mock-fix.js` to verify the conversation_id capture logic with mock data.