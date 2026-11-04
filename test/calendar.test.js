'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/engine/calendar');
const A = require('../src/engine/astro');

const jdn = (y, m, d) => A.integerJulianDayNumber(y, m, d);

test('日干支锚点（已知史实/历表）', () => {
  const cases = [
    [2000, 1, 7, '甲子'],
    [2000, 1, 1, '戊午'],
    [1984, 2, 2, '丙寅'],
    [2024, 2, 10, '甲辰'],
    [2026, 11, 4, '壬午'],
    [2002, 4, 7, '乙巳'],
  ];
  for (const [y, m, d, gz] of cases) {
    assert.equal(C.dayGanzhiFromJDN(jdn(y, m, d)).text, gz, `${y}-${m}-${d}`);
  }
});

test('六十甲子循环与序号一致性', () => {
  for (let i = 0; i < 60; i += 1) {
    assert.equal(C.SEXAGENARY[i][1], C.BRANCHES[i % 12]);
    assert.equal(C.SEXAGENARY[i][0], C.STEMS[i % 10]);
  }
  assert.equal(C.SEXAGENARY[0], '甲子');
  assert.equal(C.SEXAGENARY[59], '癸亥');
});

test('时干五鼠遁', () => {
  // 壬午日：壬日「丁壬庚子居」→ 子时=庚子；未时（第 8 支）= 丁未
  const day = C.dayGanzhiFromJDN(jdn(2026, 11, 4));
  assert.equal(day.text, '壬午');
  assert.equal(C.hourGanzhi(day.index % 10, 14).text, '丁未');
  assert.equal(C.hourGanzhi(day.index % 10, 0).text, '庚子');
  // 乙巳日：乙日「乙庚丙作初」→ 子时=丙子；辰时=庚辰
  const day2 = C.dayGanzhiFromJDN(jdn(2002, 4, 7));
  assert.equal(C.hourGanzhi(day2.index % 10, 8).text, '庚辰');
  // 23:00 起子时（时支边界）
  assert.equal(C.hourBranchIndexFromHour(23), 0);
  assert.equal(C.hourBranchIndexFromHour(0), 0);
  assert.equal(C.hourBranchIndexFromHour(1), 1);
  assert.equal(C.hourBranchIndexFromHour(22), 11);
});

test('旬首、旬空、旬内序', () => {
  const h = C.hourGanzhi(C.dayGanzhiFromJDN(jdn(2002, 4, 7)).index % 10, 8); // 庚辰
  const x = C.xunOfHour(h);
  assert.equal(x.head, '甲戌');
  assert.equal(x.yi, '己');
  assert.equal(x.posInXun, 6);
  assert.deepEqual(x.voidBranches, ['申', '酉']);

  const h2 = C.hourGanzhi(C.dayGanzhiFromJDN(jdn(2026, 11, 4)).index % 10, 14); // 丁未
  const x2 = C.xunOfHour(h2);
  assert.equal(x2.head, '甲辰');
  assert.equal(x2.yi, '壬');
  assert.equal(x2.posInXun, 3);
  assert.deepEqual(x2.voidBranches, ['寅', '卯']);
});

test('三元（符头）判定：每 15 日一轮，甲己日为符头', () => {
  // 甲子日（idx 0）→ 上元，符头即本日 甲子
  assert.deepEqual(C.yuanFromDayIndex(0), { yuan: '上元', key: '上', fuTou: '甲子' });
  // idx 4（戊辰）→ 上元，符头 甲子
  assert.equal(C.yuanFromDayIndex(4).yuan, '上元');
  assert.equal(C.yuanFromDayIndex(4).fuTou, '甲子');
  // idx 5（己巳）→ 中元，符头即己巳
  assert.deepEqual(C.yuanFromDayIndex(5), { yuan: '中元', key: '中', fuTou: '己巳' });
  // idx 10（甲戌）→ 下元，符头即甲戌
  assert.equal(C.yuanFromDayIndex(10).yuan, '下元');
  assert.equal(C.yuanFromDayIndex(10).fuTou, '甲戌');
  // idx 15（己卯）→ 上元
  assert.equal(C.yuanFromDayIndex(15).yuan, '上元');
  assert.equal(C.yuanFromDayIndex(15).fuTou, '己卯');
  // idx 20（甲申）→ 中元
  assert.equal(C.yuanFromDayIndex(20).yuan, '中元');
  assert.equal(C.yuanFromDayIndex(20).fuTou, '甲申');
  // idx 25（己丑）→ 下元
  assert.equal(C.yuanFromDayIndex(25).yuan, '下元');
  assert.equal(C.yuanFromDayIndex(25).fuTou, '己丑');
  // 每 15 日三元轮转；符头必为甲/己日，且符头序号 ≡ 元'%15' 的起点
  for (let i = 0; i < 60; i += 1) {
    const y = C.yuanFromDayIndex(i);
    assert.ok(['甲', '己'].includes(y.fuTou[0]), `idx ${i} 符头 ${y.fuTou} 非甲己日`);
    const expect = i % 15 <= 4 ? '上元' : i % 15 <= 9 ? '中元' : '下元';
    assert.equal(y.yuan, expect, `idx ${i} 三元错误`);
  }
});

