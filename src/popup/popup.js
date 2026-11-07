/* 弹窗：只读本地计数；版本检查走静态 version.json（普通 URL，不是 API）。
   检查结果写回 storage，面板据此显示更新提示，内容页本身不发请求。 */
(function () {
  'use strict';

  // 两个静态源：jsDelivr 刷新快，raw 兜底（两者都带 CORS）
  var VERSION_URLS = [
    'https://cdn.jsdelivr.net/gh/yxxbc/linuxdo-sentiment@main/version.json',
    'https://raw.githubusercontent.com/yxxbc/linuxdo-sentiment/main/version.json'
  ];
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

  var msg = document.getElementById('msg');

  function showUpdate(latest, url) {
    msg.innerHTML = '';
    msg.appendChild(document.createTextNode('有新版本 v' + latest + '，'));
    var a = document.createElement('a');
    a.href = url;
    a.textContent = '去更新';
    a.style.color = '#7aa2f7';
    a.addEventListener('click', function (e) {
      e.preventDefault();
      chrome.tabs.create({ url: url });
    });
    msg.appendChild(a);
  }

  function fetchVersion(i) {
    if (i >= VERSION_URLS.length) return Promise.reject(new Error('所有源都不可用'));
    return fetch(VERSION_URLS[i] + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        if (!data || !data.version) throw new Error('无版本号');
        return data;
      })
      .catch(function () { return fetchVersion(i + 1); });
  }

  function checkUpdate() {
    msg.textContent = '检查中…';
    fetchVersion(0)
      .then(function (data) {
        var latest = String(data.version || '');
        if (!latest) throw new Error('version.json 无版本号');
        var newer = window.LDSVersion.isNewer(ver, latest);
        chrome.storage.local.set({ update: { latest: latest, url: data.url || '', checkedAt: Date.now(), newer: newer } });
        if (newer) showUpdate(latest, data.url || 'https://github.com/yxxbc/linuxdo-sentiment/releases/latest');
        else msg.textContent = '已是最新 v' + ver;
      })
      .catch(function (e) {
        msg.textContent = '检查失败：' + e.message;
      });
  }

  chrome.storage.local.get({ days: {}, byCat: {}, update: null }, function (data) {
    var d = (data.days || {})[todayKey()];
    var n = d ? d.n : 0;
    document.getElementById('n').textContent = n;
    document.getElementById('mean').textContent = d && d.n ? (d.sum / d.n).toFixed(1) : '–';
    document.getElementById('hot').textContent = d ? d.hot : 0;
    document.getElementById('snark').textContent = d ? d.snark : 0;
    if (!n) document.getElementById('empty').hidden = false;

    // 先展示上次的检查结果，避免每次打开都请求
    var up = data.update;
    if (up && up.newer && window.LDSVersion.isNewer(ver, up.latest)) {
      showUpdate(up.latest, up.url || 'https://github.com/yxxbc/linuxdo-sentiment/releases/latest');
    } else if (up && Date.now() - up.checkedAt < 6 * 3600 * 1000) {
      msg.textContent = '已是最新 v' + ver;
    } else {
      checkUpdate();
    }

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

  document.getElementById('check').addEventListener('click', checkUpdate);
})();
