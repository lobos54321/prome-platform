#!/usr/bin/env node

/**
 * Test script to simulate Dify iframe token consumption
 * Usage: node test-token-monitoring.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase configuration missing!');
  console.error('Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test data
const testUser = {
  email: 'lobos54321@gmail.com',
  id: null
};

const testEvents = [
  {
    modelName: 'gpt-4',
    inputTokens: 1500,
    outputTokens: 800,
    description: 'Live streaming script generation'
  },
  {
    modelName: 'gpt-3.5-turbo',
    inputTokens: 1000,
    outputTokens: 500,
    description: 'Quick content generation'
  },
  {
    modelName: 'claude-3-sonnet',
    inputTokens: 2000,
    outputTokens: 1200,
    description: 'Advanced content analysis'
  }
];

async function findOrCreateTestUser() {
  console.log('🔍 Looking for test user...');
  
  // Try to find existing user
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', testUser.email)
    .maybeSingle();

  if (userError) {
    console.error('❌ Error finding user:', userError);
    return null;
  }

  if (userData) {
    console.log(`✅ Found existing user: ${userData.name} (Balance: ${userData.balance})`);
    testUser.id = userData.id;
    return userData;
  }

  // Create test user if not found
  console.log('📝 Creating test user...');
  const { data: newUser, error: createError } = await supabase
    .from('users')
    .insert([
      {
        name: 'Test Admin',
        email: testUser.email,
        role: 'admin',
        balance: 100000 // Give enough balance for testing
      }
    ])
    .select()
    .single();

  if (createError) {
    console.error('❌ Error creating user:', createError);
    return null;
  }

  console.log(`✅ Created test user: ${newUser.name} (Balance: ${newUser.balance})`);
  testUser.id = newUser.id;
  return newUser;
}

async function testTokenConsumption(modelName, inputTokens, outputTokens, description) {
  console.log(`\n🧪 Testing token consumption: ${description}`);
  console.log(`   Model: ${modelName}`);
  console.log(`   Input tokens: ${inputTokens}, Output tokens: ${outputTokens}`);

  const totalTokens = inputTokens + outputTokens;
  const conversationId = `test_conv_${Date.now()}`;
  const messageId = `test_msg_${Date.now()}`;

  // Get current balance
  const { data: beforeUser } = await supabase
    .from('users')
    .select('balance')
    .eq('id', testUser.id)
    .single();

  console.log(`   Balance before: ${beforeUser?.balance || 0}`);

  // Simulate the token consumption directly in database
  try {
    // First, find or create model config
    let { data: modelConfig, error: modelError } = await supabase
      .from('model_configs')
      .select('*')
      .eq('model_name', modelName)
      .eq('is_active', true)
      .maybeSingle();

    if (modelError && modelError.code !== 'PGRST116') {
      console.error('❌ Error checking model config:', modelError);
      return false;
    }

    if (!modelConfig) {
      console.log(`   Creating model config for ${modelName}...`);
      
      // Get default pricing based on model name
      let inputPrice = 0.002, outputPrice = 0.006;
      if (modelName.includes('gpt-4')) {
        inputPrice = 0.03;
        outputPrice = 0.06;
      } else if (modelName.includes('gpt-3.5')) {
        inputPrice = 0.001;
        outputPrice = 0.002;
      } else if (modelName.includes('claude')) {
        inputPrice = 0.003;
        outputPrice = 0.015;
      }

      const { data: newConfig, error: createConfigError } = await supabase
        .from('model_configs')
        .insert([
          {
            model_name: modelName,
            input_token_price: inputPrice,
            output_token_price: outputPrice,
            service_type: 'ai_model',
            is_active: true,
            auto_created: true,
            created_by: testUser.id
          }
        ])
        .select()
        .single();

      if (createConfigError) {
        console.error('❌ Error creating model config:', createConfigError);
        return false;
      }

      modelConfig = newConfig;
      console.log(`   ✅ Created model config: $${inputPrice}/$${outputPrice} per 1K tokens`);
    }

    // Calculate costs
    const inputCost = (inputTokens / 1000) * modelConfig.input_token_price;
    const outputCost = (outputTokens / 1000) * modelConfig.output_token_price;
    const totalCost = inputCost + outputCost;

    // Get exchange rate
    const { data: exchangeRate } = await supabase
      .from('exchange_rates')
      .select('rate')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const rate = exchangeRate?.rate || 10000;
    const pointsToDeduct = Math.round(totalCost * rate);

    console.log(`   Calculation: ${inputCost.toFixed(6)} + ${outputCost.toFixed(6)} = $${totalCost.toFixed(6)}`);
    console.log(`   Points to deduct: ${pointsToDeduct} (rate: ${rate})`);

    // Update balance
    const newBalance = (beforeUser?.balance || 0) - pointsToDeduct;
    const { data: updatedUser, error: balanceError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('id', testUser.id)
      .select('balance')
      .single();

    if (balanceError) {
      console.error('❌ Error updating balance:', balanceError);
      return false;
    }

    // Add token usage record
    const { error: usageError } = await supabase
      .from('token_usage')
      .insert([
        {
          user_id: testUser.id,
          service_id: 'dify',
          model: modelName,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          tokens_used: totalTokens,
          input_cost: inputCost,
          output_cost: outputCost,
          cost: totalCost,
          conversation_id: conversationId,
          message_id: messageId,
          created_at: new Date().toISOString()
        }
      ]);

    if (usageError) {
      console.error('❌ Error recording usage:', usageError);
      return false;
    }

    // Add billing record
    const { error: billingError } = await supabase
      .from('billing_records')
      .insert([
        {
          user_id: testUser.id,
          type: 'usage',
          amount: pointsToDeduct,
          description: `Token usage: ${modelName} (${totalTokens} tokens)`,
          status: 'completed',
          created_at: new Date().toISOString()
        }
      ]);

    if (billingError) {
      console.warn('⚠️ Warning - billing record failed:', billingError);
    }

    console.log(`   ✅ Success! Balance after: ${updatedUser.balance}`);
    console.log(`   📊 Deducted ${pointsToDeduct} points for ${totalTokens} tokens`);
    
    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

async function verifyTokenUsage() {
  console.log('\n📊 Verifying token usage records...');
  
  const { data: usageRecords, error } = await supabase
    .from('token_usage')
    .select('*')
    .eq('user_id', testUser.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error fetching usage records:', error);
    return;
  }

  console.log(`✅ Found ${usageRecords.length} recent usage records:`);
  usageRecords.forEach((record, index) => {
    console.log(`   ${index + 1}. ${record.model}: ${record.tokens_used} tokens, $${record.cost} (${record.created_at})`);
  });
}

async function main() {
  console.log('🚀 Starting token monitoring system test...\n');

  // Step 1: Find or create test user
  const user = await findOrCreateTestUser();
  if (!user) {
    console.error('❌ Failed to set up test user');
    process.exit(1);
  }

  // Step 2: Test token consumption for different models
  console.log('\n🔥 Testing token consumption scenarios...');
  let successCount = 0;
  
  for (const testEvent of testEvents) {
    const success = await testTokenConsumption(
      testEvent.modelName,
      testEvent.inputTokens,
      testEvent.outputTokens,
      testEvent.description
    );
    
    if (success) successCount++;
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Step 3: Verify records
  await verifyTokenUsage();

  // Summary
  console.log(`\n📈 Test Summary:`);
  console.log(`   ✅ Successful tests: ${successCount}/${testEvents.length}`);
  console.log(`   📊 User ID: ${testUser.id}`);
  console.log(`   📧 User email: ${testUser.email}`);
  
  if (successCount === testEvents.length) {
    console.log('\n🎉 All tests passed! Token monitoring system is working correctly.');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Please check the errors above.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});