#!/usr/bin/env node

/**
 * Check Database Migration Status
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function checkMigrationStatus() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase configuration');
    return;
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('🔍 Checking database migration status...\n');
  
  try {
    // Check if video_generations table exists
    console.log('1. Checking video_generations table...');
    const { data: videoGenData, error: videoGenError } = await supabase
      .from('video_generations')
      .select('*')
      .limit(1);
    
    if (videoGenError) {
      console.log(`   ❌ video_generations table: ${videoGenError.message}`);
    } else {
      console.log('   ✅ video_generations table: EXISTS');
      console.log(`   📊 Sample data: ${videoGenData.length} records found`);
    }
    
    // Check if functions exist by calling them
    console.log('\n2. Checking database functions...');
    
    // Test reserve_credits_for_video function
    console.log('   Testing reserve_credits_for_video function...');
    const testUserId = '9dee4891-89a6-44ee-8fe8-69097846e97d';
    const { data: reserveData, error: reserveError } = await supabase
      .rpc('reserve_credits_for_video', {
        user_uuid: testUserId,
        credits_amount: 1,
        session_id_param: 'test-function-check',
        duration_param: 8,
        metadata_param: { test: true }
      });
    
    if (reserveError) {
      console.log(`   ❌ reserve_credits_for_video: ${reserveError.message}`);
    } else {
      console.log(`   ✅ reserve_credits_for_video: EXISTS (returned: ${reserveData})`);
    }
    
    // Test complete_video_generation function
    console.log('   Testing complete_video_generation function...');
    const { data: completeData, error: completeError } = await supabase
      .rpc('complete_video_generation', {
        session_id_param: 'test-function-check',
        final_status: 'failed',
        video_url_param: null
      });
    
    if (completeError) {
      console.log(`   ❌ complete_video_generation: ${completeError.message}`);
    } else {
      console.log(`   ✅ complete_video_generation: EXISTS (returned: ${completeData})`);
    }
    
    // Check billing_records for our test
    console.log('\n3. Checking billing_records integration...');
    const { data: billingData, error: billingError } = await supabase
      .from('billing_records')
      .select('*')
      .ilike('description', '%Auto-video%')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (billingError) {
      console.log(`   ❌ billing_records check: ${billingError.message}`);
    } else {
      console.log(`   ✅ billing_records: Found ${billingData.length} video billing records`);
      if (billingData.length > 0) {
        console.log(`   📝 Latest: ${billingData[0].description} (${billingData[0].amount} credits)`);
      }
    }
    
    // Get current user balance
    console.log('\n4. Current user balance...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('balance')
      .eq('id', testUserId)
      .single();
    
    if (userError) {
      console.log(`   ❌ User balance check: ${userError.message}`);
    } else {
      console.log(`   💰 Current balance: ${userData.balance} credits`);
    }
    
  } catch (error) {
    console.error('❌ Database error:', error);
  }
}

checkMigrationStatus();