#!/usr/bin/env node

/**
 * Quick API Test - Test specific video APIs
 */

import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:8080';
const TEST_USER_ID = '9dee4891-89a6-44ee-8fe8-69097846e97d'; // Real user ID: lobos54321@gmail.com

async function quickTest() {
  console.log('🧪 Quick Video API Test...\n');
  
  // Test 1: Check balance
  console.log('1. Testing balance API...');
  try {
    const response = await fetch(`${API_BASE_URL}/api/video/balance/${TEST_USER_ID}`);
    console.log(`   Status: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Balance: ${data.credits} credits`);
    } else {
      const error = await response.text();
      console.log(`   ❌ Error: ${error}`);
    }
  } catch (error) {
    console.log(`   ❌ Exception: ${error.message}`);
  }
  
  // Test 2: Check credit sufficiency
  console.log('\n2. Testing credit check API...');
  try {
    const response = await fetch(`${API_BASE_URL}/api/video/check-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        credits: 1764
      })
    });
    console.log(`   Status: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Has enough credits: ${data.hasEnoughCredits}`);
    } else {
      const error = await response.text();
      console.log(`   ❌ Error: ${error}`);
    }
  } catch (error) {
    console.log(`   ❌ Exception: ${error.message}`);
  }
  
  // Test 3: Reserve credits
  console.log('\n3. Testing credit reservation API...');
  const sessionId = `quick-test-${Date.now()}`;
  try {
    const response = await fetch(`${API_BASE_URL}/api/video/reserve-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        credits: 1764,
        sessionId: sessionId,
        duration: 8,
        metadata: { quickTest: true }
      })
    });
    console.log(`   Status: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Reservation successful: ${JSON.stringify(data)}`);
      
      // Test completion
      console.log('\n4. Testing video completion API...');
      const completeResponse = await fetch(`${API_BASE_URL}/api/video/webhook/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          finalvideourl: 'https://example.com/test-video.mp4',
          status: 'completed'
        })
      });
      console.log(`   Status: ${completeResponse.status}`);
      if (completeResponse.ok) {
        const completeData = await completeResponse.json();
        console.log(`   ✅ Completion successful: ${JSON.stringify(completeData)}`);
      } else {
        const error = await completeResponse.text();
        console.log(`   ❌ Completion error: ${error}`);
      }
      
    } else {
      const error = await response.text();
      console.log(`   ❌ Reservation error: ${error}`);
    }
  } catch (error) {
    console.log(`   ❌ Exception: ${error.message}`);
  }
  
  console.log('\n🎯 Quick test completed!');
}

quickTest().catch(console.error);