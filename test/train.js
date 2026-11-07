/* 在 COLD（thu-coai/COLDataset）上训练逻辑回归：手写可解释特征 + 字符 2/3-gram 哈希。
   产物 src/model.js，供 classifier.offensive() 使用。用法：node test/train.js /tmp/cold */
const fs = require('fs');
const path = require('path');
const C = require('../src/classifier.js');

const B = 65536;

function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function load(dir, split) {
  const rows = parseCSV(fs.readFileSync(path.join(dir, split + '.csv'), 'utf8'));
  const head = rows[0], iL = head.indexOf('label'), iT = head.indexOf('TEXT');
  return rows.slice(1)
    .filter(r => r.length > Math.max(iL, iT) && (r[iL] === '0' || r[iL] === '1') && r[iT])
    .map(r => ({ y: r[iL] === '1' ? 1 : 0, text: r[iT] }));
}

function vectorize(rows) {
  return rows.map(r => ({ y: r.y, hand: C.feats(r.text).values, grams: C.grams(r.text) }));
}

const dir = process.argv[2] || '/tmp/cold';
const train = load(dir, 'train'), dev = load(dir, 'dev'), test = load(dir, 'test');
console.log('train/dev/test', train.length, dev.length, test.length);

const TR = vectorize(train), DV = vectorize(dev), TE = vectorize(test);
const D = TR[0].hand.length;
const w = new Float64Array(D + B), gw = new Float64Array(B);
let b = 0;

const sig = z => 1 / (1 + Math.exp(-z));
function predict(s) {
  let z = b;
  for (let i = 0; i < D; i++) z += w[i] * s.hand[i];
  for (let g = 0; g < s.grams.length; g++) z += w[D + s.grams[g][0]] * s.grams[g][1];
  return sig(z);
}

// SGD
const epochs = 30, lambda = 3e-5;
let seed = 42;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (let ep = 0; ep < epochs; ep++) {
  const lr = 0.6 * Math.pow(0.85, ep) + 0.02;
  const order = TR.map((_, i) => i).sort(() => rnd() - 0.5);
  for (const i of order) {
    const s = TR[i];
    const e = predict(s) - s.y;
    for (let d = 0; d < D; d++) w[d] -= lr * (e * s.hand[d] + lambda * w[d]);
    for (let g = 0; g < s.grams.length; g++) {
      const k = D + s.grams[g][0];
      w[k] -= lr * (e * s.grams[g][1] + lambda * w[k]);
    }
    b -= lr * e;
  }
  const p = TR.map(predict);
  const acc = p.filter((v, i) => (v >= 0.5) === (TR[i].y === 1)).length / TR.length;
  if (ep % 3 === 0) console.log(`epoch ${ep} train acc ${acc.toFixed(3)}`);
}

function metrics(pred, ys) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (let i = 0; i < ys.length; i++) {
    if (pred[i] && ys[i]) tp++; else if (pred[i] && !ys[i]) fp++;
    else if (!pred[i] && !ys[i]) tn++; else fn++;
  }
  const acc = (tp + tn) / ys.length;
  const prec = tp + fp ? tp / (tp + fp) : 0;
  const rec = tp + fn ? tp / (tp + fn) : 0;
  return { acc, prec, rec, f1: prec + rec ? 2 * prec * rec / (prec + rec) : 0, tp, fp, tn, fn };
}

const pdv = DV.map(predict), ydv = DV.map(s => s.y);
let best = { th: 0.5, f1: -1 };
for (let th = 0.05; th <= 0.95; th += 0.01) {
  const m = metrics(pdv.map(p => p >= th), ydv);
  if (m.f1 > best.f1) best = { th: +th.toFixed(2), f1: m.f1 };
}
const pte = TE.map(predict), yte = TE.map(s => s.y);
const mTest = metrics(pte.map(p => p >= best.th), yte);
const m50 = metrics(pte.map(p => p >= 0.5), yte);
console.log(`dev 最优阈值 ${best.th}, dev F1 ${best.f1.toFixed(3)}`);
console.log(`test @${best.th}: acc ${mTest.acc.toFixed(3)} prec ${mTest.prec.toFixed(3)} rec ${mTest.rec.toFixed(3)} F1 ${mTest.f1.toFixed(3)}`);
console.log(`test @0.50  : acc ${m50.acc.toFixed(3)} prec ${m50.prec.toFixed(3)} rec ${m50.rec.toFixed(3)} F1 ${m50.f1.toFixed(3)}`);

const handW = Array.from(w.slice(0, D), v => +v.toFixed(3));
const gramW = Array.from(w.slice(D), v => +v.toFixed(3));
const model = {
  bias: +b.toFixed(3), threshold: best.th,
  weights: handW, gram_weights: gramW, names: C.FEATURE_NAMES,
  metrics: { testAcc: +mTest.acc.toFixed(3), testF1: +mTest.f1.toFixed(3), testPrec: +mTest.prec.toFixed(3), testRec: +mTest.rec.toFixed(3), n: test.length }
};
fs.writeFileSync(path.join(__dirname, '..', 'src', 'model.js'),
  '/* 由 test/train.js 生成，数据 thu-coai/COLDataset。' +
  `test acc ${model.metrics.testAcc} F1 ${model.metrics.testF1} n=${model.metrics.n} */\n` +
  'globalThis.LDSModel = ' + JSON.stringify(model) + ';\n');
console.log('已写入 src/model.js，大小', (fs.statSync(path.join(__dirname, '..', 'src', 'model.js')).size / 1024).toFixed(0) + 'KB');
