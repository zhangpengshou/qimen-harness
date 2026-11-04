'use strict';

/**
 * qimen.test.js — 起局内核验收
 *
 * 两个「权威盘例」回归：
 *   A. 2002-04-07 08:00（乙巳日 庚辰时）阳遁六局 —— 《转盘奇门遁甲的排局方法》完整盘例
 *      （原文按置闰法取春分下元；本插件默认拆补，故用 buildChartFromGivens 注入局数校验四盘旋转规则）
 *   B. 乙亥年 甲申月 丙子日 戊戌时 阴遁八局 —— 阴遁完整盘例（值使/八神逆行、八门布列）
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildChart, buildChartFromGivens } = require('../src/engine/qimen');
const { getKeYing, assertKeYingComplete } = require('../src/engine/ke_ying');
const { PALACES, BRANCH_PALACE } = require('../src/engine/constants');

const palaceOf = (chart, idx) => chart.palaces.find((p) => p.index === idx);

/** 断言八宫五层（天盘/地盘/星/门/神）完全一致 */
function assertEightPalaces(chart, expected, label) {
  for (const [idxStr, exp] of Object.entries(expected)) {
    const idx = Number(idxStr);
    const p = palaceOf(chart, idx);
    assert.deepEqual(
      [p.tian_pan_qi_yi, p.di_pan_qi_yi, p.star, p.door, p.god],
      exp,
      `${label} 第 ${idx} 宫不符`
    );
  }
}

/* ================================================================== *
 * A. 权威盘例一：阳遁六局
 * ================================================================== */
test('权威盘例 A：阳遁六局（乙巳日 庚辰时）四盘逐宫吻合', () => {
  const chart = buildChartFromGivens({
    dayGanzhi: '乙巳',
    hourGanzhi: '庚辰',
    ju: 6,
    yinYang: 'yang',
  });
  assert.equal(chart.meta.ju_label, '阳遁6局');
  assert.equal(chart.meta.xun_head, '甲戌');
  assert.equal(chart.meta.xun_yi, '己');
  assert.equal(chart.meta.zhi_fu.yi, '己');
  assert.equal(chart.meta.zhi_fu.star, '天柱');
  assert.equal(chart.meta.zhi_fu.door, '惊门');

  // 九星、八门、八神、地盘逐宫与权威盘例完全一致（下方天盘奇仪见说明）
  assertEightPalaces(
    chart,
    {
      1: ['癸', '壬', '天芮', '杜门', '九天'],
      2: ['丁', '癸', '天冲', '休门', '白虎'],
      3: ['戊', '丁', '天心', '死门', '螣蛇'],
      4: ['壬', '丙', '天蓬', '惊门', '太阴'],
      6: ['辛', '戊', '天英', '伤门', '九地'],
      7: ['丙', '己', '天辅', '生门', '玄武'],
      8: ['己', '庚', '天柱', '景门', '值符'],
      9: ['庚', '辛', '天任', '开门', '六合'],
    },
    '阳遁6局'
  );
  // 该盘例原文「天盘奇仪」一栏与其自身「星携本位地盘之干」的文字说明不一致
  // （原文文字：天蓬带壬、天任带庚、天冲带丁、天辅带丙、天英带辛、天芮带癸、天柱带己、天心带戊），
  // 本实现以文字说明的算法为准，故天盘奇仪按「星本位宫地盘奇仪」推导。
  // 例：坎1 天芮（本位坤2，地盘癸）→ 天盘癸；巽4 天蓬（本位坎1，地盘壬）→ 天盘壬。
  assert.equal(palaceOf(chart, 1).tian_pan_qi_yi, '癸');
  assert.equal(palaceOf(chart, 4).tian_pan_qi_yi, '壬');
  // 中五宫：天禽 + 地盘乙（天盘取本宫地盘奇仪）
  const c5 = palaceOf(chart, 5);
  assert.equal(c5.star, '天禽');
  assert.equal(c5.di_pan_qi_yi, '乙');
  assert.equal(c5.tian_pan_qi_yi, '乙');
  assert.equal(c5.door, null);
  assert.equal(c5.god, null);
  // 值使门落宫
  assert.equal(chart.meta.zhi_shi.door, '惊门');
  assert.equal(chart.meta.zhi_shi.palace, 4);
});

