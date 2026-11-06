/**
 * qimen.js — 转盘·时家奇门起局内核
 *
 * 流程（对应需求第四节）：
 *   1. 真太阳时校正               → solar_time.js
 *   2. 四柱干支（年/月/日/时）     → calendar.js
 *   3. 当前节气 + 符头三元 → 阴阳遁/局数
 *   4. 地盘三奇六仪（阳顺阴逆）
 *   5. 值符（旬首仪）、值使（旬首本位门）
 *   6. 天盘：值符随时干落宫，九星/天盘奇仪顺时针整体旋转
 *   7. 八门：值使随时宫（按旬内时数）落宫，八门沿后天环整体旋转
 *   8. 八神：值符神随天盘值符，阳遁顺布、阴遁逆布
 *   9. 四害（击刑/入墓/门迫/刑+墓）、空亡、马星、内外盘
 *  10. 单宫十干克应
 */

'use strict';

const {
  STEMS,
  BRANCHES,
  SEXAGENARY,
  dayGanzhiFromJDN,
  hourGanzhi,
  xunOfHour,
  determineJu,
} = require('./calendar');
const {
  PALACES,
  RING,
  RING_POS,
  ringShift,
  ringDistance,
  RING_STARS,
  DOORS,
  RING_DOORS,
  GODS,
  overcomes,
  BRANCH_PALACE,
  HORSE_BY_BRANCH,
  JI_XING,
  RU_MU,
  NEI_PALACES_YANG,
} = require('./constants');
const { getKeYing, KE_YING_TABLE_VERSION } = require('./ke_ying');
const { trueSolarTime, beijingISO } = require('./solar_time');
const { changShengOf } = require('./chang_sheng');
const {
  solarTermAround,
  sunApparentLongitude,
  integerJulianDayNumber,
} = require('./astro');

/** 三奇六仪布阵次序：戊己庚辛壬癸丁丙乙 */
const QI_YI_ORDER = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'];

/** 九星本位：环序（顺时针）天蓬→天任→天冲→天辅→天英→天芮→天柱→天心，对应坎1→艮8→震3→巽4→离9→坤2→兑7→乾6 */
const STAR_AT_HOME = { 1: '天蓬', 8: '天任', 3: '天冲', 4: '天辅', 9: '天英', 2: '天芮', 7: '天柱', 6: '天心' };

/** 八门本位：坎1休、艮8生、震3伤、巽4杜、离9景、坤2死、兑7惊、乾6开 */
const DOOR_AT_HOME = { 1: '休', 8: '生', 3: '伤', 4: '杜', 9: '景', 2: '死', 7: '惊', 6: '开' };

/**
 * 后天八卦环（不含中五宫，顺时针 +1）：坎1→艮8→震3→巽4→离9→坤2→兑7→乾6
 * 九星、八门、八神、天盘奇仪 均沿此环作刚性旋转（阳遁顺、阴遁逆）。
 */
const DOOR_RING = RING;

/**
 * 值使数宫序（洛书宫序，**含中五宫**）：1→2→…→9→1
 * 「值使随时支」自旬首宫起、阳顺阴逆按旬内时数逐宫数至时支宫。
 * 中五宫必须参与计数（占一位）：若跳过它，凡是数宫路径跨中宫的局，
 * 值使门都会整体偏移一宫，八门盘随之全盘错位。
 * 若最终落在中五宫，按「中五寄坤二」把值使门寄到坤二宫。
 */
const SHI_RING = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const SHI_RING_POS = Object.fromEntries(SHI_RING.map((p, i) => [p, i]));

function shiRingShift(palace, steps, dir) {
  const n = SHI_RING.length;
  const i = SHI_RING_POS[palace];
  return SHI_RING[(((i + steps * dir) % n) + n) % n];
}

/* ------------------------------------------------------------------ *
 * 年柱 / 月柱
 * ------------------------------------------------------------------ */

/**
 * 年柱：以立春（太阳视黄经 315°）为界，按真太阳时所在年。
 * 立春前（黄经 270°–315°，即小寒至立春之间）归上一年。
 */
