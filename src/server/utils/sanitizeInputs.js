// Simple utilities usable in server.js
function sanitizeInputs(inputs) {
  if (!inputs || typeof inputs !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(inputs)) {
    if (/^conversation_/i.test(k)) continue; // strip Dify conversation internals
    out[k] = v;
  }
  return out;
}

function isSimpleGreeting(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim().toLowerCase();
  const simple = [
    'nihao', '你好', '您好', 'hi', 'hello', 'hey', '嗨', '哈喽', '哈啰', '哈羅'
  ];
  if (simple.includes(t)) return true;
  // very short greeting variants like "hello!" "hi." etc.
  if (/^(nihao|你好|您好|hi|hello|hey|嗨|哈(喽|啰|羅))[\s!！。,.。]*$/.test(t)) return true;
  return false;
}

module.exports = { sanitizeInputs, isSimpleGreeting };