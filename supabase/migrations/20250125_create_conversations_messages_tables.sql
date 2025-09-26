-- Create missing conversations and messages tables to fix foreign key constraint errors
-- This migration addresses the core issue preventing workflow execution

-- Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dify_conversation_id TEXT UNIQUE, -- Dify API conversation ID (can be null for new conversations)
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- Optional: link to user if authenticated
    title TEXT, -- Optional: conversation title
    metadata JSONB DEFAULT '{}', -- Additional conversation metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    dify_message_id TEXT, -- For assistant messages, store Dify's message ID
    token_usage JSONB, -- Store token usage information
    metadata JSONB DEFAULT '{}', -- Additional message metadata (response time, model used, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_dify_id ON public.conversations(dify_conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_role ON public.messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_dify_message_id ON public.messages(dify_message_id);

-- Enable Row Level Security
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for conversations
-- Users can view conversations they own or public conversations
CREATE POLICY "Users can view own conversations" ON public.conversations 
    FOR SELECT USING (
        user_id IS NULL OR user_id = auth.uid()
    );

-- Users can insert conversations (for anonymous users, user_id will be null)
CREATE POLICY "Users can create conversations" ON public.conversations 
    FOR INSERT WITH CHECK (
        user_id IS NULL OR user_id = auth.uid()
    );

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations" ON public.conversations 
    FOR UPDATE USING (
        user_id IS NULL OR user_id = auth.uid()
    );

-- Create RLS policies for messages
-- Users can view messages from conversations they have access to
CREATE POLICY "Users can view messages from accessible conversations" ON public.messages 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversations c 
            WHERE c.id = conversation_id 
            AND (c.user_id IS NULL OR c.user_id = auth.uid())
        )
    );

-- Users can insert messages into conversations they have access to
CREATE POLICY "Users can insert messages into accessible conversations" ON public.messages 
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.conversations c 
            WHERE c.id = conversation_id 
            AND (c.user_id IS NULL OR c.user_id = auth.uid())
        )
    );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated, anon;
GRANT SELECT, INSERT ON public.messages TO authenticated, anon;

-- Create function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at on conversations
CREATE TRIGGER update_conversations_updated_at 
    BEFORE UPDATE ON public.conversations 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert a comment to track this migration
COMMENT ON TABLE public.conversations IS 'Stores conversation mappings between internal IDs and Dify conversation IDs';
COMMENT ON TABLE public.messages IS 'Stores all messages exchanged in conversations with role-based access';
COMMENT ON COLUMN public.conversations.dify_conversation_id IS 'External Dify API conversation identifier, null for new conversations';
COMMENT ON COLUMN public.messages.conversation_id IS 'Foreign key reference to conversations table';
COMMENT ON COLUMN public.messages.role IS 'Message role: user, assistant, or system';
COMMENT ON COLUMN public.messages.token_usage IS 'JSON object containing token usage statistics';