function yearGanzhiByLichun(trueSolarJd, calendarYear) {
  const lon = sunApparentLongitude(trueSolarJd);
  let year = calendarYear;
  if (lon >= 270 && lon < 315) year -= 1;
  const idx = (((year - 4) % 60) + 60) % 60;
  return { index: idx, text: SEXAGENARY[idx] };
}

/** 月柱（五虎遁）：以「节」为界；寅月为岁首 */
const MONTH_STEM_START = { 甲: '丙', 己: '丙', 乙: '戊', 庚: '戊', 丙: '庚', 辛: '庚', 丁: '壬', 壬: '壬', 戊: '甲', 癸: '甲' };
const JIE_MONTH_BRANCH = {
  立春: '寅', 惊蛰: '卯', 清明: '辰', 立夏: '巳', 芒种: '午', 小暑: '未',
  立秋: '申', 白露: '酉', 寒露: '戌', 立冬: '亥', 大雪: '子', 小寒: '丑',
};

function monthGanzhi(yearStem, jie) {
  const branch = JIE_MONTH_BRANCH[jie];
  if (!branch) throw new Error(`月柱：未知节令 ${jie}`);
  const branchIdx = BRANCHES.indexOf(branch);
  const startIdx = STEMS.indexOf(MONTH_STEM_START[yearStem]);
  const offset = (branchIdx - 2 + 12) % 12; // 自寅月起数
  const stemIdx = (startIdx + offset) % 10;
  return { stem: STEMS[stemIdx], branch, text: STEMS[stemIdx] + branch, branchIndex: branchIdx };
}

/* ------------------------------------------------------------------ *
 * 地盘
 * ------------------------------------------------------------------ */

/**
 * 地盘布局：戊起于「局数」宫，其余按 戊己庚辛壬癸丁丙乙 次序布九宫。
 * 布阵顺序为洛书宫序：阳遁 1→2→3→…→9→1，阴遁 9→8→…→1→9。
 * 注意：与「八门环序」（1→8→3→4→9→2→7→6）是两套不同次序，不可混用。
 * @returns {Object<number,string>} 宫位 → 奇仪
 */
function buildDiPan(ju, yinYang) {
  const dir = yinYang === 'yang' ? 1 : -1;
  const map = {};
  let palace = ju;
  for (let i = 0; i < QI_YI_ORDER.length; i += 1) {
    map[palace] = QI_YI_ORDER[i];
    palace = ((palace - 1 + dir + 9) % 9) + 1;
  }
  return map;
}

/**
 * 暗干（隐干）序列
 *
 * 规则（口径 'shigan-feibu-v1'）：
 *   以「时干」加临「值使门落宫」为起点，循奇仪序 戊→己→庚→辛→壬→癸→丁→丙→乙，
 *   沿洛书宫序飞布九宫——阳遁顺飞（1→2→…→9）、阴遁逆飞（9→8→…→1），
 *   中五宫亦占一位（不跳过）。
 *   注意：起点是值使门所落之宫，而非时干在地盘的落宫（两者常不同宫）。
 *
 *   **伏吟归中**：当「值使门落宫」与「时干落宫」重合（值符星、值使门俱归本位，
 *   天盘＝地盘）时，若仍从该宫起布，九个暗干会与地盘奇仪逐宫完全重合、失去独立意义。
 *   此类伏吟局改以「中五宫」为起点起飞（起干仍为时干），见 layoutPalaces。
 *
 * 校验盘例 A（2026-10-09 01:57 阴遁九局，值使惊门落坤2，时干己，逆飞）：
 *   坤2己 → 坎1庚 → 离9辛 → 艮8壬 → 兑7癸 → 乾6丁 → 中5丙 → 巽4乙 → 震3戊
 * 校验盘例 B（2026-11-05 21:49 阴遁五局·伏吟，值使景门落离9＝时干癸落宫，逆飞）：
 *   中5癸 → 巽4丁 → 震3丙 → 坤2乙 → 坎1戊 → 离9己 → 艮8庚 → 兑7辛 → 乾6壬
 * 两者均与权威盘例逐宫一致。
 *
 * @param {{startPalace:number, startStem:string, dir:1|-1}} g startPalace = 暗干起点宫
 * @returns {Object<number,string>} 宫位 → 暗干
 */
const AN_GAN_ORDER = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'];
const AN_GAN_RULE = 'shigan-feibu-v1';

