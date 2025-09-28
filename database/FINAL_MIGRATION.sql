ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS user_id UUID;

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);

SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'chat_conversations' AND column_name = 'user_id';