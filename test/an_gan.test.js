'use strict';

/**
 * an_gan.test.js — 暗干（隐干）算法验收
 *
 * 口径：时干加临「值使门落宫」为起点，循奇仪序「戊己庚辛壬癸丁丙乙」，
 *       阳遁顺飞（洛书 1→2→…→9）、阴遁逆飞（9→8→…→1），九宫皆占一位。
 *       起点不是「时干在地盘的落宫」（那是旧实现，整体错位）。
 *
 * 权威盘例（2026-10-09 01:57 阴遁九局，值使惊门落坤二，时干己，逆飞）：
 *   坤二己 → 坎一庚 → 离九辛 → 艮八壬 → 兑七癸 → 乾六丁 → 中五丙 → 巽四乙 → 震三戊
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAnGan, buildChart, buildChartFromGivens, AN_GAN_ORDER, AN_GAN_RULE } = require('../src/engine/qimen');

const beijing = { name: '北京', lng: 116.4074, lat: 39.9042 };

test('暗干：阴遁逆飞（洛书 9→8→…→1）按奇仪序逐宫推进', () => {
  const seq = buildAnGan({ startPalace: 9, startStem: '己', dir: -1 });
  assert.deepEqual(seq, {
    9: '己',
    8: '庚',
    7: '辛',
    6: '壬',
    5: '癸',
    4: '丁',
    3: '丙',
    2: '乙',
    1: '戊',
  });
});

test('暗干：权威盘例（阴遁九局，值使惊门落坤二，时干己）整盘逐宫吻合', () => {
  const chart = buildChartFromGivens({ dayGanzhi: '丙辰', hourGanzhi: '己丑', ju: 9, yinYang: 'yin' });
  assert.equal(chart.meta.zhi_shi.palace, 2);
  assert.equal(chart.meta.an_gan_start.palace, 2, '暗干起点必须是值使门落宫');
  assert.equal(chart.meta.an_gan_start.stem, '己');
  assert.deepEqual(
    Object.fromEntries(chart.palaces.map((p) => [p.index, p.an_gan])),
    { 1: '庚', 2: '己', 3: '戊', 4: '乙', 5: '丙', 6: '丁', 7: '癸', 8: '壬', 9: '辛' }
  );
});

test('暗干：伏吟局（2026-11-05 21:49，值使宫＝时干落宫）归中五宫起飞', () => {
  const chart = buildChart({
    datetime: { year: 2026, month: 11, day: 5, hour: 21, minute: 49 },
    location: beijing,
  });
  const m = chart.meta;
  assert.equal(m.zhi_shi.palace, 9);
  assert.equal(m.an_gan_start.palace, 5, '伏吟时暗干起点应归中五宫');
  assert.equal(m.an_gan_start.stem, '癸');
  assert.equal(m.an_gan_start.source, 'zhong_gong_fu_yin');
  // 中5癸 → 巽4丁 → 震3丙 → 坤2乙 → 坎1戊 → 离9己 → 艮8庚 → 兑7辛 → 乾6壬
  assert.deepEqual(
    Object.fromEntries(chart.palaces.map((p) => [p.index, p.an_gan])),
    { 1: '戊', 2: '乙', 3: '丙', 4: '丁', 5: '癸', 6: '壬', 7: '辛', 8: '庚', 9: '己' }
  );
  assert.equal(new Set(chart.palaces.map((p) => p.an_gan)).size, 9, '九干应各出现一次');
});

test('暗干：非伏吟两盘仍起于值使门落宫，逐宫与权威盘例一致', () => {
  const cases = [
    {
      dt: { year: 2010, month: 10, day: 10, hour: 10, minute: 10 },
      start: 4,
      seq: { 1: '戊', 2: '乙', 3: '丙', 4: '丁', 5: '癸', 6: '壬', 7: '辛', 8: '庚', 9: '己' },
    },
    {
      dt: { year: 2011, month: 11, day: 11, hour: 11, minute: 11 },
      start: 9,
      seq: { 1: '辛', 2: '庚', 3: '己', 4: '戊', 5: '乙', 6: '丙', 7: '丁', 8: '癸', 9: '壬' },
    },
  ];
  for (const c of cases) {
    const chart = buildChart({ datetime: c.dt, location: beijing });
    assert.equal(chart.meta.an_gan_start.source, 'zhi_shi_palace');
    assert.equal(chart.meta.an_gan_start.palace, c.start);
    assert.equal(chart.meta.an_gan_start.palace, chart.meta.zhi_shi.palace);
    assert.deepEqual(Object.fromEntries(chart.palaces.map((p) => [p.index, p.an_gan])), c.seq);
  }
});

test('暗干：阳遁顺飞（时干戊落坎一）逐宫推进', () => {
  const seq = buildAnGan({ startPalace: 1, startStem: '戊', dir: 1 });
  assert.deepEqual(seq, {
    1: '戊',
    2: '己',
    3: '庚',
    4: '辛',
    5: '壬',
    6: '癸',
    7: '丁',
    8: '丙',
    9: '乙',
  });
});

test('暗干：九宫各占一位，九干各出现一次', () => {
  for (const dir of [1, -1]) {
    for (let startPalace = 1; startPalace <= 9; startPalace += 1) {
      for (const stem of AN_GAN_ORDER) {
        const seq = buildAnGan({ startPalace, startStem: stem, dir });
        assert.equal(Object.keys(seq).length, 9, `宫位数错：${startPalace}/${stem}/${dir}`);
        const palaces = Object.keys(seq).map(Number).sort((a, b) => a - b);
        assert.deepEqual(palaces, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
        const stems = Object.values(seq).sort();
        assert.deepEqual(stems, [...AN_GAN_ORDER].sort(), `天干重复：${startPalace}/${stem}/${dir}`);
        // 起点宫必为起点干
        assert.equal(seq[startPalace], stem);
      }
    }
  }
});

test('暗干：奇仪序固定为 戊己庚辛壬癸丁丙乙（甲不入盘）', () => {
  assert.deepEqual(AN_GAN_ORDER, ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙']);
  assert.ok(!AN_GAN_ORDER.includes('甲'));
  assert.equal(AN_GAN_RULE, 'shigan-feibu-v1');
});

test('暗干：排盘结果写入每个宫位与 meta，且起点与时干一致', () => {
  const chart = buildChart({
    datetime: { year: 2026, month: 11, day: 4, hour: 14, minute: 30 },
    location: beijing,
  });
  const m = chart.meta;
  assert.equal(m.an_gan_rule, AN_GAN_RULE);
  assert.ok(m.an_gan_start, 'meta 缺少 an_gan_start');
  assert.ok(Number.isInteger(m.an_gan_start.palace));
  // 时干丁；起点为值使门落宫（此局值使休门落兑7），而非地盘丁所在的艮8
  assert.equal(m.an_gan_start.stem, m.si_zhu.hour[0]);
  assert.equal(m.an_gan_start.palace, m.zhi_shi.palace);
  assert.equal(m.an_gan_start.palace, 7);
  const start = chart.palaces.find((p) => p.index === m.an_gan_start.palace);
  assert.equal(start.an_gan, m.an_gan_start.stem);
  // 每宫都有暗干，且九个天干齐全
  for (const p of chart.palaces) {
    assert.equal(typeof p.an_gan, 'string');
    assert.ok(AN_GAN_ORDER.includes(p.an_gan), `第 ${p.index} 宫暗干非法：${p.an_gan}`);
    assert.equal(p.an_gan_rule, AN_GAN_RULE);
  }
  assert.equal(new Set(chart.palaces.map((p) => p.an_gan)).size, 9);
  // 阴遁逆飞：兑7(丁) → 乾6(丙) → 中5(乙) → 巽4(戊)
  const byIdx = Object.fromEntries(chart.palaces.map((p) => [p.index, p]));
  assert.equal(byIdx[7].an_gan, '丁');
  assert.equal(byIdx[6].an_gan, '丙');
  assert.equal(byIdx[5].an_gan, '乙');
  assert.equal(byIdx[4].an_gan, '戊');
});

test('芮禽合宫：天芮所在宫合并展示为「芮禽」，其余星名不变', () => {
  const chart = buildChart({
    datetime: { year: 2026, month: 11, day: 4, hour: 14, minute: 30 },
    location: beijing,
  });
  let ruiCount = 0;
  for (const p of chart.palaces) {
    if (p.star === '天芮') {
      ruiCount += 1;
      assert.equal(p.star_display, '芮禽');
      assert.equal(p.star_extra, '天禽');
    } else {
      assert.equal(p.star_display, p.star);
      assert.equal(p.star_extra, null);
    }
  }
  assert.equal(ruiCount, 1, '天芮应恰好落一宫');
});
