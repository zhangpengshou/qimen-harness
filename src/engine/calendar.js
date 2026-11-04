/**
 * calendar.js — 干支历、三元（符头）、阴阳遁与局数
 *
 * 依据「转盘·时家奇门」默认决策：
 *   - 定局：当前时间所在「节」（十二节之一）+ 当日符头所定三元 → 查三元定局表
 *   - 三元：以「符头」定，甲己日为符头；甲子/己卯/甲午/己酉 = 上元，
 *           甲寅/己巳/甲申/己亥 = 中元，甲辰/己未/甲戌/己丑 = 下元
 *           （即日干支在 60 甲子中的序号 % 15 → 0-4 上元 / 5-9 中元 / 10-14 下元）
 *
 * 说明：本实现按「拆补法」口径取当前节气 + 符头三元（与需求第三节第 1 条、
 * 第四节第 1 条一致）。置闰法不启用，原因与差异见 README「假设与取舍」。
 */

'use strict';

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** 六十甲子表 */
const SEXAGENARY = Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BRANCHES[i % 12]);

/**
 * 十二「节」三元定局表。
 * yang=true 表示阳遁。ju = [上元, 中元, 下元]。
 * 依据通行《三元定局表》，并用「阴阳遁互对之和为 10」自校（test/calendar.test.js）。
 */
const JU_TABLE = {
  立春: { yang: true, ju: [8, 5, 2] },
  雨水: { yang: true, ju: [9, 6, 3] },
  惊蛰: { yang: true, ju: [1, 7, 4] },
  春分: { yang: true, ju: [3, 9, 6] },
  清明: { yang: true, ju: [4, 1, 7] },
  谷雨: { yang: true, ju: [5, 2, 8] },
  立夏: { yang: true, ju: [4, 1, 7] },
  小满: { yang: true, ju: [5, 2, 8] },
  芒种: { yang: true, ju: [6, 9, 3] },
  夏至: { yang: false, ju: [9, 3, 6] },
  小暑: { yang: false, ju: [8, 2, 5] },
  大暑: { yang: false, ju: [7, 1, 4] },
  立秋: { yang: false, ju: [2, 5, 8] },
  处暑: { yang: false, ju: [1, 4, 7] },
  白露: { yang: false, ju: [9, 3, 6] },
  秋分: { yang: false, ju: [7, 1, 4] },
  寒露: { yang: false, ju: [6, 9, 3] },
  霜降: { yang: false, ju: [5, 8, 2] },
  立冬: { yang: false, ju: [6, 9, 3] },
  小雪: { yang: false, ju: [5, 8, 2] },
  大雪: { yang: false, ju: [4, 7, 1] },
  冬至: { yang: true, ju: [1, 7, 4] },
  小寒: { yang: true, ju: [2, 8, 5] },
  大寒: { yang: true, ju: [3, 9, 6] },
};

/** 十二节（用于定局），其余 12 个为中气，不直接定局 */
const JIE = ['立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒'];

/**
 * 由公历日（当地民用日 00:00 起算的整数儒略日）求日干支序号 0..59。
 * 锚点：2000-01-07 为甲子日（JDN 2451551）。
 */
function dayIndexFromJDN(jdn) {
  return ((jdn - 11) % 60 + 60) % 60;
}

/** 日干支对象 */
function dayGanzhiFromJDN(jdn) {
  const index = dayIndexFromJDN(jdn);
  return {
    index,
    stem: STEMS[index % 10],
    branch: BRANCHES[index % 12],
    text: SEXAGENARY[index],
  };
}

/**
 * 时干支：地支由真太阳时的「时」定，天干用五鼠遁。
 * 子时 23:00–00:59，日柱不换日（按主流时家奇门：以当日日干起子时）。
 * @param {number} dayStemIndex 日干序号 0..9
 * @param {number} hour 0..23
 */
function hourBranchIndexFromHour(hour) {
  // 23:00-00:59 子(0), 01:00-02:59 丑(1) ...
  return Math.floor(((hour + 1) % 24) / 2);
}

function hourGanzhi(dayStemIndex, hour) {
  const branchIndex = hourBranchIndexFromHour(hour);
  // 五鼠遁：甲己起甲子，乙庚起丙子，丙辛起戊子，丁壬起庚子，戊癸起壬子
  const stemIndex = (dayStemIndex % 5) * 2 + branchIndex;
  const s = stemIndex % 10;
  return {
    stemIndex: s,
    branchIndex,
    stem: STEMS[s],
    branch: BRANCHES[branchIndex],
    text: STEMS[s] + BRANCHES[branchIndex],
    branchStemIndex: stemIndex, // 未归一化，用于推旬
  };
}

