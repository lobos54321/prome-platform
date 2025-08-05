/**
 * Utility to save messages to Supabase database
 */
import { SupabaseClient } from '@supabase/supabase-js';

export interface DifyResponseData {
  answer: string;
  conversation_id: string;
  message_id: string;
  metadata?: {
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };
}

/**
 * Ensure conversation exists in the database
 */
async function ensureConversationExists(
  supabase: SupabaseClient,
  conversationId: string,
  difyConversationId?: string
): Promise<void> {
  try {
    // Check if conversation exists
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .single();

    if (!existing) {
      // Create conversation record
      const { error: conversationError } = await supabase
        .from('conversations')
        .insert({
          id: conversationId,
          dify_conversation_id: difyConversationId || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (conversationError) {
        console.error('Error creating conversation:', conversationError);
        throw new Error(`Failed to create conversation: ${conversationError.message}`);
      }
      
      console.log('✅ Conversation created successfully:', conversationId);
    }
  } catch (error) {
    console.error('Error ensuring conversation exists:', error);
    throw error;
  }
}

/**
 * Save user message and assistant response to the database
 */
export async function saveMessages(
  supabase: SupabaseClient,
  conversationId: string,
  userMessage: string,
  difyResponse: DifyResponseData
): Promise<void> {
  try {
    // First, ensure the conversation exists
    await ensureConversationExists(supabase, conversationId, difyResponse.conversation_id);

    // Save user message
    const { error: userError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: userMessage,
        created_at: new Date().toISOString()
      });

    if (userError) {
      console.error('Error saving user message:', userError);
      throw new Error(`Failed to save user message: ${userError.message}`);
    }

    // Save assistant message
    const { error: assistantError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: difyResponse.answer,
        dify_message_id: difyResponse.message_id,
        token_usage: difyResponse.metadata?.usage || null,
        created_at: new Date().toISOString()
      });

    if (assistantError) {
      console.error('Error saving assistant message:', assistantError);
      throw new Error(`Failed to save assistant message: ${assistantError.message}`);
    }

    console.log('✅ Messages saved successfully');
  } catch (error) {
    console.error('Error in saveMessages:', error);
    throw error;
  }
}