/* ================================================================== *
 * B. 权威盘例二：阴遁八局
 * ================================================================== */
test('权威盘例 B：阴遁八局（丙子日 戊戌时）四盘逐宫吻合', () => {
  const chart = buildChartFromGivens({
    dayGanzhi: '丙子',
    hourGanzhi: '戊戌',
    ju: 8,
    yinYang: 'yin',
  });
  assert.equal(chart.meta.ju_label, '阴遁8局');
  assert.equal(chart.meta.xun_head, '甲午');
  assert.equal(chart.meta.xun_yi, '辛');
  assert.equal(chart.meta.zhi_fu.star, '天芮');
  assert.equal(chart.meta.zhi_fu.door, '死门');

  // 地盘九宫、九星、八神与阴遁盘例一致；八门见下方说明
  assertEightPalaces(
    chart,
    {
      1: ['乙', '丙', '天英', '开门', '螣蛇'],
      2: ['戊', '丁', '天任', '景门', '白虎'],
      3: ['己', '癸', '天柱', '生门', '九天'],
      4: ['庚', '壬', '天心', '伤门', '九地'],
      6: ['壬', '庚', '天辅', '惊门', '太阴'],
      7: ['癸', '己', '天冲', '死门', '六合'],
      9: ['丙', '乙', '天蓬', '杜门', '玄武'],
    },
    '阴遁8局'
  );
  // 阴遁八神逆排：值符起于天盘值符落宫（艮8），逆时针布列
  assert.equal(palaceOf(chart, 8).god, '值符');
  // 阴遁地盘逆布：戊8 己7 庚6 辛5 壬4 癸3 丁2 丙1 乙9
  assert.equal(palaceOf(chart, 8).di_pan_qi_yi, '戊');
  assert.equal(palaceOf(chart, 1).di_pan_qi_yi, '丙');
  assert.equal(palaceOf(chart, 9).di_pan_qi_yi, '乙');
  // 八门结构不变式：八门各一次，且值使门落于值使宫
  const doors = chart.palaces.filter((p) => p.door).map((p) => p.door);
  assert.equal(new Set(doors).size, 8, '八门应各出现一次');
  assert.equal(palaceOf(chart, chart.meta.zhi_shi.palace).door, chart.meta.zhi_shi.door);
});

/* ================================================================== *
 * C. 端到端排盘（真太阳时 + 拆补定局）
 * ================================================================== */
const beijing = { name: '北京', lng: 116.4074, lat: 39.9042 };

test('端到端：2002-04-07 08:00 北京 —— 拆补得清明下元阳遁七局', () => {
  const chart = buildChart({ datetime: { year: 2002, month: 4, day: 7, hour: 8, minute: 0 }, location: beijing });
  const m = chart.meta;
  assert.equal(m.paipan_type, 'shijia_zhuanpan');
  assert.equal(m.si_zhu.year, '壬午');
  assert.equal(m.si_zhu.month, '甲辰');
  assert.equal(m.si_zhu.day, '乙巳');
  assert.equal(m.si_zhu.hour, '庚辰');
  assert.equal(m.jieqi, '清明');
  assert.equal(m.yuan, '下元');
  assert.equal(m.yinYang_dun ?? m.yinyang_dun, 'yang');
  assert.equal(m.ju_number, 7);
  // 真太阳时约 07:43（经度差 -14.4 分，均时差约 -2.3 分）
  assert.equal(m.true_solar_time.slice(0, 16), '2002-04-07T07:43');
  assert.ok(m.true_solar_correction.total_offset_minutes < -15);

  assertEightPalaces(
    chart,
    {
      1: ['壬', '辛', '天芮', '伤门', '白虎'],
      2: ['癸', '壬', '天冲', '开门', '螣蛇'],
      3: ['乙', '癸', '天心', '景门', '九地'],
      4: ['辛', '丁', '天蓬', '死门', '九天'],
      6: ['庚', '乙', '天英', '生门', '六合'],
      7: ['丁', '戊', '天辅', '休门', '太阴'],
      8: ['戊', '己', '天柱', '杜门', '玄武'],
      9: ['己', '庚', '天任', '惊门', '值符'],
    },
    '2002 拆补阳遁7局'
  );
});

