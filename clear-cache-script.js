// 🧹 ProMe Chat 缓存清理脚本
// 使用方法: 在浏览器控制台中复制粘贴此脚本并执行

console.log('🧹 ProMe Chat 缓存清理工具');
console.log('================================');

// 检查当前缓存状态
function checkCacheStatus() {
    const difyKeys = [
        'dify_conversation_id',
        'dify_user_id', 
        'dify_messages',
        'dify_workflow_state',
        'dify_conversation_id_streaming',
        'dify_session_timestamp'
    ];
    
    console.log('📋 当前localStorage状态:');
    let hasCache = false;
    
    difyKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
            hasCache = true;
            console.log(`  ${key}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
        }
    });
    
    if (!hasCache) {
        console.log('  ✅ 无缓存数据 - 状态干净');
    }
    
    return hasCache;
}

// 清理DIFY缓存
function clearDifyCache() {
    const difyKeys = [
        'dify_conversation_id',
        'dify_user_id',
        'dify_messages', 
        'dify_workflow_state',
        'dify_conversation_id_streaming',
        'dify_session_timestamp'
    ];
    
    let cleared = 0;
    difyKeys.forEach(key => {
        if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
            cleared++;
        }
    });
    
    console.log(`✅ 已清理 ${cleared} 个DIFY缓存项`);
    return cleared;
}

// 测试API
async function testAPI() {
    try {
        console.log('🔄 正在测试API...');
        
        const response = await fetch('http://localhost:8080/api/dify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer console-test-token'
            },
            body: JSON.stringify({
                inputs: {},
                query: "控制台测试：产品是区块链钱包。特色：多链支持、DeFi集成、安全存储。用户：加密货币用户。价格：免费。",
                response_mode: "streaming",
                conversation_id: "",
                user: "console-test-user",
                files: []
            })
        });
        
        const data = await response.json();
        
        console.log('✅ API测试结果:');
        console.log(`  响应: ${data.answer.substring(0, 100)}...`);
        console.log(`  会话ID: ${data.conversation_id}`);
        console.log(`  Token消耗: ${data.metadata?.usage?.total_tokens || 'N/A'}`);
        console.log(`  成本: $${data.metadata?.usage?.total_price || 'N/A'}`);
        
        return data;
        
    } catch (error) {
        console.error('❌ API测试失败:', error.message);
        return null;
    }
}

// 执行完整清理和测试流程
async function fullCleanAndTest() {
    console.log('\n🚀 开始完整清理和测试流程...');
    
    console.log('\n1️⃣ 检查当前状态:');
    const hadCache = checkCacheStatus();
    
    if (hadCache) {
        console.log('\n2️⃣ 清理缓存:');
        clearDifyCache();
        
        console.log('\n3️⃣ 验证清理结果:');
        checkCacheStatus();
    } else {
        console.log('\n2️⃣ 缓存已经干净，跳过清理');
    }
    
    console.log('\n4️⃣ 测试API:');
    await testAPI();
    
    console.log('\n🎯 建议下一步:');
    console.log('  1. 刷新页面 (F5)');
    console.log('  2. 访问 http://localhost:5173/chat/dify');
    console.log('  3. 开始新的聊天测试');
    console.log('  4. 检查是否从COMPLETENESS 1开始');
    
    return true;
}

// 导出函数到全局
window.checkCacheStatus = checkCacheStatus;
window.clearDifyCache = clearDifyCache;
window.testAPI = testAPI;
window.fullCleanAndTest = fullCleanAndTest;

console.log('\n🔧 可用命令:');
console.log('  checkCacheStatus() - 检查缓存状态');
console.log('  clearDifyCache() - 清理DIFY缓存');
console.log('  testAPI() - 测试API端点');
console.log('  fullCleanAndTest() - 执行完整流程');
console.log('\n💡 推荐执行: fullCleanAndTest()');