function buildAnGan({ startPalace, startStem, dir }) {
  const startIdx = AN_GAN_ORDER.indexOf(startStem);
  if (startIdx < 0) throw new Error(`暗干：非法起点天干 ${startStem}`);
  if (!(startPalace >= 1 && startPalace <= 9)) throw new Error(`暗干：非法起点宫 ${startPalace}`);
  const out = {};
  for (let k = 0; k < 9; k += 1) {
    // 洛书宫序 1..9 循环；阳遁 +1、阴遁 -1
    const palace = ((startPalace - 1 + k * dir + 9 * 3) % 9) + 1;
    out[palace] = AN_GAN_ORDER[(startIdx + k) % 9];
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 由「已知四柱 + 局数」直接布盘（纯函数，测试可注入权威局数）
 * ------------------------------------------------------------------ */

/**
 * @param {Object} g
 * @param {{index:number,stem:string,branch:string,text:string}} g.day   日干支
 * @param {{stem:string,branch:string,text:string,posInXun:number}} g.hour 时干支（含旬内序）
 * @param {number} g.ju          局数 1..9
 * @param {'yang'|'yin'} g.yinYang
 * @param {'A'|'B'} [g.ruMuKouJing='A']
 * @returns {{palaces:Array, zhiFu:Object, zhiShi:Object, xun:Object, kongPalaces:number[], horsePalace:number, horseBranch:string}}
 */
function layoutPalaces({ day, hour, ju, yinYang, ruMuKouJing = 'A' }) {
  const xun = xunOfHour(hour);
  const diPan = buildDiPan(ju, yinYang);

  /* ---------- 值符 / 值使 ---------- */
  const zhiFuYi = xun.yi; // 旬首所遁之仪
  // 旬首仪所落之地盘宫（中五宫寄坤二宫）
  let zhiFuPalace = Number(Object.keys(diPan).find((p) => diPan[p] === zhiFuYi));
  if (zhiFuPalace === 5) zhiFuPalace = 2; // 中五宫寄坤二宫
  const zhiFuStar = STAR_AT_HOME[zhiFuPalace]; // 值符星（本位宫之星）
  const zhiFuDoorKey = DOOR_AT_HOME[zhiFuPalace]; // 值使门（本位宫之门）
  const zhiFuDoor = DOORS[zhiFuDoorKey].name;

  // 时干落宫：时干为甲则取旬首仪；落中五宫者寄坤二宫
  const hourStem = hour.stem === '甲' ? zhiFuYi : hour.stem;
  let hourStemPalace = Number(Object.keys(diPan).find((p) => diPan[p] === hourStem));
  if (hourStemPalace === 5) hourStemPalace = 2; // 中五宫寄坤二宫
  if (!hourStemPalace) throw new Error(`无法定位时干 ${hourStem} 的落宫`);

  /* ---------- 天盘九星与天盘奇仪 ---------- */
  // 九星整盘作刚性旋转：值符星自「本位宫」移至「时干之宫」。
  // 值符星本位宫 = STAR_AT_HOME 中对应之宫（通常即旬首仪宫，中五宫时取寄宫坤2）。
  const dir = yinYang === 'yang' ? 1 : -1;
  const zhiFuStarHome = Number(Object.keys(STAR_AT_HOME).find((k) => STAR_AT_HOME[k] === STAR_AT_HOME[zhiFuPalace]));
  // 位移 step：值符星本位宫 → 时干宫 的环距
  const starStep = (((RING_POS[hourStemPalace] - RING_POS[zhiFuStarHome]) % 8) + 8) % 8;
  // 各星本位宫之地盘奇仪（星携之干即为其天盘奇仪）
  const homeQi = {};
  for (const p of RING) homeQi[STAR_AT_HOME[p]] = diPan[p];
  homeQi['天禽'] = diPan[5];

  const starAt = { 5: '天禽' };
  const tianPanOf = { 5: diPan[5] }; // 中五宫天禽不随盘转，天盘取本宫地盘奇仪
  for (const p of RING) {
    // 落于本宫之星的本位宫 = 本宫沿行进方向回退 step 步
    const home = ringShift(p, -starStep, 1);
    const star = STAR_AT_HOME[home];
    starAt[p] = star;
    tianPanOf[p] = homeQi[star];
  }
  // 强制锚定：值符星必落于时干之宫（防御性校正，避免寄宫/中宫边界误差）
  if (starAt[hourStemPalace] !== STAR_AT_HOME[zhiFuStarHome]) {
    starAt[hourStemPalace] = STAR_AT_HOME[zhiFuStarHome];
    tianPanOf[hourStemPalace] = homeQi[STAR_AT_HOME[zhiFuStarHome]];
  }

  /* ---------- 八门（值使随时支） ---------- */
  const hourSteps = xun.posInXun; // 旬内时序：甲X=0 … 癸X=9
  // 值使门落宫：自旬首本位宫起，沿洛书九宫序每时辰进一宫（阳顺阴逆，中五宫占一位）
  let zhiShiPalace = shiRingShift(zhiFuPalace, hourSteps, dir);
  // 中五宫无门：值使门落中五宫时寄坤二宫（门盘锚点必须落在后天环上）
  if (zhiShiPalace === 5) zhiShiPalace = 2;
  // 八门盘刚性旋转：值使门（本位宫 zhiFuPalace）移至值使宫 zhiShiPalace，
  // 其余门沿后天环保持相对次序（旋转量 = 值使宫环位 − 旬首本位环位）。
  const doorStep = (((RING_POS[zhiShiPalace] - RING_POS[zhiFuPalace]) % 8) + 8) % 8;
  const doorAt = { 5: null };
  for (const p of RING) {
    const home = ringShift(p, doorStep, -1);
    doorAt[p] = DOOR_AT_HOME[home];
  }

  /* ---------- 八神（小值符随时间干落宫，阳顺阴逆） ---------- */
  const godAt = { 5: null };
  for (let i = 0; i < GODS.length; i += 1) {
    godAt[ringShift(hourStemPalace, i, dir)] = GODS[i];
  }

  /* ---------- 暗干（时干加临值使门飞布；伏吟归中） ---------- */
  // 起点 = 值使门落宫（不是时干在地盘的落宫），起干 = 时干；
  // 循奇仪序阳顺阴逆布九宫（中五宫亦占一位）。
  // 伏吟局（值使宫 === 时干落宫）时暗干会与地盘逐宫重合，改由中五宫起飞。
  const anGanStartIsFuYin = zhiShiPalace === hourStemPalace;
  const anGanStartPalace = anGanStartIsFuYin ? 5 : zhiShiPalace;
  const anGanAt = buildAnGan({ startPalace: anGanStartPalace, startStem: hourStem, dir });

  /* ---------- 空亡 / 马星 ---------- */
  const kongBranches = xun.voidBranches;
  const kongPalaces = [...new Set(kongBranches.map((b) => BRANCH_PALACE[b]))];
  const horseBranch = HORSE_BY_BRANCH[hour.branch];
  const horsePalace = BRANCH_PALACE[horseBranch];

  /* ---------- 中五寄坤二 / 天禽寄干（双天干） ---------- */
  // 中五宫无门无神，天禽星寄坤二宫并随天芮同行，因此有两处要显示「双天干」：
  //   · 坤二宫【地盘】：本宫奇仪 + 中五宫之地盘奇仪（中宫寄干）；
  //   · 芮禽合宫【天盘】：天芮携来之本位干 + 天禽携来之中宫干。
  // 顺序按专业排盘写法：寄宫干在前、本宫干在后（如「戊 辛」「壬 丙」「丙 己」）。
  const jiGongGan = diPan[5];
  const ruiPalace = Number(Object.keys(starAt).find((k) => starAt[k] === '天芮'));

  /* ---------- 组装九宫 ---------- */
  const neiSet = new Set(yinYang === 'yang' ? NEI_PALACES_YANG : [9, 2, 7, 6]);
  const palaces = PALACES.map((p) => {
    const tianGan = tianPanOf[p.index];
    const diGan = diPan[p.index];
    const doorKey = doorAt[p.index];
    const palaceEl = p.element;
    const tianPanExtra = p.index === ruiPalace ? jiGongGan : null;
    const diPanExtra = p.index === 2 ? jiGongGan : null;

    // 四害：击刑 / 入墓 均以「天盘奇仪」为对象；门迫以「门」为对象
    const jiXingActive = JI_XING[tianGan] === p.index;
    const ruMuPalace = RU_MU[ruMuKouJing][tianGan];
    const ruMuActive = ruMuPalace === p.index;
    const menPoActive = !!(doorKey && overcomes(DOORS[doorKey].element, palaceEl));
    const xingJiaMu = jiXingActive && ruMuActive; // 刑+墓：两者同时成立（各依本表独立判定）

    const keYing = tianGan && diGan ? getKeYing(tianGan, diGan) : null;

    return {
      index: p.index,
      name: p.name,
      trigram: p.trigram,
      direction: p.direction,
      element: palaceEl,
      nei_wai: p.index === 5 ? 'zhong' : neiSet.has(p.index) ? 'nei' : 'wai',
      tian_pan_qi_yi: tianGan || null,
      di_pan_qi_yi: diGan || null,
      // 寄宫附加干：仅芮禽宫（天盘）与坤二宫（地盘）非空；四害/克应仍只按上面的本宫干判定
      tian_pan_qi_yi_extra: tianPanExtra,
      di_pan_qi_yi_extra: diPanExtra,
      // 十二长生：天盘干 / 地盘干 / 暗干落本宫的旺衰（中五宫寄坤二宫判定）
      chang_sheng: {
        tian_pan: changShengOf(tianGan, p.index),
        di_pan: changShengOf(diGan, p.index),
        an_gan: changShengOf(anGanAt[p.index], p.index),
      },
      star: starAt[p.index] || null,
      // 芮禽合宫：天禽随天芮同行，展示时合并为「芮禽」
      star_display: starAt[p.index] === '天芮' ? '芮禽' : starAt[p.index] || null,
      star_extra: starAt[p.index] === '天芮' ? '天禽' : null,
      door: doorKey ? DOORS[doorKey].name : null,
      door_key: doorKey || null,
      god: godAt[p.index] || null,
      an_gan: anGanAt[p.index] || null,
      an_gan_rule: AN_GAN_RULE,
      flags: {
        kong_wang: kongPalaces.includes(p.index),
        ma_xing: horsePalace === p.index,
        ru_mu: { active: ruMuActive, scope: 'tian_pan_qi_yi', palace: ruMuPalace ?? null },
        ji_xing: { active: jiXingActive, scope: 'tian_pan_qi_yi', palace: JI_XING[tianGan] ?? null },
        men_po: { active: menPoActive, scope: 'door' },
        xing_jia_mu: xingJiaMu,
      },
      ke_ying: keYing
        ? { tian_gan: keYing.tian_gan, di_gan: keYing.di_gan, name: keYing.name, meaning: keYing.meaning }
        : { tian_gan: '', di_gan: '', name: '—', meaning: '中宫无十干克应' },
    };
  });

  return {
    palaces,
    zhiFu: { yi: zhiFuYi, star: zhiFuStar, door: zhiFuDoor, palace: zhiFuPalace },
    zhiShi: { door: zhiFuDoor, key: zhiFuDoorKey, palace: zhiShiPalace },
    xun,
    kongPalaces,
    horsePalace,
    horseBranch,
    anGanAt,
    anGanStart: anGanStartPalace,
    anGanStartIsFuYin,
    anGanStem: hourStem,
    jiGongGan,
  };
}

/* ------------------------------------------------------------------ *
 * 对外主入口
 * ------------------------------------------------------------------ */

/**
 * 核心起局函数
 * @param {Object} options
 * @param {{year:number,month:number,day:number,hour:number,minute:number,second?:number}} options.datetime 北京时间
 * @param {{name:string,lng:number,lat:number}} options.location 地点
 * @param {'A'|'B'} [options.ruMuKouJing='A'] 入墓口径
 * @param {string} [options.predictionTopic=''] 预测事项（仅记录，不驱动用神）
 * @param {boolean} [options.useTrueSolarTime=true] 是否启用真太阳时校正
 * @returns {Object} 盘面 JSON（结构见需求第六节）
 */
function buildChart(options) {
  const {
    datetime,
    location,
    ruMuKouJing = 'A',
    predictionTopic = '',
    useTrueSolarTime = true,
  } = options;
  if (!datetime || !location) throw new Error('缺少 datetime 或 location');
  if (!['A', 'B'].includes(ruMuKouJing)) throw new Error('ru_mu_kou_jing 只能为 "A" 或 "B"');
  const lng = Number(location.lng);
  const lat = Number(location.lat);
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error('经度超出范围（-180 ~ 180）');
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error('纬度超出范围（-90 ~ 90）');
  for (const [k, min, max] of [['month', 1, 12], ['day', 1, 31], ['hour', 0, 23], ['minute', 0, 59]]) {
    if (!Number.isInteger(datetime[k]) || datetime[k] < min || datetime[k] > max) {
      throw new Error(`时间字段 ${k} 不合法`);
    }
  }
  if (!Number.isInteger(datetime.year) || datetime.year < 1900 || datetime.year > 2100) {
    throw new Error('年份需在 1900 ~ 2100 之间');
  }

  /* ---------- 1. 真太阳时 ---------- */
  const st = useTrueSolarTime
    ? trueSolarTime(datetime, Number(location.lng))
    : (() => {
        const r = trueSolarTime(datetime, 120);
        return { ...r, equationOfTimeMinutes: 0, longitudeOffsetMinutes: 0, totalOffsetMinutes: 0 };
      })();

  const local = st.trueSolar; // 起局依据的当地真太阳时
  const localJd = st.trueSolarJd;

  /* ---------- 2. 四柱 ---------- */
  const jdn = integerJulianDayNumber(local.year, local.month, local.day);
  const day = dayGanzhiFromJDN(jdn);
  const hour = hourGanzhi(day.index % 10, local.hour);

  /* ---------- 3. 节气 + 符头三元 → 局 ---------- */
  const termAround = solarTermAround(localJd);
  const activeTerm = termAround.name;
  const juInfo = determineJu(activeTerm, day.index);
  const yearGz = yearGanzhiByLichun(localJd, local.year);
  const monthGz = monthGanzhi(yearGz.text[0], juInfo.jie);

  /* ---------- 4~9. 布盘 ---------- */
  const laid = layoutPalaces({
    day,
    hour,
    ju: juInfo.ju,
    yinYang: juInfo.yinYang,
    ruMuKouJing,
  });

  /* ---------- 10. 输出 ---------- */
  const juLabel = `${juInfo.yinYang === 'yang' ? '阳遁' : '阴遁'}${juInfo.ju}局`;
  return {
    meta: {
      paipan_type: 'shijia_zhuanpan',
      input_time: beijingISO(datetime.year, datetime.month, datetime.day, datetime.hour, datetime.minute, datetime.second || 0),
      location: {
        name: location.name || '',
        lng: Number(location.lng),
        lat: Number(location.lat),
      },
      true_solar_time: `${st.trueSolarISO}+08:00`,
      yinyang_dun: juInfo.yinYang,
      ju_number: juInfo.ju,
      ju_label: juLabel,
      ru_mu_kou_jing: ruMuKouJing,
      prediction_topic: predictionTopic || '',
      jieqi: activeTerm,
      jie: juInfo.jie,
      yuan: juInfo.yuan,
      fu_tou: juInfo.fuTou,
      si_zhu: {
        year: yearGz.text,
        month: monthGz.text,
        day: day.text,
        hour: hour.text,
      },
      day_ganzhi: day.text,
      hour_ganzhi: hour.text,
      xun_head: laid.xun.head,
      xun_yi: laid.xun.yi,
      void_branches: laid.xun.voidBranches,
      zhi_fu: { yi: laid.zhiFu.yi, star: laid.zhiFu.star, door: laid.zhiFu.door, palace: laid.zhiFu.palace },
      zhi_shi: { door: laid.zhiShi.door, palace: laid.zhiShi.palace },
      ma_xing_branch: laid.horseBranch,
      an_gan_rule: AN_GAN_RULE,
      an_gan_start: {
        palace: laid.anGanStart,
        stem: laid.anGanStem,
        source: laid.anGanStartIsFuYin ? 'zhong_gong_fu_yin' : 'zhi_shi_palace',
      },
      ji_gong: { from_palace: 5, to_palace: 2, stem: laid.jiGongGan, rule: 'zhong5-ji-kun2' },
      true_solar_correction: {
        equation_of_time_minutes: round(st.equationOfTimeMinutes, 3),
        longitude_offset_minutes: round(st.longitudeOffsetMinutes, 3),
        total_offset_minutes: round(st.totalOffsetMinutes, 3),
      },
    },
    palaces: laid.palaces,
    ke_ying_table_version: KE_YING_TABLE_VERSION,
    saved_at: new Date().toISOString(),
  };
}

function round(n, d = 2) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

/**
 * 由外部提供的「四柱 + 局数」直接布盘（用于复现权威盘例 / 校核旋转规则）。
 * @param {Object} o
 * @param {string} o.dayGanzhi  日柱，如 '乙巳'
 * @param {string} o.hourGanzhi 时柱，如 '庚辰'
 * @param {number} o.ju         局数
 * @param {'yang'|'yin'} o.yinYang
 * @param {'A'|'B'} [o.ruMuKouJing='A']
 */
function buildChartFromGivens({ dayGanzhi, hourGanzhi: hourText, ju, yinYang, ruMuKouJing = 'A' }) {
  const dayIdx = SEXAGENARY.indexOf(dayGanzhi);
  if (dayIdx < 0) throw new Error(`非法日柱：${dayGanzhi}`);
  const hIdx = SEXAGENARY.indexOf(hourText);
  if (hIdx < 0) throw new Error(`非法时柱：${hourText}`);
  const day = { index: dayIdx, stem: STEMS[dayIdx % 10], branch: BRANCHES[dayIdx % 12], text: dayGanzhi };
  const hour = {
    index: hIdx,
    stem: STEMS[hIdx % 10],
    branch: BRANCHES[hIdx % 12],
    text: hourText,
    stemIndex: hIdx % 10,
    branchIndex: hIdx % 12,
    posInXun: hIdx % 10,
  };
  const laid = layoutPalaces({ day, hour, ju, yinYang, ruMuKouJing });
  const juLabel = `${yinYang === 'yang' ? '阳遁' : '阴遁'}${ju}局`;
  return {
    meta: {
      paipan_type: 'shijia_zhuanpan',
      input_time: '',
      location: { name: '', lng: 0, lat: 0 },
      true_solar_time: '',
      yinyang_dun: yinYang,
      ju_number: ju,
      ju_label: juLabel,
      ru_mu_kou_jing: ruMuKouJing,
      prediction_topic: '',
      jieqi: '',
      jie: '',
      yuan: '',
      fu_tou: '',
      si_zhu: { year: '', month: '', day: dayGanzhi, hour: hourText },
      day_ganzhi: dayGanzhi,
      hour_ganzhi: hourText,
      xun_head: laid.xun.head,
      xun_yi: laid.xun.yi,
      void_branches: laid.xun.voidBranches,
      zhi_fu: { yi: laid.zhiFu.yi, star: laid.zhiFu.star, door: laid.zhiFu.door, palace: laid.zhiFu.palace },
      zhi_shi: { door: laid.zhiShi.door, palace: laid.zhiShi.palace },
      ma_xing_branch: laid.horseBranch,
      an_gan_rule: AN_GAN_RULE,
      an_gan_start: {
        palace: laid.anGanStart,
        stem: laid.anGanStem,
        source: laid.anGanStartIsFuYin ? 'zhong_gong_fu_yin' : 'zhi_shi_palace',
      },
      ji_gong: { from_palace: 5, to_palace: 2, stem: laid.jiGongGan, rule: 'zhong5-ji-kun2' },
      true_solar_correction: { equation_of_time_minutes: 0, longitude_offset_minutes: 0, total_offset_minutes: 0 },
      note: '由外部给定四柱与局数直接布盘（用于校核）',
    },
    palaces: laid.palaces,
    ke_ying_table_version: KE_YING_TABLE_VERSION,
    saved_at: new Date().toISOString(),
  };
}

module.exports = {
  buildChart,
  buildChartFromGivens,
  layoutPalaces,
  buildDiPan,
  buildAnGan,
  AN_GAN_ORDER,
  AN_GAN_RULE,
  QI_YI_ORDER,
  STAR_AT_HOME,
  DOOR_AT_HOME,
  yearGanzhiByLichun,
  monthGanzhi,
};
