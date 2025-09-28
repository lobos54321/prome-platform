#!/usr/bin/env node

/**
 * Dify API Connection Diagnostic Script
 * Run this in your production environment to debug the 503 error
 */

import fetch from 'node-fetch';
import https from 'https';
import dns from 'dns';
import { promisify } from 'util';

// Environment variables check
const DIFY_API_URL = process.env.VITE_DIFY_API_URL || process.env.DIFY_API_URL || '';
const DIFY_API_KEY = process.env.VITE_DIFY_API_KEY || process.env.DIFY_API_KEY || '';

console.log('🔍 Dify API Connection Diagnostic');
console.log('='.repeat(50));

async function runDiagnostics() {
  // 1. Environment variables check
  console.log('\n1. Environment Variables Check:');
  console.log(`   DIFY_API_URL: ${DIFY_API_URL ? 'SET' : 'NOT SET'} (${DIFY_API_URL.substring(0, 30)}...)`);
  console.log(`   DIFY_API_KEY: ${DIFY_API_KEY ? 'SET' : 'NOT SET'} (${DIFY_API_KEY.substring(0, 10)}...)`);
  
  if (!DIFY_API_URL || !DIFY_API_KEY) {
    console.log('❌ Missing required environment variables');
    return;
  }
  
  const apiUrl = new URL(DIFY_API_URL);
  console.log(`   Parsed host: ${apiUrl.hostname}`);
  console.log(`   Parsed port: ${apiUrl.port || (apiUrl.protocol === 'https:' ? 443 : 80)}`);
  
  // 2. DNS Resolution Test
  console.log('\n2. DNS Resolution Test:');
  try {
    const dnsLookup = promisify(dns.lookup);
    const address = await dnsLookup(apiUrl.hostname);
    console.log(`   ✅ DNS resolved: ${apiUrl.hostname} -> ${address.address}`);
  } catch (error) {
    console.log(`   ❌ DNS resolution failed: ${error.message}`);
    return;
  }
  
  // 3. Basic connectivity test
  console.log('\n3. Basic Connectivity Test:');
  try {
    const response = await fetch(DIFY_API_URL, {
      method: 'GET',
      timeout: 10000,
      headers: {
        'User-Agent': 'Dify-Connection-Test/1.0'
      }
    });
    console.log(`   ✅ Connection successful: ${response.status} ${response.statusText}`);
  } catch (error) {
    console.log(`   ❌ Connection failed: ${error.message}`);
    if (error.code) {
      console.log(`   Error code: ${error.code}`);
    }
    return;
  }
  
  // 4. API Authentication Test
  console.log('\n4. API Authentication Test:');
  try {
    const testEndpoint = `${DIFY_API_URL}/meta`;
    const response = await fetch(testEndpoint, {
      method: 'GET',
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Dify-Connection-Test/1.0'
      }
    });
    
    console.log(`   Response status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log('   ✅ Authentication successful');
      const data = await response.text();
      console.log(`   Response preview: ${data.substring(0, 200)}...`);
    } else {
      console.log('   ❌ Authentication failed');
      const errorText = await response.text();
      console.log(`   Error response: ${errorText.substring(0, 200)}...`);
    }
  } catch (error) {
    console.log(`   ❌ API test failed: ${error.message}`);
    if (error.code) {
      console.log(`   Error code: ${error.code}`);
    }
  }
  
  // 5. Chat Messages Endpoint Test
  console.log('\n5. Chat Messages Endpoint Test:');
  try {
    const testEndpoint = `${DIFY_API_URL}/chat-messages`;
    const testPayload = {
      inputs: {},
      query: "Hello, this is a connection test",
      response_mode: "blocking",
      user: "test-user-connection-diagnostic"
    };
    
    const response = await fetch(testEndpoint, {
      method: 'POST',
      timeout: 15000,
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Dify-Connection-Test/1.0'
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log(`   Response status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log('   ✅ Chat endpoint accessible');
      const data = await response.text();
      console.log(`   Response preview: ${data.substring(0, 200)}...`);
    } else {
      console.log('   ❌ Chat endpoint failed');
      const errorText = await response.text();
      console.log(`   Error response: ${errorText.substring(0, 200)}...`);
    }
  } catch (error) {
    console.log(`   ❌ Chat endpoint test failed: ${error.message}`);
    if (error.code) {
      console.log(`   Error code: ${error.code}`);
    }
  }
  
  // 6. Network configuration info
  console.log('\n6. Network Configuration Info:');
  console.log(`   Node.js version: ${process.version}`);
  console.log(`   Platform: ${process.platform}`);
  console.log(`   Architecture: ${process.arch}`);
  
  // Check for proxy settings
  const proxyVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy'];
  const proxies = proxyVars.filter(v => process.env[v]).map(v => `${v}=${process.env[v]}`);
  if (proxies.length > 0) {
    console.log(`   Proxy settings: ${proxies.join(', ')}`);
  } else {
    console.log('   No proxy settings detected');
  }
}

runDiagnostics().catch(error => {
  console.error('\n❌ Diagnostic script failed:', error);
  process.exit(1);
});