test('三元定局表自洽：24 节气 × 三元，上元与下元局数互补为 10 或同宗', () => {
  const terms = Object.keys(C.JU_TABLE);
  assert.equal(terms.length, 24);
  for (const t of terms) {
    const { yang, ju } = C.JU_TABLE[t];
    assert.equal(ju.length, 3, `${t} 应有三元`);
    for (const n of ju) assert.ok(Number.isInteger(n) && n >= 1 && n <= 9, `${t} 局数越界`);
    // 阴阳遁中元/下元相对上元的位移应为 +3 或 +6（mod 9）
    const d1 = (ju[1] - ju[0] + 9) % 9;
    const d2 = (ju[2] - ju[1] + 9) % 9;
    assert.ok([3, 6].includes(d1), `${t} 中元位移异常 ${d1}`);
    assert.ok([3, 6].includes(d2), `${t} 下元位移异常 ${d2}`);
    assert.equal(typeof yang, 'boolean');
  }
  // 阳遁节气集合固定
  const yangTerms = terms.filter((t) => C.JU_TABLE[t].yang);
  const yinTerms = terms.filter((t) => !C.JU_TABLE[t].yang);
  assert.equal(yangTerms.length, 12);
  assert.equal(yinTerms.length, 12);
  // 冬至一七四、夏至九三六 等口诀校验
  assert.deepEqual(C.JU_TABLE['冬至'].ju, [1, 7, 4]);
  assert.deepEqual(C.JU_TABLE['夏至'].ju, [9, 3, 6]);
  assert.deepEqual(C.JU_TABLE['春分'].ju, [3, 9, 6]);
  assert.deepEqual(C.JU_TABLE['霜降'].ju, [5, 8, 2]);
  assert.deepEqual(C.JU_TABLE['大雪'].ju, [4, 7, 1]);
  assert.deepEqual(C.JU_TABLE['惊蛰'].ju, [1, 7, 4]);
});

test('determineJu：中气使用本节气三元，且回带所属「节」', () => {
  // 2026-11-04 壬午日（idx 18）→ 霜降上元 → 阴遁 5 局（不是寒露的 6 局）
  const r = C.determineJu('霜降', 18);
  assert.equal(r.ju, 5);
  assert.equal(r.yinYang, 'yin');
  assert.equal(r.yuan, '上元');
  assert.equal(r.jie, '寒露');

  // 2002-04-07 乙巳日（idx 41）→ 清明下元 → 阳遁 7 局（拆补口径）
  const r2 = C.determineJu('清明', 41);
  assert.equal(r2.ju, 7);
  assert.equal(r2.yinYang, 'yang');
  assert.equal(r2.yuan, '下元');
  assert.equal(r2.jie, '清明');
});

test('中气 → 节 映射完整', () => {
  for (const [zhong, jie] of Object.entries(C.ZHONGQI_TO_JIE)) {
    assert.ok(C.JIE.includes(jie), `${zhong} 映射到非节 ${jie}`);
    assert.ok(C.JU_TABLE[zhong], `${zhong} 缺少三元局数`);
  }
  assert.equal(Object.keys(C.ZHONGQI_TO_JIE).length, 12);
});
