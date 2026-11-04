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

'use strict';

const { PALACES, BRANCH_PALACE } = require('./constants');

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
      lines.push(`- **九星**：${starLine(p)}`);
      lines.push(`- **八门**：无（中五宫无门）`);
      lines.push(`- **天盘奇仪**：${p.tian_pan_qi_yi || '—'}`);
      lines.push(`- **地盘奇仪**：${p.di_pan_qi_yi || '—'}`);
      const ky = p.ke_ying || {};
      lines.push(
        `- **十干克应**：${ky.name && ky.name !== '—' ? `${ky.tian_gan}+${ky.di_gan} - ${ky.name}（${ky.meaning}）` : '中五宫不列十干克应'}`
      );
      lines.push(
        `- **寄宫说明**：天禽星寄坤二宫、随局不转；中五宫不列八门与八神，天盘奇仪取本宫地盘奇仪。`
      );
    } else {
      lines.push(`- **八神**：${p.god || '—'}`);
      lines.push(`- **九星**：${starLine(p)}`);
      lines.push(`- **八门**：${p.door || '—'}`);
      lines.push(`- **天盘奇仪**：${p.tian_pan_qi_yi || '—'}`);
      lines.push(`- **地盘奇仪**：${p.di_pan_qi_yi || '—'}`);
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

module.exports = {
  buildAiAnalysisText,
  aiAnalysisFileName,
  topicShort,
  fmtDateTime,
  fmtFileTime,
  detectSpecialPatterns,
  RU_MU_LABEL,
  RU_MU_DETAIL,
};
