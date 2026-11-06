/**
 * app.js — 奇门遁甲排盘插件 · 前端主程序
 *
 * 数据来源：window.QimenEngine（由 src/engine/*.js 打包生成）
 * 结构：
 *   - 输入（时间 / 地点 / 口径）→ buildChart → 盘面 JSON
 *   - 九宫格四层叠加渲染（神 / 天 / 人 / 地）
 *   - 图层聚焦、3D 叠加、拖动旋转、单宫详情、图例、JSON 存盘与重载
 */
'use strict';

(function () {
  const E = window.QimenEngine;
  if (!E) {
    document.body.innerHTML = '<p style="padding:2rem;color:#f88">未加载 qimen.engine.js，请先执行 npm run build。</p>';
    return;
  }

  const { PALACES } = E.constants;
  const { STARS, DOORS, GOD_MEANINGS, STEM_MEANINGS } = E.constants;
  const { KE_YING_TABLE_VERSION } = E;

  /* ------------------------------------------------------------------ *
   * 全局状态
   * ------------------------------------------------------------------ */
  const state = {
    chart: null,
    selected: null, // 选中的宫位序号
    focusLayer: 'all', // all | shen | tian | men | di
    mode3d: false,
    showChangSheng: true, // 是否显示天盘干的十二长生标记
    // 默认 0°：真正的俯视可读态，且 3D 透视不会让宫位命中区域偏移
    rotX: 0,
    rotY: 0,
    dragging: false,
    pointerActive: false, // 指针是否按下（用于拖动判定）
    dragStartX: 0,
    dragStartY: 0,
    lastX: 0,
    lastY: 0,
    suppressClickUntil: 0, // 拖动结束后短时间内忽略 click，避免误选宫
    lastSelectTs: 0,
    loadedFromFile: false,
  };

  const $ = (id) => document.getElementById(id);

  const el = {
    app: $('app'),
    date: $('in-date'),
    time: $('in-time'),
    city: $('in-city'),
    lng: $('in-lng'),
    lat: $('in-lat'),
    rumu: $('in-rumu'),
    topic: $('in-topic'),
    board: $('board'),
    rotor: $('scene-rotor'),
    wrap: $('scene-wrap'),
    panelTitle: $('panel-title'),
    panelTag: $('panel-tag'),
    panelBody: $('panel-body'),
    juBar: $('ju-bar'),
    toast: $('toast'),
    modal: $('modal'),
    modalTitle: $('modal-title'),
    modalPre: $('modal-pre'),
    modalTag: $('modal-tag'),
    viewNote: $('view-note'),
  };

  /* ------------------------------------------------------------------ *
   * 工具
   * ------------------------------------------------------------------ */
  function toast(msg, isErr = false) {
    el.toast.textContent = msg;
    el.toast.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.toast.className = 'toast';
    }, 2600);
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  /** 双干显示：寄宫干在前、本宫干在后（如「戊 辛」「壬 丙」） */
  function ganWithJi(gan, extra) {
    return extra ? `${extra} ${gan || '—'}` : gan || '—';
  }

  /** 由「天盘干 + 地盘干」取克应 */
  function keYingOf(tian, di) {
    if (!tian || !di) return null;
    try {
      return E.getKeYing(tian, di);
    } catch (_) {
      return null;
    }
  }

  /** 宫位四层的中文名 */
  const LAYER_LABEL = { shen: '八神', tian: '九星 / 天盘奇仪', men: '八门', di: '地盘奇仪' };

  /* ------------------------------------------------------------------ *
   * 地点下拉
   * ------------------------------------------------------------------ */
  function initCities() {
    const frag = document.createDocumentFragment();
    const opt0 = document.createElement('option');
    opt0.value = '__custom__';
    opt0.textContent = '自定义经纬度';
    frag.appendChild(opt0);
    const groups = new Map();
    for (const c of E.CITIES) {
      if (!groups.has(c.province)) groups.set(c.province, []);
      groups.get(c.province).push(c);
    }
    for (const [prov, list] of groups) {
      const og = document.createElement('optgroup');
      og.label = prov;
      for (const c of list) {
        const o = document.createElement('option');
        o.value = c.name;
        o.textContent = c.name;
        o.dataset.lng = String(c.lng);
        o.dataset.lat = String(c.lat);
        og.appendChild(o);
      }
      frag.appendChild(og);
    }
    el.city.appendChild(frag);
    el.city.value = '北京';
  }

  function syncCityFromSelect() {
    const opt = el.city.selectedOptions[0];
    if (!opt || opt.value === '__custom__') return;
    if (opt.dataset.lng) {
      el.lng.value = Number(opt.dataset.lng).toFixed(4);
      el.lat.value = Number(opt.dataset.lat).toFixed(4);
    }
  }

  function cityNameForSave() {
    const opt = el.city.selectedOptions[0];
    if (opt && opt.value !== '__custom__') return opt.value;
    return `自选（${Number(el.lng.value).toFixed(2)}°, ${Number(el.lat.value).toFixed(2)}°）`;
  }

  /* ------------------------------------------------------------------ *
   * 排盘
   * ------------------------------------------------------------------ */
  function readInput() {
    const dateStr = el.date.value || '2026-11-04';
    const timeStr = el.time.value || '14:30';
    const [y, m, d] = dateStr.split('-').map(Number);
    const [hh, mm] = timeStr.split(':').map(Number);
    const lng = Number(el.lng.value);
    const lat = Number(el.lat.value);
    if (!y || !m || !d) throw new Error('日期格式不正确');
    if (Number.isNaN(hh) || Number.isNaN(mm)) throw new Error('时间格式不正确');
    if (Number.isNaN(lng) || lng < -180 || lng > 180) throw new Error('经度需在 -180 ~ 180 之间');
    if (Number.isNaN(lat) || lat < -90 || lat > 90) throw new Error('纬度需在 -90 ~ 90 之间');
    return {
      datetime: { year: y, month: m, day: d, hour: hh, minute: mm, second: 0 },
      location: { name: cityNameForSave(), lng, lat },
      ruMuKouJing: el.rumu.value,
      predictionTopic: el.topic ? el.topic.value.trim() : '',
    };
  }

  function paipan() {
    let opts;
    try {
      opts = readInput();
    } catch (err) {
      toast(err.message, true);
      return;
    }
    try {
      const chart = E.buildChart(opts);
      state.chart = chart;
      state.loadedFromFile = false;
      state.selected = null;
      renderAll();
      toast(`${chart.meta.ju_label} · ${chart.meta.si_zhu.hour}时 已起局`);
    } catch (err) {
      console.error(err);
      toast('起局失败：' + err.message, true);
    }
  }

  /* ------------------------------------------------------------------ *
   * 渲染：信息条
   * ------------------------------------------------------------------ */
  function renderMeta() {
    const m = state.chart.meta;
    $('pill-sizhu').textContent = `${m.si_zhu.year} ${m.si_zhu.month} ${m.si_zhu.day} ${m.si_zhu.hour}`;
    $('pill-ju').textContent = m.ju_label;
    $('pill-jieqi').textContent = `${m.jieqi}${m.jie && m.jie !== m.jieqi ? `（${m.jie}）` : ''}`;
    $('pill-yuan').textContent = `${m.yuan} · 符头${m.fu_tou}`;
    $('pill-zhifu').textContent = `${m.zhi_fu.star}（${m.zhi_fu.yi}）`;
    $('pill-zhishi').textContent = `${m.zhi_shi.door} → ${palaceName(m.zhi_shi.palace)}`;
    $('pill-kong').textContent = `${m.void_branches.join('')} · ${m.void_branches
      .map((b) => palaceName(E.constants.BRANCH_PALACE[b]))
      .filter((v, i, a) => a.indexOf(v) === i)
      .join('、')}`;
    $('pill-ma').textContent = `${m.ma_xing_branch} → ${palaceName(E.constants.BRANCH_PALACE[m.ma_xing_branch])}`;

    const corr = m.true_solar_correction || {};
    const sign = (v) => (v >= 0 ? '+' : '');
    $('meta-note').textContent =
      `真太阳时 ${m.true_solar_time.replace('+08:00', '')}（经度差 ${sign(corr.longitude_offset_minutes)}${corr.longitude_offset_minutes}′，均时差 ${sign(
        corr.equation_of_time_minutes
      )}${corr.equation_of_time_minutes}′）· 入墓口径 ${m.ru_mu_kou_jing}`;
  }

  function palaceName(index) {
    const p = PALACES.find((x) => x.index === index);
    return p ? p.trigram + p.name.slice(1) : `第${index}宫`;
  }

  /* ------------------------------------------------------------------ *
   * 渲染：九宫格
   * ------------------------------------------------------------------ */
  function renderBoard() {
    el.board.innerHTML = '';
    const chart = state.chart;
    const byIndex = new Map(chart.palaces.map((p) => [p.index, p]));

    // 按洛书方位排入 3×3 网格（上南下北、左东右西）
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const palace = PALACES.find((p) => p.grid.row === row && p.grid.col === col);
        const cell = document.createElement('div');
        cell.className = 'palace';
        cell.dataset.index = String(palace.index);
        cell.tabIndex = 0;
        cell.setAttribute('role', 'button');
        cell.setAttribute('aria-label', `${palace.name}，点击查看详情`);
        const data = byIndex.get(palace.index);
        applyPalaceClass(cell, data);
        cell.appendChild(buildPalace(data, palace));
        // 选中：click 为主；pointerup 兜底（触摸/浏览器差异下 click 可能不派发）
        cell.addEventListener('click', () => {
          // 拖动旋转结束时浏览器仍可能派发一次 click，此处忽略，避免「拖动即选中」
          if (Date.now() < state.suppressClickUntil) return;
          selectPalace(palace.index);
        });
        cell.addEventListener('pointerup', (ev) => {
          if (ev.button !== undefined && ev.button !== 0) return;
          if (state.dragging || Date.now() < state.suppressClickUntil) return;
          selectPalace(palace.index);
        });
        cell.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            selectPalace(palace.index);
          }
        });
        el.board.appendChild(cell);
      }
    }
    applyBoardClasses();
    highlightSelection();
  }

  function applyPalaceClass(cell, data) {
    cell.classList.toggle('nei', data.nei_wai === 'nei');
    cell.classList.toggle('wai', data.nei_wai === 'wai');
    cell.classList.toggle('zhong', data.nei_wai === 'zhong');
    if (state.selected === data.index) cell.classList.add('active');
  }

  /**
   * 宫位 DOM（左右两列网格化，参照专业排盘版式）
   *
   *  ┌──────────────────────────────┐
   *  │ 八神(左上)            空/马(右上) │
   *  │       暗干 芮禽   │   天盘奇仪   │
   *  │         死门      │   地盘奇仪   │
   *  │ 巽 4宫·东南                     │
   *  └──────────────────────────────┘
   * 左列：暗干 + 九星 / 八门（居中对齐）；右列：天盘奇仪 / 地盘奇仪（同一垂直线）
   * 九宫格内不显示十干克应文字（仅在单宫详情展示），避免信息过载。
   */
  function buildPalace(data, palaceMeta) {
    const frag = document.createDocumentFragment();

    const hit = document.createElement('div');
    hit.className = 'palace-hit';
    frag.appendChild(hit);

    // 左上角：八神（中五宫无神，留空）
    if (data.god) {
      const god = document.createElement('div');
      god.className = 'p-god';
      god.textContent = data.god;
      god.title = `八神 · ${data.god}：${GOD_MEANINGS[data.god] || ''}`;
      frag.appendChild(god);
    }

    // 右上角：空亡 / 马星
    const badges = document.createElement('div');
    badges.className = 'corner-badges';
    if (data.flags.kong_wang) badges.appendChild(makeBadge('空', 'badge-kong'));
    if (data.flags.ma_xing) badges.appendChild(makeBadge('马', 'badge-ma'));
    if (badges.childNodes.length) frag.appendChild(badges);

    // 主体：左右两列
    const main = document.createElement('div');
    main.className = 'p-main';

    // 左列上：暗干 + 九星（芮禽合并）
    const starRow = document.createElement('div');
    starRow.className = 'p-star';
    const anGan = data.an_gan || '';
    if (anGan) {
      const an = document.createElement('span');
      an.className = 'an-gan';
      an.textContent = anGan;
      an.title = `暗干（隐干）· ${anGan}：${(STEM_MEANINGS[anGan] || '')}`;
      starRow.appendChild(an);
    }
    // 中五宫不在盘面单列「天禽」：天禽寄坤二宫、随天芮同行——
    // 星名已合并到芮禽宫，中宫之干已寄到坤二宫地盘与芮禽宫天盘（双干）。
    if (data.index !== 5) {
      const starName = document.createElement('span');
      starName.className = 'star-name';
      starName.textContent = data.star_display || data.star || '—';
      const starMeaning = (STARS[data.star] || {}).meaning || '';
      starName.title =
        `九星 · ${data.star || ''}：${starMeaning}` +
        (data.star_extra ? `\n${data.star_extra}与天芮同宫（寄坤二宫），合并显示为「芮禽」` : '');
      starRow.appendChild(starName);
    }
    main.appendChild(starRow);

    // 右列：天盘奇仪 / 地盘奇仪（同一容器内右对齐，保证严格同一条垂直线）
    const rightCol = document.createElement('div');
    rightCol.className = 'p-right';

    const tianCell = document.createElement('div');
    tianCell.className = 'p-tian';
    // 芮禽宫：先列天禽携来的中宫干，再列天芮携来的本位干
    if (data.index !== 5 && data.tian_pan_qi_yi_extra) {
      tianCell.appendChild(makeJiToken(data.tian_pan_qi_yi_extra, 'tian'));
    }
    if (data.tian_pan_qi_yi && data.index !== 5) {
      const q = document.createElement('span');
      q.className = 'qi-token';
      q.textContent = data.tian_pan_qi_yi;
      q.title = `天盘奇仪 · ${data.tian_pan_qi_yi}：${(STEM_MEANINGS[data.tian_pan_qi_yi] || '')}`;
      if (data.flags.xing_jia_mu) {
        q.classList.add('harm-both');
        q.title += '\n刑+墓：既落相刑之宫，又入墓库';
      } else {
        if (data.flags.ru_mu.active) {
          q.classList.add('harm-rumu');
          q.title += '\n入墓：天盘奇仪入墓库之宫';
        }
        if (data.flags.ji_xing.active) {
          q.classList.add('harm-jixing');
          q.title += '\n击刑：天盘奇仪落相刑之宫';
        }
      }
      // 十二长生只标天盘干：小字暗色，绝对定位于该干正上方
      const csInfo = (data.chang_sheng || {}).tian_pan;
      if (csInfo) {
        q.appendChild(makeChangShengTag(csInfo));
        q.title += `\n十二长生：${csInfo.name}（${csInfo.level}，寄生${csInfo.branch}）— ${csInfo.meaning}`;
      }
      tianCell.appendChild(q);
    }
    rightCol.appendChild(tianCell);

    // 左列下：八门
    const doorCell = document.createElement('div');
    doorCell.className = 'p-door';
    if (data.door) {
      doorCell.textContent = data.door;
      doorCell.title = `八门 · ${data.door}：${(DOORS[data.door_key] || {}).meaning || ''}`;
      if (data.flags.men_po.active) {
        doorCell.classList.add('harm-menpo');
        doorCell.title += '\n门迫：门五行克宫五行';
      }
    } else if (data.index !== 5) {
      doorCell.classList.add('is-empty');
      doorCell.textContent = '—';
    }
    main.appendChild(doorCell);

    // 右列下：地盘奇仪
    const diCell = document.createElement('div');
    diCell.className = 'p-di';
    // 坤二宫：先列中五宫寄来的干，再列本宫地盘奇仪
    if (data.di_pan_qi_yi_extra) {
      diCell.appendChild(makeJiToken(data.di_pan_qi_yi_extra, 'di'));
    }
    if (data.di_pan_qi_yi) {
      const q = document.createElement('span');
      q.className = 'diqi-token';
      q.textContent = data.di_pan_qi_yi;
      q.title = `地盘奇仪 · ${data.di_pan_qi_yi}：${(STEM_MEANINGS[data.di_pan_qi_yi] || '')}`;
      diCell.appendChild(q);
    }
    rightCol.appendChild(diCell);

    main.appendChild(rightCol);
    frag.appendChild(main);

    // 宫名
    const label = document.createElement('div');
    label.className = 'palace-label';
    const b = document.createElement('b');
    b.textContent = palaceMeta.trigram;
    label.appendChild(b);
    const span = document.createElement('span');
    span.textContent = `${palaceMeta.number}宫 · ${palaceMeta.direction}`;
    label.appendChild(span);
    frag.appendChild(label);

    return frag;
  }

  /** 十二长生小标签：只标天盘干，绝对定位于该干正上方；显隐由顶栏开关控制 */
  function makeChangShengTag(info) {
    if (!info) return null;
    const levelCls = info.level === '旺' ? 'cs-wang' : info.level === '衰' ? 'cs-shuai' : 'cs-ping';
    const s = document.createElement('span');
    s.className = `cs-tag ${levelCls}`;
    s.textContent = info.name;
    const palaceText = info.palace === 5 ? '中五宫（寄坤二）' : `第${info.palace}宫`;
    s.title =
      `十二长生 · 天盘奇仪 ${info.stem} 落${palaceText}：${info.name}（${info.level}）\n` +
      `寄生${info.branch}${info.via_palace !== info.palace ? '（中五宫寄坤二宫）' : ''}\n${info.meaning}`;
    return s;
  }

  /** 寄宫干（中五寄坤二 / 天禽随天芮）：与天盘、地盘本宫干同排显示 */
  function makeJiToken(gan, layer) {
    const s = document.createElement('span');
    s.className = (layer === 'tian' ? 'qi-token' : 'diqi-token') + ' ji-token';
    s.textContent = gan;
    s.title =
      (layer === 'tian' ? '天禽随天芮携来' : '中五宫寄坤二宫') +
      `之中宫地盘奇仪 · ${gan}：${STEM_MEANINGS[gan] || ''}`;
    return s;
  }

  function makeBadge(text, cls) {
    const s = document.createElement('span');
    s.className = 'badge ' + cls;
    s.textContent = text;
    return s;
  }

  function applyBoardClasses() {
    el.board.classList.toggle('mode-3d', state.mode3d);
    el.board.classList.toggle('hide-chang-sheng', !state.showChangSheng);
    el.board.classList.remove('focus-shen', 'focus-tian', 'focus-men', 'focus-di');
    if (state.focusLayer !== 'all') el.board.classList.add('focus-' + state.focusLayer);
    document.querySelectorAll('.layer-tab').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.layer === state.focusLayer));
    });
    applyRotorTransform();
  }

  function applyRotorTransform() {
    const rx = state.rotX;
    const ry = state.rotY;
    // translate(-50%,-50%) 先做居中，再绕盘心旋转
    el.rotor.style.transform = `translate(-50%, -50%) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
  }

  function highlightSelection() {
    document.querySelectorAll('.palace').forEach((cell) => {
      cell.classList.toggle('active', Number(cell.dataset.index) === state.selected);
    });
  }

  /* ------------------------------------------------------------------ *
   * 渲染：详情面板
   * ------------------------------------------------------------------ */
  function selectPalace(index, opts) {
    const force = !!(opts && opts.force);
    const now = Date.now();
    // pointerup 与 click 会先后触发；同一宫在极短时间内只处理一次，避免重复渲染
    if (!force && state.selected === index && now - state.lastSelectTs < 450) return;
    state.selected = index;
    state.lastSelectTs = now;
    highlightSelection();
    renderPanel();
  }

  function renderPanel() {
    const chart = state.chart;
    if (!chart) return;
    if (!state.selected) {
      el.panelTitle.textContent = '单宫详情';
      el.panelTag.textContent = '未选宫';
      el.panelBody.innerHTML =
        '<div class="empty-hint">点击任意宫位查看该宫的<b>四层符号释义</b>、<b>暗干</b>、<b>十干克应</b>与<b>四害 / 空亡 / 马星</b>状态。<br /><br />提示：<br />· 宫格左侧为「暗干 + 九星 / 八门」，右侧为「天盘奇仪 / 地盘奇仪」；<br />· 顶部 <kbd>神 / 天 / 人 / 地</kbd> 可单独抬升一层，便于辨认；<br />· 按住盘面拖动可旋转视角；<br />· <kbd>3D 叠加</kbd> 切换层分离视图。</div>';
      return;
    }
    const data = chart.palaces.find((p) => p.index === state.selected);
    if (!data) return;
    const pm = PALACES.find((p) => p.index === data.index);

    el.panelTitle.textContent = data.name;
    el.panelTag.textContent = `${data.nei_wai === 'nei' ? '内盘' : data.nei_wai === 'wai' ? '外盘' : '中宫'} · ${data.direction} · ${data.element}`;

    const body = document.createDocumentFragment();

    // 头部
    const hero = document.createElement('div');
    hero.className = 'detail-hero';
    const big = document.createElement('span');
    big.className = 'big';
    big.textContent = pm.trigram;
    hero.appendChild(big);
    const sub = document.createElement('span');
    sub.className = 'sub';
    sub.textContent = `${data.name} · ${data.direction} · 五行${data.element}`;
    hero.appendChild(sub);
    body.appendChild(hero);

    // ---- 四层符号 ----
    body.appendChild(secTitle('四 层 符 号'));
    const kv = document.createElement('dl');
    kv.className = 'kv';
    kv.appendChild(dt('八神'));
    kv.appendChild(ddGan(data.god || '—', data.god ? GOD_MEANINGS[data.god] : '本宫不列八神（中五宫）'));
    kv.appendChild(dt('九星'));
    kv.appendChild(
      data.index === 5
        ? ddGan('—', '中五宫不单列九星：天禽寄坤二宫、随天芮同行；星名合并为「芮禽」，中宫之干寄至坤二宫与芮禽宫作双干。')
        : ddGan(
            data.star_display || data.star || '—',
            data.star
              ? (STARS[data.star] || {}).meaning +
                (data.star_extra ? `\n天禽随天芮同宫，合并显示为「芮禽」。` : '')
              : '本宫不列九星'
          )
    );
    kv.appendChild(dt('天盘奇仪'));
    kv.appendChild(
      ddGan(
        ganWithJi(data.tian_pan_qi_yi, data.tian_pan_qi_yi_extra),
        (data.tian_pan_qi_yi
          ? `天盘（客）之干，随九星运转。${STEM_MEANINGS[data.tian_pan_qi_yi] || ''}`
          : '') +
          (data.tian_pan_qi_yi_extra
            ? `\n含寄宫干 ${data.tian_pan_qi_yi_extra}：天禽随天芮携来之中五宫地盘奇仪。`
            : '')
      )
    );
    kv.appendChild(dt('八门'));
    kv.appendChild(ddGan(data.door || '—', data.door ? (DOORS[data.door_key] || {}).meaning : '中五宫无门'));
    kv.appendChild(dt('地盘奇仪'));
    kv.appendChild(
      ddGan(
        ganWithJi(data.di_pan_qi_yi, data.di_pan_qi_yi_extra),
        (data.di_pan_qi_yi
          ? `地盘（主）之干，为九宫本气。${STEM_MEANINGS[data.di_pan_qi_yi] || ''}`
          : '') +
          (data.di_pan_qi_yi_extra
            ? `\n含寄宫干 ${data.di_pan_qi_yi_extra}：中五宫寄坤二宫之地盘奇仪。`
            : '')
      )
    );
    body.appendChild(kv);

    // ---- 中五寄宫（双干来源） ----
    if (data.index === 5 || data.di_pan_qi_yi_extra || data.tian_pan_qi_yi_extra) {
      body.appendChild(secTitle('中 五 寄 宫'));
      const jiCard = document.createElement('div');
      jiCard.className = 'an-gan-card';
      const jiName = document.createElement('div');
      jiName.className = 'an-name';
      const jiGan =
        (chart.meta.ji_gong && chart.meta.ji_gong.stem) ||
        data.di_pan_qi_yi_extra || data.tian_pan_qi_yi_extra || '—';
      jiName.textContent = `中宫干 ${jiGan} → 坤二宫`;
      jiCard.appendChild(jiName);
      const jiMean = document.createElement('div');
      jiMean.className = 'meaning';
      jiMean.textContent =
        '中五宫无门无神，天禽寄坤二宫并随天芮同行：坤二宫【地盘】与芮禽宫【天盘】各多出一干，' +
        '盘面按「寄宫干在前、本宫干在后」显示；该寄干与天盘干、地盘干同参。';
      jiCard.appendChild(jiMean);
      body.appendChild(jiCard);
    }

    // ---- 暗干（隐干） ----
    body.appendChild(secTitle('暗 干（隐 干）'));
    const anGanVal = data.an_gan || '—';
    const anCard = document.createElement('div');
    anCard.className = 'an-gan-card';
    const anName = document.createElement('div');
    anName.className = 'an-name';
    anName.textContent = anGanVal === '—' ? '—' : `暗干 ${anGanVal}`;
    anCard.appendChild(anName);
    const anMean = document.createElement('div');
    anMean.className = 'meaning';
    anMean.textContent =
      anGanVal === '—'
        ? '本宫无暗干。'
        : `${STEM_MEANINGS[anGanVal] || ''} 暗干主「暗中之机」：与天盘干、地盘干同参时，可看出表面之下隐藏的助力或隐患（如门吉而暗干带庚，表吉里凶）。`;
    anCard.appendChild(anMean);
    const anRule = document.createElement('div');
    anRule.className = 'an-rule';
    const ag = chart.meta.an_gan_start;
    const isFuYin = !!(ag && ag.source === 'zhong_gong_fu_yin');
    const agStartDesc = isFuYin
      ? '中五宫（伏吟归中）'
      : `值使门落宫（第${ag ? ag.palace : '—'}宫）`;
    anRule.textContent =
      `排法：时干${ag ? `（${ag.stem}）` : ''}起于${agStartDesc}，` +
      `循奇仪序「戊己庚辛壬癸丁丙乙」${chart.meta.yinyang_dun === 'yang' ? '阳遁顺飞' : '阴遁逆飞'}布九宫。` +
      (isFuYin ? '本局值使门与时干同宫（伏吟），暗干归中五宫起飞以免与地盘逐宫重合。' : '') +
      `口径 ${chart.meta.an_gan_rule || 'shigan-feibu-v1'}。`;
    anCard.appendChild(anRule);
    body.appendChild(anCard);

    // ---- 十二长生 ----
    const cs = data.chang_sheng || {};
    if (cs.tian_pan || cs.di_pan || cs.an_gan) {
      body.appendChild(secTitle('十 二 长 生'));
      const csList = document.createElement('dl');
      csList.className = 'kv';
      for (const [label, info] of [
        ['天盘干', cs.tian_pan],
        ['地盘干', cs.di_pan],
        ['暗干', cs.an_gan],
      ]) {
        if (!info) continue;
        csList.appendChild(dt(label));
        csList.appendChild(
          ddGan(
            info.name,
            `${info.level} · 干${info.stem} 寄生${info.branch}` +
              `${info.via_palace !== info.palace ? '（中五宫寄坤二）' : ''}：${info.meaning}`
          )
        );
      }
      body.appendChild(csList);
    }

    // ---- 十干克应 ----
    body.appendChild(secTitle('十 干 克 应'));
    const ky = keYingOf(data.tian_pan_qi_yi, data.di_pan_qi_yi);
    const kyCard = document.createElement('div');
    kyCard.className = 'ke-ying-card';
    if (ky) {
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = ky.name;
      kyCard.appendChild(name);
      const formula = document.createElement('div');
      formula.className = 'formula';
      formula.textContent = `天盘 ${ky.tian_gan} ＋ 地盘 ${ky.di_gan}`;
      kyCard.appendChild(formula);
      const mean = document.createElement('div');
      mean.className = 'meaning';
      mean.textContent = ky.meaning;
      kyCard.appendChild(mean);
    } else {
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = '—';
      kyCard.appendChild(name);
      const mean = document.createElement('div');
      mean.className = 'meaning';
      mean.textContent = '中五宫不列十干克应。';
      kyCard.appendChild(mean);
    }
    body.appendChild(kyCard);

    // ---- 四害 / 空亡 / 马星 ----
    body.appendChild(secTitle('四 害 · 空 亡 · 马 星'));
    const flags = document.createElement('div');
    flags.className = 'flag-row';
    flags.appendChild(flagChip('空亡', data.flags.kong_wang, 'kong'));
    flags.appendChild(flagChip('马星', data.flags.ma_xing, 'ma'));
    flags.appendChild(flagChip('入墓', data.flags.ru_mu.active, 'rumu'));
    flags.appendChild(flagChip('击刑', data.flags.ji_xing.active, 'jixing'));
    flags.appendChild(flagChip('门迫', data.flags.men_po.active, 'menpo'));
    flags.appendChild(flagChip('刑+墓', data.flags.xing_jia_mu, 'both'));
    body.appendChild(flags);

    const explain = document.createElement('div');
    explain.className = 'meaning';
    explain.style.marginTop = '9px';
    explain.textContent = explainFlags(data);
    body.appendChild(explain);

    // ---- 快速选宫 ----
    body.appendChild(secTitle('快 速 选 宫'));
    const mini = document.createElement('div');
    mini.className = 'palace-grid-mini';
    const order = [4, 9, 2, 3, 5, 7, 8, 1, 6];
    for (const idx of order) {
      const p = chart.palaces.find((x) => x.index === idx);
      const cell = document.createElement('div');
      cell.className = 'mini-cell' + (idx === state.selected ? ' sel' : '');
      const mz = document.createElement('span');
      mz.className = 'mz';
      mz.textContent = PALACES.find((x) => x.index === idx).trigram;
      cell.appendChild(mz);
      const t = document.createElement('span');
      t.textContent = p.star_display ? p.star_display.replace('天', '') : '—';
      cell.appendChild(t);
      cell.addEventListener('click', () => {
        selectPalace(idx);
        const target = document.querySelector(`.palace[data-index="${idx}"]`);
        if (target) target.focus();
      });
      mini.appendChild(cell);
    }
    body.appendChild(mini);

    el.panelBody.innerHTML = '';
    el.panelBody.appendChild(body);
  }

  function secTitle(text) {
    const d = document.createElement('div');
    d.className = 'sec-title';
    d.textContent = text;
    return d;
  }
  function dt(text) {
    const d = document.createElement('dt');
    d.textContent = text;
    return d;
  }
  function ddGan(text, meaning) {
    const d = document.createElement('dd');
    const g = document.createElement('span');
    g.className = 'gan';
    g.textContent = text;
    d.appendChild(g);
    if (meaning) {
      const m = document.createElement('span');
      m.style.cssText =
        'display:block;color:#93a5c4;font-size:12px;line-height:1.7;margin-top:2px;white-space:pre-line';
      m.textContent = meaning;
      d.appendChild(m);
    }
    return d;
  }
  function flagChip(text, on, kind) {
    const s = document.createElement('span');
    s.className = 'flag ' + (on ? 'on ' + kind : '');
    const dot = document.createElement('i');
    dot.className = 'dot';
    s.appendChild(dot);
    s.appendChild(document.createTextNode(text));
    return s;
  }

  function explainFlags(d) {
    const parts = [];
    if (d.flags.kong_wang) parts.push('空亡：时旬空亡之地支映射本宫，主虚、主空、事难落实。');
    if (d.flags.ma_xing) parts.push('马星：地支三合驿马位，主变动、出行、迁移、快速。');
    if (d.flags.xing_jia_mu) parts.push('刑+墓：天盘奇仪既落相刑之宫（击刑），又入本气墓库（入墓），凶性叠加。');
    else {
      if (d.flags.ji_xing.active) parts.push('击刑：天盘六仪落入相刑之宫，主受制、刑伤、口舌。');
      if (d.flags.ru_mu.active) parts.push('入墓：天盘奇仪入墓库之宫，主昏昧、受困、才能不显。');
    }
    if (d.flags.men_po.active) parts.push('门迫：八门五行克宫五行，主事有阻力、强行则损。');
    if (!parts.length) parts.push('本宫无四害、空亡、马星标记。');
    return parts.join(' ');
  }

  /* ------------------------------------------------------------------ *
   * 存盘 / 载入 / 导出分析文本
   * ------------------------------------------------------------------ */
  function downloadText(text, filename, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /** 当前盘面 + 输入框里的预测事项（保持同步，避免未点「起局」时导出旧值） */
  function snapshotChart() {
    const chart = JSON.parse(JSON.stringify(state.chart));
    chart.meta.prediction_topic = el.topic ? el.topic.value.trim() : '';
    return chart;
  }

  function saveJSON() {
    if (!state.chart) return;
    const chart = snapshotChart();
    chart.saved_at = new Date().toISOString();
    const m = chart.meta;
    const d = m.true_solar_time.slice(0, 10);
    const t = m.true_solar_time.slice(11, 16).replace(':', '');
    const ju = m.ju_label.replace('遁', '').replace('局', '');
    const filename = `qimen_${d}_${t}_${ju}局.json`;
    downloadText(JSON.stringify(chart, null, 2), filename, 'application/json;charset=utf-8');
    showModal(JSON.stringify(chart, null, 2), filename, '盘面 JSON');
    toast(`已导出 ${filename}`);
  }

  /** 导出 AI 分析文本（Markdown/TXT，遵循固定模板） */
  function exportAiText() {
    if (!state.chart) return;
    const chart = snapshotChart();
    let text;
    let filename;
    try {
      text = E.buildAiAnalysisText(chart);
      filename = E.aiAnalysisFileName(chart);
    } catch (err) {
      console.error(err);
      toast('导出失败：' + err.message, true);
      return;
    }
    downloadText(text, filename, 'text/plain;charset=utf-8');
    showModal(text, filename, 'AI 分析文本（Markdown）');
    toast(`已导出 ${filename}`);
  }

  /**
   * 通用预览弹层
   * @param {string} content 文本内容
   * @param {string} filename 文件名
   * @param {string} title 弹层标题
   */
  function showModal(content, filename, title) {
    el.modalTitle.textContent = title || '预览';
    el.modalPre.textContent = content;
    el.modalTag.textContent = filename || '';
    el.modal.classList.add('show');
    el.modal.dataset.payload = content;
  }

  function loadJSONFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        validateChart(data);
        applyLoadedChart(data);
        toast('已载入盘面 JSON');
        setTimeout(verifyLoadedChart, 120);
      } catch (err) {
        console.error(err);
        toast('载入失败：' + err.message, true);
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  function validateChart(d) {
    if (!d || d.meta?.paipan_type !== 'shijia_zhuanpan') throw new Error('不是本插件的排盘 JSON（meta.paipan_type 不符）');
    if (!Array.isArray(d.palaces) || d.palaces.length !== 9) throw new Error('palaces 应为 9 宫');
    if (d.ke_ying_table_version !== KE_YING_TABLE_VERSION) {
      toast(`提示：克应表版本为 ${d.ke_ying_table_version}，当前为 ${KE_YING_TABLE_VERSION}`, true);
    }
  }

  function applyLoadedChart(d) {
    state.chart = d;
    state.loadedFromFile = true;
    state.selected = null;

    // 回填输入控件
    const m = d.meta;
    if (m.input_time) {
      el.date.value = m.input_time.slice(0, 10);
      el.time.value = m.input_time.slice(11, 16);
    }
    if (m.location) {
      el.lng.value = Number(m.location.lng).toFixed(4);
      el.lat.value = Number(m.location.lat).toFixed(4);
      const opt = [...el.city.options].find((o) => o.value === m.location.name);
      el.city.value = opt ? m.location.name : '__custom__';
    }
    el.rumu.value = m.ru_mu_kou_jing || 'A';
    if (el.topic) el.topic.value = m.prediction_topic || '';
    renderAll();
  }

  function verifyLoadedChart() {
    // 依据载入的输入重新起局，确认可复现同一盘面标记
    if (!state.chart || !state.loadedFromFile) return;
    try {
      const opts = readInput();
      const rebuilt = E.buildChart(opts);
      const same = JSON.stringify(rebuilt.palaces) === JSON.stringify(state.chart.palaces);
      if (same) {
        toast('重载复现校验通过：同一输入得到同一盘面 ✓');
      } else {
        toast('注意：按当前输入重算的盘面与文件不一致（可能因天文算法精度或口径不同）', true);
        console.warn('rebuilt', rebuilt);
      }
    } catch (err) {
      toast('校核失败：' + err.message, true);
    }
  }

  /* ------------------------------------------------------------------ *
   * 自适应九宫格尺寸：按舞台可用空间计算，避免大量留白或溢出
   * ------------------------------------------------------------------ */
  function fitBoard() {
    const wrap = el.wrap;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const gap = Math.max(6, Math.min(14, rect.width * 0.012));
    const byW = (rect.width * 0.94 - gap * 2) / 3;
    const byH = (rect.height * 0.96 - gap * 2) / 3;
    const cell = Math.max(84, Math.min(250, Math.floor(Math.min(byW, byH / 0.92))));
    document.documentElement.style.setProperty('--cell-w', `${cell}px`);
    document.documentElement.style.setProperty('--gap', `${gap}px`);
  }

  let fitTimer = 0;
  function scheduleFit() {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(fitBoard, 90);
  }
  window.addEventListener('resize', scheduleFit);

  /* ------------------------------------------------------------------ *
   * 渲染总入口
   * ------------------------------------------------------------------ */
  function renderAll() {
    renderMeta();
    renderBoard();
    renderPanel();
    updateLegend();
    updateViewNote();
    fitBoard();
  }

  function updateLegend() {
    const m = state.chart.meta;
    const nei = m.yinyang_dun === 'yang' ? '8 / 3 / 4 / 1' : '9 / 2 / 7 / 6';
    const wai = m.yinyang_dun === 'yang' ? '9 / 2 / 7 / 6' : '8 / 3 / 4 / 1';
    const g = el.app.querySelector('.legend .grp .sw');
    void g;
    const sws = el.app.querySelectorAll('.legend .grp:first-child .sw');
    if (sws[0]) sws[0].innerHTML = `<i class="chip nei"></i>内盘（${nei} 宫）`;
    if (sws[1]) sws[1].innerHTML = `<i class="chip wai"></i>外盘（${wai} 宫）`;
  }

  function updateViewNote() {
    const modeText = state.mode3d ? '3D 层分离' : '俯视可读';
    const focusText =
      state.focusLayer === 'all' ? '四层叠加' : `聚焦${LAYER_LABEL[state.focusLayer]}`;
    el.viewNote.textContent =
      `${modeText} · ${focusText} · 十二长生${state.showChangSheng ? '开' : '关'} · 拖动旋转 · 点击图层可聚焦`;
  }

  /* ------------------------------------------------------------------ *
   * 交互
   * ------------------------------------------------------------------ */
  function initEvents() {
    $('btn-paipan').addEventListener('click', paipan);
    $('btn-now').addEventListener('click', () => {
      const now = new Date();
      el.date.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      el.time.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      paipan();
    });
    $('btn-geo').addEventListener('click', locate);
    $('btn-save').addEventListener('click', saveJSON);
    $('btn-export-ai').addEventListener('click', exportAiText);
    if (el.topic) {
      el.topic.addEventListener('input', () => {
        if (state.chart) state.chart.meta.prediction_topic = el.topic.value.trim();
      });
    }
    $('btn-load').addEventListener('click', () => $('file-load').click());
    $('file-load').addEventListener('change', (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (f) loadJSONFile(f);
      ev.target.value = '';
    });

    $('btn-changsheng').addEventListener('click', () => {
      state.showChangSheng = !state.showChangSheng;
      $('btn-changsheng').setAttribute('aria-pressed', String(state.showChangSheng));
      applyBoardClasses();
      updateViewNote();
    });

    $('btn-view').addEventListener('click', () => {
      state.mode3d = !state.mode3d;
      $('btn-view').setAttribute('aria-pressed', String(state.mode3d));
      if (state.mode3d) {
        state.rotX = -18;
        state.rotY = 0;
      } else {
        state.rotX = 0;
        state.rotY = 0;
      }
      applyBoardClasses();
      updateViewNote();
    });

    el.city.addEventListener('change', () => {
      syncCityFromSelect();
    });
    el.lng.addEventListener('input', () => {
      el.city.value = '__custom__';
    });
    el.lat.addEventListener('input', () => {
      el.city.value = '__custom__';
    });

    // 图层聚焦
    document.querySelectorAll('.layer-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const layer = btn.dataset.layer;
        state.focusLayer = state.focusLayer === layer ? 'all' : layer;
        applyBoardClasses();
        updateViewNote();
      });
    });

    // 拖动旋转
    // 注意：绝不能在这里调用 setPointerCapture —— 指针捕获会把后续 click 事件重定向到
    // 捕获元素（#scene-wrap），导致宫位的 click 监听器永远收不到事件（单宫详情不联动）。
    // 这里改为：按下后监听 window 的 move/up，移动超过阈值才判定为拖动。
    const DRAG_THRESHOLD = 5; // px

    const onPointerMove = (ev) => {
      if (!state.pointerActive) return;
      const totalX = ev.clientX - state.dragStartX;
      const totalY = ev.clientY - state.dragStartY;
      if (!state.dragging) {
        if (Math.hypot(totalX, totalY) < DRAG_THRESHOLD) return;
        state.dragging = true;
        el.wrap.classList.add('dragging');
      }
      const dx = ev.clientX - state.lastX;
      const dy = ev.clientY - state.lastY;
      state.lastX = ev.clientX;
      state.lastY = ev.clientY;
      state.rotY = Math.max(-38, Math.min(38, state.rotY + dx * 0.28));
      state.rotX = Math.max(-62, Math.min(16, state.rotX - dy * 0.22));
      el.rotor.style.transition = 'none';
      applyRotorTransform();
    };

    const onPointerEnd = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      state.pointerActive = false;
      if (state.dragging) {
        state.dragging = false;
        state.suppressClickUntil = Date.now() + 350;
        el.rotor.style.transition = '';
      }
      el.wrap.classList.remove('dragging');
    };

    el.wrap.addEventListener('pointerdown', (ev) => {
      // 仅响应主键/触摸，避免右键或中键触发拖动
      if (ev.button !== undefined && ev.button !== 0) return;
      state.pointerActive = true;
      state.dragging = false;
      state.dragStartX = ev.clientX;
      state.dragStartY = ev.clientY;
      state.lastX = ev.clientX;
      state.lastY = ev.clientY;
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerEnd);
      window.addEventListener('pointercancel', onPointerEnd);
    });

    // 全局快捷键
    document.addEventListener('keydown', (ev) => {
      if (ev.target && /INPUT|SELECT|TEXTAREA/.test(ev.target.tagName)) return;
      if (ev.key === 'Escape') {
        state.focusLayer = 'all';
        applyBoardClasses();
        state.selected = null;
        highlightSelection();
        renderPanel();
        updateViewNote();
      } else if (ev.key === '1') { state.focusLayer = 'shen'; applyBoardClasses(); }
      else if (ev.key === '2') { state.focusLayer = 'tian'; applyBoardClasses(); }
      else if (ev.key === '3') { state.focusLayer = 'men'; applyBoardClasses(); }
      else if (ev.key === '4') { state.focusLayer = 'di'; applyBoardClasses(); }
      else if (ev.key === '0') { state.focusLayer = 'all'; applyBoardClasses(); }
    });

    // 弹层
    $('btn-modal-close').addEventListener('click', () => el.modal.classList.remove('show'));
    el.modal.addEventListener('click', (ev) => {
      if (ev.target === el.modal) el.modal.classList.remove('show');
    });
    $('btn-modal-copy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(el.modalPre.textContent);
        toast('已复制到剪贴板');
      } catch (_) {
        toast('复制失败，请手动选择文本', true);
      }
    });
    $('btn-modal-download').addEventListener('click', () => {
      const payload = el.modal.dataset.payload || el.modalPre.textContent;
      const name = el.modalTag.textContent || 'qimen.txt';
      const mime = name.endsWith('.json') ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8';
      const blob = new Blob([payload], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    });
  }

  function locate() {
    if (!navigator.geolocation) {
      toast('浏览器不支持定位，请手动输入经纬度', true);
      return;
    }
    const btn = $('btn-geo');
    btn.disabled = true;
    btn.textContent = '定位中…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        el.lng.value = pos.coords.longitude.toFixed(4);
        el.lat.value = pos.coords.latitude.toFixed(4);
        el.city.value = '__custom__';
        btn.disabled = false;
        btn.textContent = '📍 定位';
        toast(`已定位：${el.lng.value}°, ${el.lat.value}°`);
        paipan();
      },
      (err) => {
        btn.disabled = false;
        btn.textContent = '📍 定位';
        toast('定位失败：' + err.message + '（可手动输入或选择地区）', true);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }

  /* ------------------------------------------------------------------ *
   * 启动
   * ------------------------------------------------------------------ */
  /**
   * 解析 URL hash：可分享/复现视图
   * #date=…&time=…&lng=…&lat=…&rumu=B&topic=测出行&layer=tian&view=3d&cs=0&palace=8
   */
  function applyHash() {
    const raw = (location.hash || '').replace(/^#/, '');
    if (!raw) return;
    const q = new URLSearchParams(raw);
    const set = (id, key) => {
      const v = q.get(key);
      if (v !== null && v !== '') document.getElementById(id).value = v;
    };
    set('in-date', 'date');
    set('in-time', 'time');
    set('in-lng', 'lng');
    set('in-lat', 'lat');
    set('in-rumu', 'rumu');
    set('in-topic', 'topic');
    if (q.get('lng') || q.get('lat')) el.city.value = '__custom__';
    if (q.get('cs') === '0') state.showChangSheng = false;
    $('btn-changsheng').setAttribute('aria-pressed', String(state.showChangSheng));
    if (q.get('view') === '3d') {
      state.mode3d = true;
      state.rotX = -18;
      $('btn-view').setAttribute('aria-pressed', 'true');
    }
    const layer = q.get('layer');
    if (['shen', 'tian', 'men', 'di'].includes(layer)) state.focusLayer = layer;
    const palace = Number(q.get('palace'));
    if (palace >= 1 && palace <= 9) {
      state.pendingSelect = palace;
    }
  }

  function boot() {
    initCities();
    initEvents();
    applyHash();
    paipan();
    if (state.mode3d) applyBoardClasses();
    if (state.pendingSelect) {
      selectPalace(state.pendingSelect);
      state.pendingSelect = null;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
