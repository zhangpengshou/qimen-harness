/**
 * constants.js — 九宫、九星、八门、八神、五行、地支宫位等静态数据与词条释义
 */

'use strict';

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

module.exports = {
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
};