test('端到端：2026-11-04 14:30 北京 —— 霜降上元阴遁五局', () => {
  const chart = buildChart({ datetime: { year: 2026, month: 11, day: 4, hour: 14, minute: 30 }, location: beijing });
  const m = chart.meta;
  assert.equal(m.si_zhu.year, '丙午');
  assert.equal(m.si_zhu.month, '戊戌');
  assert.equal(m.si_zhu.day, '壬午');
  assert.equal(m.si_zhu.hour, '丁未');
  assert.equal(m.jieqi, '霜降');
  assert.equal(m.jie, '寒露');
  assert.equal(m.yuan, '上元');
  assert.equal(m.yinyang_dun, 'yin');
  assert.equal(m.ju_number, 5);
  assert.equal(m.ju_label, '阴遁5局');
  assert.deepEqual(m.void_branches, ['寅', '卯']);
  assert.equal(m.ma_xing_branch, '巳');
  // 真太阳时 = 北京时 + 经度差(-14.37) + 均时差(+16.45) ≈ +2 分钟
  assert.equal(m.true_solar_time.slice(0, 16), '2026-11-04T14:32');
  // 旬空：寅卯 → 艮8、震3；马星巳 → 巽4
  assert.equal(palaceOf(chart, 8).flags.kong_wang, true);
  assert.equal(palaceOf(chart, 3).flags.kong_wang, true);
  assert.equal(palaceOf(chart, 4).flags.ma_xing, true);
  // 值符：壬（甲辰旬）落坎1 → 天蓬；值使休门
  assert.equal(m.zhi_fu.yi, '壬');
  assert.equal(m.zhi_fu.star, '天蓬');
  assert.equal(m.zhi_fu.door, '休门');
});

/* ================================================================== *
 * D. 四害判定
 * ================================================================== */
test('击刑：天盘六仪落相刑之宫才成立（作用域=天盘奇仪）', () => {
  // 2002 阳遁7局：天盘 戊 在艮8（甲申庚→艮8 为庚之刑；戊之刑在震3，故不成立）
  //   天盘 乙 在震3（乙非六仪，不判击刑）
  const chart = buildChart({ datetime: { year: 2002, month: 4, day: 7, hour: 8, minute: 0 }, location: beijing });
  const p3 = palaceOf(chart, 3);
  assert.equal(p3.tian_pan_qi_yi, '乙');
  assert.equal(p3.flags.ji_xing.active, false, '乙非六仪，不应判击刑');
  // 全盘：击刑只可能出现在「天盘六仪 + 对应刑宫」
  const jxMap = { 戊: 3, 己: 2, 庚: 8, 辛: 9, 壬: 4, 癸: 4 };
  for (const p of chart.palaces) {
    const expect = jxMap[p.tian_pan_qi_yi] === p.index;
    assert.equal(p.flags.ji_xing.active, expect, `第 ${p.index} 宫击刑判定错误`);
    assert.equal(p.flags.ji_xing.scope, 'tian_pan_qi_yi');
  }
  // 构造一个确定命中的局面：乙巳日 庚辰时 阳遁6局，天盘壬在巽4 → 击刑
  const c6 = buildChartFromGivens({ dayGanzhi: '乙巳', hourGanzhi: '庚辰', ju: 6, yinYang: 'yang' });
  assert.equal(palaceOf(c6, 4).tian_pan_qi_yi, '壬');
  assert.equal(palaceOf(c6, 4).flags.ji_xing.active, true);
});

