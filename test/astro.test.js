'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../src/engine/astro');

const DEG = Math.PI / 180;
const CST = 8 / 24;

/** UT 儒略日 → 北京时间字符串 */
function cstString(jd) {
  const c = A.civilFromJulianDay(jd + CST);
  const total = Math.round(c.dayFraction * 86400);
  const pad = (n) => String(n).padStart(2, '0');
  return `${c.year}-${pad(c.month)}-${pad(c.day)} ${pad(Math.floor(total / 3600))}:${pad(
    Math.floor(total / 60) % 60
  )}`;
}

test('儒略日与公历互转', () => {
  // 2000-01-01 12:00 UT 的标准 JDN = 2451545.0
  assert.equal(A.julianDayFromCivil(2000, 1, 1, 0.5), 2451545.0);
  // 2012-06-30 12:00 UT 因闰秒前后仍为整数日，不校验秒
  const jd = A.julianDayFromCivil(2026, 11, 4, 0.5);
  const c = A.civilFromJulianDay(jd);
  assert.equal(c.year, 2026);
  assert.equal(c.month, 11);
  assert.equal(c.day, 4);
});

test('节气定日：2026 年春分 / 立冬 / 冬至时刻落在公开表 ±10 分钟', () => {
  const cases = [
    // [太阳视黄经, 附近日期, 期望北京时间（公开节气表，分钟级）]
    [0, [2026, 3, 20], '2026-03-20 22:46'],
    [225, [2026, 11, 7], '2026-11-07 17:52'],
    [270, [2026, 12, 22], '2026-12-22 04:50'],
    [315, [2026, 2, 4], '2026-02-04 04:02'],
  ];
  for (const [deg, [y, m, d], expect] of cases) {
    const jd = A.solveSolarLongitudeCrossing(deg, A.julianDayFromCivil(y, m, d));
    const actual = cstString(jd);
    const [eh, em] = expect.split(' ')[1].split(':').map(Number);
    const [ah, am] = actual.split(' ')[1].split(':').map(Number);
    const diff = Math.abs((ah * 60 + am) - (eh * 60 + em));
    assert.ok(diff <= 10, `节气 ${expect} 实测 ${actual}（差 ${diff} 分钟）`);
  }
});

test('均时差：2026 年关键节点与天文年历一致（误差 < 0.5 分钟）', () => {
  // 参考值（北京时间当日 0 时，分钟）
  const cases = [
    [2026, 2, 11, -14.2],
    [2026, 5, 14, 3.7],
    [2026, 7, 26, -6.6],
    [2026, 11, 3, 16.4],
  ];
  for (const [y, m, d, expectMin] of cases) {
    const jd = A.julianDayFromCivil(y, m, d, 0.5);
    const v = A.equationOfTimeMinutes(jd);
    assert.ok(Math.abs(v - expectMin) < 0.5, `${y}-${m}-${d} 均时差 ${v.toFixed(2)} 应≈${expectMin}`);
  }
  // 2 月中旬应显著为负、11 月初应显著为正
  assert.ok(A.equationOfTimeMinutes(A.julianDayFromCivil(2026, 2, 11, 0.5)) < -12);
  assert.ok(A.equationOfTimeMinutes(A.julianDayFromCivil(2026, 11, 3, 0.5)) > 14);
});

test('太阳视黄经连续单调递增（春分起一周内）', () => {
  let prev = -1;
  for (let i = 0; i < 40; i += 1) {
    const jd = A.julianDayFromCivil(2026, 3, 20) + i * 0.25;
    const lon = A.sunApparentLongitude(jd);
    assert.ok(lon > prev || (prev > 350 && lon < 10), `黄经在 ${jd} 处不连续`);
    prev = lon;
  }
});

test('solarTermAround 返回当前节气名与其起止时刻', () => {
  // 2026-11-04 14:30 CST 应处于霜降（10/23）与立冬（11/07）之间
  const jd = A.julianDayFromCivil(2026, 11, 4, 6 / 24);
  const t = A.solarTermAround(jd);
  assert.equal(t.name, '霜降');
  assert.ok(t.jdPrev < jd && jd < t.jdNext);
  assert.equal(cstString(t.jdNext).slice(0, 10), '2026-11-07');
});
