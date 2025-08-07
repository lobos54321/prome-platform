// Check conversations in database
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkConversations() {
  console.log('🔍 检查数据库中的对话记录...\n');
  
  try {
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('id, dify_conversation_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('❌ 查询错误:', error);
      return;
    }
    
    console.log(`📊 找到 ${conversations.length} 条对话记录:`);
    conversations.forEach((conv, index) => {
      console.log(`${index + 1}. ID: ${conv.id}`);
      console.log(`   DIFY ID: ${conv.dify_conversation_id || '未保存'}`);
      console.log(`   创建时间: ${new Date(conv.created_at).toLocaleString()}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  }
}

checkConversations();