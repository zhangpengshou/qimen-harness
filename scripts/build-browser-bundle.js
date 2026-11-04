/**
 * build-browser-bundle.js — 把 engine 的 CommonJS 模块打包成浏览器可直接引用的 IIFE
 *
 * 引擎保持 CommonJS（Node 单测可直接 require），浏览器端由本脚本生成
 * web/qimen.engine.js（挂到 window.QimenEngine），无需任何第三方依赖或打包器。
 *
 * 用法：node scripts/build-browser-bundle.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const ROOT = path.join(__dirname, '..');
const ENGINE = path.join(ROOT, 'src', 'engine');
const OUT = path.join(ROOT, 'web', 'qimen.engine.js');

// 模块顺序：被依赖者在前
const MODULES = ['astro', 'calendar', 'constants', 'ke_ying', 'solar_time', 'cities', 'qimen', 'ai_text'];

const banner = `/**
 * qimen.engine.js — 自动生成，请勿手改。
 * 源码：src/engine/*.js（CommonJS），由 scripts/build-browser-bundle.js 生成。
 * 挂载：window.QimenEngine
 * 生成时间：${new Date().toISOString()}
 */
(function (global) {
  'use strict';
  var factories = {};
  var cache = {};
  function define(id, fn) { factories[id] = fn; }
  function require(id) {
    if (cache[id]) return cache[id].exports;
    var fn = factories[id];
    if (!fn) throw new Error('未找到模块：' + id);
    var module = { exports: {} };
    cache[id] = module;
    fn(module, module.exports, require);
    return module.exports;
  }
`;

const parts = [banner];

/**
 * 把 `module.exports = <表达式>;` 改写为 `Object.assign(module.exports, <表达式>);`
 * 用括号配平定位语句结尾，兼容对象字面量（含箭头函数体内的括号）与函数声明。
 */
function rewriteModuleExports(code) {
  const marker = 'module.exports';
  let idx = code.indexOf(marker);
  if (idx < 0) return code;
  // 只处理最后一次出现（文件末尾的导出语句）
  idx = code.lastIndexOf(marker);
  let i = idx + marker.length;
  while (i < code.length && /\s/.test(code[i])) i += 1;
  if (code[i] !== '=') return code;
  i += 1;
  while (i < code.length && /\s/.test(code[i])) i += 1;
  const exprStart = i;
  // 括号/字符串配平扫描
  let depth = 0;
  let inStr = null;
  let inTpl = 0;
  let inLineComment = false;
  let inBlockComment = false;
  for (; i < code.length; i += 1) {
    const ch = code[i];
    const next = code[i + 1];
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i += 1; }
      continue;
    }
    if (inStr) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (inTpl > 0) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === '`') { inTpl -= 1; continue; }
      if (ch === '$' && next === '{') { depth += 1; i += 1; inTpl += 1; }
      continue;
    }
    if (ch === '/' && next === '/') { inLineComment = true; i += 1; continue; }
    if (ch === '/' && next === '*') { inBlockComment = true; i += 1; continue; }
    if (ch === '"' || ch === "'") { inStr = ch; continue; }
    if (ch === '`') { inTpl += 1; continue; }
    if (ch === '(' || ch === '[' || ch === '{') { depth += 1; continue; }
    if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0) {
        // 表达式在此闭合，向后找分号
        let j = i + 1;
        while (j < code.length && /\s/.test(code[j])) j += 1;
        if (code[j] === ';') j += 1;
        const expr = code.slice(exprStart, i + 1);
        return `${code.slice(0, idx)}Object.assign(module.exports, ${expr});${code.slice(j)}`;
      }
    }
  }
  return code;
}

for (const name of MODULES) {
  const file = path.join(ENGINE, `${name}.js`);
  let code = fs.readFileSync(file, 'utf8');
  // 'use strict' 由外层统一提供
  code = code.replace(/^'use strict';\s*/m, '');
  // require('./x') → require('x')
  code = code.replace(/require\((['"])\.\/([a-zA-Z0-9_]+)\1\)/g, (m, q, id) => `require('${id}')`);
  code = rewriteModuleExports(code);
  parts.push(`define('${name}', function (module, exports, require) {\n${code}\n});\n`);
}

parts.push(`
  var api = {};
  ['astro', 'calendar', 'constants', 'ke_ying', 'solar_time', 'cities', 'qimen'].forEach(function (id) {
    api[id] = require(id);
  });
  // 扁平化导出，便于页面直接使用
  api.buildChart = require('qimen').buildChart;
  api.buildChartFromGivens = require('qimen').buildChartFromGivens;
  api.buildDiPan = require('qimen').buildDiPan;
  api.buildAnGan = require('qimen').buildAnGan;
  api.AN_GAN_ORDER = require('qimen').AN_GAN_ORDER;
  api.AN_GAN_RULE = require('qimen').AN_GAN_RULE;
  api.getKeYing = require('ke_ying').getKeYing;
  api.KE_YING_TABLE_VERSION = require('ke_ying').KE_YING_TABLE_VERSION;
  api.buildAiAnalysisText = require('ai_text').buildAiAnalysisText;
  api.aiAnalysisFileName = require('ai_text').aiAnalysisFileName;
  api.topicShort = require('ai_text').topicShort;
  api.CITIES = require('cities').CITIES;
  api.DEFAULT_CITY = require('cities').DEFAULT_CITY;
  api.searchCities = require('cities').searchCities;
  api.trueSolarTime = require('solar_time').trueSolarTime;
  api.beijingISO = require('solar_time').beijingISO;
  api.sunApparentLongitude = require('astro').sunApparentLongitude;
  api.solarTermAround = require('astro').solarTermAround;
  api.solarTermsOfYear = require('astro').solarTermsOfYear;
  api.equationOfTimeMinutes = require('astro').equationOfTimeMinutes;
  global.QimenEngine = api;
})(typeof window !== 'undefined' ? window : this);
`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, parts.join('\n'), 'utf8');

// 自检：用 Node 的 vm 以浏览器方式载入产物，确认可运行
const vm = require('vm');
const sandbox = { window: {} };
const script = fs.readFileSync(OUT, 'utf8');
try {
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox, { filename: 'qimen.engine.js' });
  const eng = sandbox.window.QimenEngine;
  if (!eng || typeof eng.buildChart !== 'function') throw new Error('产物缺少 buildChart');
  const chart = eng.buildChart({
    datetime: { year: 2026, month: 11, day: 4, hour: 14, minute: 30 },
    location: { name: '北京', lng: 116.4074, lat: 39.9042 },
  });
  if (chart.palaces.length !== 9) throw new Error('产物排盘异常');
  console.log(`已生成 ${path.relative(ROOT, OUT)}（${(script.length / 1024).toFixed(1)} KB）`);
  console.log(`自检通过：${chart.meta.si_zhu.day}日 ${chart.meta.si_zhu.hour}时 ${chart.meta.ju_label}`);
} catch (err) {
  console.error('产物自检失败：', err);
  process.exit(1);
}
