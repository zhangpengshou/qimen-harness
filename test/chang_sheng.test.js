'use strict';

/**
 * chang_sheng.test.js — 十二长生（天干落宫旺衰）验收
 *
 * 口径：十干长生起支（阳顺阴逆）→ 十二地支寄九宫（四隅宫按干阴阳择支）→ 中五寄坤二。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  STAGES,
  START_BRANCH,
  PALACE_BRANCHES,
  LEVEL,
  MEANING,
  changShengOf,
  changShengTable,
} = require('../src/engine/chang_sheng');
const { buildChart } = require('../src/engine/qimen');
const { buildAiAnalysisText } = require('../src/engine/ai_text');

const beijing = { name: '北京', lng: 116.4074, lat: 39.9042 };
const dt = { year: 2026, month: 11, day: 4, hour: 14, minute: 30 };

test('十二长生：次序固定为十二态，十干长生起支符合通行口诀', () => {
  assert.deepEqual(STAGES, ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养']);
  assert.deepEqual(START_BRANCH, {
    甲: '亥', 乙: '午', 丙: '寅', 丁: '酉', 戊: '寅',
    己: '酉', 庚: '巳', 辛: '子', 壬: '申', 癸: '卯',
  });
  assert.equal(Object.keys(changShengTable('甲')).length, 9, '九宫均应可判');
});

test('十二长生：阳干顺行、阴干逆行的经典落宫', () => {
  const cases = [
    ['甲', 3, '帝旺'], ['乙', 3, '临官'], ['丙', 9, '帝旺'],
    ['壬', 1, '帝旺'], ['庚', 7, '帝旺'], ['戊', 6, '墓'],
    ['乙', 5, '养'], ['癸', 4, '胎'],
  ];
  for (const [stem, palace, name] of cases) {
    const r = changShengOf(stem, palace);
    assert.equal(r.name, name, `${stem}落${palace}宫`);
    assert.equal(r.stem, stem);
    assert.equal(r.palace, palace);
    assert.ok(r.meaning, `${stem}落${palace}宫缺释义`);
  }
  assert.equal(changShengOf('辛', 1).name, '长生', '辛长生在子，落坎一为长生');
  assert.equal(changShengOf('甲', 10), null, '非法宫位应返回 null');
  assert.equal(changShengOf('X', 1), null, '非法天干应返回 null');
});

test('十二长生：十二地支全部寄入九宫，四隅宫各辖两支', () => {
  const branches = Object.values(PALACE_BRANCHES).flat();
  assert.equal(branches.length, 12);
  assert.equal(new Set(branches).size, 12);
  assert.equal(PALACE_BRANCHES[5], undefined, '中五宫无地支');
  for (const p of [2, 4, 6, 8]) {
    assert.equal(PALACE_BRANCHES[p].length, 2, `第${p}宫应辖两支`);
  }
});

test('十二长生：中五宫寄坤二宫，判定支与状态一致', () => {
  for (const stem of Object.keys(START_BRANCH)) {
    const a = changShengOf(stem, 5);
    const b = changShengOf(stem, 2);
    assert.equal(a.via_palace, 2, `${stem} 中五宫应寄坤二`);
    assert.equal(a.branch, b.branch);
    assert.equal(a.name, b.name);
  }
});

test('十二长生：旺/平/衰三级覆盖十二态，释义完整', () => {
  for (const s of STAGES) {
    assert.ok(['旺', '平', '衰'].includes(LEVEL[s]), `${s} 缺旺衰分级`);
    assert.ok(MEANING[s] && MEANING[s].length > 6, `${s} 缺释义`);
  }
  assert.equal(STAGES.filter((s) => LEVEL[s] === '旺').length, 3);
  assert.equal(STAGES.filter((s) => LEVEL[s] === '平').length, 4);
  assert.equal(STAGES.filter((s) => LEVEL[s] === '衰').length, 5);
});

test('十二长生：九宫 JSON 三类天干状态与引擎一致（含中五宫）', () => {
  const chart = buildChart({ datetime: dt, location: beijing });
  for (const p of chart.palaces) {
    assert.ok(p.chang_sheng, `第${p.index}宫缺 chang_sheng`);
    for (const [key, stem] of [
      ['tian_pan', p.tian_pan_qi_yi],
      ['di_pan', p.di_pan_qi_yi],
      ['an_gan', p.an_gan],
    ]) {
      const cs = p.chang_sheng[key];
      if (!stem) {
        assert.equal(cs, null);
        continue;
      }
      assert.ok(cs, `第${p.index}宫 ${key} 缺长生`);
      assert.equal(cs.stem, stem);
      assert.equal(cs.name, changShengOf(stem, p.index).name);
      assert.ok(['旺', '平', '衰'].includes(cs.level));
    }
  }
  assert.equal(chart.palaces.find((p) => p.index === 5).chang_sheng.di_pan.via_palace, 2);
});

test('十二长生：AI 分析文本九宫均写入长生与口径说明', () => {
  const chart = buildChart({ datetime: dt, location: beijing });
  const text = buildAiAnalysisText(chart);
  assert.equal((text.match(/- \*\*十二长生\*\*：/g) || []).length, 9);
  assert.match(text, /十二长生口径/);
  assert.match(text, /旺＝长生\/临官\/帝旺/);
});
