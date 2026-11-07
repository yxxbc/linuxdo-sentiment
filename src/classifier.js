/* 文本戾气/阴阳怪气启发式打分器 —— 纯函数，可单测，不联网。
   分数是“信号强度”，不是判决：命中越多越像，但语义仍可能反讽或误伤。 */
(function (global) {
  'use strict';

  var WEIGHT = {
    attack: 40,      // 指向具体人的攻击（你/他 + 贬义）
    insult: 16,      // 贬义称谓
    sarcasm: 11,     // 阴阳套话
    rhetorical: 7,   // 反问句式
    stance: 9,       // 对厂商/群体的对立性贬损
    intensify: 4,    // 绝对化/程度强化
    profanity: 26,   // 脏话
    threat: 30,      // 暴力威胁
    condescend: 7,   // 居高临下
    emphatic: 4,     // 问号/感叹密度
    emoji: 8,
    punct: 4
  };

  var LEX = {
    attack: [
      '傻逼', '煞笔', '傻b', '脑残', '弱智', '智障', '废物', '蠢货', '蠢猪', '狗东西',
      '杂种', '你妈', '尼玛', '滚出去', '闭嘴', '有病', '精神病', '巨婴', '你也配',
      '你算什么东西', '你有什么资格', '谁给你勇气', '你懂个屁', '别丢人了', '丢人现眼',
      '就你这', '你这人', '你这种人', '你们这些', '小学生水平', '也配'
    ],
    insult: [
      '垃圾', '菜鸡', '拉胯', '笑话', '小丑', '杠精', '喷子', '键盘侠', '水军', '孝子',
      '舔狗', '韭菜', '懂哥', '乐子人', '收收味', '破防', '逆天', '离谱', '晦气'
    ],
    sarcasm: [
      '典中典', '太典了', '赢麻了', '遥遥领先', '高情商', '您可真', '您老', '学到了',
      '已严肃学习', '受教了', '就这', '还得是你', '你开心就好', '尊重祝福', '好的呢',
      '加油哦', '建议多读书', '难怪', '怪不得', '呵呵', '是啊是啊', '笑死', '难绷',
      '绷不住', '您说得对', '你说的都对', '有内味', '味儿对了', '急了', '收收味'
    ],
    rhetorical: [
      '难道', '凭什么', '哪来的', '谁告诉你', '这也叫', '你怎么不', '你倒是', '能不能别',
      '这也配', '谁给你的'
    ],
    stance: ['智商税', '割韭菜', '洗地', '收钱', '公关稿', '恶心', '缝合', '抄袭', '蹭'],
    // 脏话/强侮辱：参照 ToxiCN(general) 与 COLD 语料里高频项，只收高精度词
    profanity: [
      '他妈的', '你他妈的', '你妈的', '你妈', '妈的', '尼玛', '操你', '艹你', '草你', '日你',
      '傻逼', '傻b', '傻卵', '煞笔', '萨比', '沙雕', '智障', '弱智', '脑残', '傻缺', '白痴',
      '去死', '死全家', '王八蛋', '混蛋', '畜生', '孽畜', '杂种', '杂碎', '野种', '狗东西',
      '人渣', '败类', '下三滥', '贱人', '贱货', '婊子', '母狗', '骚货', '荡妇', '妓女',
      '滚蛋', '滚粗', '给我滚', '几把', '鸡巴', '屌逼', '干你', '草泥马', '尼玛币'
    ],
    // 威胁（口语里的“两拳”也算，社区里它就是威胁姿态）
    threat: ['邦邦两拳', '两拳', '打你', '揍你', '抽你', '弄死', '砍死', '捅死', '扇你', '一巴掌', '打死你', '杀你'],
    // 居高临下/训人
    condescend: ['水中水', '水硕', '就这', '绝了', '自欺欺人', '可怜之人', '说白了', '低能', '是谁告诉你', '根本就没'],
    // 群体/地域/性别蔑称：参照 ToxiCN(racism/region/sexism/LGBT) 里无歧义的条目
    slur: [
      '尼哥', '倪哥', '黑鬼', '黑奴', '白皮猪', '棒子', '小日本', '鬼子', '倭寇', '阿三',
      '乡巴佬', '基佬', '娘炮', '人妖', '女拳', '拳师', '幕刃', '亩人', '国楠', '龟男',
      '小仙女', '婚驴', '剩女', '废物点心'
    ],
    intensify: ['一点都', '完全', '根本', '从来', '永远', '全是', '每次', '又是', '果然', '压根', '纯粹'],
    emoji: ['🙃', '🙂', '😅', '🤡', '👏', '🥰']
  };

  // 单字/易误伤词用正则，带边界
  var REGEX_TERMS = [
    { type: 'sarcasm', term: '典', re: /(^|[，。！？、\s])典([，。！？、\s]|$)/ },
    { type: 'sarcasm', term: '绷', re: /绷(不住|了)/ },
    { type: 'insult', term: '菜', re: /(^|[，。！？\s])菜([，。！？\s]|$)/ },
    { type: 'sarcasm', term: '说得对', re: /(说得|说的)(都对|对)/ },
    { type: 'sarcasm', term: '多读点书', re: /多读(点|些)书|建议多读/ },
    { type: 'profanity', term: '逼样', re: /(啥|傻|沙|杀|煞)逼(样|子|毛|人)?/ },
    { type: 'profanity', term: '妈的', re: /(他|你|tm|tmd|md)的?妈/ }
  ];

  var ZH_PUNCT = /[！!]{2,}|[？?]{2,}|。{3,}/g;

  function mask(text) {
    var t = text;
    t = t.replace(/垃圾佬/g, '███');
    return t;
  }

  function countHits(text, list) {
    var hits = [];
    for (var i = 0; i < list.length; i++) {
      var term = list[i];
      var idx = text.indexOf(term);
      if (idx >= 0) hits.push(term);
    }
    return hits;
  }

  function nearPerson(text, term) {
    var re = /(你|您|他|她|这人|这人|楼主|楼上)/;
    var i = text.indexOf(term);
    if (i < 0) return false;
    var seg = text.slice(Math.max(0, i - 14), i + term.length + 6);
    return re.test(seg);
  }

  function score(input) {
    var text = String(input || '');
    var masked = mask(text);
    var features = [];
    var raw = 0;

    // 1. 指向人的攻击：词 + 人称呼应才算
    var atk = countHits(masked, LEX.attack);
    for (var i = 0; i < atk.length; i++) {
      var w = WEIGHT.attack;
      if (!nearPerson(masked, atk[i])) w = Math.round(w * 0.45);
      raw += w;
      features.push({ type: 'attack', term: atk[i], weight: w });
    }

    // 2. 贬义称谓（不必然指人）
    var ins = countHits(masked, LEX.insult);
    for (var j = 0; j < ins.length; j++) {
      var wi = WEIGHT.insult;
      if (nearPerson(masked, ins[j])) wi = Math.round(wi * 1.6);
      raw += wi;
      features.push({ type: 'insult', term: ins[j], weight: wi });
    }

    // 3. 阴阳套话
    var sar = countHits(masked, LEX.sarcasm);
    for (var k = 0; k < sar.length; k++) {
      raw += WEIGHT.sarcasm;
      features.push({ type: 'sarcasm', term: sar[k], weight: WEIGHT.sarcasm });
    }

    // 4. 反问
    var rht = countHits(masked, LEX.rhetorical);
    for (var m = 0; m < rht.length; m++) {
      raw += WEIGHT.rhetorical;
      features.push({ type: 'rhetorical', term: rht[m], weight: WEIGHT.rhetorical });
    }

    // 5. 立场性贬损
    var st = countHits(masked, LEX.stance);
    for (var n = 0; n < st.length; n++) {
      raw += WEIGHT.stance;
      features.push({ type: 'stance', term: st[n], weight: WEIGHT.stance });
    }

    // 5b. 脏话
    var pf = countHits(masked, LEX.profanity);
    for (var pp = 0; pp < Math.min(pf.length, 2); pp++) {
      var wp = nearPerson(masked, pf[pp]) ? Math.round(WEIGHT.profanity * 1.3) : WEIGHT.profanity;
      raw += wp;
      features.push({ type: 'profanity', term: pf[pp], weight: wp });
    }

    // 5c. 威胁
    var th = countHits(masked, LEX.threat);
    if (th.length) {
      raw += WEIGHT.threat * Math.min(th.length, 2);
      features.push({ type: 'threat', term: th.slice(0, 2).join('/'), weight: WEIGHT.threat });
    }

    // 5d. 居高临下
    var cd = countHits(masked, LEX.condescend);
    if (cd.length) {
      raw += WEIGHT.condescend * Math.min(cd.length, 2);
      features.push({ type: 'condescend', term: cd.slice(0, 2).join('/'), weight: WEIGHT.condescend });
    }

    // 5e. 问号/感叹密度
    var qm = (masked.match(/[？?]/g) || []).length;
    if (qm >= 2) {
      raw += WEIGHT.emphatic * Math.min(qm - 1, 2);
      features.push({ type: 'emphatic', term: '？？×' + qm, weight: WEIGHT.emphatic });
    }

    // 6. 绝对化
    var it = countHits(masked, LEX.intensify);
    if (it.length) {
      raw += WEIGHT.intensify * Math.min(it.length, 3);
      features.push({ type: 'intensify', term: it.slice(0, 3).join('/'), weight: WEIGHT.intensify });
    }

    // 7. 阴阳 emoji
    var em = countHits(masked, LEX.emoji);
    if (em.length) {
      raw += WEIGHT.emoji * Math.min(em.length, 2);
      features.push({ type: 'emoji', term: em.join(''), weight: WEIGHT.emoji });
    }

    // 8. 标点轰炸：!!! ??? …… 同时出现更可疑
    // 8b. 单字词（带边界）
    for (var q = 0; q < REGEX_TERMS.length; q++) {
      var rt = REGEX_TERMS[q];
      if (rt.re.test(masked)) {
        raw += WEIGHT[rt.type];
        features.push({ type: rt.type, term: rt.term, weight: WEIGHT[rt.type] });
      }
    }

    var p = masked.match(ZH_PUNCT) || [];
    if (p.length) {
      raw += WEIGHT.punct * Math.min(p.length, 3);
      features.push({ type: 'punct', term: p.join(''), weight: WEIGHT.punct });
    }

    // 9. 短句纯情绪（<=8 字且带贬义）加权
    if (text.length <= 8 && (atk.length || ins.length)) raw += 8;

    var s = Math.round(100 * (1 - Math.exp(-raw / 60)));
    if (s > 100) s = 100;

    return {
      score: s,
      label: labelFor(s),
      features: features,
      raw: raw
    };
  }

  function labelFor(s) {
    if (s < 12) return '平和';
    if (s < 30) return '有火药味';
    if (s < 55) return '阴阳/对立';
    return '攻击性';
  }

  /* ---------- 用于训练/推理的数值特征（与 model.js 的权重一一对应） ---------- */
  var FEATURE_NAMES = [
    'len', 'loglen', 'prof', 'slur', 'attack', 'insult', 'sarc', 'rhet', 'stance',
    'inten', 'emoji', 'punct', 'excl', 'quest', 'p2', 'at', 'digit', 'latin', 'rep', 'badratio', 'short'
  ];

  function cap5(n) { return Math.min(n, 5) / 5; }

  function feats(input) {
    var text = mask(String(input || ''));
    var len = text.length;
    var prof = countHits(text, LEX.profanity).length;
    for (var rp = 0; rp < REGEX_TERMS.length; rp++) {
      if (REGEX_TERMS[rp].type === 'profanity' && REGEX_TERMS[rp].re.test(text)) prof += 1;
    }
    var slur = countHits(text, LEX.slur).length;
    var atk = countHits(text, LEX.attack).length;
    var ins = countHits(text, LEX.insult).length;
    var sar = countHits(text, LEX.sarcasm).length;
    var rht = countHits(text, LEX.rhetorical).length;
    var stn = countHits(text, LEX.stance).length;
    var itn = countHits(text, LEX.intensify).length;
    var emj = countHits(text, LEX.emoji).length;
    var pn = (text.match(ZH_PUNCT) || []).length;
    var latin = (text.match(/[a-zA-Z]/g) || []).length;
    var vals = [
      Math.min(len, 200) / 200,
      Math.log(1 + len) / 6,
      cap5(prof), cap5(slur), cap5(atk), cap5(ins), cap5(sar), cap5(rht), cap5(stn),
      cap5(itn), cap5(emj), cap5(pn),
      /[！!]{2,}/.test(text) ? 1 : 0,
      /[？?]{2,}/.test(text) ? 1 : 0,
      /(你|您|他|她)/.test(text) ? 1 : 0,
      /@[\w\u4e00-\u9fa5]+/.test(text) ? 1 : 0,
      /\d/.test(text) ? 1 : 0,
      len ? latin / len : 0,
      /(.)\1{2,}/.test(text) ? 1 : 0,
      Math.min(5, (prof + slur + atk + ins) / Math.max(4, len) * 10) / 5,
      (len <= 6 && (prof + slur + atk) > 0) ? 1 : 0
    ];
    return { names: FEATURE_NAMES, values: vals };
  }

  function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }

  /* 字符 2/3-gram 哈希特征：中文短文本上比词表稳，训练和推理共用同一套哈希 */
  var NGRAM_B = 16384;
  function hashGram(text, start, n) {
    var h = 5381;
    for (var i = start; i < start + n; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
    return h % NGRAM_B;
  }
  function grams(input) {
    var text = mask(String(input || '')).replace(/\s+/g, ' ');
    var out = [], total = 0;
    for (var n = 2; n <= 4; n++) {
      for (var i = 0; i + n <= text.length; i++) {
        out.push(hashGram(text, i, n));
        total++;
      }
    }
    if (!total) return [];
    var count = {};
    for (var j = 0; j < out.length; j++) count[out[j]] = (count[out[j]] || 0) + 1;
    var arr = [];
    for (var k in count) arr.push([+k, count[k] / total]);
    return arr;
  }

  // 需要 src/model.js 提供 LDSModel（由 test/train.js 生成）
  function offensive(input) {
    var m = global.LDSModel;
    if (!m) return null;
    var f = feats(input);
    var z = m.bias;
    for (var i = 0; i < f.values.length; i++) z += m.weights[i] * f.values[i];
    var g = grams(input);
    for (var j = 0; j < g.length; j++) z += m.gram_weights[g[j][0]] * g[j][1];
    var p = sigmoid(z);
    // 0.80 是在 COLD test 上 precision≈0.91 的高置信档，用来只标“明确攻击”
    return { p: p, score: Math.round(p * 100), hit: p >= m.threshold, severe: p >= 0.80 };
  }

  var api = {
    score: score, labelFor: labelFor, LEX: LEX, WEIGHT: WEIGHT,
    feats: feats, grams: grams, FEATURE_NAMES: FEATURE_NAMES, offensive: offensive
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.LDSClassifier = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
