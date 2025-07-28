#!/usr/bin/env node

/**
 * Admin script to add credits to a specific user account
 * Usage: node add-credits.js <email> <credits> [description]
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase configuration missing!');
  console.error('Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env');
  console.error('Current values:');
  console.error('  VITE_SUPABASE_URL:', supabaseUrl || 'undefined');
  console.error('  VITE_SUPABASE_ANON_KEY:', supabaseKey ? 'set' : 'undefined');
  process.exit(1);
}

// Validate URL format
try {
  new URL(supabaseUrl);
} catch (error) {
  console.error('❌ Invalid Supabase URL format:', supabaseUrl);
  console.error('Please provide a valid URL (e.g., https://your-project.supabase.co)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addCreditsToUser(email, credits, description = 'Admin credit addition') {
  try {
    console.log(`🔍 Looking for user with email: ${email}`);
    
    // Test database connection first
    try {
      const { data: testData, error: testError } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      
      if (testError) {
        console.error('❌ Database connection test failed:', testError);
        console.error('Please check your Supabase configuration in .env file');
        return false;
      }
      console.log('✅ Database connection test successful');
    } catch (connError) {
      console.error('❌ Database connection failed:', connError);
      return false;
    }
    
    // Find user by email
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (userError) {
      console.error('❌ Database error:', userError);
      console.error('Error details:', JSON.stringify(userError, null, 2));
      return false;
    }

    if (!userData) {
      console.error(`❌ User with email ${email} not found`);
      console.log('💡 Available users (first 5):');
      
      try {
        const { data: allUsers, error: listError } = await supabase
          .from('users')
          .select('email, name, balance')
          .limit(5);
        
        if (!listError && allUsers) {
          allUsers.forEach(user => {
            console.log(`   - ${user.email} (${user.name}) - Balance: ${user.balance}`);
          });
        }
      } catch (listErr) {
        console.log('Could not list users:', listErr);
      }
      
      return false;
    }

    console.log(`✅ Found user: ${userData.name} (ID: ${userData.id})`);
    console.log(`💰 Current balance: ${userData.balance || 0} credits`);

    const currentBalance = parseFloat(userData.balance) || 0;
    const newBalance = currentBalance + credits;

    // Update balance
    const { data: updateData, error: updateError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('id', userData.id)
      .select('balance')
      .single();

    if (updateError) {
      console.error('❌ Failed to update balance:', updateError);
      console.error('Update error details:', JSON.stringify(updateError, null, 2));
      return false;
    }

    console.log(`✅ Balance updated to: ${updateData.balance} credits`);

    // Add billing record
    const { error: billingError } = await supabase
      .from('billing_records')
      .insert([
        {
          user_id: userData.id,
          type: 'charge',
          amount: credits,
          description: description,
          status: 'completed',
          created_at: new Date().toISOString()
        }
      ]);

    if (billingError) {
      console.warn('⚠️ Failed to create billing record:', billingError);
      console.warn('Billing error details:', JSON.stringify(billingError, null, 2));
      console.log('💡 Balance was updated successfully, but billing record failed');
    } else {
      console.log('✅ Billing record created successfully');
    }

    console.log(`🎉 Successfully added ${credits} credits to ${email}`);
    console.log(`📊 New balance: ${newBalance} credits`);
    
    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    console.error('Full error details:', JSON.stringify(error, null, 2));
    return false;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('📝 Usage: node add-credits.js <email> <credits> [description]');
    console.log('📝 Example: node add-credits.js lobos54321@gmail.com 10000 "Initial admin credits"');
    process.exit(1);
  }

  const email = args[0];
  const credits = parseInt(args[1]);
  const description = args[2] || 'Admin credit addition';

  if (isNaN(credits) || credits <= 0) {
    console.error('❌ Credits must be a positive number');
    process.exit(1);
  }

  console.log('🚀 Adding credits to admin account...');
  console.log(`📧 Email: ${email}`);
  console.log(`💎 Credits: ${credits}`);
  console.log(`📝 Description: ${description}`);
  console.log('');

  const success = await addCreditsToUser(email, credits, description);
  
  if (success) {
    console.log('');
    console.log('✅ Credits added successfully!');
    process.exit(0);
  } else {
    console.log('');
    console.log('❌ Failed to add credits');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});