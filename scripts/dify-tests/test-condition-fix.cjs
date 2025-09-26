/* Run: node scripts/dify-tests/test-condition-fix.cjs */
const { isSimpleGreeting } = require('../../src/server/utils/sanitizeInputs.cjs');

const cases = [
  { text: 'nihao', expect: true },
  { text: '你好', expect: true },
  { text: 'hello!', expect: true },
  { text: 'hello there', expect: false },
  { text: '帮我查询', expect: false },
];

let ok = true;
for (const c of cases) {
  const r = isSimpleGreeting(c.text);
  if (r !== c.expect) {
    console.error(`❌ "${c.text}" expected ${c.expect} got ${r}`);
    ok = false;
  }
}
console.log(ok ? '✅ Greeting condition tests passed.' : '❌ Greeting condition tests failed.');
process.exit(ok ? 0 : 1);