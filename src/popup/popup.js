/* 弹窗：只读本地计数；网络请求仅在点“检查更新”时发生（GitHub API，无正文）。 */
(function () {
  'use strict';

  var REPO = 'yxxbc/linuxdo-sentiment';
  var ver = chrome.runtime.getManifest().version;
  document.getElementById('ver').textContent = 'v' + ver;

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  chrome.storage.local.get({ days: {}, byCat: {} }, function (data) {
    var d = (data.days || {})[todayKey()];
    var n = d ? d.n : 0;
    document.getElementById('n').textContent = n;
    document.getElementById('mean').textContent = d && d.n ? (d.sum / d.n).toFixed(1) : '–';
    document.getElementById('hot').textContent = d ? d.hot : 0;
    document.getElementById('snark').textContent = d ? d.snark : 0;
    if (!n) document.getElementById('empty').hidden = false;

    var cats = Object.keys(data.byCat || {}).map(function (k) {
      var c = data.byCat[k];
      return { name: k, n: c.n, mean: c.n ? c.sum / c.n : 0 };
    }).filter(function (c) { return c.n >= 10; })
      .sort(function (a, b) { return b.mean - a.mean; })
      .slice(0, 4);

    var box = document.getElementById('cats');
    if (!cats.length) return;
    box.appendChild(el('div', 'lbl', '分类均分（累计，≥10 帖）'));
    var max = 60;
    cats.forEach(function (c) {
      var row = el('div', 'row');
      row.appendChild(el('span', 'cat', c.name));
      var bar = el('div', 'bar');
      var fill = el('div', 'fill');
      fill.style.width = Math.min(100, Math.round(100 * c.mean / max)) + '%';
      fill.style.background = c.mean >= 55 ? '#e5484d' : c.mean >= 30 ? '#f5a524' : '#3d8b6b';
      bar.appendChild(fill);
      row.appendChild(bar);
      row.appendChild(el('span', 'val', c.mean.toFixed(0)));
      box.appendChild(row);
    });
  });

  document.getElementById('check').addEventListener('click', function () {
    var msg = document.getElementById('msg');
    msg.textContent = '检查中…';
    fetch('https://api.github.com/repos/' + REPO + '/releases/latest', {
      headers: { 'Accept': 'application/vnd.github+json' }
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (rel) {
      var latest = String(rel.tag_name || '').replace(/^v/, '');
      if (!latest) throw new Error('无 tag');
      if (latest === ver) {
        msg.textContent = '已是最新 v' + ver;
      } else {
        msg.innerHTML = '';
        msg.appendChild(document.createTextNode('有新版本 v' + latest + '：'));
        var a = document.createElement('a');
        a.href = rel.html_url;
        a.target = '_blank';
        a.rel = 'noreferrer';
        a.textContent = '下载';
        a.style.color = '#7aa2f7';
        msg.appendChild(a);
      }
    }).catch(function (e) {
      msg.textContent = '检查失败：' + e.message;
    });
  });
})();
