#!/usr/bin/env node

/**
 * Get Real Users from Database
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function getRealUsers() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase configuration');
    return;
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    // Get all users
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, balance, created_at')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching users:', error);
      return;
    }
    
    console.log('👥 Real Users in Database:');
    console.log('='.repeat(80));
    
    if (users.length === 0) {
      console.log('No users found in database');
      return;
    }
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Balance: ${user.balance} credits`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
      console.log('');
    });
    
    // Return the first user for testing
    if (users.length > 0) {
      console.log('🎯 Use this user for testing:');
      console.log(`export TEST_USER_ID="${users[0].id}"`);
      console.log(`# User: ${users[0].email} (${users[0].balance} credits)`);
    }
    
  } catch (error) {
    console.error('❌ Database error:', error);
  }
}

getRealUsers();