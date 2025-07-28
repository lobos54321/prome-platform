#!/usr/bin/env node

/**
 * Admin script to add credits to a specific user account
 * Usage: node add-credits.js <email> <credits> [description]
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase configuration missing!');
  console.error('Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addCreditsToUser(email, credits, description = 'Admin credit addition') {
  try {
    console.log(`🔍 Looking for user with email: ${email}`);
    
    // Find user by email
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (userError) {
      console.error('❌ Database error:', userError);
      return false;
    }

    if (!userData) {
      console.error(`❌ User with email ${email} not found`);
      return false;
    }

    console.log(`✅ Found user: ${userData.name} (ID: ${userData.id})`);
    console.log(`💰 Current balance: ${userData.balance || 0} credits`);

    const currentBalance = userData.balance || 0;
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
      console.log('💡 Balance was updated successfully, but billing record failed');
    } else {
      console.log('✅ Billing record created successfully');
    }

    console.log(`🎉 Successfully added ${credits} credits to ${email}`);
    console.log(`📊 New balance: ${newBalance} credits`);
    
    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
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