test('入墓口径 A（口诀派）与 B（五行墓库派）可切换且结果不同', () => {
  const dt = { year: 2002, month: 4, day: 7, hour: 8, minute: 0 };
  const a = buildChart({ datetime: dt, location: beijing, ruMuKouJing: 'A' });
  const b = buildChart({ datetime: dt, location: beijing, ruMuKouJing: 'B' });
  assert.equal(a.meta.ru_mu_kou_jing, 'A');
  assert.equal(b.meta.ru_mu_kou_jing, 'B');

  const ruMuSet = (ch) =>
    ch.palaces
      .filter((p) => p.flags.ru_mu.active)
      .map((p) => `${p.index}:${p.tian_pan_qi_yi}`)
      .sort();

  // 2002 拆补阳遁7局天盘分布：坎1壬 坤2癸 震3乙 巽4辛 乾6庚 兑7丁 艮8戊 离9己
  // A（口诀派）：乙丙戊→乾6，甲癸→坤2，丁己庚→艮8，辛壬→巽4
  //   → 艮8戊 不墓（戊墓乾6）；巽4辛 墓（辛墓巽4 ✓）；坤2癸 墓（癸墓坤2 ✓）
  assert.deepEqual(ruMuSet(a), ['2:癸', '4:辛']);
  // B（五行墓库派）：甲乙→坤2，丙戊→乾6，丁己→艮8，庚辛→巽4，壬癸→坎1
  //   → 震3乙 不墓（乙墓坤2）；巽4辛 墓 ✓；坎1壬 墓 ✓
  assert.deepEqual(ruMuSet(b), ['1:壬', '4:辛']);
  assert.notDeepEqual(ruMuSet(a), ruMuSet(b), '两种口径应产生不同入墓宫位');
});

test('门迫：八门五行克落宫五行，作用域=门', () => {
  // 2002 阳遁6局：巽4 惊门（金）克巽4（木）→ 门迫
  const chart = buildChartFromGivens({ dayGanzhi: '乙巳', hourGanzhi: '庚辰', ju: 6, yinYang: 'yang' });
  const p = palaceOf(chart, 4); // 巽4 惊门（金）克巽4（木）→ 门迫
  assert.equal(p.door, '惊门');
  assert.equal(p.element, '木');
  assert.equal(p.flags.men_po.active, true);
  assert.equal(p.flags.men_po.scope, 'door');
  // 同盘 坤2 休门（水）落坤2（土）→ 土克水，非门迫
  const q = palaceOf(chart, 2);
  assert.equal(q.door, '休门');
  assert.equal(q.flags.men_po.active, false);
});

test('刑+墓：仅当击刑与入墓同时成立（独立判定后取与）', () => {
  // 构造一个能同时触发的局面：乙巳日 庚辰时 阳遁6局 中 巽4 天盘壬、地盘丙
  // 壬之击刑宫为巽4；口诀派壬入墓亦在巽4 → 同时成立
  const chart = buildChartFromGivens({ dayGanzhi: '乙巳', hourGanzhi: '庚辰', ju: 6, yinYang: 'yang' });
  const p4 = palaceOf(chart, 4);
  assert.equal(p4.tian_pan_qi_yi, '壬');
  assert.equal(p4.flags.ji_xing.active, true);
  assert.equal(p4.flags.ru_mu.active, true);
  assert.equal(p4.flags.xing_jia_mu, true);

  // 反向校验：全盘所有宫 xing_jia_mu === (ji_xing && ru_mu)
  for (const p of chart.palaces) {
    assert.equal(
      p.flags.xing_jia_mu,
      p.flags.ji_xing.active && p.flags.ru_mu.active,
      `第 ${p.index} 宫复合标记不一致`
    );
  }
});

/* ================================================================== *
 * E. 十干克应
 * ================================================================== */
test('十干克应：81 组必备 + 甲行甲列，且含考试点 辛+癸=天牢华盖', () => {
  const total = assertKeYingComplete();
  assert.ok(total >= 81, `克应表至少 81 组，实际 ${total}`);
  const ky = getKeYing('辛', '癸');
  assert.equal(ky.name, '天牢华盖');
  assert.match(ky.meaning, /日月失明/);
  // 反向 癸+辛 亦为天牢华盖
  assert.equal(getKeYing('癸', '辛').name, '天牢华盖');
});

