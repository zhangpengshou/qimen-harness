'use strict';

/**
 * bundle.test.js — 浏览器产物自检
 * 确保 web/qimen.engine.js 可用、导出完整、与 Node 端结果一致。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const BUNDLE = path.join(ROOT, 'web', 'qimen.engine.js');

function loadBundle() {
  const code = fs.readFileSync(BUNDLE, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'qimen.engine.js' });
  return sandbox.window.QimenEngine;
}

test('浏览器产物存在且可加载', () => {
  assert.ok(fs.existsSync(BUNDLE), '缺少 web/qimen.engine.js，请先 npm run build');
  const E = loadBundle();
  assert.ok(E, '产物未挂载 window.QimenEngine');
});

test('产物导出关键 API', () => {
  const E = loadBundle();
  for (const k of ['buildChart', 'buildChartFromGivens', 'buildDiPan', 'buildAnGan', 'getKeYing', 'trueSolarTime', 'CITIES']) {
    assert.equal(typeof E[k] === 'function' || Array.isArray(E[k]), true, `缺少导出 ${k}`);
  }
  assert.ok(E.constants && E.constants.PALACES.length === 9);
  assert.ok(E.constants.BRANCH_PALACE);
  assert.ok(E.constants.STEM_MEANINGS && E.constants.STEM_MEANINGS['甲']);
  assert.equal(E.KE_YING_TABLE_VERSION, '81-gan-ke-ying-v1');
  // 跨 vm realm 的数组原型不同，用 JSON 比较
  assert.equal(JSON.stringify(E.AN_GAN_ORDER), JSON.stringify(['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙']));
});

test('产物：暗干与芮禽字段与 Node 端一致', () => {
  const E = loadBundle();
  const { buildChart } = require('../src/engine/qimen');
  const opts = {
    datetime: { year: 2026, month: 11, day: 4, hour: 14, minute: 30 },
    location: { name: '北京', lng: 116.4074, lat: 39.9042 },
  };
  const a = buildChart(opts);
  const b = E.buildChart(opts);
  assert.equal(JSON.stringify(b.palaces.map((p) => p.an_gan)), JSON.stringify(a.palaces.map((p) => p.an_gan)));
  assert.equal(JSON.stringify(b.palaces.map((p) => p.star_display)), JSON.stringify(a.palaces.map((p) => p.star_display)));
  assert.equal(b.meta.an_gan_rule, 'shigan-feibu-v1');
});

test('产物排盘结果与 Node 端完全一致', () => {
  const E = loadBundle();
  const { buildChart } = require('../src/engine/qimen');
  const opts = {
    datetime: { year: 2026, month: 11, day: 4, hour: 14, minute: 30 },
    location: { name: '北京', lng: 116.4074, lat: 39.9042 },
    ruMuKouJing: 'A',
    predictionTopic: '一致性校验',
  };
  const a = buildChart(opts);
  const b = E.buildChart(opts);
  // 跨 vm realm 的对象原型不同，统一用 JSON 比较
  assert.equal(JSON.stringify(b.palaces), JSON.stringify(a.palaces));
  assert.equal(b.meta.ju_label, a.meta.ju_label);
  assert.equal(b.meta.true_solar_time, a.meta.true_solar_time);
  assert.equal(b.meta.si_zhu.hour, a.meta.si_zhu.hour);
});

test('产物的十干克应查询可用', () => {
  const E = loadBundle();
  const ky = E.getKeYing('辛', '癸');
  assert.equal(ky.name, '天牢华盖');
});

test('产物：AI 分析文本导出与 Node 端完全一致', () => {
  const E = loadBundle();
  const { buildChart } = require('../src/engine/qimen');
  const { buildAiAnalysisText, aiAnalysisFileName } = require('../src/engine/ai_text');
  const opts = {
    datetime: { year: 2026, month: 11, day: 4, hour: 14, minute: 30 },
    location: { name: '北京', lng: 116.4074, lat: 39.9042 },
    predictionTopic: '测出行',
  };
  assert.equal(typeof E.buildAiAnalysisText, 'function');
  assert.equal(typeof E.aiAnalysisFileName, 'function');
  const a = buildAiAnalysisText(buildChart(opts));
  const b = E.buildAiAnalysisText(E.buildChart(opts));
  assert.equal(b, a);
  assert.equal(E.aiAnalysisFileName(E.buildChart(opts)), aiAnalysisFileName(buildChart(opts)));
  assert.match(b, /## 四、 AI 分析提示语/);
});
