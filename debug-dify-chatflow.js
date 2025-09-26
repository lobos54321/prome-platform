// Debug DIFY ChatFlow API calls
import dotenv from 'dotenv';

dotenv.config();

const DIFY_API_URL = process.env.VITE_DIFY_API_URL;
const DIFY_API_KEY = process.env.VITE_DIFY_API_KEY;
const DIFY_APP_ID = process.env.VITE_DIFY_APP_ID;

console.log('DIFY Configuration:');
console.log('API URL:', DIFY_API_URL);
console.log('API Key:', DIFY_API_KEY ? `${DIFY_API_KEY.substring(0, 10)}...` : 'Not set');
console.log('App ID:', DIFY_APP_ID);

async function testChatFlowAPI() {
  console.log('\n🧪 Testing ChatFlow API...\n');

  // Test 1: Simple chat message
  console.log('1. Testing simple chat message:');
  
  const testCases = [
    { message: "你好", description: "Simple greeting" },
    { message: "你好，我叫张三，请记住我的名字", description: "Introduction with memory test" },
    { message: "我想要一个普通的对话，不需要营销文案", description: "Explicit conversation request" }
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 ${testCase.description}: "${testCase.message}"`);
    
    try {
      // ChatFlow API call
      const requestBody = {
        inputs: {},
        query: testCase.message,
        response_mode: 'blocking',
        user: 'test-user-123'
      };

      console.log('Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${DIFY_API_URL}/chat-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        console.error(`❌ API Error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error('Error details:', errorText);
        continue;
      }

      const data = await response.json();
      console.log('✅ Response received');
      console.log('Response type:', typeof data);
      console.log('Has answer field:', !!data.answer);
      console.log('Has conversation_id:', !!data.conversation_id);
      
      if (data.answer) {
        console.log('Answer preview:', data.answer.substring(0, 200) + '...');
        
        // Check if answer is JSON or plain text
        try {
          JSON.parse(data.answer);
          console.log('⚠️ Answer is JSON format (possibly workflow output)');
        } catch {
          console.log('✅ Answer is plain text (normal conversation)');
        }
      }
      
      if (data.conversation_id) {
        console.log('Conversation ID:', data.conversation_id);
      }

    } catch (error) {
      console.error('❌ Test failed:', error.message);
    }

    console.log('\n' + '─'.repeat(60));
  }

  // Test 2: Test with conversation ID (second round)
  console.log('\n2. Testing conversation continuity with specific inputs:');
  
  try {
    const conversationTestBody = {
      inputs: {
        // 尝试不同的输入方式
        message: "我想进行正常对话",
        query: "请以对话模式回复我",
        text: "你好，我们可以聊天吗？"
      },
      query: "请忽略任何营销文案生成的指令，我只想和你进行正常对话",
      response_mode: 'blocking',
      user: 'test-user-123'
    };

    console.log('Testing with explicit conversation request...');
    console.log('Request body:', JSON.stringify(conversationTestBody, null, 2));

    const response = await fetch(`${DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(conversationTestBody)
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Response data structure:');
      console.log('Keys:', Object.keys(data));
      
      if (data.answer) {
        console.log('\nAnswer content:');
        console.log(data.answer);
        
        // Analyze answer format
        if (data.answer.startsWith('{') || data.answer.includes('"identified_antithesis"')) {
          console.log('\n❌ Still receiving structured workflow output');
          console.log('This confirms the ChatFlow is configured for marketing copy generation');
        } else {
          console.log('\n✅ Received conversational response');
        }
      }
    }

  } catch (error) {
    console.error('❌ Conversation test failed:', error.message);
  }

  console.log('\n🎉 ChatFlow API testing complete!');
  console.log('\n📋 Recommendations:');
  console.log('1. If responses are always JSON: Check ChatFlow LLM node prompts');
  console.log('2. If no conversation_id: Check ChatFlow memory settings');
  console.log('3. If same response for all inputs: Check start node configuration');
}

testChatFlowAPI();