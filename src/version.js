/* 版本比较：语义化 x.y.z，返回 latest 是否比 current 新。纯函数。 */
(function (global) {
  'use strict';

  function parts(v) {
    return String(v || '').replace(/^v/i, '').split('.').map(function (x) {
      var n = parseInt(x, 10);
      return isNaN(n) ? 0 : n;
    });
  }

  function isNewer(current, latest) {
    var a = parts(current), b = parts(latest);
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var x = a[i] || 0, y = b[i] || 0;
      if (y > x) return true;
      if (y < x) return false;
    }
    return false;
  }

  var api = { isNewer: isNewer, parts: parts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.LDSVersion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
