/* Run: node scripts/dify-tests/verify-fix.cjs */
const { sanitizeInputs, isSimpleGreeting } = require('../../src/server/utils/sanitizeInputs.cjs');

function assert(name, cond) {
  if (!cond) throw new Error(`❌ ${name}`);
  console.log(`✅ ${name}`);
}

(function main() {
  // Sanitize strips conversation_* keys
  const sanitized = sanitizeInputs({
    conversation_info_completeness: 1,
    foo: 'bar',
    conversation_product_info: 'x',
  });
  assert('Sanitize removes conversation_* keys', !('conversation_info_completeness' in sanitized) && !('conversation_product_info' in sanitized));
  assert('Sanitize keeps business keys', sanitized.foo === 'bar');

  // Greeting detection
  ['nihao', '你好', 'hello!', '嗨', '哈喽', '  hello  '].forEach(g => {
    assert(`Greeting detected: "${g}"`, isSimpleGreeting(g));
  });
  ['help', '订单问题', 'hello there'].forEach(t => {
    assert(`Non-greeting not detected: "${t}"`, !isSimpleGreeting(t));
  });

  console.log('All checks passed.');
})();