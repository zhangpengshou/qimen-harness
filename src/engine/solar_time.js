/**
 * solar_time.js — 真太阳时校正
 *
 * 真太阳时 = 北京时间 + 经度时差 + 均时差
 *   经度时差 = (经度 − 120°) × 4 分钟   （东经为正）
 *   均时差   = 视太阳时 − 平太阳时（天文算法，按日期计算，见 astro.js）
 *
 * 输入/输出均为「北京时间」（UTC+8）的墙钟表示，内部用 UT 儒略日计算。
 */

'use strict';

const { equationOfTimeMinutes, julianDayFromCivil, civilFromJulianDay } = require('./astro');

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

module.exports = {
  BEIJING_MERIDIAN,
  beijingWallClockToJD,
  jdToBeijingWallClock,
  trueSolarTime,
  beijingISO,
};
