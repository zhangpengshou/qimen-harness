'use strict';

/**
 * ai_text.test.js — 导出「AI 分析文本」验收
 *
 * 覆盖：模板四段结构、九宫完整、十干克应断语、四害状态、暗干、
 *       预测事项填空、文件名规则、无 HTML 标签、特殊格局识别。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildChart } = require('../src/engine/qimen');
const {
  buildAiAnalysisText,
  aiAnalysisFileName,
  topicShort,
  detectSpecialPatterns,
} = require('../src/engine/ai_text');

const beijing = { name: '北京', lng: 116.4074, lat: 39.9042 };
const chart = buildChart({
  datetime: { year: 2026, month: 11, day: 4, hour: 14, minute: 30 },
  location: beijing,
  predictionTopic: '测今日出行是否顺利',
});
const text = buildAiAnalysisText(chart);

test('AI 文本：四段模板结构齐全', () => {
  for (const h of [
    '# 奇门遁甲排盘数据（时家转盘）',
    '## 一、 基础排盘信息',
    '## 二、 九宫盘面详解',
    '## 三、 图例与全局提示',
    '## 四、 AI 分析提示语',
  ]) {
    assert.ok(text.includes(h), `缺少标题：${h}`);
  }
});

test('AI 文本：基础信息字段完整', () => {
  const m = chart.meta;
  assert.match(text, /\*\*预测事项\*\*：测今日出行是否顺利/);
  assert.match(text, /\*\*排盘时间\*\*：2026-11-04 14:30/);
  assert.match(text, /\*\*真太阳时\*\*：2026-11-04 14:32:05（经度：116\.4074，纬度：39\.9042/);
  assert.match(text, new RegExp(`\\*\\*四柱干支\\*\\*：${m.si_zhu.year} ${m.si_zhu.month} ${m.si_zhu.day} ${m.si_zhu.hour}`));
  assert.match(text, /节气三元.*霜降.*上元/);
  assert.match(text, /排盘局数\*\*：阴遁 5 局/);
  assert.match(text, /值符\/值使\*\*：天蓬.*休门/);
  assert.match(text, /旬首空亡\*\*：旬首 甲辰壬，空亡 寅卯/);
  assert.match(text, /马星\*\*：巳/);
});

test('AI 文本：九宫 1-9 逐一列出且标题含方位五行内外盘', () => {
  for (let i = 1; i <= 9; i += 1) {
    assert.ok(text.includes(`### ${i}. `), `缺少第 ${i} 宫小节`);
  }
  assert.match(text, /### 1\. 坎一宫 \(正北, 水, 外盘\)/);
  assert.match(text, /### 2\. 坤二宫 \(西南, 土, 内盘\)/);
  assert.match(text, /### 5\. 中五宫 \(中央, 土, 寄宫\)/);
  assert.match(text, /### 9\. 离九宫 \(正南, 火, 内盘\)/);
});

test('AI 文本：每宫含神/星/门/天盘干/地盘干/克应/状态', () => {
  const blocks = text.split(/### \d+\. /).slice(1);
  assert.equal(blocks.length, 9);
  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i];
    const idx = i + 1;
    assert.match(b, /- \*\*八神\*\*：/, `第 ${idx} 宫缺八神`);
    assert.match(b, /- \*\*九星\*\*：/, `第 ${idx} 宫缺九星`);
    assert.match(b, /- \*\*八门\*\*：/, `第 ${idx} 宫缺八门`);
    assert.match(b, /- \*\*天盘奇仪\*\*：/, `第 ${idx} 宫缺天盘奇仪`);
    assert.match(b, /- \*\*地盘奇仪\*\*：/, `第 ${idx} 宫缺地盘奇仪`);
    assert.match(b, /- \*\*十干克应\*\*：/, `第 ${idx} 宫缺十干克应`);
    assert.match(b, /- \*\*状态标记\*\*：/, `第 ${idx} 宫缺状态标记`);
  }
});

test('AI 文本：十干克应名称与断语必须完整（含 辛+癸 天牢华盖）', () => {
  const ru = chart.palaces.find((p) => p.ke_ying && p.ke_ying.tian_gan === '癸' && p.ke_ying.di_gan === '辛');
  if (ru) {
    assert.ok(text.includes(`${ru.ke_ying.tian_gan}+${ru.ke_ying.di_gan} - ${ru.ke_ying.name}`));
    assert.ok(text.includes(ru.ke_ying.meaning));
  }
  // 逐宫核对：克应名称与断语都要出现
  for (const p of chart.palaces) {
    if (p.ke_ying && p.ke_ying.name && p.ke_ying.name !== '—') {
      assert.ok(text.includes(p.ke_ying.name), `第 ${p.index} 宫克应名缺失：${p.ke_ying.name}`);
      assert.ok(text.includes(p.ke_ying.meaning), `第 ${p.index} 宫克应断语缺失`);
    }
  }
});

test('AI 文本：四害 / 空亡 / 马星 状态逐宫输出', () => {
  const cases = [];
  for (const p of chart.palaces) {
    const tags = [];
    if (p.flags.kong_wang) tags.push('空亡');
    if (p.flags.ma_xing) tags.push('马星');
    if (p.flags.ji_xing.active) tags.push('击刑');
    if (p.flags.ru_mu.active) tags.push('入墓');
    if (p.flags.men_po.active) tags.push('门迫');
    if (p.flags.xing_jia_mu) tags.push('刑+墓');
    cases.push(tags.join('、') || '无');
  }
  // 按小节顺序取「状态标记」行
  const statusLines = [...text.matchAll(/- \*\*状态标记\*\*：(.*)/g)].map((m) => m[1]);
  assert.equal(statusLines.length, 9);
  assert.deepEqual(statusLines, cases);
});

test('AI 文本：暗干写入九星行（浅灰干不丢失）', () => {
  for (const p of chart.palaces) {
    if (p.an_gan) {
      assert.ok(text.includes(`暗干：${p.an_gan}`), `第 ${p.index} 宫暗干未导出`);
    }
  }
  // 芮禽合并说明
  const rui = chart.palaces.find((p) => p.star === '天芮');
  if (rui) assert.ok(text.includes('芮禽'));
});

test('AI 文本：中五宫有寄宫说明且标注无门无神', () => {
  const block = text.split('### 5. ')[1].split('### 6. ')[0];
  assert.match(block, /八神\*\*：无/);
  assert.match(block, /八门\*\*：无/);
  assert.match(block, /寄宫说明/);
  assert.match(block, /天禽星寄坤二宫/);
});

test('AI 文本：中五寄宫产生的双干写入坤二地盘与芮禽天盘', () => {
  const c = buildChart({
    datetime: { year: 2010, month: 10, day: 10, hour: 10, minute: 10 },
    location: beijing,
  });
  const t = buildAiAnalysisText(c);
  // 阴遁3局：中宫干丙寄坤二；坤二地盘己、兑七芮禽天盘己
  assert.match(t, /- \*\*地盘奇仪\*\*：丙 己（含中五寄宫干 丙）/);
  assert.match(t, /- \*\*天盘奇仪\*\*：丙 己（含天禽寄宫干 丙）/);
  assert.match(t, /中宫之干 丙 寄至坤二宫地盘与芮禽宫天盘/);
  assert.match(t, /- \*\*九星\*\*：无（中五宫不单列九星/);
});

test('AI 文本：图例含内外盘划分与四害说明', () => {
  assert.match(text, /内盘为 9、2、7、6 宫，外盘为 8、3、4、1 宫/);
  for (const k of ['击刑', '入墓', '门迫', '空亡', '马星']) {
    assert.ok(text.includes(k), `图例缺 ${k}`);
  }
  assert.match(text, /当前口径：口诀派/);
});

test('AI 文本：不含任何 HTML 标签', () => {
  assert.equal(/<[a-zA-Z/][^>]*>/.test(text), false, '导出文本不应含 HTML 标签');
});

test('AI 文本：预测事项为空时写「未填写」', () => {
  const c2 = buildChart({
    datetime: { year: 2026, month: 11, day: 4, hour: 14, minute: 30 },
    location: beijing,
  });
  assert.match(buildAiAnalysisText(c2), /\*\*预测事项\*\*：未填写/);
});

test('文件名：qimen_AI分析_[时间]_[事项前四字].txt', () => {
  assert.equal(aiAnalysisFileName(chart), 'qimen_AI分析_2026-11-04_1432_测今日出.txt');
  const c2 = buildChart({
    datetime: { year: 2026, month: 11, day: 4, hour: 14, minute: 30 },
    location: beijing,
  });
  assert.equal(aiAnalysisFileName(c2), 'qimen_AI分析_2026-11-04_1432_未填写.txt');
});

test('文件名：非法字符与空白被清洗', () => {
  assert.equal(topicShort('测出行求财顺利'), '测出行求');
  assert.equal(topicShort('  测 出行  '), '测出行');
  assert.equal(topicShort(''), '未填写');
  const c2 = JSON.parse(JSON.stringify(chart));
  c2.meta.prediction_topic = 'a/b:c*d?e';
  // ':' 属于标点被剔除 → 前四字 a/bc → 再去掉 / → abc
  assert.equal(aiAnalysisFileName(c2), 'qimen_AI分析_2026-11-04_1432_abc.txt');
});

test('特殊格局识别：伏吟 / 反吟', () => {
  const mk = (fn) => ({
    palaces: Array.from({ length: 9 }, (_, i) => {
      const index = i + 1;
      return fn(index);
    }),
  });
  // 伏吟：天盘干 == 地盘干
  const fu = mk((index) => ({
    index,
    tian_pan_qi_yi: ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'][index - 1],
    di_pan_qi_yi: ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'][index - 1],
  }));
  assert.ok(detectSpecialPatterns(fu).some((s) => s.startsWith('伏吟')));

  // 反吟：天盘干 == 对宫地盘干
  const diPan = { 1: '戊', 2: '己', 3: '庚', 4: '辛', 5: '壬', 6: '癸', 7: '丁', 8: '丙', 9: '乙' };
  const opp = { 1: 9, 9: 1, 2: 8, 8: 2, 3: 7, 7: 3, 4: 6, 6: 4 };
  const fan = mk((index) => ({
    index,
    tian_pan_qi_yi: diPan[opp[index] || index],
    di_pan_qi_yi: diPan[index],
  }));
  assert.ok(detectSpecialPatterns(fan).some((s) => s.startsWith('反吟')));
});

test('输入校验：非法 chart 应抛错', () => {
  assert.throws(() => buildAiAnalysisText(null), /需要合法的排盘 JSON/);
  assert.throws(() => buildAiAnalysisText({ meta: {} }), /需要合法的排盘 JSON/);
});
