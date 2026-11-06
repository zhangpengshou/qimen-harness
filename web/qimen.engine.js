/**
 * qimen.engine.js — 自动生成，请勿手改。
 * 源码：src/engine/*.js（CommonJS），由 scripts/build-browser-bundle.js 生成。
 * 挂载：window.QimenEngine
 * 生成时间：2026-11-06T06:01:32.966Z
 */
(function (global) {
  'use strict';
  var factories = {};
  var cache = {};
  function define(id, fn) { factories[id] = fn; }
  function require(id) {
    if (cache[id]) return cache[id].exports;
    var fn = factories[id];
    if (!fn) throw new Error('未找到模块：' + id);
    var module = { exports: {} };
    cache[id] = module;
    fn(module, module.exports, require);
    return module.exports;
  }

define('astro', function (module, exports, require) {
/**
 * astro.js — 天文计算内核（无第三方依赖）
 *
 * 提供：
 *   - 儒略日 / 公历互转（Meeus, Astronomical Algorithms, ch.7）
 *   - ΔT（TT-UT）近似
 *   - 太阳视黄经（截断 VSOP87D 地球黄经 L0/L1/L2/L3 → 地心视黄经）
 *   - 均时差 EoT（Meeus ch.28）
 *   - 24 节气时刻求解（视黄经 = 15° 的整数倍）
 *
 * 精度评估：视黄经误差约 0.005°（≈ 7 分钟量级的时间误差上限），
 * 对奇门定局（以「日」为粒度）绰绰有余；用于真太阳时的均时差误差 < 3 秒。
 *
 * 自检方式见 test/astro.test.js（对照 2026 年公开节气时刻表）。
 */

const DEG = Math.PI / 180;

/* ------------------------------------------------------------------ *
 * 儒略日
 * ------------------------------------------------------------------ */

/** 公历（格里高利历，含其前身儒略历）→ 儒略日数（当日正午为 .0） */
function julianDayFromCivil(year, month, day, dayFraction = 0) {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    b -
    1524.5 +
    dayFraction
  );
}

/** 儒略日 → 公历 {year, month, day, dayFraction} */
function civilFromJulianDay(jd) {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const dayF = b - d - Math.floor(30.6001 * e) + f;
  const day = Math.floor(dayF);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  return { year, month, day, dayFraction: dayF - day };
}

/** 整数儒略日（该公历日 00:00 起算的日号，用于干支纪日） */
function integerJulianDayNumber(year, month, day) {
  return Math.floor(julianDayFromCivil(year, month, day) + 0.5);
}

/**
 * ΔT = TT - UT，单位秒。用 NASA/Espenak-Meeus 分段多项式，2005–2050 段。
 * 2020 年代约 69–72 秒，对节气时刻影响 < 2 分钟，可忽略但对均时差严谨处理。
 */
function deltaTSeconds(year) {
  if (year >= 2005 && year < 2050) {
    const t = year - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t * t;
  }
  if (year >= 1986 && year < 2005) {
    const t = year - 2000;
    return (
      63.86 +
      0.3345 * t -
      0.060374 * t * t +
      0.0017275 * t * t * t +
      0.000651814 * t * t * t * t +
      0.00002373599 * t * t * t * t * t
    );
  }
  if (year >= 2050 && year < 2150) {
    const u = (year - 1820) / 100;
    return -20 + 32 * u * u - 0.5628 * (2150 - year);
  }
  const u = (year - 1820) / 100;
  return -20 + 32 * u * u;
}

/* ------------------------------------------------------------------ *
 * 截断 VSOP87D：地球日心黄经 L（弧度，已去 2π 整周）
 * 项格式：[A, B, C]  =>  A * cos(B + C * τ)，τ = 儒略千年数（TT）
 * 数据取自 Meeus, Astronomical Algorithms, Appendix III（L0..L3 主要项）。
 * ------------------------------------------------------------------ */

const EARTH_L0 = [
  [175347046, 0, 0],
  [3341656, 4.6692568, 6283.07585],
  [34894, 4.6261, 12566.1517],
  [3497, 2.7441, 5753.3849],
  [3418, 2.8289, 3.5231],
  [3136, 3.6277, 77713.7715],
  [2676, 4.4181, 7860.4194],
  [2343, 6.1352, 3930.2097],
  [1324, 0.7425, 11506.7698],
  [1273, 2.0371, 529.691],
  [1199, 1.1096, 1577.3435],
  [990, 5.233, 5884.927],
  [902, 2.045, 26.298],
  [857, 3.508, 398.149],
  [780, 1.179, 5223.694],
  [753, 2.533, 5507.553],
  [505, 4.583, 18849.228],
  [492, 4.205, 775.523],
  [357, 2.92, 0.067],
  [317, 5.849, 11790.629],
  [284, 1.899, 796.298],
  [271, 0.315, 10977.079],
  [243, 0.345, 5486.778],
  [206, 4.806, 2544.314],
  [205, 1.869, 5573.143],
  [202, 2.458, 6069.777],
  [156, 0.833, 213.299],
  [132, 3.411, 2942.463],
  [126, 1.083, 20.775],
  [115, 0.645, 0.98],
  [103, 0.636, 4694.003],
  [102, 0.976, 15720.839],
  [102, 4.267, 7.114],
  [99, 6.21, 2146.17],
  [98, 0.68, 155.42],
  [86, 5.98, 161000.69],
  [85, 1.3, 6275.96],
  [85, 3.67, 71430.7],
  [80, 1.81, 17260.15],
  [79, 3.04, 12036.46],
  [75, 1.76, 5088.63],
  [74, 3.5, 3154.69],
  [74, 4.68, 801.82],
  [70, 0.83, 9437.76],
  [62, 3.98, 8827.39],
  [61, 1.82, 7084.9],
  [57, 2.78, 6286.6],
  [56, 4.39, 14143.5],
  [56, 3.47, 6279.55],
  [52, 0.19, 12139.55],
  [52, 1.33, 1748.02],
  [51, 0.28, 5856.48],
  [49, 0.49, 1194.45],
  [41, 5.37, 8429.24],
  [41, 2.4, 19651.05],
  [39, 6.17, 10447.39],
  [37, 6.04, 10213.29],
  [37, 2.57, 1059.38],
  [36, 1.71, 2352.87],
  [36, 1.78, 6812.77],
  [33, 0.59, 17789.85],
  [30, 0.44, 83996.85],
  [30, 2.74, 1349.87],
  [25, 3.16, 4690.48],
];

const EARTH_L1 = [
  [628331966747, 0, 0],
  [206059, 2.678235, 6283.07585],
  [4303, 2.6351, 12566.1517],
  [425, 1.59, 3.523],
  [119, 5.796, 26.298],
  [109, 2.966, 1577.344],
  [93, 2.59, 18849.23],
  [72, 1.14, 529.69],
  [68, 1.87, 398.15],
  [67, 4.41, 5507.55],
  [59, 2.89, 5223.69],
  [56, 2.17, 155.42],
  [45, 0.4, 796.3],
  [36, 0.47, 775.52],
  [29, 2.65, 7.11],
  [21, 5.34, 0.98],
  [19, 1.85, 5486.78],
  [19, 4.97, 213.3],
  [17, 2.99, 6275.96],
  [16, 0.03, 2544.31],
  [16, 1.43, 2146.17],
  [15, 1.21, 10977.08],
  [12, 2.83, 1748.02],
  [12, 3.26, 5088.63],
  [12, 5.27, 1194.45],
  [12, 2.08, 4694.0],
  [11, 0.77, 553.57],
  [10, 1.3, 6286.6],
  [10, 4.24, 1349.87],
  [9, 2.7, 242.73],
  [9, 5.64, 951.72],
  [8, 5.3, 2352.87],
  [6, 2.65, 9437.76],
  [6, 4.67, 4690.48],
];

const EARTH_L2 = [
  [52919, 0, 0],
  [8720, 1.0721, 6283.0758],
  [309, 0.867, 12566.152],
  [27, 0.05, 3.52],
  [16, 5.19, 26.3],
  [16, 3.68, 155.42],
  [10, 0.76, 18849.23],
  [9, 2.06, 77713.77],
  [7, 0.83, 775.52],
  [5, 4.66, 1577.34],
  [4, 1.03, 7.11],
  [4, 3.44, 5573.14],
  [3, 5.14, 796.3],
  [3, 6.05, 5507.55],
  [3, 1.19, 242.73],
  [3, 6.12, 529.69],
  [3, 0.31, 398.15],
  [3, 2.28, 553.57],
  [2, 4.38, 5223.69],
  [2, 3.75, 0.98],
];

const EARTH_L3 = [
  [289, 5.844, 6283.076],
  [35, 0, 0],
  [17, 5.49, 12566.15],
  [3, 5.2, 155.42],
  [1, 4.72, 3.52],
  [1, 5.3, 18849.23],
  [1, 5.97, 242.73],
];

const EARTH_L4 = [[114, 3.142, 0], [8, 4.13, 6283.08], [1, 3.84, 12566.15]];
const EARTH_L5 = [[1, 3.14, 0]];

function sumSeries(series, tau) {
  let sum = 0;
  for (let i = 0; i < series.length; i += 1) {
    const [a, b, c] = series[i];
    sum += a * Math.cos(b + c * tau);
  }
  return sum;
}

/** 地球日心黄经（弧度，0..2π），入参为 TT 儒略日 */
function earthHeliocentricLongitude(jdTT) {
  const tau = (jdTT - 2451545.0) / 365250.0;
  const l =
    sumSeries(EARTH_L0, tau) +
    sumSeries(EARTH_L1, tau) * tau +
    sumSeries(EARTH_L2, tau) * tau * tau +
    sumSeries(EARTH_L3, tau) * tau * tau * tau +
    sumSeries(EARTH_L4, tau) * tau ** 4 +
    sumSeries(EARTH_L5, tau) * tau ** 5;
  const lon = l / 1e8; // 弧度
  return ((lon % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}

/** 平黄赤交角（弧度） */
function meanObliquity(jdTT) {
  const t = (jdTT - 2451545.0) / 36525.0;
  const arcsec = 84381.448 + (21.448 - 46.815 * t - 0.00059 * t * t + 0.001813 * t * t * t);
  return (arcsec / 3600) * DEG; // 角秒 → 度 → 弧度
}

/** 黄经章动 Δψ（弧度，低精度，Meeus 简化式，误差 < 0.5″ → 可忽略） */
function nutationInLongitude(jdTT) {
  const t = (jdTT - 2451545.0) / 36525.0;
  const omega = (125.04452 - 1934.136261 * t) * DEG;
  const lSun = (280.4665 + 36000.7698 * t) * DEG;
  const lMoon = (218.3165 + 481267.8813 * t) * DEG;
  const dpsi =
    -17.2 * Math.sin(omega) -
    1.32 * Math.sin(2 * lSun) -
    0.23 * Math.sin(2 * lMoon) +
    0.21 * Math.sin(2 * omega);
  return dpsi / 3600 * DEG; // arcsec → deg → rad
}

/**
 * 太阳视黄经（度，0..360）。与 solarGeometry 共用同一套彗差/章动改正。
 * @param {number} jdUT  UT 儒略日
 */
function sunApparentLongitude(jdUT) {
  return solarGeometry(jdUT).lambdaDeg;
}

/* 地球日心距离 R（AU），L 的同源系列，用于光行差改正 */
const EARTH_R0 = [
  [100013989, 0, 0],
  [1670700, 3.0984635, 6283.07585],
  [13956, 3.05525, 12566.1517],
  [3084, 5.1985, 77713.7715],
  [1628, 1.1739, 5753.3849],
  [1576, 2.8469, 7860.4194],
  [925, 5.453, 11506.77],
  [542, 4.564, 3930.21],
  [472, 3.661, 5884.927],
  [346, 0.964, 5507.553],
  [329, 5.9, 5223.694],
  [307, 0.299, 5573.143],
  [243, 4.273, 11790.629],
  [212, 5.847, 1577.344],
  [186, 5.022, 10977.079],
  [175, 3.012, 18849.228],
  [110, 5.055, 5486.778],
  [98, 0.89, 6069.78],
  [86, 5.69, 15720.84],
  [86, 1.27, 161000.69],
  [65, 0.27, 17260.15],
  [63, 0.92, 529.69],
  [57, 2.01, 83996.85],
  [56, 5.24, 71430.7],
  [49, 3.25, 2544.31],
  [47, 2.58, 775.52],
  [45, 5.54, 9437.76],
  [43, 6.01, 6275.96],
  [39, 5.36, 4694.0],
  [38, 2.39, 8827.39],
  [37, 0.83, 19651.05],
  [37, 4.9, 12139.55],
  [36, 1.67, 12036.46],
  [35, 1.84, 2942.46],
  [33, 0.24, 7084.9],
  [32, 0.18, 5088.63],
  [32, 1.78, 398.15],
  [28, 1.21, 6286.6],
  [28, 1.9, 6279.55],
  [26, 4.59, 10447.39],
];

const EARTH_R1 = [
  [103019, 1.10749, 6283.07585],
  [1721, 1.0644, 12566.1517],
  [702, 3.142, 0],
  [32, 1.02, 18849.23],
  [31, 2.84, 5507.55],
  [25, 1.32, 5223.69],
  [18, 1.42, 1577.34],
  [10, 5.91, 10977.08],
  [9, 1.42, 6275.96],
  [9, 0.27, 5486.78],
];

const EARTH_R2 = [
  [4359, 5.7846, 6283.0758],
  [124, 5.579, 12566.152],
  [12, 3.14, 0],
  [9, 3.63, 77713.77],
  [6, 1.87, 5573.14],
  [3, 5.47, 18849.23],
];

/**
 * 太阳几何量统一计算（视黄经、视赤经、均时差）。
 * 所有日期均以 UT 儒略日传入，内部换算 TT。
 */
function solarGeometry(jdUT) {
  const jdTT = jdUT + deltaTSeconds((jdUT - 2451545) / 365.25 + 2000) / 86400;
  const t = (jdTT - 2451545.0) / 36525.0;
  const eps = meanObliquity(jdTT);
  const dpsi = nutationInLongitude(jdTT);
  const tau = (jdTT - 2451545.0) / 365250.0;
  const lEarth = earthHeliocentricLongitude(jdTT);
  const rSeries =
    sumSeries(EARTH_R0, tau) +
    sumSeries(EARTH_R1, tau) * tau +
    sumSeries(EARTH_R2, tau) * tau * tau;
  const radius = rSeries / 1e8;
  const aberration = ((20.4898 / 3600) / radius) * DEG; // 光行差（弧度）
  // 地心视黄经 = 日心黄经 + 180° − 光行差 + 章动
  const lambda = lEarth + Math.PI - aberration + dpsi;
  // 视赤经（弧度，归一到 0..2π）
  const alphaRaw = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const alpha = ((alphaRaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  // 太阳平黄经 L0（Meeus 28.2，单位：度/儒略世纪）
  const l0deg =
    280.4664567 +
    36000.76982779 * t +
    0.03032028 * t * t +
    (t * t * t) / 49931 -
    t ** 4 / 15300 -
    t ** 5 / 2000000;
  const l0 = ((((l0deg % 360) + 360) % 360) * DEG);
  let e = l0 - 0.0057183 * DEG - alpha + dpsi * Math.cos(eps);
  e = (((e + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return {
    lambdaDeg: ((((lambda / DEG) % 360) + 360) % 360),
    alphaRad: alpha,
    equationOfTimeMinutes: (e / DEG) * 4, // 1° = 4 分钟
    obliquityDeg: eps / DEG,
    nutationDeg: dpsi / DEG,
  };
}

/** 均时差（分钟）：视太阳时 − 平太阳时。正值表示日晷快于钟表。 */
function equationOfTimeMinutes(jdUT) {
  return solarGeometry(jdUT).equationOfTimeMinutes;
}

/* ------------------------------------------------------------------ *
 * 24 节气
 * ------------------------------------------------------------------ */

const SOLAR_TERMS = [
  '春分', '清明', '谷雨', '立夏', '小满', '芒种',
  '夏至', '小暑', '大暑', '立秋', '处暑', '白露',
  '秋分', '寒露', '霜降', '立冬', '小雪', '大雪',
  '冬至', '小寒', '大寒', '立春', '雨水', '惊蛰',
];

/** 十二「节」（奇门定局用），索引 0 = 立春 */
const JIE_ORDER = ['立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒'];

/** 节气序号：0=春分（视黄经 0°），每 15° 一个 */
function solarTermIndexAt(jdUT) {
  return sunApparentLongitude(jdUT) / 15;
}

/**
 * 求视黄经跨越 targetDeg（15 的整数倍）的精确 UT 儒略日。
 * 用割线法（外层）+ 括区保护，误差 < 1 秒。
 */
function solveSolarLongitudeCrossing(targetDeg, jdGuess) {
  const norm = (d) => ((d % 360) + 360) % 360;
  const f = (jd) => {
    let d = norm(sunApparentLongitude(jd) - targetDeg);
    if (d > 180) d -= 360;
    return d;
  };
  // 初值：太阳日均行约 0.9856°
  let jd0 = jdGuess;
  for (let i = 0; i < 8; i += 1) {
    const d = f(jd0);
    if (Math.abs(d) < 1e-7) break;
    jd0 -= d / 0.9856473;
  }
  // 牛顿式精修
  for (let i = 0; i < 6; i += 1) {
    const d = f(jd0);
    if (Math.abs(d) < 1e-9) break;
    const h = 0.01;
    const slope = (f(jd0 + h) - f(jd0 - h)) / (2 * h);
    jd0 -= d / slope;
  }
  return jd0;
}

/**
 * 给定 UT 儒略日，返回前一个与后一个节气：
 * { index, name, prevIndex, prevName, jdPrev, jdNext, deg }
 */
function solarTermAround(jdUT) {
  const lon = sunApparentLongitude(jdUT);
  const k = Math.floor(lon / 15); // 0..23
  const idx = ((k % 24) + 24) % 24;
  const jdPrev = solveSolarLongitudeCrossing(k * 15, jdUT - ((lon - k * 15) / 0.9856));
  const jdNext = solveSolarLongitudeCrossing(((k + 1) % 24) * 15, jdPrev + 15.2);
  return {
    index: idx,
    name: SOLAR_TERMS[idx],
    longitude: lon,
    jdPrev,
    jdNext,
    jdCurrent: jdUT,
  };
}

/** 某公历年内的 24 节气时刻表（UT 儒略日），从当年春分起算 */
function solarTermsOfYear(year) {
  const list = [];
  // 年初（1/1）太阳黄经约 280°，取当前节气序号，向前后各铺 24 个
  const jdStart = julianDayFromCivil(year, 1, 1);
  let k = Math.floor(sunApparentLongitude(jdStart) / 15);
  let anchorJd = jdStart;
  for (let n = 0; n < 26; n += 1) {
    const target = (((k + n) % 24) + 24) % 24;
    const guess = anchorJd + (n === 0 ? (target * 15 - sunApparentLongitude(anchorJd) + 360) % 360 / 0.9856 : 15.2);
    const jd = solveSolarLongitudeCrossing(target * 15, guess);
    list.push({ index: target, name: SOLAR_TERMS[target], jd });
    anchorJd = jd;
  }
  return list.sort((a, b) => a.jd - b.jd);
}

Object.assign(module.exports, {
  DEG,
  julianDayFromCivil,
  civilFromJulianDay,
  integerJulianDayNumber,
  deltaTSeconds,
  sunApparentLongitude,
  equationOfTimeMinutes,
  solarTermAround,
  solarTermsOfYear,
  solveSolarLongitudeCrossing,
  SOLAR_TERMS,
  JIE_ORDER,
  meanObliquity,
});

});

define('calendar', function (module, exports, require) {
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

Object.assign(module.exports, {
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
});

});

define('constants', function (module, exports, require) {
/**
 * constants.js — 九宫、九星、八门、八神、五行、地支宫位等静态数据与词条释义
 */

/** 九宫本体（洛书方位：上南下北、左东右西） */
const PALACES = [
  { index: 1, name: '坎一宫', trigram: '坎', direction: '正北', element: '水', number: 1, grid: { row: 2, col: 1 } },
  { index: 2, name: '坤二宫', trigram: '坤', direction: '西南', element: '土', number: 2, grid: { row: 0, col: 2 } },
  { index: 3, name: '震三宫', trigram: '震', direction: '正东', element: '木', number: 3, grid: { row: 1, col: 0 } },
  { index: 4, name: '巽四宫', trigram: '巽', direction: '东南', element: '木', number: 4, grid: { row: 0, col: 0 } },
  { index: 5, name: '中五宫', trigram: '中', direction: '中央', element: '土', number: 5, grid: { row: 1, col: 1 } },
  { index: 6, name: '乾六宫', trigram: '乾', direction: '西北', element: '金', number: 6, grid: { row: 2, col: 2 } },
  { index: 7, name: '兑七宫', trigram: '兑', direction: '正西', element: '金', number: 7, grid: { row: 1, col: 2 } },
  { index: 8, name: '艮八宫', trigram: '艮', direction: '东北', element: '土', number: 8, grid: { row: 2, col: 0 } },
  { index: 9, name: '离九宫', trigram: '离', direction: '正南', element: '火', number: 9, grid: { row: 0, col: 1 } },
];

const PALACE_BY_INDEX = Object.fromEntries(PALACES.map((p) => [p.index, p]));

/**
 * 九宫环序（自坎一宫起顺时针绕行，中五宫不在环上）
 * 坎1 → 艮8 → 震3 → 巽4 → 离9 → 坤2 → 兑7 → 乾6 → 回坎1
 */
const RING = [1, 8, 3, 4, 9, 2, 7, 6];
const RING_POS = Object.fromEntries(RING.map((p, i) => [p, i]));

/** 顺时针（环序 +1）/ 逆时针（-1）环形位移 */
function ringShift(palace, steps, dir) {
  const i = RING_POS[palace];
  if (i === undefined) throw new Error(`中五宫不在八宫环上：${palace}`);
  const n = RING.length;
  return RING[(((i + steps * dir) % n) + n) % n];
}

/** 顺时针环距 */
function ringDistance(from, to) {
  const a = RING_POS[from];
  const b = RING_POS[to];
  const n = RING.length;
  return ((b - a) % n + n) % n;
}

/** 九星（按环序）及其本位宫、五行、吉凶与释义 */
const STARS = {
  天蓬: { home: 1, element: '水', nature: '凶', meaning: '贪狼水星，主盗贼、水险、暗昧、智谋；利潜藏借势，忌张扬。', key: '蓬' },
  天任: { home: 8, element: '土', nature: '吉', meaning: '左辅土星，主稳重、田土、厚德、人丁；利守成置业。', key: '任' },
  天冲: { home: 3, element: '木', nature: '吉', meaning: '禄存木星，主行动、勇武、催动、奔走；利速成、争讼。', key: '冲' },
  天辅: { home: 4, element: '木', nature: '吉', meaning: '文曲木星，主文教、学业、谋略、合作；利科考、文书。', key: '辅' },
  天英: { home: 9, element: '火', nature: '凶', meaning: '右弼火星，主声名、文书、血光、急躁；利扬名，忌冲动。', key: '英' },
  天芮: { home: 2, element: '土', nature: '凶', meaning: '巨门土星，主疾病、阻碍、师事、旧疾；利求医问学，忌谋事。', key: '芮' },
  天柱: { home: 7, element: '金', nature: '凶', meaning: '破军金星，主口舌、破坏、损伤；利拆解破旧，忌合作。', key: '柱' },
  天心: { home: 6, element: '金', nature: '吉', meaning: '武曲金星，主谋略、医药、首领、决断；利求医、谋大事。', key: '心' },
  天禽: { home: 5, element: '土', nature: '吉', meaning: '廉贞土星，主中正、调节、尊贵；寄中五宫，随局不转。', key: '禽' },
};

/** 环上八星（不含中五宫天禽） */
const RING_STARS = ['天蓬', '天任', '天冲', '天辅', '天英', '天芮', '天柱', '天心'];

/** 八门及其本位宫、五行、吉凶与释义 */
const DOORS = {
  休: { name: '休门', home: 1, element: '水', nature: '吉', meaning: '主休养、求见、和合、婚姻；利静养、调停、拜访。', key: '休' },
  生: { name: '生门', home: 8, element: '土', nature: '吉', meaning: '主生机、财利、田宅、生意；利求财、开业、置业。', key: '生' },
  伤: { name: '伤门', home: 3, element: '木', nature: '凶', meaning: '主伤害、竞争、索债、捕猎；利竞技、讨债，忌合作。', key: '伤' },
  杜: { name: '杜门', home: 4, element: '木', nature: '中', meaning: '主闭塞、隐藏、技艺、防守；利保密、避祸、学艺。', key: '杜' },
  景: { name: '景门', home: 9, element: '火', nature: '中', meaning: '主文书、声名、宴乐、虚华；利宣传、考试、见贵。', key: '景' },
  死: { name: '死门', home: 2, element: '土', nature: '凶', meaning: '主死亡、滞塞、田地、吊丧；利田土、送终，忌求财谋事。', key: '死' },
  惊: { name: '惊门', home: 7, element: '金', nature: '凶', meaning: '主惊恐、口舌、官非、虚惊；利诉讼、鸣冤，忌远行。', key: '惊' },
  开: { name: '开门', home: 6, element: '金', nature: '吉', meaning: '主开通、官贵、开市、远行；利求官、开业、出行。', key: '开' },
};

/** 环上八门（按环序：坎1休、艮8生、震3伤、巽4杜、离9景、坤2死、兑7惊、乾6开） */
const RING_DOORS = ['休', '生', '伤', '杜', '景', '死', '惊', '开'];

/** 八神（顺序固定） */
const GODS = ['值符', '螣蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天'];

const GOD_MEANINGS = {
  值符: '诸神之首，主尊贵、权柄、主事之人；临宫得吉助，谋事有主。',
  螣蛇: '主虚惊、怪异、缠绕、变化；临宫多虚幻不实、心神不定。',
  太阴: '主阴私、暗中、庇护、贵人暗助；利密谋、藏匿。',
  六合: '主和合、婚姻、中介、交易；利谈判、合作、说合。',
  白虎: '主凶猛、伤病、道路、争执；利武断、催讨，忌平和之事。（阴遁作勾陈，主牵扯、田土、迟滞）',
  玄武: '主盗贼、暗昧、欺瞒、遗失；忌交易、签约、远行。（阴遁作朱雀，主口舌、文书、是非）',
  九地: '主厚重、稳固、田野、迟缓；利守成、屯聚、下盘。',
  九天: '主高远、动象、扬名、出行；利远行、上诉、张扬。',
};

/** 五行生克 */
const ELEMENT_OVERCOME = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

function overcomes(a, b) {
  return ELEMENT_OVERCOME[a] === b;
}

/** 地支 → 九宫（中五宫无地支） */
const BRANCH_PALACE = {
  子: 1,
  丑: 8,
  寅: 8,
  卯: 3,
  辰: 4,
  巳: 4,
  午: 9,
  未: 2,
  申: 2,
  酉: 7,
  戌: 6,
  亥: 6,
};

/** 地支三合 → 马星位（驿马） */
const HORSE_BY_BRANCH = {
  申: '寅', 子: '寅', 辰: '寅', // 申子辰 水局，马在寅（艮8）
  寅: '申', 午: '申', 戌: '申', // 寅午戌 火局，马在申（坤2）
  巳: '亥', 酉: '亥', 丑: '亥', // 巳酉丑 金局，马在亥（乾6）
  亥: '巳', 卯: '巳', 未: '巳', // 亥卯未 木局，马在巳（巽4）
};

/**
 * 十天干象义（用于天盘干 / 地盘干 / 暗干的释义）
 * 以奇门常用取象为主，供单宫详情引用。
 */
const STEM_MEANINGS = {
  甲: '甲为阳木、十干之首，主首领、栋梁、开端、贵人；奇门中甲隐于六仪，不单独显于盘面。',
  乙: '乙为阴木、日奇，主柔和、草木、文书、医药、婚姻；性柔而善屈伸。',
  丙: '丙为阳火、月奇，主光明、声名、文书、威权；性急而外露，亦主血光。',
  丁: '丁为阴火、星奇，主灯火、口舌、文章、心思、暗助；性静而明。',
  戊: '戊为阳土，主财货、田土、山岳、稳重；六仪之首，甲子所遁。',
  己: '己为阴土，主田园、暗昧、湿土、蓄藏；性柔而多隐，亦主疾病、牵连。',
  庚: '庚为阳金，主金属、阻隔、争斗、道路、兵革；性刚而好胜。',
  辛: '辛为阴金，主珠玉、小刀、口舌、刑伤、过失；性锐而多躁。',
  壬: '壬为阳水，主江河、奔波、流动、智慧、暗昧；性动而多变。',
  癸: '癸为阴水，主雨露、暗昧、玄秘、积蓄、阴私；性静而深沉。',
};

/** 三合局 */
const SAN_HE = {
  申子辰: '水局',
  寅午戌: '火局',
  巳酉丑: '金局',
  亥卯未: '木局',
};

/**
 * 六仪击刑表：天盘六仪 → 相刑之宫
 * 甲子戊→震3，甲戌己→坤2，甲申庚→艮8，甲午辛→离9，甲辰壬→巽4，甲寅癸→巽4
 */
const JI_XING = { 戊: 3, 己: 2, 庚: 8, 辛: 9, 壬: 4, 癸: 4 };

/**
 * 入墓表
 *  A 口诀派（默认）：乙丙戊乾、甲癸坤、丁己庚艮、辛壬巽
 *  B 五行墓库派：仅甲乙入坤、丙戊入乾、丁己入艮、庚辛入巽、壬癸入坎
 *  甲在盘面隐于戊（甲子戊），按「甲癸坤」归入坤二宫。
 */
const RU_MU = {
  A: { 甲: 2, 乙: 6, 丙: 6, 丁: 8, 戊: 6, 己: 8, 庚: 8, 辛: 4, 壬: 4, 癸: 2 },
  B: { 甲: 2, 乙: 2, 丙: 6, 丁: 8, 戊: 6, 己: 8, 庚: 4, 辛: 4, 壬: 1, 癸: 1 },
};

/** 内外盘（阳遁：8/3/4/1 内，9/2/7/6 外；阴遁反之；中五宫不属内外） */
const NEI_PALACES_YANG = [8, 3, 4, 1];

Object.assign(module.exports, {
  PALACES,
  PALACE_BY_INDEX,
  RING,
  RING_POS,
  ringShift,
  ringDistance,
  STARS,
  RING_STARS,
  DOORS,
  RING_DOORS,
  GODS,
  GOD_MEANINGS,
  ELEMENT_OVERCOME,
  overcomes,
  BRANCH_PALACE,
  HORSE_BY_BRANCH,
  SAN_HE,
  STEM_MEANINGS,
  JI_XING,
  RU_MU,
  NEI_PALACES_YANG,
});

});

define('ke_ying', function (module, exports, require) {
/**
 * ke_ying.js — 81 组十干克应（天盘干 + 地盘干）表
 *
 * 索引方式：KE_YING[天盘干][地盘干] = { name, meaning }
 * 顺序：甲乙丙丁戊己庚辛壬癸。
 *
 * 说明：
 *  - 天盘干为「客」，地盘干为「主」，表名读作「天盘干加地盘干」。
 *  - 同一干叠加（如戊+戊）为伏吟，主静、主迟、主旧事。
 *  - 术语统一用「入墓」。表中释义为通行口诀断语，供单宫详情引用，
 *    实际断卦仍须结合九星、八门、八神与旺衰，不作唯一结论。
 *  - 校验点（需求第九节第 6 条）：辛+癸 = 天牢华盖。
 */

const KE_YING_TABLE_VERSION = '81-gan-ke-ying-v1';

/** 甲：奇门盘面以「甲子戊」代甲，故甲行取甲为天盘之克应（甲加诸干） */
const JIA_ROW = {
  甲: { name: '伏吟', meaning: '甲加甲，同气伏吟。主静守、迟滞，旧事重提，宜守不宜进。' },
  乙: { name: '青龙合灵', meaning: '甲加乙，青龙合灵。主贵人相助、谋事可成，宜和合、求文书。' },
  丙: { name: '青龙返首', meaning: '甲加丙，青龙返首。大吉，主名利双收、谋事有成，宜进取。' },
  丁: { name: '青龙耀明', meaning: '甲加丁，青龙耀明。主光明显达、文书喜庆，宜求名、见贵。' },
  戊: { name: '青龙伏吟', meaning: '甲加戊，青龙伏吟。主守旧、积蓄，宜静守，动则无功。' },
  己: { name: '青龙入狱', meaning: '甲加己，青龙入狱。主受困、牵连，谋事阻滞，宜守待时。' },
  庚: { name: '青龙失势', meaning: '甲加庚，青龙失势。主受制、争斗，宜避锋、缓图。' },
  辛: { name: '青龙折足', meaning: '甲加辛，青龙折足。主挫伤、破财，宜防跌损、勿远行。' },
  壬: { name: '青龙入网', meaning: '甲加壬，青龙入网。主牵缠、水险，谋事宜守，忌涉水远行。' },
  癸: { name: '青龙华盖', meaning: '甲加癸，青龙华盖。主暗昧、庇护，宜隐忍，忌张扬。' },
};

const KE_YING = {
  甲: JIA_ROW,
  乙: {
    甲: { name: '利阴害阳', meaning: '乙加甲，利阴害阳。主暗中得利、明处受损，宜阴不宜阳。' },
    乙: { name: '日奇伏吟', meaning: '乙加乙，日奇伏吟。主柔顺守成、旧事缠绵，宜静守。' },
    丙: { name: '奇仪顺遂', meaning: '乙加丙，奇仪顺遂。主吉庆、贵人提携，谋事顺遂。' },
    丁: { name: '奇仪相佐', meaning: '乙加丁，奇仪相佐。主文书、合作、谋望可成，宜结伴。' },
    戊: { name: '利阴害阳', meaning: '乙加戊，利阴害阳。主得暗助、损明面，宜低调行事。' },
    己: { name: '日奇入墓', meaning: '乙加己，日奇入墓。主才华受抑、事多阻滞，宜守待。' },
    庚: { name: '日奇被刑', meaning: '乙加庚，日奇被刑。主受制、争斗、官非，宜避让。' },
    辛: { name: '青龙逃走', meaning: '乙加辛，青龙逃走。主破财、人离、事散，宜守不宜动。' },
    壬: { name: '日奇得使', meaning: '乙加壬，日奇得使。主得助力、谋事有成，宜求人办事。' },
    癸: { name: '华盖逢星', meaning: '乙加癸，华盖逢星。主暗昧、隐疾，宜静养、避是非。' },
  },
  丙: {
    甲: { name: '飞鸟跌穴', meaning: '丙加甲，飞鸟跌穴。大吉，主谋事速成、名利双收，宜进取。' },
    乙: { name: '日月并行', meaning: '丙加乙，日月并行。主光明、合作、喜庆，谋事顺遂。' },
    丙: { name: '月奇悖师', meaning: '丙加丙，月奇悖师。主急躁、虚惊、口舌，宜静不宜动。' },
    丁: { name: '月奇朱雀', meaning: '丙加丁，月奇朱雀。主文书、传信、口舌，宜言事宜谨慎。' },
    戊: { name: '飞鸟跌穴', meaning: '丙加戊，飞鸟跌穴。大吉，主名利速成，宜积极进取。' },
    己: { name: '火悖入墓', meaning: '丙加己，火悖入墓。主光明受掩、事多暗滞，宜守。' },
    庚: { name: '荧惑入白', meaning: '丙加庚，荧惑入白。主争斗、破财、血光，宜避锋。' },
    辛: { name: '丙辛相合', meaning: '丙加辛，丙辛相合。主合而化水，事多反复，宜守约。' },
    壬: { name: '火入天罗', meaning: '丙加壬，火入天罗。主官非、水险、牵连，宜谨言慎行。' },
    癸: { name: '月奇逢癸', meaning: '丙加癸，月奇逢癸。主暗昧、虚惊，宜静守、避是非。' },
  },
  丁: {
    甲: { name: '青龙耀明', meaning: '丁加甲，青龙耀明。主显达、喜庆、文书，宜求名见贵。' },
    乙: { name: '奇仪相合', meaning: '丁加乙，奇仪相合。主和合、婚喜、成事，宜结伴共谋。' },
    丙: { name: '星随月转', meaning: '丁加丙，星随月转。主得贵人提携、事有转机，宜顺势。' },
    丁: { name: '奇仪伏吟', meaning: '丁加丁，奇仪伏吟。主文书迟滞、旧事重提，宜静守。' },
    戊: { name: '青龙耀明', meaning: '丁加戊，青龙耀明。主光明得助、谋事有成，宜进取。' },
    己: { name: '火入勾陈', meaning: '丁加己，火入勾陈。主受困、迟滞、牵连，宜守待时。' },
    庚: { name: '亭亭之格', meaning: '丁加庚，亭亭之格。主阻隔、争斗，宜缓图、避正面冲突。' },
    辛: { name: '朱雀入狱', meaning: '丁加辛，朱雀入狱。主口舌、官非、受制，宜谨言。' },
    壬: { name: '丁壬相合', meaning: '丁加壬，丁壬相合。主和合、婚喜、暗中成事，宜密谋。' },
    癸: { name: '朱雀投江', meaning: '丁加癸，朱雀投江。主文书遗失、口舌消散，宜静守。' },
  },
  戊: {
    甲: { name: '青龙伏吟', meaning: '戊加甲，青龙伏吟。主守旧、积蓄，宜静守，动则无功。' },
    乙: { name: '青龙合灵', meaning: '戊加乙，青龙合灵。主贵人相助、谋事可成，宜和合。' },
    丙: { name: '青龙返首', meaning: '戊加丙，青龙返首。大吉，主名利双收，宜积极进取。' },
    丁: { name: '青龙耀明', meaning: '戊加丁，青龙耀明。主光明显达、文书喜庆，宜求名。' },
    戊: { name: '伏吟', meaning: '戊加戊，伏吟。主静守、迟滞、旧事，宜守不宜进。' },
    己: { name: '贵人入狱', meaning: '戊加己，贵人入狱。主受困、牵连、贵人不现，宜守。' },
    庚: { name: '值符飞宫', meaning: '戊加庚，值符飞宫。主变动、失位、争斗，宜顺势迁移。' },
    辛: { name: '青龙折足', meaning: '戊加辛，青龙折足。主挫伤、破财、跌损，宜防意外。' },
    壬: { name: '青龙入网', meaning: '戊加壬，青龙入网。主牵缠、水险，忌涉水远行。' },
    癸: { name: '青龙华盖', meaning: '戊加癸，青龙华盖。主暗昧、庇护，宜隐忍、忌张扬。' },
  },
  己: {
    甲: { name: '青龙入狱', meaning: '己加甲，青龙入狱。主受困、牵连，谋事阻滞，宜守待时。' },
    乙: { name: '墓神不明', meaning: '己加乙，墓神不明。主暗昧、隐疾、事不明朗，宜静守。' },
    丙: { name: '火悖地户', meaning: '己加丙，火悖地户。主口舌、虚惊、暗损，宜谨言。' },
    丁: { name: '朱雀入墓', meaning: '己加丁，朱雀入墓。主文书受阻、口舌自消，宜静守。' },
    戊: { name: '犬遇青龙', meaning: '己加戊，犬遇青龙。主贵人提携、事有转机，宜顺势。' },
    己: { name: '地户逢鬼', meaning: '己加己，地户逢鬼。主暗昧、疾病、牵连，宜守避。' },
    庚: { name: '刑格', meaning: '己加庚，刑格。主争斗、刑伤、官非，宜避锋、守法。' },
    辛: { name: '游魂入墓', meaning: '己加辛，游魂入墓。主心神不宁、事多反复，宜静养。' },
    壬: { name: '地网交加', meaning: '己加壬，地网交加。主牵缠、阻滞，宜守待解。' },
    癸: { name: '华盖地户', meaning: '己加癸，华盖地户。主暗昧、隐忍、闭藏，宜静守。' },
  },
  庚: {
    甲: { name: '太白入荧', meaning: '庚加甲，太白入荧。主争斗、破财、官非，宜避锋守正。' },
    乙: { name: '太白逢星', meaning: '庚加乙，太白逢星。主竞争、受制、合而不顺，宜缓图。' },
    丙: { name: '太白入荧', meaning: '庚加丙，太白入荧。主争斗、火灾、血光，宜避锋。' },
    丁: { name: '亭亭之格', meaning: '庚加丁，亭亭之格。主阻隔、争斗，宜缓图、避冲突。' },
    戊: { name: '太白入角', meaning: '庚加戊，太白入角。主竞争、夺利、失位，宜守。' },
    己: { name: '官符刑格', meaning: '庚加己，官符刑格。主官非、刑伤、口舌，宜守法慎言。' },
    庚: { name: '太白伏吟', meaning: '庚加庚，太白伏吟。主争斗、僵持、旧怨，宜静守。' },
    辛: { name: '太白同宫', meaning: '庚加辛，太白同宫。主竞争、刑伤、破财，宜避让。' },
    壬: { name: '太白入天罗', meaning: '庚加壬，太白入天罗。主官非、阻滞、水险，宜谨言。' },
    癸: { name: '太白入地网', meaning: '庚加癸，太白入地网。主牵缠、暗损、困滞，宜守。' },
  },
  辛: {
    甲: { name: '青龙折足', meaning: '辛加甲，青龙折足。主挫伤、破财、跌损，宜防意外。' },
    乙: { name: '白虎猖狂', meaning: '辛加乙，白虎猖狂。主凶伤、争斗、破财，宜避锋守静。' },
    丙: { name: '丙辛相合', meaning: '辛加丙，丙辛相合。主合而化水、事多反复，宜守约。' },
    丁: { name: '狱神得奇', meaning: '辛加丁，狱神得奇。主受制中得解、事有转机，宜守待。' },
    戊: { name: '困龙被伤', meaning: '辛加戊，困龙被伤。主受困、损耗、屈抑，宜守。' },
    己: { name: '入狱自刑', meaning: '辛加己，入狱自刑。主自招是非、受困，宜自省守法。' },
    庚: { name: '白虎出力', meaning: '辛加庚，白虎出力。主争斗、刑伤、破财，宜避锋。' },
    辛: { name: '伏吟天庭', meaning: '辛加辛，伏吟天庭。主迟滞、旧事、反复，宜静守。' },
    壬: { name: '凶蛇入狱', meaning: '辛加壬，凶蛇入狱。主暗害、牵连、受困，宜守避。' },
    癸: { name: '天牢华盖', meaning: '辛加癸，天牢华盖。日月失明，误入天网，动止乖张。' },
  },
  壬: {
    甲: { name: '青龙入网', meaning: '壬加甲，青龙入网。主牵缠、水险，宜守、忌涉水远行。' },
    乙: { name: '小蛇得势', meaning: '壬加乙，小蛇得势。主得助力、事有转机，宜顺势。' },
    丙: { name: '水蛇入火', meaning: '壬加丙，水蛇入火。主冲突、虚惊、官非，宜避锋。' },
    丁: { name: '干合蛇刑', meaning: '壬加丁，干合蛇刑。主合中有刑、事多反复，宜守约。' },
    戊: { name: '小蛇化龙', meaning: '壬加戊，小蛇化龙。主升迁、变化、得势，宜进取。' },
    己: { name: '凶蛇入狱', meaning: '壬加己，凶蛇入狱。主暗害、牵连、受困，宜守避。' },
    庚: { name: '太白擒蛇', meaning: '壬加庚，太白擒蛇。主受制、争讼，宜守正缓图。' },
    辛: { name: '螣蛇相缠', meaning: '壬加辛，螣蛇相缠。主虚惊、缠绕、反复，宜静守。' },
    壬: { name: '蛇入地罗', meaning: '壬加壬，蛇入地罗。主牵缠、困滞、暗昧，宜守待。' },
    癸: { name: '幼女奸淫', meaning: '壬加癸，幼女奸淫。主阴私、暗昧、是非，宜谨言守礼。' },
  },
  癸: {
    甲: { name: '青龙华盖', meaning: '癸加甲，青龙华盖。主暗昧、庇护，宜隐忍、忌张扬。' },
    乙: { name: '华盖逢星', meaning: '癸加乙，华盖逢星。主暗昧、隐疾、得暗助，宜静养。' },
    丙: { name: '华盖悖师', meaning: '癸加丙，华盖悖师。主虚惊、口舌、暗损，宜静守。' },
    丁: { name: '螣蛇夭矫', meaning: '癸加丁，螣蛇夭矫。主虚惊、怪异、心神不定，宜静养。' },
    戊: { name: '天乙会合', meaning: '癸加戊，天乙会合。主贵人暗助、事可谋，宜求人。' },
    己: { name: '华盖地户', meaning: '癸加己，华盖地户。主暗昧、闭藏、隐忍，宜静守。' },
    庚: { name: '太白入网', meaning: '癸加庚，太白入网。主牵缠、官非、困滞，宜守。' },
    辛: { name: '天牢华盖', meaning: '癸加辛，天牢华盖。日月失明，误入天网，动止乖张。' },
    壬: { name: '螣蛇相缠', meaning: '癸加壬，螣蛇相缠。主虚惊、缠绕、反复，宜静守。' },
    癸: { name: '天网四张', meaning: '癸加癸，天网四张。主牵缠、困滞、难脱，宜守待。' },
  },
};

/** 查询十干克应：天盘干 + 地盘干 */
function getKeYing(tianGan, diGan) {
  const row = KE_YING[tianGan];
  if (!row) throw new Error(`克应表无此天盘干：${tianGan}`);
  const entry = row[diGan];
  if (!entry) throw new Error(`克应表无此组合：${tianGan}+${diGan}`);
  return { tian_gan: tianGan, di_gan: diGan, ...entry };
}

/** 表完整性自检：9×9 必备，另含甲行/甲列（共 10×10） */
function assertKeYingComplete() {
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  let count = 0;
  for (const a of stems) {
    for (const b of stems) {
      const e = getKeYing(a, b);
      if (!e.name || !e.meaning) throw new Error(`克应条目缺失：${a}+${b}`);
      count += 1;
    }
  }
  // 需求要求 9×9 = 81 组（天盘九干 × 地盘九干）；本表另补甲行甲列，共 100 组。
  if (count < 81) throw new Error(`克应表应至少 81 组，实际 ${count}`);
  if (count !== 100) throw new Error(`克应表应为 10×10 = 100 组，实际 ${count}`);
  return count;
}

Object.assign(module.exports, { KE_YING, KE_YING_TABLE_VERSION, getKeYing, assertKeYingComplete });

});

define('solar_time', function (module, exports, require) {
/**
 * solar_time.js — 真太阳时校正
 *
 * 真太阳时 = 北京时间 + 经度时差 + 均时差
 *   经度时差 = (经度 − 120°) × 4 分钟   （东经为正）
 *   均时差   = 视太阳时 − 平太阳时（天文算法，按日期计算，见 astro.js）
 *
 * 输入/输出均为「北京时间」（UTC+8）的墙钟表示，内部用 UT 儒略日计算。
 */

const { equationOfTimeMinutes, julianDayFromCivil, civilFromJulianDay } = require('astro');

const BEIJING_MERIDIAN = 120;

/** 东八区墙钟 → UT 儒略日 */
function beijingWallClockToJD(year, month, day, hour, minute, second = 0) {
  const dayFraction = (hour * 3600 + minute * 60 + second) / 86400;
  return julianDayFromCivil(year, month, day, dayFraction) - 8 / 24;
}

/** UT 儒略日 → 东八区墙钟分量 */
function jdToBeijingWallClock(jd) {
  const c = civilFromJulianDay(jd + 8 / 24);
  const totalSeconds = Math.round(c.dayFraction * 86400);
  return {
    year: c.year,
    month: c.month,
    day: c.day,
    hour: Math.floor(totalSeconds / 3600) % 24,
    minute: Math.floor(totalSeconds / 60) % 60,
    second: totalSeconds % 60,
  };
}

/**
 * 计算真太阳时。
 * @param {{year:number,month:number,day:number,hour:number,minute:number,second?:number}} beijing 北京时间
 * @param {number} longitude 经度（东经正、西经负）
 * @returns {{jdUT:number, equationOfTimeMinutes:number, longitudeOffsetMinutes:number, totalOffsetMinutes:number, trueSolarJd:number, trueSolar:{year,month,day,hour,minute,second}, trueSolarISO:string}}
 */
function trueSolarTime(beijing, longitude) {
  const { year, month, day, hour, minute, second = 0 } = beijing;
  const jdUT = beijingWallClockToJD(year, month, day, hour, minute, second);
  const eot = equationOfTimeMinutes(jdUT);
  const longitudeOffset = (longitude - BEIJING_MERIDIAN) * 4; // 分钟
  const totalOffset = longitudeOffset + eot;
  const trueSolarJd = jdUT + totalOffset / 1440;
  const wc = jdToBeijingWallClock(trueSolarJd);
  const pad = (n) => String(n).padStart(2, '0');
  const iso = `${wc.year}-${pad(wc.month)}-${pad(wc.day)}T${pad(wc.hour)}:${pad(wc.minute)}:${pad(wc.second)}`;
  return {
    jdUT,
    equationOfTimeMinutes: eot,
    longitudeOffsetMinutes: longitudeOffset,
    totalOffsetMinutes: totalOffset,
    trueSolarJd,
    trueSolar: wc,
    trueSolarISO: iso,
    trueSolarWallClock: trueSolarJd + 8 / 24, // 东八区墙钟儒略日，便于取「日」
  };
}

/** 东八区墙钟 → ISO8601（带 +08:00 偏移） */
function beijingISO(year, month, day, hour, minute, second = 0) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}+08:00`;
}

Object.assign(module.exports, {
  BEIJING_MERIDIAN,
  beijingWallClockToJD,
  jdToBeijingWallClock,
  trueSolarTime,
  beijingISO,
});

});

define('cities', function (module, exports, require) {
/**
 * cities.js — 离线地区经纬度库（用于手动选择地点，避免依赖在线地图）
 * 数据为常用城市/地区中心点，精度到 0.01°（约 1 公里），足以支撑真太阳时校正。
 * 经度东经为正、西经为负；纬度北纬为正。
 */
const CITIES = [
  { name: '北京', province: '北京', lng: 116.4074, lat: 39.9042 },
  { name: '上海', province: '上海', lng: 121.4737, lat: 31.2304 },
  { name: '天津', province: '天津', lng: 117.2009, lat: 39.0842 },
  { name: '重庆', province: '重庆', lng: 106.5516, lat: 29.563 },
  { name: '广州', province: '广东', lng: 113.2644, lat: 23.1291 },
  { name: '深圳', province: '广东', lng: 114.0579, lat: 22.5431 },
  { name: '东莞', province: '广东', lng: 113.7518, lat: 23.0207 },
  { name: '佛山', province: '广东', lng: 113.1214, lat: 23.0218 },
  { name: '珠海', province: '广东', lng: 113.5767, lat: 22.2707 },
  { name: '汕头', province: '广东', lng: 116.6822, lat: 23.3535 },
  { name: '惠州', province: '广东', lng: 114.4126, lat: 23.0794 },
  { name: '湛江', province: '广东', lng: 110.3594, lat: 21.2707 },
  { name: '杭州', province: '浙江', lng: 120.1551, lat: 30.2741 },
  { name: '宁波', province: '浙江', lng: 121.544, lat: 29.8683 },
  { name: '温州', province: '浙江', lng: 120.6994, lat: 27.9944 },
  { name: '绍兴', province: '浙江', lng: 120.5802, lat: 30.0303 },
  { name: '金华', province: '浙江', lng: 119.6474, lat: 29.0792 },
  { name: '南京', province: '江苏', lng: 118.7969, lat: 32.0603 },
  { name: '苏州', province: '江苏', lng: 120.5853, lat: 31.2989 },
  { name: '无锡', province: '江苏', lng: 120.3119, lat: 31.4912 },
  { name: '常州', province: '江苏', lng: 119.9741, lat: 31.8112 },
  { name: '南通', province: '江苏', lng: 120.8943, lat: 31.9802 },
  { name: '徐州', province: '江苏', lng: 117.1848, lat: 34.2618 },
  { name: '扬州', province: '江苏', lng: 119.4211, lat: 32.3932 },
  { name: '武汉', province: '湖北', lng: 114.3055, lat: 30.5928 },
  { name: '宜昌', province: '湖北', lng: 111.2865, lat: 30.6919 },
  { name: '襄阳', province: '湖北', lng: 112.1441, lat: 32.0429 },
  { name: '长沙', province: '湖南', lng: 112.9388, lat: 28.2282 },
  { name: '株洲', province: '湖南', lng: 113.1341, lat: 27.8274 },
  { name: '衡阳', province: '湖南', lng: 112.5719, lat: 26.8938 },
  { name: '成都', province: '四川', lng: 104.0665, lat: 30.5723 },
  { name: '绵阳', province: '四川', lng: 104.6796, lat: 31.4675 },
  { name: '宜宾', province: '四川', lng: 104.6308, lat: 28.7602 },
  { name: '西安', province: '陕西', lng: 108.9398, lat: 34.3416 },
  { name: '宝鸡', province: '陕西', lng: 107.2373, lat: 34.3619 },
  { name: '咸阳', province: '陕西', lng: 108.7051, lat: 34.3336 },
  { name: '郑州', province: '河南', lng: 113.6254, lat: 34.7466 },
  { name: '洛阳', province: '河南', lng: 112.454, lat: 34.6211 },
  { name: '开封', province: '河南', lng: 114.3076, lat: 34.7973 },
  { name: '石家庄', province: '河北', lng: 114.5149, lat: 38.0428 },
  { name: '唐山', province: '河北', lng: 118.1802, lat: 39.6304 },
  { name: '保定', province: '河北', lng: 115.4646, lat: 38.8739 },
  { name: '秦皇岛', province: '河北', lng: 119.5996, lat: 39.9354 },
  { name: '太原', province: '山西', lng: 112.5489, lat: 37.8706 },
  { name: '大同', province: '山西', lng: 113.3001, lat: 40.0768 },
  { name: '济南', province: '山东', lng: 117.1201, lat: 36.6512 },
  { name: '青岛', province: '山东', lng: 120.3826, lat: 36.0671 },
  { name: '烟台', province: '山东', lng: 121.4479, lat: 37.4638 },
  { name: '潍坊', province: '山东', lng: 119.1618, lat: 36.7073 },
  { name: '临沂', province: '山东', lng: 118.3564, lat: 35.1047 },
  { name: '沈阳', province: '辽宁', lng: 123.4315, lat: 41.8057 },
  { name: '大连', province: '辽宁', lng: 121.6147, lat: 38.914 },
  { name: '鞍山', province: '辽宁', lng: 122.9946, lat: 41.1106 },
  { name: '长春', province: '吉林', lng: 125.3235, lat: 43.8171 },
  { name: '吉林', province: '吉林', lng: 126.5496, lat: 43.8378 },
  { name: '哈尔滨', province: '黑龙江', lng: 126.5349, lat: 45.8038 },
  { name: '齐齐哈尔', province: '黑龙江', lng: 123.9182, lat: 47.3543 },
  { name: '合肥', province: '安徽', lng: 117.2272, lat: 31.8206 },
  { name: '芜湖', province: '安徽', lng: 118.4329, lat: 31.3526 },
  { name: '蚌埠', province: '安徽', lng: 117.3893, lat: 32.9166 },
  { name: '福州', province: '福建', lng: 119.2965, lat: 26.0745 },
  { name: '厦门', province: '福建', lng: 118.0894, lat: 24.4798 },
  { name: '泉州', province: '福建', lng: 118.6757, lat: 24.8741 },
  { name: '南昌', province: '江西', lng: 115.8582, lat: 28.682 },
  { name: '九江', province: '江西', lng: 116.0019, lat: 29.7051 },
  { name: '赣州', province: '江西', lng: 114.935, lat: 25.8311 },
  { name: '南宁', province: '广西', lng: 108.3665, lat: 22.817 },
  { name: '桂林', province: '广西', lng: 110.2993, lat: 25.2736 },
  { name: '柳州', province: '广西', lng: 109.4281, lat: 24.3146 },
  { name: '海口', province: '海南', lng: 110.1983, lat: 20.044 },
  { name: '三亚', province: '海南', lng: 109.512, lat: 18.2528 },
  { name: '贵阳', province: '贵州', lng: 106.6302, lat: 26.647 },
  { name: '遵义', province: '贵州', lng: 106.9272, lat: 27.7256 },
  { name: '昆明', province: '云南', lng: 102.8329, lat: 24.8801 },
  { name: '大理', province: '云南', lng: 100.2676, lat: 25.6065 },
  { name: '丽江', province: '云南', lng: 100.233, lat: 26.8721 },
  { name: '拉萨', province: '西藏', lng: 91.1409, lat: 29.6456 },
  { name: '兰州', province: '甘肃', lng: 103.8343, lat: 36.0611 },
  { name: '天水', province: '甘肃', lng: 105.7249, lat: 34.5809 },
  { name: '西宁', province: '青海', lng: 101.7782, lat: 36.6171 },
  { name: '银川', province: '宁夏', lng: 106.2309, lat: 38.4872 },
  { name: '乌鲁木齐', province: '新疆', lng: 87.6168, lat: 43.8256 },
  { name: '喀什', province: '新疆', lng: 75.9898, lat: 39.4677 },
  { name: '伊宁', province: '新疆', lng: 81.3242, lat: 43.9169 },
  { name: '呼和浩特', province: '内蒙古', lng: 111.7492, lat: 40.8426 },
  { name: '包头', province: '内蒙古', lng: 109.8403, lat: 40.6574 },
  { name: '香港', province: '香港', lng: 114.1694, lat: 22.3193 },
  { name: '澳门', province: '澳门', lng: 113.5439, lat: 22.1987 },
  { name: '台北', province: '台湾', lng: 121.5654, lat: 25.033 },
  { name: '高雄', province: '台湾', lng: 120.3014, lat: 22.6273 },
  { name: '东京', province: '日本', lng: 139.6917, lat: 35.6895 },
  { name: '大阪', province: '日本', lng: 135.5023, lat: 34.6937 },
  { name: '首尔', province: '韩国', lng: 126.978, lat: 37.5665 },
  { name: '新加坡', province: '新加坡', lng: 103.8198, lat: 1.3521 },
  { name: '吉隆坡', province: '马来西亚', lng: 101.6869, lat: 3.139 },
  { name: '曼谷', province: '泰国', lng: 100.5018, lat: 13.7563 },
  { name: '纽约', province: '美国', lng: -74.006, lat: 40.7128 },
  { name: '洛杉矶', province: '美国', lng: -118.2437, lat: 34.0522 },
  { name: '旧金山', province: '美国', lng: -122.4194, lat: 37.7749 },
  { name: '芝加哥', province: '美国', lng: -87.6298, lat: 41.8781 },
  { name: '西雅图', province: '美国', lng: -122.3321, lat: 47.6062 },
  { name: '温哥华', province: '加拿大', lng: -123.1207, lat: 49.2827 },
  { name: '多伦多', province: '加拿大', lng: -79.3832, lat: 43.6532 },
  { name: '伦敦', province: '英国', lng: -0.1276, lat: 51.5072 },
  { name: '巴黎', province: '法国', lng: 2.3522, lat: 48.8566 },
  { name: '柏林', province: '德国', lng: 13.405, lat: 52.52 },
  { name: '罗马', province: '意大利', lng: 12.4964, lat: 41.9028 },
  { name: '莫斯科', province: '俄罗斯', lng: 37.6173, lat: 55.7558 },
  { name: '悉尼', province: '澳大利亚', lng: 151.2093, lat: -33.8688 },
  { name: '墨尔本', province: '澳大利亚', lng: 144.9631, lat: -37.8136 },
  { name: '奥克兰', province: '新西兰', lng: 174.7633, lat: -36.8485 },
  { name: '迪拜', province: '阿联酋', lng: 55.2708, lat: 25.2048 },
];

/** 按名称/省份模糊搜索 */
function searchCities(keyword) {
  const k = String(keyword || '').trim();
  if (!k) return CITIES;
  return CITIES.filter((c) => c.name.includes(k) || c.province.includes(k));
}

/** 默认地点：北京 */
const DEFAULT_CITY = CITIES[0];

Object.assign(module.exports, { CITIES, DEFAULT_CITY, searchCities });

});

define('qimen', function (module, exports, require) {
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

const {
  STEMS,
  BRANCHES,
  SEXAGENARY,
  dayGanzhiFromJDN,
  hourGanzhi,
  xunOfHour,
  determineJu,
} = require('calendar');
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
} = require('constants');
const { getKeYing, KE_YING_TABLE_VERSION } = require('ke_ying');
const { trueSolarTime, beijingISO } = require('solar_time');
const {
  solarTermAround,
  sunApparentLongitude,
  integerJulianDayNumber,
} = require('astro');

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

Object.assign(module.exports, {
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
});

});

define('ai_text', function (module, exports, require) {
/**
 * ai_text.js — 导出「AI 分析文本」（Markdown / TXT）
 *
 * 目的：把内存中的排盘 JSON 拼成一份对大模型友好、零门槛可读的 Markdown 文本，
 *      用户可直接粘贴给 ChatGPT / DeepSeek 等做断局分析。
 *
 * 约束：
 *  - 纯文本 + Markdown，**不包含任何 HTML 标签**；
 *  - 十干克应的名称与断语、四害状态必须完整保留（AI 推理的核心依据）；
 *  - 严格按《新增功能：导出 AI 分析文本》模板的四段结构输出。
 */

const { PALACES, BRANCH_PALACE } = require('constants');

/** 对冲宫（用于判断反吟） */
const OPPOSITE = { 1: 9, 9: 1, 2: 8, 8: 2, 3: 7, 7: 3, 4: 6, 6: 4 };

const RU_MU_LABEL = { A: '口诀派', B: '五行墓库派' };
const RU_MU_DETAIL = {
  A: '乙丙戊入乾、甲癸入坤、丁己庚入艮、辛壬入巽',
  B: '甲乙入坤、丙戊入乾、丁己入艮、庚辛入巽、壬癸入坎',
};

/** ISO8601（+08:00）→ "YYYY-MM-DD HH:mm[:ss]" */
function fmtDateTime(iso, withSeconds) {
  if (!iso || typeof iso !== 'string') return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return iso;
  const base = `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
  return withSeconds && m[6] ? `${base}:${m[6]}` : base;
}

/** 文件名里的时间：YYYY-MM-DD_HHmm */
function fmtFileTime(iso) {
  if (!iso || typeof iso !== 'string') return '0000-00-00_0000';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return '0000-00-00_0000';
  return `${m[1]}-${m[2]}-${m[3]}_${m[4]}${m[5]}`;
}

/** 预测事项取前 4 个字（去掉空白与标点），空则「未填写」 */
function topicShort(topic) {
  const raw = String(topic || '').replace(/[\s，。、；：！？,.;:!?（）()【】[\]「」"'‘’“”]/g, '');
  if (!raw) return '未填写';
  return Array.from(raw).slice(0, 4).join('');
}

/**
 * 生成导出文件名：qimen_AI分析_[时间]_[预测事项前四个字].txt
 * @param {object} chart 排盘 JSON
 * @param {string} [ext='txt']
 */
function aiAnalysisFileName(chart, ext = 'txt') {
  const m = (chart && chart.meta) || {};
  const time = fmtFileTime(m.true_solar_time || m.input_time);
  const topic = topicShort(m.prediction_topic);
  const safe = topic.replace(/[\\/:*?"<>|]/g, '');
  return `qimen_AI分析_${time}_${safe}.${ext}`;
}

/** 宫位状态标记（空亡 / 马星 / 击刑 / 入墓 / 门迫 / 刑+墓） */
function statusTags(p) {
  const tags = [];
  if (p.flags.kong_wang) tags.push('空亡');
  if (p.flags.ma_xing) tags.push('马星');
  if (p.flags.ji_xing.active) tags.push('击刑');
  if (p.flags.ru_mu.active) tags.push('入墓');
  if (p.flags.men_po.active) tags.push('门迫');
  if (p.flags.xing_jia_mu) tags.push('刑+墓');
  return tags;
}

/** 全局特殊格局：伏吟 / 反吟 */
function detectSpecialPatterns(chart) {
  const outer = chart.palaces.filter((p) => p.index !== 5);
  const fuYin = outer.every((p) => p.tian_pan_qi_yi && p.tian_pan_qi_yi === p.di_pan_qi_yi);
  const byIndex = new Map(chart.palaces.map((p) => [p.index, p]));
  const fanYin = outer.every((p) => {
    const opp = byIndex.get(OPPOSITE[p.index]);
    return opp && p.tian_pan_qi_yi && p.tian_pan_qi_yi === opp.di_pan_qi_yi;
  });
  const out = [];
  if (fuYin) out.push('伏吟（天盘奇仪与地盘奇仪全部同位，主静守、迟滞、旧事重提）');
  if (fanYin) out.push('反吟（天盘奇仪与对宫地盘奇仪全部相同，主动荡、反复、来回）');
  return out;
}

/** 双干：寄宫干在前、本宫干在后，并注明寄干来源 */
function ganLine(gan, extra, label) {
  if (!extra) return gan || '—';
  return `${extra} ${gan || '—'}（含${label} ${extra}）`;
}

/** 某宫的「九星」描述（芮禽合并 + 暗干） */
function starLine(p) {
  const isRui = p.star === '天芮';
  let name = p.star || '—';
  const parts = [];
  if (isRui) {
    name = '芮禽';
    parts.push('天芮、天禽同宫');
  }
  if (p.an_gan) parts.push(`暗干：${p.an_gan}`);
  return parts.length ? `${name}（${parts.join('；')}）` : name;
}

/**
 * 拼接 AI 分析文本
 * @param {object} chart buildChart 的返回值
 * @returns {string} Markdown 文本
 */
function buildAiAnalysisText(chart) {
  if (!chart || !chart.meta || !Array.isArray(chart.palaces)) {
    throw new Error('buildAiAnalysisText: 需要合法的排盘 JSON');
  }
  const m = chart.meta;
  const jiGan = (chart.palaces.find((x) => x.index === 5) || {}).di_pan_qi_yi || '—';
  const lines = [];

  /* ---------------- 一、基础排盘信息 ---------------- */
  lines.push('# 奇门遁甲排盘数据（时家转盘）', '');
  lines.push('## 一、 基础排盘信息');
  lines.push(`- **预测事项**：${m.prediction_topic ? m.prediction_topic : '未填写'}`);
  lines.push(`- **排盘时间**：${fmtDateTime(m.input_time)}（北京时间）`);
  lines.push(
    `- **真太阳时**：${fmtDateTime(m.true_solar_time, true)}（经度：${m.location ? m.location.lng : '—'}，纬度：${
      m.location ? m.location.lat : '—'
    }，地点：${m.location && m.location.name ? m.location.name : '未提供'}）`
  );
  lines.push(
    `- **四柱干支**：${m.si_zhu.year} ${m.si_zhu.month} ${m.si_zhu.day} ${m.si_zhu.hour}`
  );
  const jieqi = m.jie && m.jie !== m.jieqi ? `${m.jieqi} · ${m.yuan}（属${m.jie}节）` : `${m.jieqi} · ${m.yuan}`;
  lines.push(`- **节气三元**：${jieqi}`);
  lines.push(`- **排盘局数**：${m.yinyang_dun === 'yang' ? '阳遁' : '阴遁'} ${m.ju_number} 局`);
  lines.push(
    `- **值符/值使**：${m.zhi_fu.star}（值符仪 ${m.zhi_fu.yi}，落${palaceName(m.zhi_fu.palace)}） / ${m.zhi_shi.door}（落${palaceName(
      m.zhi_shi.palace
    )}）`
  );
  lines.push(`- **旬首空亡**：旬首 ${m.xun_head}${m.xun_yi}，空亡 ${(m.void_branches || []).join('')}`);
  lines.push(`- **马星**：${m.ma_xing_branch}（落${palaceName(branchPalace(m.ma_xing_branch))}）`);
  lines.push('');

  /* ---------------- 二、九宫盘面详解 ---------------- */
  lines.push('## 二、 九宫盘面详解');
  lines.push('*（注：以下按洛书九宫顺序，从 1 宫至 9 宫逐一列出）*');
  lines.push('');

  for (const p of chart.palaces.slice().sort((a, b) => a.index - b.index)) {
    const pm = PALACES.find((x) => x.index === p.index) || {};
    const neiWai = p.index === 5 ? '寄宫' : p.nei_wai === 'nei' ? '内盘' : '外盘';
    lines.push(`### ${p.index}. ${p.name} (${p.direction}, ${p.element}, ${neiWai})`);

    if (p.index === 5) {
      lines.push(`- **八神**：无（中五宫不列八神）`);
      lines.push(
        `- **九星**：无（中五宫不单列九星，天禽寄坤二宫、随天芮同行）${p.an_gan ? `；暗干：${p.an_gan}` : ''}`
      );
      lines.push(`- **八门**：无（中五宫无门）`);
      lines.push(`- **天盘奇仪**：${ganLine(p.tian_pan_qi_yi, p.tian_pan_qi_yi_extra, '天禽寄宫干')}`);
      lines.push(`- **地盘奇仪**：${ganLine(p.di_pan_qi_yi, p.di_pan_qi_yi_extra, '中五寄宫干')}`);
      const ky = p.ke_ying || {};
      lines.push(
        `- **十干克应**：${ky.name && ky.name !== '—' ? `${ky.tian_gan}+${ky.di_gan} - ${ky.name}（${ky.meaning}）` : '中五宫不列十干克应'}`
      );
      lines.push(
        `- **寄宫说明**：天禽星寄坤二宫、随天芮同行；中五宫不列八门、八神与九星，天盘奇仪取本宫地盘奇仪。` +
          `中宫之干 ${jiGan} 寄至坤二宫地盘与芮禽宫天盘，两处按「寄宫干在前、本宫干在后」显示双干。`
      );
    } else {
      lines.push(`- **八神**：${p.god || '—'}`);
      lines.push(`- **九星**：${starLine(p)}`);
      lines.push(`- **八门**：${p.door || '—'}`);
      lines.push(`- **天盘奇仪**：${ganLine(p.tian_pan_qi_yi, p.tian_pan_qi_yi_extra, '天禽寄宫干')}`);
      lines.push(`- **地盘奇仪**：${ganLine(p.di_pan_qi_yi, p.di_pan_qi_yi_extra, '中五寄宫干')}`);
      const ky = p.ke_ying || {};
      const kyText =
        ky.name && ky.name !== '—'
          ? `${ky.tian_gan}+${ky.di_gan} - ${ky.name}（${ky.meaning}）`
          : '本宫无十干克应';
      lines.push(`- **十干克应**：${kyText}`);
    }

    const tags = statusTags(p);
    lines.push(`- **状态标记**：${tags.length ? tags.join('、') : '无'}`);
    lines.push('');
  }

  /* ---------------- 三、图例与全局提示 ---------------- */
  const nei = m.yinyang_dun === 'yang' ? [8, 3, 4, 1] : [9, 2, 7, 6];
  const wai = m.yinyang_dun === 'yang' ? [9, 2, 7, 6] : [8, 3, 4, 1];
  lines.push('## 三、 图例与全局提示');
  lines.push(
    `- **内/外盘划分**：当前为${m.yinyang_dun === 'yang' ? '阳遁' : '阴遁'}，内盘为 ${nei.join('、')} 宫，外盘为 ${wai.join('、')} 宫（中五宫不属内外盘）。`
  );
  lines.push('- **四害说明**：');
  lines.push('  - 击刑：天盘六仪落入相刑之宫。');
  lines.push(
    `  - 入墓：天盘奇仪落入墓库（当前口径：${RU_MU_LABEL[m.ru_mu_kou_jing] || '口诀派'} — ${
      RU_MU_DETAIL[m.ru_mu_kou_jing] || RU_MU_DETAIL.A
    }）。`
  );
  lines.push('  - 门迫：八门五行克落宫五行。');
  lines.push('  - 空亡：时旬空亡之地支所映射之宫。');
  lines.push('  - 马星：时支三合驿马位，主变动、出行。');
  const special = detectSpecialPatterns(chart);
  if (special.length) lines.push(`- **特殊格局**：${special.join('；')}`);
  lines.push('');

  /* ---------------- 四、AI 分析提示语 ---------------- */
  lines.push('## 四、 AI 分析提示语');
  lines.push('请你作为精通奇门遁甲的专家，基于上述排盘数据及“预测事项”，进行详细的断局分析。');
  lines.push('要求：');
  lines.push('1. 明确提取并分析**用神**（根据事项取对应的星、门、神、干）。');
  lines.push('2. 结合用神所在宫位的旺衰、吉凶格局（十干克应）、四害状态进行生克分析。');
  lines.push('3. 给出明确、有逻辑的结论与建议，不要模棱两可。');
  lines.push('');

  return lines.join('\n');
}

/* ---------------- 内部小工具 ---------------- */

function branchPalace(branch) {
  return BRANCH_PALACE[branch] || 5;
}

function palaceName(index) {
  const p = PALACES.find((x) => x.index === index);
  return p ? p.name : `第 ${index} 宫`;
}

Object.assign(module.exports, {
  buildAiAnalysisText,
  aiAnalysisFileName,
  topicShort,
  fmtDateTime,
  fmtFileTime,
  detectSpecialPatterns,
  RU_MU_LABEL,
  RU_MU_DETAIL,
});

});


  var api = {};
  ['astro', 'calendar', 'constants', 'ke_ying', 'solar_time', 'cities', 'qimen'].forEach(function (id) {
    api[id] = require(id);
  });
  // 扁平化导出，便于页面直接使用
  api.buildChart = require('qimen').buildChart;
  api.buildChartFromGivens = require('qimen').buildChartFromGivens;
  api.buildDiPan = require('qimen').buildDiPan;
  api.buildAnGan = require('qimen').buildAnGan;
  api.AN_GAN_ORDER = require('qimen').AN_GAN_ORDER;
  api.AN_GAN_RULE = require('qimen').AN_GAN_RULE;
  api.getKeYing = require('ke_ying').getKeYing;
  api.KE_YING_TABLE_VERSION = require('ke_ying').KE_YING_TABLE_VERSION;
  api.buildAiAnalysisText = require('ai_text').buildAiAnalysisText;
  api.aiAnalysisFileName = require('ai_text').aiAnalysisFileName;
  api.topicShort = require('ai_text').topicShort;
  api.CITIES = require('cities').CITIES;
  api.DEFAULT_CITY = require('cities').DEFAULT_CITY;
  api.searchCities = require('cities').searchCities;
  api.trueSolarTime = require('solar_time').trueSolarTime;
  api.beijingISO = require('solar_time').beijingISO;
  api.sunApparentLongitude = require('astro').sunApparentLongitude;
  api.solarTermAround = require('astro').solarTermAround;
  api.solarTermsOfYear = require('astro').solarTermsOfYear;
  api.equationOfTimeMinutes = require('astro').equationOfTimeMinutes;
  global.QimenEngine = api;
})(typeof window !== 'undefined' ? window : this);
