/* 模型（COLD 训练）在“高置信”档的行为：只该在明确攻击时亮 */
const C = require('../src/classifier.js');
require('../src/model.js');

const cases = [
  ['支持支持，感谢大佬，参与一波', false],
  ['垃圾佬路过，这板子不错', false],
  ['这脚本我测了，500K 正常，满 1M 开始重复', false],
  ['你这人是不是有病？滚出去', true],
  ['你就是个傻逼，别说话了', true]
];

let pass = 0, fail = 0;
for (const [text, expect] of cases) {
  const r = C.offensive(text);
  const ok = r.severe === expect;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} p=${r.p.toFixed(3)} severe=${r.severe} 期望 ${expect}  ${text}`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
