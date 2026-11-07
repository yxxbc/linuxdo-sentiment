const V = require('../src/version.js');
const cases = [
  ['0.2.0', '0.2.1', true],
  ['0.2.1', '0.2.1', false],
  ['0.3.0', '0.2.9', false],
  ['1.0.0', '1.0.1', true],
  ['v0.2.0', '0.3.0', true]
];
let pass = 0, fail = 0;
for (const [a, b, want] of cases) {
  const got = V.isNewer(a, b);
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${a} -> ${b} = ${got}`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
