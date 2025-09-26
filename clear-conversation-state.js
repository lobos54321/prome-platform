#!/usr/bin/env node

/**
 * 清除有问题的对话状态
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lfjslsygnitdgdnfboiy.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const problemConversationId = '2bdeea25-b770-410f-b4f0-27a6f1662600';

async function clearConversationState() {
  console.log('🧹 Clearing conversation state for:', problemConversationId);
  
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
    process.exit(1);
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    // 1. 查看当前状态
    console.log('\n🔍 Checking current conversation state...');
    const { data: conversation, error: fetchError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', problemConversationId)
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Error fetching conversation:', fetchError);
      return;
    }
    
    if (conversation) {
      console.log('📄 Current conversation record:');
      console.log('  ID:', conversation.id);
      console.log('  Dify ID:', conversation.dify_conversation_id);
      console.log('  User ID:', conversation.user_id);
      console.log('  Created:', conversation.created_at);
      
      // 2. 删除对话记录
      console.log('\n🗑️  Deleting conversation record...');
      const { error: deleteConvError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', problemConversationId);
      
      if (deleteConvError) {
        console.error('❌ Error deleting conversation:', deleteConvError);
      } else {
        console.log('✅ Conversation record deleted');
      }
      
      // 3. 删除相关消息
      console.log('\n🗑️  Deleting related messages...');
      const { error: deleteMsgError } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', problemConversationId);
      
      if (deleteMsgError) {
        console.error('❌ Error deleting messages:', deleteMsgError);
      } else {
        console.log('✅ Messages deleted');
      }
      
    } else {
      console.log('ℹ️  No conversation record found in database');
    }
    
    // 4. 创建一个测试用的新对话
    console.log('\n🆕 Creating test conversation...');
    const testConversationId = randomUUID();
    const testUserId = randomUUID();
    
    const { error: insertError } = await supabase
      .from('conversations')
      .insert({
        id: testConversationId,
        user_id: testUserId,
        dify_conversation_id: null,
        created_at: new Date().toISOString()
      });
    
    if (insertError) {
      console.error('❌ Error creating test conversation:', insertError);
    } else {
      console.log('✅ Test conversation created:', testConversationId);
      console.log('🔗 Test URL: https://prome.live/chat/dify?conversation=' + testConversationId);
    }
    
    console.log('\n✨ Cleanup completed!');
    console.log('💡 Suggestion: Clear browser localStorage and start a fresh conversation');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

clearConversationState().catch(console.error);