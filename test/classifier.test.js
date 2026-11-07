/* 单测：用真实抓取到的楼词语料 + 对抗样例，检查排序与边界。
   运行：/opt/homebrew/bin/node test/classifier.test.js */
const C = require('../src/classifier.js');

const cases = [
  // [文本, 期望标签, 说明]
  ['支持支持，感谢大佬，参与一波', '平和', '抽奖帖常见回复'],
  ['垃圾佬路过，这主板不错，收藏了', '平和', '社区友好用法，不能误伤'],
  ['这是我在 1M 上下文下的测试结果，500K 时还正常，满 1M 就开始重复', '平和', '技术讨论'],
  ['The model seems fine in my tests, no regression observed.', '平和', '英文中性'],

  ['某为名声臭成这样，真是晦气', '有火药味', '立场贬损，不指向个人'],
  ['大佬说得对，已严肃学习', '阴阳/对立', '阴阳套话'],
  ['典中典，这下赢麻了', '阴阳/对立', '反讽组合'],
  ['你这人是不是有病？别人问个问题你也要阴阳？', '攻击性', '人身攻击'],
  ['就你这水平也配评价？回去多读点书', '攻击性', '指向性贬低'],

  // 来自真实截图的三个帖子（长句、无脏话但情绪化 / 有脏话 / 有变体脏话）
  ['qs接近100没绷住，一看又被pua了吧。qs100，估计也就是诺丁汉、南安普顿那种级别的，这种就是标准到不能再标准的水硕，读的又是文科，是谁告诉你无法申请这种学校的？更离谱的是，你居然信了一个中国作家，写推荐信给英国学校，最后还读了一个商科？？这个作家是刘慈欣吗？', '攻击性', '长句阴阳+居高临下'],
  ['他妈的，给我结一下精神补偿费。看了你的帖子还不太气，看完你的回复，我只能说可怜之人必有可恨之处。你的思维是这个世纪的年轻人吗？看完真的想给你邦邦两拳', '攻击性', '脏话+威胁'],
  ['还去英国？第二个印度，乱的啥逼样了，都要解体了', '阴阳/对立', '变体脏话（逼样）']
];

let pass = 0, fail = 0;
for (const [text, expect, note] of cases) {
  const r = C.score(text);
  const ok = r.label === expect;
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${String(r.score).padStart(3)} ${r.label.padEnd(5)} [期望 ${expect}] ${note}`);
  if (!ok) console.log('      features:', JSON.stringify(r.features));
}

// 排序不变量：攻击 > 阴阳 > 中性
const s = (t) => C.score(t).score;
const order = [
  ['中性', s('这个脚本我测了，结果正常')],
  ['阴阳', s('大佬说得对，已严肃学习')],
  ['攻击', s('你这人是不是有病？别人问个问题你也要阴阳？')]
];
console.log('\n排序:', order.map(x => `${x[0]}=${x[1]}`).join(' < '));
const sorted = order[0][1] < order[1][1] && order[1][1] < order[2][1];
if (!sorted) { fail++; console.log('FAIL 排序不变量'); } else pass++;

// 边界：空串与超长文本不应抛错
try {
  C.score('');
  C.score('啊'.repeat(5000));
  pass++;
} catch (e) { fail++; console.log('FAIL 边界抛错', e.message); }

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
