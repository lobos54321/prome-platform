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
 * Ensure conversation exists before saving messages
 */
export async function ensureConversationExists(
  supabase: SupabaseClient,
  conversationId: string,
  difyConversationId?: string | null,
  userId?: string | null
): Promise<void> {
  try {
    // Check if conversation already exists
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('id, dify_conversation_id')
      .eq('id', conversationId)
      .single();

    if (existingConversation) {
      // Update dify_conversation_id if provided and not already set
      if (difyConversationId && !existingConversation.dify_conversation_id) {
        const { error: updateError } = await supabase
          .from('conversations')
          .update({ 
            dify_conversation_id: difyConversationId,
            updated_at: new Date().toISOString()
          })
          .eq('id', conversationId);

        if (updateError) {
          console.error('Error updating conversation mapping:', updateError);
        } else {
          console.log('✅ Updated conversation mapping with Dify ID');
        }
      }
      return;
    }

    // Create new conversation record
    const { error: insertError } = await supabase
      .from('conversations')
      .insert({
        id: conversationId,
        dify_conversation_id: difyConversationId,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Error creating conversation record:', insertError);
      throw insertError;
    } else {
      console.log('✅ Created new conversation record');
    }
  } catch (error) {
    console.error('Error in ensureConversationExists:', error);
    throw error;
  }
}

/**
 * Save user message and assistant response to the database
 * NOTE: This function expects the conversation to already exist
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
      throw userError;
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
      throw assistantError;
    }

    console.log('✅ Messages saved successfully');
  } catch (error) {
    console.error('Error in saveMessages:', error);
    throw error;
  }
}

/**
 * Combined function to ensure conversation exists and save messages in one transaction
 */
export async function ensureConversationAndSaveMessages(
  supabase: SupabaseClient,
  conversationId: string,
  userMessage: string,
  difyResponse: DifyResponseData,
  userId?: string | null
): Promise<void> {
  try {
    // First ensure conversation exists
    await ensureConversationExists(supabase, conversationId, difyResponse.conversation_id, userId);
    
    // Then save messages
    await saveMessages(supabase, conversationId, userMessage, difyResponse);
  } catch (error) {
    console.error('Error in ensureConversationAndSaveMessages:', error);
    throw error;
  }
}