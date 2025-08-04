-- Add conversations and messages tables for Dify chat integration
-- This migration creates the missing tables referenced in server.js

-- Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dify_conversation_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table  
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    dify_message_id TEXT,
    token_usage JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_dify_id ON public.conversations(dify_conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_dify_id ON public.messages(dify_message_id);

-- Add Row Level Security (RLS)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create policies for conversations table
CREATE POLICY "Users can view all conversations" ON public.conversations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update conversations" ON public.conversations FOR UPDATE TO authenticated USING (true);

-- Create policies for messages table  
CREATE POLICY "Users can view all messages" ON public.messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated, anon;
GRANT SELECT, INSERT ON public.messages TO authenticated, anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;