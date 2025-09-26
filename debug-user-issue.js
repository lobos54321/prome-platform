// Debug user authentication and database sync issue
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function debugUserIssue() {
  console.log('🔍 调试用户认证和数据库同步问题...\n');
  
  const problematicUserId = 'c6bd6407-e90b-43fa-8c9a-80582156f69b';
  
  try {
    // 1. 检查用户是否存在于users表
    console.log('1. 检查用户是否存在于users表:');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', problematicUserId);
    
    if (userError) {
      console.log('❌ 查询users表出错:', userError.message);
    } else {
      console.log(`✅ Users表查询结果: ${userData.length} 条记录`);
      if (userData.length === 0) {
        console.log('⚠️ 用户在数据库中不存在！');
      } else {
        console.log('📄 用户信息:', userData[0]);
      }
    }
    
    // 2. 检查所有用户
    console.log('\n2. 检查所有用户:');
    const { data: allUsers, error: allUsersError } = await supabase
      .from('users')
      .select('id, email, name, created_at');
    
    if (allUsersError) {
      console.log('❌ 查询所有用户出错:', allUsersError.message);
    } else {
      console.log(`✅ 数据库中共有 ${allUsers.length} 个用户:`);
      allUsers.forEach(user => {
        console.log(`   - ${user.id}: ${user.email} (${user.name})`);
      });
    }
    
    // 3. 检查conversations表结构
    console.log('\n3. 检查conversations表:');
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .limit(5);
    
    if (convError) {
      console.log('❌ 查询conversations表出错:', convError.message);
    } else {
      console.log(`✅ Conversations表查询成功，共 ${conversations.length} 条记录`);
      if (conversations.length > 0) {
        console.log('📄 样本对话:', conversations[0]);
      }
    }
    
    // 4. 检查messages表结构
    console.log('\n4. 检查messages表:');
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .limit(5);
    
    if (msgError) {
      console.log('❌ 查询messages表出错:', msgError.message);
    } else {
      console.log(`✅ Messages表查询成功，共 ${messages.length} 条记录`);
      if (messages.length > 0) {
        console.log('📄 样本消息:', messages[0]);
      }
    }
    
    // 5. 检查auth用户
    console.log('\n5. 尝试检查auth系统中的用户:');
    try {
      // Note: 这需要service_role key才能查看所有用户，这里只是尝试
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
      if (authError) {
        console.log('⚠️ 无法查询auth用户 (需要service_role权限):', authError.message);
      } else {
        console.log(`✅ Auth系统中有 ${authData.users.length} 个用户`);
      }
    } catch (authErr) {
      console.log('⚠️ 无法查询auth用户:', authErr.message);
    }
    
    // 6. 创建测试用户来修复问题
    console.log('\n6. 尝试创建缺失的用户记录:');
    try {
      const { data: insertData, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            id: problematicUserId,
            name: 'Test User',
            email: 'test@example.com',
            role: 'user',
            balance: 1000,
          }
        ])
        .select()
        .single();
      
      if (insertError) {
        console.log('❌ 创建用户记录失败:', insertError.message);
      } else {
        console.log('✅ 成功创建用户记录:', insertData);
      }
    } catch (insertErr) {
      console.log('❌ 创建用户记录出错:', insertErr.message);
    }
    
  } catch (error) {
    console.error('❌ 调试过程中出错:', error.message);
  }
  
  console.log('\n🎉 调试完成！');
}

debugUserIssue();