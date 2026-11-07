/* 入口：识别页面类型 → 抽取 → 打分 → 面板 + 行内标记 → 本地汇总。 */
(function () {
  'use strict';

  var C = window.LDSClassifier;
  var Core = window.LDSCore;
  var UI = window.LDSUI;
  if (!C || !Core || !UI) return;

  var state = { analyzed: new WeakSet(), posts: [] };

  function dayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function storeAggregate(rec) {
    try {
      chrome.storage.local.get({ days: {}, byCat: {} }, function (data) {
        var days = data.days || {};
        var d = days[dayKey()] || { n: 0, sum: 0, hot: 0, snark: 0 };
        d.n += rec.n; d.sum += rec.sum; d.hot += rec.hot; d.snark += rec.snark;
        days[dayKey()] = d;

        var byCat = data.byCat || {};
        if (rec.category) {
          var c = byCat[rec.category] || { n: 0, sum: 0, hot: 0 };
          c.n += rec.n; c.sum += rec.sum; c.hot += rec.hot;
          byCat[rec.category] = c;
        }
        // 只保留 90 天
        var keys = Object.keys(days).sort();
        while (keys.length > 90) delete days[keys.shift()];

        chrome.storage.local.set({ days: days, byCat: byCat });
      });
    } catch (e) { /* 非扩展环境（测试页）忽略 */ }
  }

  function analyzeTopic() {
    var posts = Core.extractPosts(document);
    if (!posts.length) return;
    var scored = [];
    posts.forEach(function (p) {
      if (!p.text || state.analyzed.has(p.el)) return;
      state.analyzed.add(p.el);
      var r = C.score(p.text);
      var off = C.offensive ? C.offensive(p.text) : null;
      if (off && off.severe) { r.severe = true; r.score = Math.max(r.score, 60); }
      p.score = r.score; p.features = r.features;
      scored.push({ score: r.score, author: p.author, text: p.text, el: p.el, features: r.features });
      p.result = r;
      UI.markPost(p, r);
    });
    state.posts = state.posts.concat(scored);
    if (!scored.length) return;

    var s = Core.summarize(state.posts);
    s.scored = state.posts;
    var category = (document.querySelector('.badge-category__name') || {}).textContent || '';
    storeAggregate({ n: scored.length, sum: state.posts.reduce(function (a, b) { return a + b.score; }, 0), hot: s.hot, snark: s.snark, category: category.trim() });

    var mount = function (update) {
      UI.mount(UI.panel(s, {
        title: 'L站舆情 · 本主题',
        update: update,
        onExport: function () {
        var data = {
          url: location.href,
          title: document.title,
          summary: { n: s.n, mean: s.mean, p90: s.p90, hot: s.hot, snark: s.snark },
          posts: state.posts.map(function (p) {
            return { author: p.author, score: p.score, text: p.text.slice(0, 400), features: p.features };
          })
        };
        download('lds-topic-' + Date.now() + '.json', JSON.stringify(data, null, 2));
        }
      }));
    };

    try {
      chrome.storage.local.get({ update: null }, function (data) {
        var u = data.update;
        var cur = chrome.runtime.getManifest().version;
        if (u && u.newer && window.LDSVersion && window.LDSVersion.isNewer(cur, u.latest)) {
          mount({ latest: u.latest, url: u.url || 'https://github.com/yxxbc/linuxdo-sentiment/releases/latest' });
        } else {
          mount(null);
        }
      });
    } catch (e) {
      mount(null);
    }
  }

  function analyzeList() {
    var rows = Core.extractTopicRows(document);
    if (!rows.length) return;
    var scored = 0;
    rows.forEach(function (r) {
      if (state.analyzed.has(r.el)) return;
      state.analyzed.add(r.el);
      // 列表页只有标题：用标题做弱信号，避免误判，按 0.6 折算
      var res = C.score(r.title);
      UI.badge(r, Math.round(res.score * 0.6));
      scored++;
    });
    if (!scored) return;
    if (!document.getElementById('lds-list-note')) {
      var n = UI.el('div', 'lds-list-note', '标题戾气已标注在回复数旁（标题信号弱，仅作导航）');
      n.id = 'lds-list-note';
      document.body.appendChild(n);
      setTimeout(function () { n.classList.add('lds-fade'); }, 4000);
    }
  }

  function download(name, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function run() {
    if (/^\/t\//.test(location.pathname)) analyzeTopic();
    else if (/^\/(latest|top|new|c\/|tag\/)/.test(location.pathname)) analyzeList();
  }

  // Discourse 是无限滚动，新楼层进 DOM 后再算一次
  var t = null;
  var mo = new MutationObserver(function () {
    clearTimeout(t);
    t = setTimeout(run, 600);
  });
  mo.observe(document.body, { childList: true, subtree: true });

  run();
})();
