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
 * Save user message and assistant response to the database
 */
export async function saveMessages(
  supabase: SupabaseClient,
  conversationId: string,
  userMessage: string,
  difyResponse: DifyResponseData
): Promise<void> {
  try {
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
      return;
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
      return;
    }

    console.log('✅ Messages saved successfully');
  } catch (error) {
    console.error('Error in saveMessages:', error);
  }
}