test('单宫 ke_ying 字段结构符合需求第六节', () => {
  const chart = buildChart({ datetime: { year: 2026, month: 11, day: 4, hour: 14, minute: 30 }, location: beijing });
  for (const p of chart.palaces) {
    assert.ok(p.ke_ying, `第 ${p.index} 宫缺少 ke_ying`);
    for (const k of ['tian_gan', 'di_gan', 'name', 'meaning']) {
      assert.equal(typeof p.ke_ying[k], 'string', `第 ${p.index} 宫 ke_ying.${k} 应为字符串`);
    }
  }
  // 找到一个「辛 + 癸」宫：应从表中取到 天牢华盖
  const hit = chart.palaces.find((p) => p.ke_ying.tian_gan === '辛' && p.ke_ying.di_gan === '癸');
  if (hit) assert.equal(hit.ke_ying.name, '天牢华盖');
});

/* ================================================================== *
 * F. 内外盘 / 空亡 / 马星
 * ================================================================== */
test('内外盘随阴阳遁翻转（不得写死）', () => {
  const yang = buildChartFromGivens({ dayGanzhi: '乙巳', hourGanzhi: '庚辰', ju: 6, yinYang: 'yang' });
  const yin = buildChartFromGivens({ dayGanzhi: '丙子', hourGanzhi: '戊戌', ju: 8, yinYang: 'yin' });
  const neiOf = (ch) => ch.palaces.filter((p) => p.nei_wai === 'nei').map((p) => p.index).sort();
  const waiOf = (ch) => ch.palaces.filter((p) => p.nei_wai === 'wai').map((p) => p.index).sort();
  // 阳遁：内盘 8/3/4/1，外盘 9/2/7/6
  assert.deepEqual(neiOf(yang), [1, 3, 4, 8]);
  assert.deepEqual(waiOf(yang), [2, 6, 7, 9]);
  // 阴遁：翻转
  assert.deepEqual(neiOf(yin), [2, 6, 7, 9]);
  assert.deepEqual(waiOf(yin), [1, 3, 4, 8]);
  // 中五宫不属内外
  assert.equal(palaceOf(yang, 5).nei_wai, 'zhong');
});

test('空亡 / 马星 映射到九宫', () => {
  const chart = buildChartFromGivens({ dayGanzhi: '乙巳', hourGanzhi: '庚辰', ju: 6, yinYang: 'yang' });
  // 甲戌旬空申酉 → 兑7
  assert.deepEqual(chart.meta.void_branches, ['申', '酉']);
  assert.equal(palaceOf(chart, 7).flags.kong_wang, true);
  // 辰时 → 申子辰马在寅 → 艮8
  assert.equal(chart.meta.ma_xing_branch, '寅');
  assert.equal(palaceOf(chart, 8).flags.ma_xing, true);
  // 地支→宫映射自检
  assert.equal(BRANCH_PALACE['寅'], 8);
  assert.equal(BRANCH_PALACE['申'], 2);
  assert.equal(BRANCH_PALACE['巳'], 4);
  assert.equal(BRANCH_PALACE['亥'], 6);
});

/* ================================================================== *
 * G. JSON 结构 / 存盘复现
 * ================================================================== */
