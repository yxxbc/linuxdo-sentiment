/* DOM 抽取 + 汇总，纯逻辑（传入 root，可在测试里用假 DOM）。 */
(function (global) {
  'use strict';

  function pick(el, sels) {
    for (var i = 0; i < sels.length; i++) {
      var n = el.querySelector(sels[i]);
      if (n) return n;
    }
    return null;
  }

  function txt(n) {
    return n ? (n.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  function extractPosts(root) {
    var all = Array.prototype.slice.call(root.querySelectorAll('article[data-post-id], .topic-post'));
    // 真实的 Discourse 页面里 .topic-post 会被 article 包住，去掉嵌套重复项
    var nodes = all.filter(function (n) {
      for (var j = 0; j < all.length; j++) {
        if (all[j] !== n && all[j].contains(n)) return false;
      }
      return true;
    });
    var out = [];
    // 兼容 crawler/非标准主题：退回到 .cooked
    if (!nodes.length) {
      nodes = Array.prototype.slice.call(root.querySelectorAll('.cooked'));
    }
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var isBody = el.classList && el.classList.contains('cooked');
      var body = isBody ? el : pick(el, ['.cooked', '.post .contents', '.contents']);
      if (!body) continue;
      var scope = isBody && el.closest ? (el.closest('.topic-body, .post, .crawler-post') || el.parentElement) : el;
      var author = pick(scope, ['.username a', 'a[data-user-card]', '.username', '.creator a']);
      var when = pick(el, ['time']);
      out.push({
        el: el,
        id: el.getAttribute ? (el.getAttribute('data-post-id') || '') : '',
        author: txt(author).replace(/^@/, ''),
        text: txt(body),
        time: when ? (when.getAttribute('datetime') || txt(when)) : ''
      });
    }
    return out;
  }

  function extractTopicRows(root) {
    var rows = root.querySelectorAll('tr.topic-list-item');
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var a = pick(r, ['a.title', '.raw-topic-link']);
      if (!a) continue;
      var cat = pick(r, ['.badge-category__name', '.badge-wrapper .badge-category']);
      var replies = pick(r, ['.posts .number', '.posts']);
      var views = pick(r, ['.views .number', '.views']);
      out.push({
        el: r,
        title: txt(a),
        url: a.getAttribute ? a.getAttribute('href') : '',
        category: txt(cat),
        replies: parseInt(txt(replies).replace(/[^\d]/g, ''), 10) || 0,
        views: parseInt(txt(views).replace(/[^\d]/g, ''), 10) || 0
      });
    }
    return out;
  }

  function summarize(scored) {
    var n = scored.length;
    if (!n) return { n: 0, mean: 0, p90: 0, hot: 0, snark: 0, top: [] };
    var sum = 0, hot = 0, snark = 0;
    for (var i = 0; i < n; i++) {
      sum += scored[i].score;
      if (scored[i].score >= 55) hot++;
      else if (scored[i].score >= 30) snark++;
    }
    var sorted = scored.slice().sort(function (a, b) { return a.score - b.score; });
    var idx = Math.min(n - 1, Math.floor(n * 0.9));
    return {
      n: n,
      mean: +(sum / n).toFixed(1),
      p90: sorted[idx].score,
      hot: hot,
      snark: snark,
      top: sorted.slice(-3).reverse()
    };
  }

  var api = { extractPosts: extractPosts, extractTopicRows: extractTopicRows, summarize: summarize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.LDSCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
