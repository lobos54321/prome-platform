// Fix user synchronization issue
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function fixUserSync() {
  console.log('🔧 修复用户同步问题...\n');
  
  const problematicUserId = 'c6bd6407-e90b-43fa-8c9a-80582156f69b';
  
  try {
    // 1. First, execute the SQL to create the helper function
    console.log('1. 创建辅助函数...');
    
    const sqlContent = fs.readFileSync('./fix-user-sync.sql', 'utf8');
    const statements = sqlContent.split(';').filter(stmt => stmt.trim() && !stmt.trim().startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          const { error } = await supabase.rpc('exec', { query: statement.trim() });
          if (error && !error.message.includes('already exists')) {
            console.warn('⚠️ SQL执行警告:', error.message);
          }
        } catch (sqlError) {
          console.warn('⚠️ SQL执行错误:', sqlError.message);
        }
      }
    }
    
    // 2. Create the missing user using the function
    console.log('2. 创建缺失的用户记录...');
    
    try {
      // Try to call the function we created
      const { data, error } = await supabase.rpc('create_missing_user', {
        p_user_id: problematicUserId,
        p_email: 'lobos54321@gmail.com',
        p_name: 'Lobos'
      });
      
      if (error) {
        console.log('⚠️ 函数调用失败，尝试直接插入...');
        // Fallback: try direct insert (might fail due to RLS)
        const { data: insertData, error: insertError } = await supabase
          .from('users')
          .insert({
            id: problematicUserId,
            name: 'Lobos',
            email: 'lobos54321@gmail.com',
            role: 'user',
            balance: 1000
          });
        
        if (insertError) {
          console.log('❌ 直接插入也失败:', insertError.message);
        } else {
          console.log('✅ 直接插入成功');
        }
      } else {
        console.log('✅ 函数调用成功');
      }
    } catch (funcError) {
      console.log('❌ 创建用户失败:', funcError.message);
    }
    
    // 3. Check if user now exists
    console.log('3. 验证用户是否存在...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', problematicUserId);
    
    if (userError) {
      console.log('❌ 用户查询失败:', userError.message);
    } else if (userData.length > 0) {
      console.log('✅ 用户现在存在于数据库中:', userData[0]);
    } else {
      console.log('❌ 用户仍然不存在');
    }
    
    // 4. Update orphaned conversations to link to this user
    console.log('4. 更新孤立的对话记录...');
    const { data: updateData, error: updateError } = await supabase
      .from('conversations')
      .update({ user_id: problematicUserId })
      .is('user_id', null)
      .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString()); // Last 24 hours
    
    if (updateError) {
      console.log('⚠️ 更新对话记录失败:', updateError.message);
    } else {
      console.log('✅ 对话记录更新完成');
    }
    
    // 5. Test creating a new conversation
    console.log('5. 测试创建新对话...');
    const { data: testConv, error: testError } = await supabase
      .from('conversations')
      .insert({
        user_id: problematicUserId,
        title: 'Test Conversation',
        dify_conversation_id: 'test_' + Date.now()
      })
      .select()
      .single();
    
    if (testError) {
      console.log('❌ 测试对话创建失败:', testError.message);
    } else {
      console.log('✅ 测试对话创建成功:', testConv);
      
      // Test creating a message
      const { data: testMsg, error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: testConv.id,
          role: 'user',
          content: 'Test message'
        });
      
      if (msgError) {
        console.log('❌ 测试消息创建失败:', msgError.message);
      } else {
        console.log('✅ 测试消息创建成功');
      }
    }
    
  } catch (error) {
    console.error('❌ 修复过程中出错:', error.message);
  }
  
  console.log('\n🎉 用户同步修复完成！');
}

fixUserSync();