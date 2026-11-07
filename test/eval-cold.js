/* 用 COLD 测试集（thu-coai/COLDataset, Weibo 语料, label 1=offensive）评估二分类。
   用法：node test/eval-cold.js /tmp/cold/test.csv */
const fs = require('fs');
const C = require('../src/classifier.js');

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const file = process.argv[2];
if (!file) { console.error('usage: eval-cold.js <test.csv>'); process.exit(2); }
const rows = parseCSV(fs.readFileSync(file, 'utf8'));
const head = rows[0];
const iLabel = head.indexOf('label');
const iText = head.indexOf('TEXT');
const data = rows.slice(1).filter(r => r.length > Math.max(iLabel, iText) && (r[iLabel] === '0' || r[iLabel] === '1'))
  .map(r => ({ y: r[iLabel] === '1' ? 1 : 0, text: r[iText] }));

function evalAt(th) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const d of data) {
    const s = C.score(d.text).score;
    const p = s >= th ? 1 : 0;
    if (p && d.y) tp++; else if (p && !d.y) fp++; else if (!p && !d.y) tn++; else fn++;
  }
  const acc = (tp + tn) / data.length;
  const prec = tp + fp ? tp / (tp + fp) : 0;
  const rec = tp + fn ? tp / (tp + fn) : 0;
  const f1 = prec + rec ? 2 * prec * rec / (prec + rec) : 0;
  return { th, acc, prec, rec, f1, tp, fp, tn, fn };
}

console.log('样本数', data.length, '攻击性比例', (data.filter(d => d.y).length / data.length).toFixed(3));
console.log('th\tacc\tprec\trecall\tF1');
let best = null;
for (let th = 10; th <= 80; th += 5) {
  const r = evalAt(th);
  console.log(`${th}\t${r.acc.toFixed(3)}\t${r.prec.toFixed(3)}\t${r.rec.toFixed(3)}\t${r.f1.toFixed(3)}`);
  if (!best || r.f1 > best.f1) best = r;
}
console.log('\n最佳阈值', best.th, 'F1', best.f1.toFixed(3), 'acc', best.acc.toFixed(3));

// 误判样本
const fpList = [], fnList = [];
for (const d of data) {
  const s = C.score(d.text).score;
  const p = s >= best.th ? 1 : 0;
  if (p && !d.y) fpList.push([s, d.text]);
  if (!p && d.y) fnList.push([s, d.text]);
}
console.log('\n误报 top (非攻击被判攻击):');
fpList.sort((a, b) => b[0] - a[0]).slice(0, 8).forEach(x => console.log(' ', x[0], x[1].slice(0, 50)));
console.log('\n漏报 top (攻击被判非攻击):');
fnList.sort((a, b) => b[0] - a[0]).slice(0, 8).forEach(x => console.log(' ', x[0], x[1].slice(0, 50)));