/** 时干支所属旬（六甲旬）：返回 {head, headStemIndex, xunIndex 0..5, voidBranches} */
const XUN_HEADS = ['甲子', '甲戌', '甲申', '甲午', '甲辰', '甲寅'];
const XUN_VOID = [
  ['戌', '亥'],
  ['申', '酉'],
  ['午', '未'],
  ['辰', '巳'],
  ['寅', '卯'],
  ['子', '丑'],
];
const XUN_YI = ['戊', '己', '庚', '辛', '壬', '癸']; // 旬首所遁之仪
const XUN_INDEX_OF_STEM = { 戊: 0, 己: 1, 庚: 2, 辛: 3, 壬: 4, 癸: 5 };

function xunOfHour(hourGz) {
  // 以时干支在 60 甲子中的序号 % 10 = 旬内序（甲X为0）
  const stem = hourGz.stem;
  const branch = hourGz.branch;
  const hourIdx = SEXAGENARY.indexOf(stem + branch);
  const xunIndex = Math.floor(hourIdx / 10);
  return {
    xunIndex,
    head: XUN_HEADS[xunIndex],
    headStem: '甲',
    yi: XUN_YI[xunIndex],
    voidBranches: XUN_VOID[xunIndex],
    posInXun: hourIdx % 10, // 0..9，甲X时为 0
    hourIdx,
  };
}

/** 日干支 → 三元 */
function yuanFromDayIndex(dayIndex) {
  const m = dayIndex % 15;
  if (m <= 4) return { yuan: '上元', key: '上', fuTou: SEXAGENARY[dayIndex - m] };
  if (m <= 9) return { yuan: '中元', key: '中', fuTou: SEXAGENARY[dayIndex - (m - 5)] };
  return { yuan: '下元', key: '下', fuTou: SEXAGENARY[dayIndex - (m - 10)] };
}

/**
 * 定局：由「当前节气名」+「三元」→ 阴阳遁与局数。
 * 二十四节气（含中气）在 JU_TABLE 中均有独立三元局数，
 * 直接查本节气；同时给出所属「节」（用于月柱）。
 * @returns {{jie:string, ju:number, yinYang:'yang'|'yin', yuan:string, yuanKey:string, fuTou:string, sourceTerm:string}}
 */
function determineJu(termName, dayIndex) {
  const sourceTerm = termName;
  const entry = JU_TABLE[termName];
  if (!entry) throw new Error(`未知节气：${termName}`);
  const jie = JIE.includes(termName) ? termName : jieForZhongQi(termName);
  const y = yuanFromDayIndex(dayIndex);
  const ju = entry.ju[['上', '中', '下'].indexOf(y.key)];
  return {
    jie,
    ju,
    yinYang: entry.yang ? 'yang' : 'yin',
    yuan: y.yuan,
    yuanKey: y.key,
    fuTou: y.fuTou,
    sourceTerm,
  };
}

/**
 * 中气 → 所属月的「节」。
 * 节气按太阳黄经 15° 排列：立春→雨水→惊蛰→…；每个「节」与其后的中气同属一月。
 */
const ZHONGQI_TO_JIE = {
  雨水: '立春',
  春分: '惊蛰',
  谷雨: '清明',
  小满: '立夏',
  夏至: '芒种',
  大暑: '小暑',
  处暑: '立秋',
  秋分: '白露',
  霜降: '寒露',
  小雪: '立冬',
  冬至: '大雪',
  大寒: '小寒',
};

function jieForZhongQi(zhongqi) {
  const jie = ZHONGQI_TO_JIE[zhongqi];
  if (!jie) throw new Error(`未知中气：${zhongqi}`);
  return jie;
}

module.exports = {
  STEMS,
  BRANCHES,
  SEXAGENARY,
  JU_TABLE,
  JIE,
  XUN_HEADS,
  XUN_VOID,
  XUN_YI,
  XUN_INDEX_OF_STEM,
  ZHONGQI_TO_JIE,
  dayIndexFromJDN,
  dayGanzhiFromJDN,
  hourBranchIndexFromHour,
  hourGanzhi,
  xunOfHour,
  yuanFromDayIndex,
  determineJu,
  jieForZhongQi,
};
