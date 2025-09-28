-- Safe database migration script
-- Purpose: Add user_id column to chat_conversations table to fix conversation history saving issue
-- Date: 2025-09-27

-- Step 1: Check current table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'chat_conversations' 
ORDER BY ordinal_position;

-- Step 2: Add user_id column if it does not exist
ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS user_id UUID;

-- Step 3: Create foreign key constraint if users table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE chat_conversations 
        ADD CONSTRAINT fk_chat_conversations_user_id 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Step 4: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id 
ON chat_conversations(user_id);

-- Step 5: Add column comment
COMMENT ON COLUMN chat_conversations.user_id IS 'User ID for authenticated conversations (NULL for anonymous)';

-- Step 6: Verify migration result
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'chat_conversations' 
AND column_name = 'user_id';