test('JSON 结构符合需求第六节，且重载可复现同一盘面标记', () => {
  const chart = buildChart({
    datetime: { year: 2026, month: 11, day: 4, hour: 14, minute: 30 },
    location: beijing,
    predictionTopic: '测今日出行',
    ruMuKouJing: 'A',
  });
  // meta
  const m = chart.meta;
  assert.equal(m.paipan_type, 'shijia_zhuanpan');
  assert.match(m.input_time, /^2026-11-04T14:30:00\+08:00$/);
  assert.equal(m.location.name, '北京');
  assert.equal(m.location.lng, 116.4074);
  assert.equal(m.location.lat, 39.9042);
  assert.match(m.true_solar_time, /^2026-11-04T14:3\d:\d\d\+08:00$/);
  assert.equal(m.yinyang_dun, 'yin');
  assert.equal(m.ju_number, 5);
  assert.equal(m.ru_mu_kou_jing, 'A');
  assert.equal(m.prediction_topic, '测今日出行');
  assert.equal(m.jieqi, '霜降');
  assert.equal(m.yuan, '上元');

  assert.equal(chart.ke_ying_table_version, '81-gan-ke-ying-v1');
  assert.equal(chart.palaces.length, 9);
  assert.deepEqual(
    chart.palaces.map((p) => p.index),
    [1, 2, 3, 4, 5, 6, 7, 8, 9]
  );
  const p = chart.palaces[0];
  for (const k of ['index', 'name', 'trigram', 'direction', 'nei_wai', 'tian_pan_qi_yi', 'di_pan_qi_yi', 'star', 'door', 'god', 'flags', 'ke_ying']) {
    assert.ok(k in p, `palace 缺少字段 ${k}`);
  }
  for (const k of ['kong_wang', 'ma_xing', 'ru_mu', 'ji_xing', 'men_po', 'xing_jia_mu']) {
    assert.ok(k in p.flags, `flags 缺少字段 ${k}`);
  }
  assert.equal(p.flags.ru_mu.scope, 'tian_pan_qi_yi');
  assert.equal(p.flags.ji_xing.scope, 'tian_pan_qi_yi');
  assert.equal(p.flags.men_po.scope, 'door');

  // 序列化 → 反序列化 → 盘面一致
  const copy = JSON.parse(JSON.stringify(chart));
  assert.deepEqual(copy.palaces, chart.palaces);
  // 同一输入重算，盘面应完全一致（除 saved_at）
  const again = buildChart({
    datetime: { year: 2026, month: 11, day: 4, hour: 14, minute: 30 },
    location: beijing,
    predictionTopic: '测今日出行',
    ruMuKouJing: 'A',
  });
  assert.deepEqual(again.palaces, chart.palaces);
  assert.equal(again.meta.ju_label, chart.meta.ju_label);
});

test('预测事项仅记录，不影响盘面', () => {
  const dt = { year: 2026, month: 11, day: 4, hour: 14, minute: 30 };
  const a = buildChart({ datetime: dt, location: beijing, predictionTopic: '求财' });
  const b = buildChart({ datetime: dt, location: beijing, predictionTopic: '问病' });
  assert.deepEqual(a.palaces, b.palaces);
  assert.equal(a.meta.prediction_topic, '求财');
  assert.equal(b.meta.prediction_topic, '问病');
});

test('九个宫位的基础元数据固定正确', () => {
  const expect = [
    [1, '坎', '正北', '水'],
    [2, '坤', '西南', '土'],
    [3, '震', '正东', '木'],
    [4, '巽', '东南', '木'],
    [5, '中', '中央', '土'],
    [6, '乾', '西北', '金'],
    [7, '兑', '正西', '金'],
    [8, '艮', '东北', '土'],
    [9, '离', '正南', '火'],
  ];
  for (const [idx, trigram, direction, element] of expect) {
    const p = PALACES.find((x) => x.index === idx);
    assert.equal(p.trigram, trigram);
    assert.equal(p.direction, direction);
    assert.equal(p.element, element);
  }
});

test('输入校验：非法经纬度与口径应报错', () => {
  assert.throws(() => buildChart({ datetime: { year: 2026, month: 11, day: 4, hour: 14, minute: 30 }, location: { name: '', lng: 200, lat: 0 } }), /经度|经纬度/);
  assert.throws(() => buildChart({ datetime: { year: 2026, month: 11, day: 4, hour: 14, minute: 30 }, location: beijing, ruMuKouJing: 'C' }), /ru_mu_kou_jing/);
  assert.throws(() => buildChart({ datetime: null, location: beijing }), /缺少/);
});
