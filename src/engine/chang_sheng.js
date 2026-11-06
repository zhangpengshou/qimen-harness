/**
 * chang_sheng.js — 十二长生（天干落宫的能量旺衰）
 *
 * 口径：
 *   1. 十干各有「长生」地支（火土同宫：丙戊长生寅、丁己长生酉）。
 *   2. 阳干顺行、阴干逆行，按 长生→沐浴→冠带→临官→帝旺→衰→病→死→墓→绝→胎→养 布十二地支。
 *   3. 十二地支寄九宫沿用 constants.js 的 BRANCH_PALACE：
 *      四正宫各辖一支；四隅宫各辖两支，按「阳干取阳支、阴干取阴支」择一，
 *      使每个干在每宫都有唯一确定的长生状态。
 *   4. 中五宫无地支，按本插件「中五寄坤二」口径寄坤二宫判定（via_palace=2）。
 *
 * 用途：衡量天盘奇仪 / 地盘奇仪 / 暗干落宫时的旺衰，供断局时判能量强弱。
 */

'use strict';

const { BRANCH_PALACE } = require('./constants');

/** 十二长生次序 */
const STAGES = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];

const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const BRANCH_INDEX = Object.fromEntries(BRANCHES.map((b, i) => [b, i]));

const YANG_STEMS = ['甲', '丙', '戊', '庚', '壬'];
const YANG_STEM_SET = new Set(YANG_STEMS);
const YANG_BRANCH_SET = new Set(['子', '寅', '辰', '午', '申', '戌']);

/** 十干长生地支（甲隐于六仪，盘面不单独出现，但保留以完整） */
const START_BRANCH = {
  甲: '亥',
  乙: '午',
  丙: '寅',
  丁: '酉',
  戊: '寅',
  己: '酉',
  庚: '巳',
  辛: '子',
  壬: '申',
  癸: '卯',
};

/** 九宫 → 所辖地支（中五宫无地支） */
const PALACE_BRANCHES = (() => {
  const out = {};
  for (const [branch, palace] of Object.entries(BRANCH_PALACE)) {
    if (!out[palace]) out[palace] = [];
    out[palace].push(branch);
  }
  return out;
})();

/** 旺衰三级：旺（气盛） / 平（过渡） / 衰（气弱） */
const LEVEL = {
  长生: '旺',
  沐浴: '平',
  冠带: '平',
  临官: '旺',
  帝旺: '旺',
  衰: '衰',
  病: '衰',
  死: '衰',
  墓: '衰',
  绝: '衰',
  胎: '平',
  养: '平',
};

const MEANING = {
  长生: '气初生而渐长，主生发、起步、后劲足；宜开端、宜渐进。',
  沐浴: '气未定而多波动，主犹疑、反复、桃花；忌冒进与重大决断。',
  冠带: '气渐成形，主成长、修饰、崭露头角；利学习整备。',
  临官: '气正盛而可用，主得位、有实权、可任事；利求官谋事。',
  帝旺: '气至极盛，主强旺显达，然盛极将衰；利进取，忌过满。',
  衰: '盛极而退，主守成、力不从心；宜收敛，不宜新谋。',
  病: '气弱而病，主隐患、疲敝、拖延；事宜缓、宜调理。',
  死: '气近于静，主停滞、终结、缺乏生机；宜止不宜进。',
  墓: '气藏入墓，主收藏、隐匿、受困；利藏匿归档，忌张扬。',
  绝: '气断而将续，主隔绝、了结、转折；旧事已终，新机未萌。',
  胎: '气复结胎，主孕育、萌芽、暗中成形；利筹备，尚未可动。',
  养: '气得滋养，主休养、蓄势、待时；宜积累，待旺而动。',
};

/**
 * 判定某天干落某宫的十二长生状态。
 * @param {string} stem 天干（甲乙丙丁戊己庚辛壬癸）
 * @param {number} palace 宫位 1..9
 * @returns {{stem:string,palace:number,via_palace:number,branch:string,name:string,stage:number,level:string,meaning:string}|null}
 */
function changShengOf(stem, palace) {
  if (!stem || !START_BRANCH[stem]) return null;
  const viaPalace = palace === 5 ? 2 : palace;
  const candidates = PALACE_BRANCHES[viaPalace];
  if (!candidates || !candidates.length) return null;

  const isYang = YANG_STEM_SET.has(stem);
  let branch = candidates[0];
  if (candidates.length > 1) {
    branch = candidates.find((b) => YANG_BRANCH_SET.has(b) === isYang) || candidates[0];
  }

  const dir = isYang ? 1 : -1;
  const step = ((((BRANCH_INDEX[branch] - BRANCH_INDEX[START_BRANCH[stem]]) * dir) % 12) + 12) % 12;
  const name = STAGES[step];
  return {
    stem,
    palace,
    via_palace: viaPalace,
    branch,
    name,
    stage: step,
    level: LEVEL[name],
    meaning: MEANING[name],
  };
}

/** 某干在九宫的十二长生全表（供自检与文档） */
function changShengTable(stem) {
  const out = {};
  for (let p = 1; p <= 9; p += 1) out[p] = changShengOf(stem, p);
  return out;
}

module.exports = {
  STAGES,
  START_BRANCH,
  YANG_STEMS,
  PALACE_BRANCHES,
  LEVEL,
  MEANING,
  changShengOf,
  changShengTable,
};
