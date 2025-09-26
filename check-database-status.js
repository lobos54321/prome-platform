// Check database status and data
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkDatabaseStatus() {
  console.log('🔍 检查数据库状态...\n');
  
  try {
    // Check users table
    const { count: userCount, error: userError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    if (userError) {
      console.log('❌ Users表错误:', userError.message);
    } else {
      console.log(`✅ Users表: ${userCount} 个用户`);
    }
    
    // Check a sample user if exists
    const { data: sampleUser, error: sampleError } = await supabase
      .from('users')
      .select('*')
      .limit(1)
      .single();
    
    if (!sampleError && sampleUser) {
      console.log(`📄 样本用户: ${sampleUser.email}, 余额: ${sampleUser.balance}`);
    }
    
    // Check token usage
    const { count: tokenCount, error: tokenError } = await supabase
      .from('token_usage')
      .select('*', { count: 'exact', head: true });
    
    if (tokenError) {
      console.log('❌ Token使用记录错误:', tokenError.message);
    } else {
      console.log(`✅ Token使用记录: ${tokenCount} 条`);
    }
    
    // Check model configs
    const { data: models, error: modelsError } = await supabase
      .from('model_configs')
      .select('model_name, input_token_price, output_token_price, is_active');
    
    if (modelsError) {
      console.log('❌ 模型配置错误:', modelsError.message);
    } else {
      console.log(`✅ 模型配置: ${models.length} 个模型`);
      models.forEach(model => {
        console.log(`   - ${model.model_name}: 输入$${model.input_token_price}/1k, 输出$${model.output_token_price}/1k (${model.is_active ? '激活' : '禁用'})`);
      });
    }
    
    // Check exchange rate
    const { data: rate, error: rateError } = await supabase
      .from('exchange_rates')
      .select('rate')
      .eq('is_active', true)
      .single();
    
    if (rateError) {
      console.log('❌ 汇率配置错误:', rateError.message);
    } else {
      console.log(`✅ 当前汇率: 1 USD = ${rate.rate} 积分`);
    }
    
    // Check billing records
    const { count: billingCount, error: billingError } = await supabase
      .from('billing_records')
      .select('*', { count: 'exact', head: true });
    
    if (billingError) {
      console.log('❌ 账单记录错误:', billingError.message);
    } else {
      console.log(`✅ 账单记录: ${billingCount} 条`);
    }
    
    console.log('\n🎉 数据库状态检查完成！');
    
  } catch (error) {
    console.error('❌ 检查数据库状态时出错:', error.message);
  }
}

checkDatabaseStatus();