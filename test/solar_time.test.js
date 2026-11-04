'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { trueSolarTime, beijingISO, jdToBeijingWallClock } = require('../src/engine/solar_time');

test('真太阳时 = 北京时 + 经度时差 + 均时差（两项都参与）', () => {
  const r = trueSolarTime({ year: 2026, month: 11, day: 4, hour: 14, minute: 30 }, 116.4074);
  // 经度时差 (116.4074 − 120) × 4 ≈ −14.37 分
  assert.ok(Math.abs(r.longitudeOffsetMinutes - (116.4074 - 120) * 4) < 1e-9);
  // 11 月初均时差约 +16.4 分
  assert.ok(r.equationOfTimeMinutes > 15 && r.equationOfTimeMinutes < 18);
  // 总修正应为两项之和
  assert.ok(Math.abs(r.totalOffsetMinutes - (r.longitudeOffsetMinutes + r.equationOfTimeMinutes)) < 1e-9);
  // 真太阳时约 14:32
  assert.equal(r.trueSolarISO.slice(0, 16), '2026-11-04T14:32');
  // 两项均非零（验收第 9 条）
  assert.notEqual(r.longitudeOffsetMinutes, 0);
  assert.notEqual(Math.round(r.equationOfTimeMinutes), 0);
});

test('经度 120° 时经度时差为 0，真太阳时仅含均时差', () => {
  const r = trueSolarTime({ year: 2026, month: 2, day: 11, hour: 12, minute: 0 }, 120);
  assert.equal(r.longitudeOffsetMinutes, 0);
  assert.ok(r.equationOfTimeMinutes < -12);
  assert.equal(r.totalOffsetMinutes, r.equationOfTimeMinutes);
});

test('西经为负、东经为正，时差符号正确', () => {
  const west = trueSolarTime({ year: 2026, month: 6, day: 1, hour: 12, minute: 0 }, -74.006);
  const east = trueSolarTime({ year: 2026, month: 6, day: 1, hour: 12, minute: 0 }, 135.5);
  assert.ok(west.longitudeOffsetMinutes < -700, '纽约经度时差应约 −776 分');
  assert.ok(east.longitudeOffsetMinutes > 60, '东经 135.5° 时差应约 +62 分');
});

test('日期跨越：真太阳时可能跨日', () => {
  // 乌鲁木齐（87.62°E）00:10 北京时 → 经度时差约 −129.5 分 → 前一日 22:00 左右
  const r = trueSolarTime({ year: 2026, month: 3, day: 15, hour: 0, minute: 10 }, 87.6168);
  assert.equal(r.trueSolarISO.slice(0, 10), '2026-03-14');
  // 反向：东经 135° 00:30 → 真太阳时约 01:3x，仍在同日
  const r2 = trueSolarTime({ year: 2026, month: 3, day: 15, hour: 0, minute: 30 }, 135.5);
  assert.equal(r2.trueSolarISO.slice(0, 10), '2026-03-15');
});

test('beijingISO 带 +08:00 偏移', () => {
  assert.equal(beijingISO(2026, 11, 4, 14, 30), '2026-11-04T14:30:00+08:00');
  assert.equal(beijingISO(2026, 1, 2, 3, 4, 5), '2026-01-02T03:04:05+08:00');
});

test('jd ↔ 北京时墙钟往返一致（分钟级）', () => {
  const r = trueSolarTime({ year: 2026, month: 11, day: 4, hour: 14, minute: 30 }, 116.4074);
  // trueSolarJd 为 UT 儒略日；jdToBeijingWallClock 内部已 +8h，故直接传入
  const back = jdToBeijingWallClock(r.trueSolarJd);
  assert.equal(back.hour, 14);
  assert.equal(back.minute, 32);
});
