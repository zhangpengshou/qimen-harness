const { buildChart } = require('../src/engine/qimen');
const beijing = { name: '北京', lng: 116.4074, lat: 39.9042 };
const problems = [];
let count = 0;
const cache = new Map();

function check(label, opts) {
  count += 1;
  try {
    const c = buildChart(opts);
    const m = c.meta;
    if (!m.ju_label || !Number.isInteger(m.ju_number)) throw new Error('局数缺失');
    if (c.palaces.length !== 9) throw new Error('宫数异常');
    for (const p of c.palaces) {
      if (!p.star) throw new Error(`宫${p.index} 缺星`);
      if (p.index !== 5 && !p.door) throw new Error(`宫${p.index} 缺门`);
      if (p.index !== 5 && !p.god) throw new Error(`宫${p.index} 缺神`);
      if (!p.ke_ying || !p.ke_ying.name) throw new Error(`宫${p.index} 缺克应`);
      if (p.flags.xing_jia_mu !== (p.flags.ji_xing.active && p.flags.ru_mu.active)) {
        throw new Error(`宫${p.index} 刑+墓不一致`);
      }
    }
    // 值符星应落在「时干（或旬首仪）之地盘宫」（中五宫寄坤二宫）
    const zf = m.zhi_fu;
    const hourStem = m.si_zhu.hour[0];
    const stemOnDiPan = hourStem === '甲' ? m.xun_yi : hourStem;
    let hourPalace = c.palaces.find((p) => p.di_pan_qi_yi === stemOnDiPan);
    if (!hourPalace) throw new Error(`找不到时干 ${stemOnDiPan} 的地盘宫`);
    let hp = hourPalace.index;
    if (hp === 5) hp = 2;
    const zp = c.palaces.find((p) => p.index === hp);
    if (zp.star !== zf.star) throw new Error(`值符星 ${zf.star} 应随时干落宫${hp}，实际 ${zp.star}`);
    // 值使门确实落在 zhi_shi.palace
    const sp = c.palaces.find((p) => p.index === m.zhi_shi.palace);
    if (sp.door !== m.zhi_shi.door) throw new Error(`值使门 ${m.zhi_shi.door} 未落在宫${m.zhi_shi.palace}（实际 ${sp.door}）`);
    // 同一输入两次结果一致
    const key = JSON.stringify(opts);
    if (cache.has(key)) {
      const prev = cache.get(key);
      if (JSON.stringify(prev.palaces) !== JSON.stringify(c.palaces)) throw new Error('重复计算不一致');
    } else cache.set(key, c);
  } catch (err) {
    problems.push(`${label}: ${err.message}`);
  }
}

// 遍历 2024-2026 每月 1/8/15/22 日的 0/6/12/18/23 时
for (let y = 2024; y <= 2026; y += 1) {
  for (let mo = 1; mo <= 12; mo += 1) {
    for (const d of [1, 8, 15, 22, 28]) {
      for (const h of [0, 6, 12, 18, 23]) {
        check(`${y}-${mo}-${d} ${h}`, {
          datetime: { year: y, month: mo, day: d, hour: h, minute: 30 },
          location: beijing,
        });
      }
    }
  }
}
// 边界：子时前后、经度极端
for (const h of [0, 1, 22, 23]) {
  for (const [name, loc] of [
    ['乌鲁木齐', { name: '乌鲁木齐', lng: 87.6168, lat: 43.8256 }],
    ['纽约', { name: '纽约', lng: -74.006, lat: 40.7128 }],
    ['东经180', { name: '', lng: 180, lat: 0 }],
    ['西经180', { name: '', lng: -180, lat: 0 }],
  ]) {
    check(`${name} ${h}时`, { datetime: { year: 2025, month: 6, day: 15, hour: h, minute: 0 }, location: loc });
  }
}
// 两种口径
for (const k of ['A', 'B']) {
  check(`口径${k}`, { datetime: { year: 2026, month: 11, day: 4, hour: 14, minute: 30 }, location: beijing, ruMuKouJing: k });
}

console.log(`共检查 ${count} 组，问题 ${problems.length} 条`);
if (problems.length) {
  console.log(problems.slice(0, 30).join('\n'));
  process.exitCode = 1;
} else {
  console.log('全部通过：所有组合均能排出结构完整、内部自洽的盘面');
}
