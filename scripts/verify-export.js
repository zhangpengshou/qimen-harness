/**
 * verify-export.js — 用 CDP 真实点击验证「导出分析文本」
 *
 * 前置：先运行 `npm run serve`（默认 http://127.0.0.1:5178/），且本机装有 Chrome。
 * 校验点：按钮位于「保存 JSON」右侧同一水平线、点击后弹出 Markdown 预览、
 *         四段模板结构、9 宫齐全、克应断语、四害状态、文件名规范、无 HTML 标签。
 */
'use strict';

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = process.env.QIMEN_URL || 'http://127.0.0.1:5178/';
const PORT = Number(process.env.CDP_PORT) || 9337;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJson(p) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path: p }, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-ai-'));
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--window-size=1600,1000', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, URL], { stdio: 'ignore' });
  let ws;
  try {
    let targets = null;
    for (let i = 0; i < 40; i += 1) {
      await sleep(300);
      try { targets = await getJson('/json/list'); if (targets.some((t) => t.webSocketDebuggerUrl)) break; } catch (_) {}
    }
    const t = targets.find((x) => x.type === 'page' && x.webSocketDebuggerUrl);
    if (!t) throw new Error('未找到调试目标');
    ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('WebSocket 连接失败')); });
    let id = 0; const pending = new Map();
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => { id += 1; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
    const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;

    await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: path.join(os.tmpdir(), 'qimen-dl') }).catch(() => {});

    for (let i = 0; i < 30; i += 1) { if (await ev("!!document.getElementById('btn-export-ai')")) break; await sleep(300); }
    await sleep(600);

    const layout = await ev(`(function(){
      var b = document.getElementById('btn-export-ai');
      var s = document.getElementById('btn-save');
      var rb = b.getBoundingClientRect(), rs = s.getBoundingClientRect();
      return { text: b.textContent.trim(), visible: rb.width>0 && rb.height>0, rightOfSave: rb.left >= rs.right, gap: Math.round(rb.left - rs.right), topSame: Math.abs(rb.top-rs.top)<2 };
    })()`);

    await ev(`(function(){
      var t = document.getElementById('in-topic');
      t.value = '测明日签约是否顺利';
      t.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('btn-paipan').click();
    })()`);
    await sleep(600);

    const rect = await ev(`(function(){
      var r = document.getElementById('btn-export-ai').getBoundingClientRect();
      return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
    })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', buttons: 1, clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', buttons: 0, clickCount: 1 });
    await sleep(500);

    const modal = await ev(`(function(){
      var m = document.getElementById('modal');
      return {
        shown: m.classList.contains('show'),
        title: document.getElementById('modal-title').textContent,
        tag: document.getElementById('modal-tag').textContent,
        body: document.getElementById('modal-pre').textContent
      };
    })()`);

    const checks = {
      titleHasTemplate: modal.body.startsWith('# 奇门遁甲排盘数据（时家转盘）'),
      hasFourSections: ['## 一、 基础排盘信息', '## 二、 九宫盘面详解', '## 三、 图例与全局提示', '## 四、 AI 分析提示语'].every((s) => modal.body.includes(s)),
      has9Palaces: (modal.body.match(/^### \d\. /gm) || []).length === 9,
      topicFilled: modal.body.includes('**预测事项**：测明日签约是否顺利'),
      hasKeYingMeaning: /- \*\*十干克应\*\*：.+（.+）/m.test(modal.body),
      hasStatus: (modal.body.match(/- \*\*状态标记\*\*/g) || []).length === 9,
      noHtml: !/<[a-zA-Z/][^>]*>/.test(modal.body),
      filenameOk: /^qimen_AI分析_\d{4}-\d{2}-\d{2}_\d{4}_测明日签\.txt$/.test(modal.tag),
      previewVisible: modal.shown && modal.title.includes('AI 分析文本'),
    };

    console.log('按钮：', JSON.stringify(layout));
    console.log('弹层：', JSON.stringify({ shown: modal.shown, title: modal.title, tag: modal.tag, len: modal.body.length }));
    console.log('检查：', JSON.stringify(checks, null, 2));

    const ok = layout.text === '导出分析文本' && layout.visible && layout.rightOfSave && layout.topSame &&
      Object.values(checks).every((v) => v === true);
    console.log(ok ? '\n验证通过：按钮位置正确，导出的 Markdown 结构完整、文件名符合规范' : '\n验证失败');
    process.exitCode = ok ? 0 : 1;
  } catch (err) {
    console.error('异常：', err.message);
    process.exitCode = 2;
  } finally {
    try { if (ws) ws.close(); } catch (_) {}
    chrome.kill(); await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
  }
})();
