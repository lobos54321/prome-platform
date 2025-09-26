// 临时脚本：清除localStorage中的消息历史以显示新的欢迎消息
console.log('清除localStorage中的旧消息...');

// 清除所有Dify相关的localStorage项
localStorage.removeItem('dify_messages');
localStorage.removeItem('dify_conversation_id');
localStorage.removeItem('dify_user_id');
localStorage.removeItem('dify_workflow_state');
localStorage.removeItem('dify_session_timestamp');

console.log('✅ 已清除localStorage，请刷新页面查看新的欢迎消息');