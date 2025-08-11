#!/usr/bin/env node

/**
 * 调试"biubiu"工作流中断问题
 * 模拟用户从LLM18开始的完整对话流程
 */

import https from 'https';
import { URLSearchParams } from 'url';

async function makeRequest(endpoint, data, options = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const reqOptions = {
      hostname: 'prome.live',
      port: 443,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...options.headers
      },
      timeout: options.timeout || 30000
    };

    const req = https.request(reqOptions, (res) => {
      let rawData = '';
      res.on('data', (chunk) => rawData += chunk);
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(rawData);
          resolve({ status: res.statusCode, data: parsedData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: rawData, headers: res.headers, parseError: e });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

async function testWorkflowProgress() {
  const userId = `debug-workflow-${Date.now()}`;
  let conversationId = null;
  
  console.log('🚀 开始测试工作流中断问题');
  console.log(`👤 测试用户ID: ${userId}`);
  console.log('');

  try {
    // Step 1: 发送初始消息，应该进入LLM18
    console.log('=== Step 1: 发送初始消息 ===');
    const step1Response = await makeRequest('/api/dify', {
      message: '你好',
      user: userId,
      conversation_id: null,
      stream: false
    });

    console.log('状态码:', step1Response.status);
    if (step1Response.status !== 200) {
      console.error('❌ Step 1 失败:', step1Response.data);
      return;
    }

    conversationId = step1Response.data.conversation_id;
    console.log('✅ Step 1 成功');
    console.log('对话ID:', conversationId);
    console.log('回答预览:', step1Response.data.answer?.substring(0, 100) + '...');
    console.log('');

    // Step 2: 发送产品信息
    console.log('=== Step 2: 发送产品信息 ===');
    const step2Response = await makeRequest('/api/dify', {
      message: '我的产品是一个AI聊天机器人，可以帮助用户解决各种问题',
      user: userId,
      conversation_id: conversationId,
      stream: false
    });

    console.log('状态码:', step2Response.status);
    if (step2Response.status !== 200) {
      console.error('❌ Step 2 失败:', step2Response.data);
      return;
    }

    console.log('✅ Step 2 成功');
    console.log('回答预览:', step2Response.data.answer?.substring(0, 100) + '...');
    console.log('');

    // Step 3: 继续回答问题直到信息收集完成
    console.log('=== Step 3: 继续信息收集 ===');
    const step3Response = await makeRequest('/api/dify', {
      message: '目标用户是企业客户，主要解决客服效率问题',
      user: userId,
      conversation_id: conversationId,
      stream: false
    });

    console.log('状态码:', step3Response.status);
    if (step3Response.status !== 200) {
      console.error('❌ Step 3 失败:', step3Response.data);
      return;
    }

    console.log('✅ Step 3 成功');
    console.log('回答预览:', step3Response.data.answer?.substring(0, 100) + '...');
    console.log('');

    // Step 4: 发送"biubiu" - 这里应该会触发问题
    console.log('=== Step 4: 发送关键词"biubiu" ===');
    console.log('⚠️  这一步可能会导致工作流中断...');
    
    const step4Response = await makeRequest('/api/dify', {
      message: 'biubiu',
      user: userId,
      conversation_id: conversationId,
      stream: false
    }, { timeout: 60000 }); // 增加超时时间

    console.log('状态码:', step4Response.status);
    
    if (step4Response.status === 400) {
      console.error('❌ Step 4 返回400错误 - 这就是问题所在！');
      console.error('错误详情:', step4Response.data);
      
      // 尝试分析错误原因
      if (step4Response.data.error || step4Response.data.message) {
        console.error('API错误信息:', step4Response.data.error || step4Response.data.message);
      }
    } else if (step4Response.status === 200) {
      console.log('✅ Step 4 成功（意外！）');
      console.log('回答预览:', step4Response.data.answer?.substring(0, 100) + '...');
    } else {
      console.error(`❌ Step 4 返回状态码 ${step4Response.status}`);
      console.error('响应:', step4Response.data);
    }

  } catch (error) {
    console.error('🚨 测试过程中发生错误:', error.message);
    if (error.code) {
      console.error('错误代码:', error.code);
    }
  }
}

// 执行测试
testWorkflowProgress();