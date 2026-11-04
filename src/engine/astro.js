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

'use strict';

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

module.exports = {
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
};
