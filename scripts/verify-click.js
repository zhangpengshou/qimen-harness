/**
 * verify-click.js — 用 CDP 真实输入事件验证「点击宫位 → 单宫详情联动」
 * 仅用于本地验证，验证后删除。
 */
'use strict';

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://127.0.0.1:5178/';
const PORT = 9333;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getJson(pathname) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port: PORT, path: pathname }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error('bad json: ' + body.slice(0, 200)));
          }
        });
      })
      .on('error', reject);
  });
}

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-probe-'));
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--window-size=1600,1000',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      URL,
    ],
    { stdio: 'ignore' }
  );

  let ws;
  try {
    // 等待调试端口就绪
    let targets = null;
    for (let i = 0; i < 40; i += 1) {
      await sleep(300);
      try {
        targets = await getJson('/json/list');
        if (targets && targets.some((t) => t.type === 'page' && t.webSocketDebuggerUrl)) break;
      } catch (_) { /* 继续等待 */ }
    }
    const target = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    if (!target) throw new Error('未找到调试目标');

    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = () => rej(new Error('WebSocket 连接失败'));
    });

    let id = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        id += 1;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });

    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      return r.result.value;
    };

    // 等页面脚本完成首局渲染
    for (let i = 0; i < 30; i += 1) {
      const ready = await evaluate("!!document.querySelector('.palace[data-index=\"8\"]')");
      if (ready) break;
      await sleep(300);
    }
    await sleep(500);

    async function realClick(palaceIndex) {
      const expectedNames = {
        1: '坎一宫', 2: '坤二宫', 3: '震三宫', 4: '巽四宫', 5: '中五宫',
        6: '乾六宫', 7: '兑七宫', 8: '艮八宫', 9: '离九宫',
      };
      const rect = await evaluate(`(() => {
        const el = document.querySelector('.palace[data-index="${palaceIndex}"]');
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      })()`);
      await send('Input.dispatchMouseEvent', {
        type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', buttons: 1, clickCount: 1,
      });
      await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', buttons: 0, clickCount: 1,
      });
      await sleep(160);
      const r = await evaluate(
        "({title: document.getElementById('panel-title').textContent, tag: document.getElementById('panel-tag').textContent, hasAnGan: document.getElementById('panel-body').textContent.includes('暗 干'), active: (document.querySelector('.palace.active')||{}).dataset ? document.querySelector('.palace.active').dataset.index : 'none'})"
      );
      return { ...r, expected: expectedNames[palaceIndex] };
    }

    const results = [];
    for (const idx of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const r = await realClick(idx);
      results.push({ palace: idx, ...r });
    }

    // 真实拖动：按下 → 移动 → 释放，检查是否误选
    const before = await evaluate("document.getElementById('panel-title').textContent");
    const c = await evaluate(`(() => {
      const el = document.querySelector('.palace[data-index="9"]');
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', buttons: 1, clickCount: 1 });
    for (let d = 10; d <= 80; d += 10) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x + d, y: c.y + d / 2, button: 'left', buttons: 1 });
      await sleep(30);
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x + 80, y: c.y + 40, button: 'left', buttons: 0, clickCount: 1 });
    await sleep(300);
    const afterDrag = await evaluate("({title: document.getElementById('panel-title').textContent, rot: document.getElementById('scene-rotor').style.transform})");

    console.log('真实鼠标点击结果：');
    for (const r of results) {
      console.log(`  宫${r.palace} → 面板「${r.title}」/ 标签「${r.tag}」/ 含暗干区=${r.hasAnGan} / 高亮宫=${r.active}`);
    }
    console.log('真实拖动结果：');
    console.log(`  拖动前标题「${before}」→ 拖动后「${afterDrag.title}」；旋转已改变=${afterDrag.rot.includes('rotate')}`);

    const ok =
      results.every((r) => r.title === r.expected && r.hasAnGan) &&
      afterDrag.title === results[results.length - 1].title;
    console.log(ok ? '\n验证通过：九宫全部可点击联动、拖动不误选' : '\n验证失败');
    process.exitCode = ok ? 0 : 1;
  } catch (err) {
    console.error('验证异常：', err.message);
    process.exitCode = 2;
  } finally {
    try { if (ws) ws.close(); } catch (_) {}
    chrome.kill();
    await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
  }
})();
