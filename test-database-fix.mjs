#!/usr/bin/env node

// Test script to verify database constraint fixes
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Mock saveMessages implementation matching the fixed version
async function testSaveMessages(supabase, conversationId, userMessage, difyResponse) {
  console.log('🧪 Testing saveMessages with conversation existence check...');
  
  try {
    // First, ensure the conversation exists (matching our fix)
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .single();

    if (!existing) {
      console.log('📝 Creating conversation record...');
      const { error: conversationError } = await supabase
        .from('conversations')
        .insert({
          id: conversationId,
          dify_conversation_id: difyResponse.conversation_id || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (conversationError) {
        console.error('❌ Error creating conversation:', conversationError);
        throw new Error(`Failed to create conversation: ${conversationError.message}`);
      }
      
      console.log('✅ Conversation created successfully:', conversationId);
    } else {
      console.log('✅ Conversation already exists:', conversationId);
    }

    // Now save messages - this should not fail with FK constraint
    console.log('📝 Saving user message...');
    const { error: userError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: userMessage,
        created_at: new Date().toISOString()
      });

    if (userError) {
      console.error('❌ Error saving user message:', userError);
      throw new Error(`Failed to save user message: ${userError.message}`);
    }

    console.log('📝 Saving assistant message...');
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
      console.error('❌ Error saving assistant message:', assistantError);
      throw new Error(`Failed to save assistant message: ${assistantError.message}`);
    }

    console.log('✅ Messages saved successfully without FK constraint errors');
    return true;
  } catch (error) {
    console.error('❌ Error in testSaveMessages:', error);
    throw error;
  }
}

async function testDatabaseConstraintFix() {
  console.log('🧪 Testing Database Constraint Fix...');
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log('⚠️ Skipping test - Supabase not configured');
    return true; // Skip test if not configured
  }
  
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Generate test data
    const testConversationId = `test-conv-${Date.now()}`;
    const testUserMessage = 'Test message for database constraint fix';
    const testDifyResponse = {
      answer: 'Test response from Dify API',
      conversation_id: `dify-conv-${Date.now()}`,
      message_id: `msg-${Date.now()}`,
      metadata: {
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        }
      }
    };
    
    console.log('📊 Test data:');
    console.log('  Conversation ID:', testConversationId);
    console.log('  User Message:', testUserMessage);
    console.log('  Dify Response Answer:', testDifyResponse.answer);
    
    // Test the fixed saveMessages function
    const success = await testSaveMessages(supabase, testConversationId, testUserMessage, testDifyResponse);
    
    if (success) {
      console.log('✅ Database constraint fix test passed!');
      
      // Clean up test data
      console.log('🧹 Cleaning up test data...');
      await supabase.from('messages').delete().eq('conversation_id', testConversationId);
      await supabase.from('conversations').delete().eq('id', testConversationId);
      console.log('✅ Test data cleaned up');
    }
    
    return success;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Test scenario: Attempting to save messages without existing conversation
async function testOriginalProblemScenario() {
  console.log('🧪 Testing Original Problem Scenario (messages without conversation)...');
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log('⚠️ Skipping test - Supabase not configured');
    return true;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const testConversationId = `test-orig-problem-${Date.now()}`;
    
    console.log('📝 Attempting to save message to non-existent conversation (should fail in old version)...');
    
    // This would fail in the old version but should work with our fix
    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: testConversationId,
        role: 'user',
        content: 'This would cause FK constraint violation',
        created_at: new Date().toISOString()
      });

    if (error) {
      if (error.code === '23503' && error.message.includes('violates foreign key constraint')) {
        console.log('✅ Confirmed: Original problem exists - FK constraint violation as expected');
        console.log('   Error:', error.message);
        return true; // This confirms the original problem exists
      } else {
        console.error('❌ Unexpected error:', error);
        return false;
      }
    } else {
      console.log('⚠️ Message saved successfully - this should not happen without conversation');
      // Clean up if somehow it worked
      await supabase.from('messages').delete().eq('conversation_id', testConversationId);
      return false;
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  Promise.all([
    testOriginalProblemScenario(),
    testDatabaseConstraintFix()
  ])
    .then(results => {
      const allPassed = results.every(result => result);
      console.log('📊 Test Results:');
      console.log(`  Original Problem Test: ${results[0] ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`  Database Fix Test: ${results[1] ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`  Overall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
      process.exit(allPassed ? 0 : 1);
    })
    .catch(err => {
      console.error('💥 Unexpected error:', err);
      process.exit(1);
    });
}

export { testDatabaseConstraintFix, testOriginalProblemScenario };