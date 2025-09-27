#!/usr/bin/env node

/**
 * Check Database Structure
 * Checks the current database state and whether we need to add credits system
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

async function checkDatabase() {
  console.log('🔍 Checking current database structure...');
  
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // 1. Check if users table has credits column
    console.log('\n📊 Checking users table structure...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, balance, credits')
      .limit(1);
    
    if (usersError) {
      console.log('❌ Users table or credits column missing:', usersError.message);
    } else {
      console.log('✅ Users table accessible');
      if (users && users.length > 0) {
        const user = users[0];
        console.log('  - Has balance field:', user.balance !== undefined);
        console.log('  - Has credits field:', user.credits !== undefined);
        if (user.credits !== undefined) {
          console.log(`  - Sample credits value: ${user.credits}`);
        }
      }
    }
    
    // 2. Check credits_transactions table
    console.log('\n💰 Checking credits_transactions table...');
    const { error: transError } = await supabase
      .from('credits_transactions')
      .select('id')
      .limit(1);
    
    if (transError) {
      console.log('❌ Credits transactions table missing:', transError.message);
    } else {
      console.log('✅ Credits transactions table exists');
    }
    
    // 3. Check video_generations table
    console.log('\n🎬 Checking video_generations table...');
    const { error: videoError } = await supabase
      .from('video_generations')
      .select('id')
      .limit(1);
    
    if (videoError) {
      console.log('❌ Video generations table missing:', videoError.message);
    } else {
      console.log('✅ Video generations table exists');
    }
    
    // 4. Check if functions exist
    console.log('\n🔧 Checking database functions...');
    try {
      const { error: funcError } = await supabase.rpc('check_user_credits', {
        user_uuid: '00000000-0000-0000-0000-000000000000',
        required_credits: 1000
      });
      
      if (funcError) {
        console.log('❌ check_user_credits function missing:', funcError.message);
      } else {
        console.log('✅ check_user_credits function exists');
      }
    } catch (e) {
      console.log('❌ Database functions not accessible:', e.message);
    }
    
    // 5. Suggest migration approach
    console.log('\n📋 Migration Assessment:');
    
    if (usersError && usersError.message.includes('credits')) {
      console.log('🔄 Need to add credits column to users table');
    } else {
      console.log('✅ Users table structure is ready');
    }
    
    if (transError) {
      console.log('🔄 Need to create credits_transactions table');
    } else {
      console.log('✅ Credits transactions table ready');
    }
    
    if (videoError) {
      console.log('🔄 Need to create video_generations table');
    } else {
      console.log('✅ Video generations table ready');
    }
    
    console.log('\n💡 Recommendations:');
    console.log('1. Your system already has a balance field');
    console.log('2. We can migrate balance (USD) to credits (balance * 1000)');
    console.log('3. The credits system can run alongside the existing balance system');
    
  } catch (error) {
    console.error('❌ Database check failed:', error);
  }
}

checkDatabase().catch(console.error);