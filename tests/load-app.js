/* 브라우저 없이 실제 앱 스크립트(app.js, teacher.js)를 가짜 화면 환경에서 불러와요. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
function loadApp(files = ['app.js', 'teacher.js']) {
  const noop = () => {};
  const el = () => ({ style: {}, appendChild: noop, remove: noop, setAttribute: noop, classList: { add: noop, remove: noop } });
  const ctx = vm.createContext({
    console, setTimeout, clearTimeout, setInterval, clearInterval, Promise, Date, Math, JSON, Object, Array, Set, Map, Number, String, parseInt, parseFloat, isNaN, URL, Uint8Array,
    document: { getElementById: () => null, createElement: el, head: { appendChild: noop }, body: { appendChild: noop, contains: () => false }, addEventListener: noop, querySelector: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: () => null, setItem: noop }, navigator: {}, location: {}, crypto: { randomUUID: () => 'x' }
  });
  ctx.window = ctx; ctx.addEventListener = noop; ctx.APP_CONFIG = {};
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx;
}
module.exports = { loadApp };
