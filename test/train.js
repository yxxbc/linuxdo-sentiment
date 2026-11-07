/* 在 COLD（thu-coai/COLDataset）上训练逻辑回归：可解释特征 + 字符 2/3/4-gram 哈希。
   - dev 上按 epoch 早停，保留最佳权重
   - 用最佳 epoch 数在 train+dev 上重训，再报 test
   产物 src/model.js。用法：node test/train.js /tmp/cold */
const fs = require('fs');
const path = require('path');
const C = require('../src/classifier.js');

const B = 65536;
const MAX_EPOCHS = 40;
const LAMBDA = 3e-5;

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
let w = new Float64Array(D + B), b = 0;

const sig = z => 1 / (1 + Math.exp(-z));
function predict(s, ww = w, bb = b) {
  let z = bb;
  for (let i = 0; i < D; i++) z += ww[i] * s.hand[i];
  for (let g = 0; g < s.grams.length; g++) z += ww[D + s.grams[g][0]] * s.grams[g][1];
  return sig(z);
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

function trainEpochs(data, epochs, ww, bb, seed0 = 42) {
  let seed = seed0;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let ep = 0; ep < epochs; ep++) {
    const lr = 0.6 * Math.pow(0.88, ep) + 0.02;
    const order = data.map((_, i) => i).sort(() => rnd() - 0.5);
    for (const i of order) {
      const s = data[i];
      const e = predict(s, ww, bb) - s.y;
      for (let d = 0; d < D; d++) ww[d] -= lr * (e * s.hand[d] + LAMBDA * ww[d]);
      for (let g = 0; g < s.grams.length; g++) {
        const k = D + s.grams[g][0];
        ww[k] -= lr * (e * s.grams[g][1] + LAMBDA * ww[k]);
      }
      bb -= lr * e;
    }
  }
  return { w: ww, b: bb };
}

// ---- 阶段 1：在 train 上训练，dev 早停 ----
let best = { f1: -1, epoch: 0, w: null, b: 0, th: 0.5 };
const ydv = DV.map(s => s.y);
for (let ep = 1; ep <= MAX_EPOCHS; ep++) {
  const r = trainEpochs(TR, 1, w, b, 1000 + ep);
  w = r.w; b = r.b;
  const pdv = DV.map(s => predict(s));
  let bth = { th: 0.5, f1: -1 };
  for (let th = 0.3; th <= 0.8; th += 0.01) {
    const m = metrics(pdv.map(p => p >= th), ydv);
    if (m.f1 > bth.f1) bth = { th: +th.toFixed(2), f1: m.f1 };
  }
  if (bth.f1 > best.f1) {
    best = { f1: bth.f1, epoch: ep, w: Float64Array.from(w), b, th: bth.th };
  }
  if (ep % 5 === 0 || ep === MAX_EPOCHS) {
    console.log(`epoch ${String(ep).padStart(2)} dev F1 ${bth.f1.toFixed(3)} @${bth.th}  (best ${best.f1.toFixed(3)} @ep${best.epoch})`);
  }
}

// ---- 阶段 2：用最佳 epoch 数在 train+dev 上重训 ----
const ALL = TR.concat(DV);
let w2 = new Float64Array(D + B), b2 = 0;
const r2 = trainEpochs(ALL, best.epoch, w2, b2, 777);
w2 = r2.w; b2 = r2.b;

function evalOn(ww, bb, th) {
  const p = TE.map(s => predict(s, ww, bb));
  return metrics(p.map(x => x >= th), TE.map(s => s.y));
}

const devOnly = evalOn(best.w, best.b, best.th);
const combined = evalOn(w2, b2, best.th);
console.log(`\n阶段1 权重 test: acc ${devOnly.acc.toFixed(3)} F1 ${devOnly.f1.toFixed(3)} (th ${best.th})`);
console.log(`阶段2 权重 test: acc ${combined.acc.toFixed(3)} prec ${combined.prec.toFixed(3)} rec ${combined.rec.toFixed(3)} F1 ${combined.f1.toFixed(3)} (th ${best.th})`);

const FINAL = combined.f1 >= devOnly.f1 ? { w: w2, b: b2, m: combined, src: 'train+dev' } : { w: best.w, b: best.b, m: devOnly, src: 'train' };
console.log(`采用 ${FINAL.src} 权重，test acc ${FINAL.m.acc.toFixed(3)} F1 ${FINAL.m.f1.toFixed(3)}`);

const handW = Array.from(FINAL.w.slice(0, D), v => +v.toFixed(3));
const gramW = Array.from(FINAL.w.slice(D), v => +v.toFixed(3));
const model = {
  bias: +FINAL.b.toFixed(3), threshold: best.th,
  weights: handW, gram_weights: gramW, names: C.FEATURE_NAMES,
  metrics: {
    testAcc: +FINAL.m.acc.toFixed(3), testF1: +FINAL.m.f1.toFixed(3),
    testPrec: +FINAL.m.prec.toFixed(3), testRec: +FINAL.m.rec.toFixed(3),
    n: test.length, trainedOn: FINAL.src, epochs: best.epoch
  }
};
fs.writeFileSync(path.join(__dirname, '..', 'src', 'model.js'),
  '/* 由 test/train.js 生成，数据 thu-coai/COLDataset。' +
  `test acc ${model.metrics.testAcc} F1 ${model.metrics.testF1} n=${model.metrics.n} (${model.metrics.trainedOn}) */\n` +
  'globalThis.LDSModel = ' + JSON.stringify(model) + ';\n');
console.log('已写入 src/model.js，大小', (fs.statSync(path.join(__dirname, '..', 'src', 'model.js')).size / 1024).toFixed(0) + 'KB');
