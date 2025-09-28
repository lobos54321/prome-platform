DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'chat_conversations' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE chat_conversations ADD COLUMN user_id UUID;
        ALTER TABLE chat_conversations 
        ADD CONSTRAINT fk_chat_conversations_user_id 
        FOREIGN KEY (user_id) REFERENCES users(id);
        RAISE NOTICE 'Added user_id column to chat_conversations table';
    ELSE
        RAISE NOTICE 'user_id column already exists in chat_conversations table';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);

DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow anonymous conversations" ON chat_conversations;
    DROP POLICY IF EXISTS "Allow anonymous messages" ON chat_messages;
    DROP POLICY IF EXISTS "Users can access their own conversations" ON chat_conversations;
    DROP POLICY IF EXISTS "Users can access their own messages" ON chat_messages;
    DROP POLICY IF EXISTS "Allow device-based conversations" ON chat_conversations;
    DROP POLICY IF EXISTS "Allow device-based messages" ON chat_messages;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Some policies may not exist, continuing...';
END $$;

CREATE POLICY "Users can access their own conversations" ON chat_conversations
    FOR ALL TO authenticated 
    USING (user_id = auth.uid());

CREATE POLICY "Users can access their own messages" ON chat_messages
    FOR ALL TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM chat_conversations 
            WHERE chat_conversations.id = chat_messages.conversation_id 
            AND chat_conversations.user_id = auth.uid()
        )
    );

CREATE POLICY "Allow device-based conversations" ON chat_conversations
    FOR ALL TO anon 
    USING (user_id IS NULL);

CREATE POLICY "Allow device-based messages" ON chat_messages
    FOR ALL TO anon 
    USING (
        EXISTS (
            SELECT 1 FROM chat_conversations 
            WHERE chat_conversations.id = chat_messages.conversation_id 
            AND chat_conversations.user_id IS NULL
        )
    );