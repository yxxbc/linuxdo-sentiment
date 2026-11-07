/* 面板与行内标记。只做 DOM，不发请求。 */
(function (global) {
  'use strict';

  var BUCKETS = [
    { min: 55, label: '攻击性', cls: 'hot' },
    { min: 30, label: '阴阳/对立', cls: 'snark' },
    { min: 12, label: '有火药', cls: 'warm' },
    { min: 0, label: '平和', cls: 'calm' }
  ];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function bucketOf(score) {
    for (var i = 0; i < BUCKETS.length; i++) if (score >= BUCKETS[i].min) return BUCKETS[i];
    return BUCKETS[BUCKETS.length - 1];
  }

  function chip(score) {
    var b = bucketOf(score);
    return el('span', 'lds-chip ' + b.cls, '戾气 ' + score);
  }

  function bars(scored) {
    var counts = { hot: 0, snark: 0, warm: 0, calm: 0 };
    for (var i = 0; i < scored.length; i++) counts[bucketOf(scored[i].score).cls]++;
    var wrap = el('div', 'lds-bars');
    for (var j = 0; j < BUCKETS.length; j++) {
      var b = BUCKETS[j];
      var row = el('div', 'lds-bar-row');
      row.appendChild(el('span', 'lds-bar-label', b.label));
      var track = el('div', 'lds-track');
      var fill = el('div', 'lds-fill ' + b.cls);
      fill.style.width = Math.round(100 * counts[b.cls] / Math.max(1, scored.length)) + '%';
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el('span', 'lds-bar-num', String(counts[b.cls])));
      wrap.appendChild(row);
    }
    return wrap;
  }

  function panel(summary, opts) {
    var p = el('div', 'lds-panel');
    p.id = 'lds-panel';

    var head = el('div', 'lds-head');
    head.appendChild(el('span', 'lds-title', opts.title || 'L站舆情'));
    var close = el('button', 'lds-x', '×');
    close.title = '收起';
    head.appendChild(close);
    p.appendChild(head);

    var scoreRow = el('div', 'lds-score-row');
    var big = el('div', 'lds-big', String(summary.mean));
    big.appendChild(el('span', 'lds-unit', ' 均分'));
    scoreRow.appendChild(big);
    var meta = el('div', 'lds-meta');
    meta.appendChild(el('div', null, '帖子 ' + summary.n + ' · P90 ' + summary.p90));
    meta.appendChild(el('div', null, '攻击性 ' + summary.hot + ' · 阴阳 ' + summary.snark));
    scoreRow.appendChild(meta);
    p.appendChild(scoreRow);

    p.appendChild(bars(summary.scored || []));

    if (summary.top && summary.top.length) {
      var list = el('div', 'lds-top');
      list.appendChild(el('div', 'lds-sub', '最刺的三条'));
      summary.top.forEach(function (t) {
        var row = el('div', 'lds-top-row');
        var a = el('a', 'lds-top-author', (t.author || '匿名') + ' ' + t.score);
        a.href = '#';
        a.addEventListener('click', function (e) {
          e.preventDefault();
          if (t.el && t.el.scrollIntoView) t.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        });
        row.appendChild(a);
        row.appendChild(el('span', 'lds-top-text', (t.text || '').slice(0, 42)));
        list.appendChild(row);
      });
      p.appendChild(list);
    }

    if (opts.update && opts.update.url) {
      var up = el('div', 'lds-update');
      var ua = el('a', null, '新版本 v' + opts.update.latest + ' 可用 →');
      ua.href = opts.update.url;
      ua.target = '_blank';
      ua.rel = 'noreferrer';
      up.appendChild(ua);
      p.appendChild(up);
    }

    var foot = el('div', 'lds-foot');
    var exportBtn = el('button', 'lds-btn', '导出 JSON');
    exportBtn.addEventListener('click', function () { opts.onExport && opts.onExport(); });
    foot.appendChild(exportBtn);
    var hint = el('span', 'lds-hint', '启发式，仅本地');
    foot.appendChild(hint);
    p.appendChild(foot);

    close.addEventListener('click', function () { p.classList.toggle('lds-collapsed'); });
    return p;
  }

  function mount(node) {
    var old = document.getElementById('lds-panel');
    if (old) old.replaceWith(node); else document.body.appendChild(node);
  }

  function markPost(post, result) {
    // result: {score, features, severe?}
    var host = post.el.querySelector('.topic-meta-data .post-infos, .post-infos, .topic-meta-data');
    if (!host) return;
    var old = host.querySelector('.lds-chip');
    var c = chip(result.score);
    if (result.severe) c.textContent = '攻击 ' + result.score;
    c.title = result.features.map(function (f) { return f.type + ':' + f.term; }).join(' | ') || '无信号';
    if (old) old.replaceWith(c); else host.appendChild(c);
    post.el.classList.toggle('lds-hot-post', !!(result.score >= 55 || result.severe));
  }

  function badge(row, score) {
    var td = row.el.querySelector('.posts');
    if (!td) return;
    var b = row.el.querySelector('.lds-row-score') || el('span', 'lds-row-score');
    b.textContent = String(score);
    b.className = 'lds-row-score ' + bucketOf(score).cls;
    if (!b.parentNode) td.appendChild(b);
  }

  var api = { panel: panel, mount: mount, markPost: markPost, badge: badge, el: el };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.LDSUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
