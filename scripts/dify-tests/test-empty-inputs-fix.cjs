/* Run: node scripts/dify-tests/test-empty-inputs-fix.cjs */
const { sanitizeInputs } = require('../../src/server/utils/sanitizeInputs.cjs');

const incomingInputs = {
  business_key: 'value',
  conversation_info_completeness: 2,
};

const sanitizedExisting = sanitizeInputs(incomingInputs);
if ('conversation_info_completeness' in sanitizedExisting) {
  console.error('❌ conversation_* leaked in existing conversation');
  process.exit(1);
}

console.log('✅ Existing conversation keeps only business inputs:', sanitizedExisting);
console.log('ℹ️ New chat-messages should send inputs: {}');
console.log('ℹ️ New workflow should send inputs: { query } only (no conversation_*).');