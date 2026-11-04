'use strict';

/**
 * an_gan.test.js — 暗干（隐干）算法验收
 *
 * 口径：时干起于时干落宫，循奇仪序「戊己庚辛壬癸丁丙乙」，
 *       阳遁顺飞（洛书 1→2→…→9）、阴遁逆飞（9→8→…→1），九宫皆占一位。
 *
 * 权威盘例（阴遁二局，时干己落离九，逆飞）：
 *   离九己 → 艮八庚 → 兑七辛 → 乾六壬 → 中五癸 → 巽四丁 → 震三丙 → 坤二乙 → 坎一戊
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAnGan, buildChart, AN_GAN_ORDER, AN_GAN_RULE } = require('../src/engine/qimen');

const beijing = { name: '北京', lng: 116.4074, lat: 39.9042 };

test('暗干：阴遁盘例（时干己落离九）序列与公开盘例一致', () => {
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
  // 时干丁 落宫（阴遁5局地盘丁在艮8）
  assert.equal(m.an_gan_start.stem, m.si_zhu.hour[0]);
  const start = chart.palaces.find((p) => p.index === m.an_gan_start.palace);
  assert.equal(start.an_gan, m.an_gan_start.stem);
  // 每宫都有暗干，且九个天干齐全
  for (const p of chart.palaces) {
    assert.equal(typeof p.an_gan, 'string');
    assert.ok(AN_GAN_ORDER.includes(p.an_gan), `第 ${p.index} 宫暗干非法：${p.an_gan}`);
    assert.equal(p.an_gan_rule, AN_GAN_RULE);
  }
  assert.equal(new Set(chart.palaces.map((p) => p.an_gan)).size, 9);
  // 阴遁逆飞：艮8(丁) 的下一宫为洛书 7（兑7）→ 丙；再 6（乾6）→ 乙
  const byIdx = Object.fromEntries(chart.palaces.map((p) => [p.index, p]));
  assert.equal(byIdx[8].an_gan, '丁');
  assert.equal(byIdx[7].an_gan, '丙');
  assert.equal(byIdx[6].an_gan, '乙');
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
