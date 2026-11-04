/**
 * run-tests.js — 零依赖、单进程的测试运行器
 *
 * 为什么不用 `node --test`：`node --test` 会为每个测试文件 spawn 子进程，
 * 在受限沙箱（禁止子进程管道）中会报 `spawn EPERM`。
 * 本运行器在同一进程内 require 全部测试文件，利用 node:test 的进程内报告。
 *
 * 用法：node test/run-tests.js
 * 退出码：全部通过 0，否则 1。
 */
'use strict';

const path = require('path');
const { test } = require('node:test');

// 触发 node:test 的进程内事件（不设置 --test 时由 reporter 汇总）
const files = [
  'astro.test.js',
  'calendar.test.js',
  'ke_ying.test.js',
  'solar_time.test.js',
  'an_gan.test.js',
  'ai_text.test.js',
  'qimen.test.js',
  'bundle.test.js',
];

let failed = 0;
let passed = 0;
const failures = [];

process.on('test:fail', (data) => {
  failed += 1;
  failures.push(data);
});
process.on('test:pass', () => {
  passed += 1;
});

(async () => {
  process.exitCode = 0;
  for (const f of files) {
    const full = path.join(__dirname, f);
    try {
      require(full);
    } catch (err) {
      console.error(`\n[加载失败] ${f}\n`, err);
      process.exitCode = 1;
    }
  }
  // 等 node:test 的进程内队列排空（reporter 会自行打印 ✔/✖ 与汇总）
  await new Promise((resolve) => setTimeout(resolve, 1200));
  if (failed > 0) {
    console.log('\n失败明细：');
    for (const f of failures) {
      const name = (f.data && f.data.name) || f.name;
      const msg = f.data && f.data.error ? f.data.error.message : '';
      console.log(` ✖ ${name}${msg ? '：' + msg : ''}`);
    }
    process.exitCode = 1;
  }
})();
