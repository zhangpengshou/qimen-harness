'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { KE_YING, KE_YING_TABLE_VERSION, getKeYing, assertKeYingComplete } = require('../src/engine/ke_ying');

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

test('克应表：版本号正确', () => {
  assert.equal(KE_YING_TABLE_VERSION, '81-gan-ke-ying-v1');
});

test('克应表：9×9 必备，另含甲行甲列（共 100 组），全部有名称与释义', () => {
  const total = assertKeYingComplete();
  assert.equal(total, 100);
  assert.ok(total >= 81, '需求要求至少 81 组');
  for (const a of STEMS) {
    assert.ok(KE_YING[a], `缺少天盘干 ${a}`);
    for (const b of STEMS) {
      const e = getKeYing(a, b);
      assert.ok(e.name && e.name.length >= 2, `${a}+${b} 缺少名称`);
      assert.ok(e.meaning && e.meaning.length >= 6, `${a}+${b} 缺少释义`);
      assert.equal(e.tian_gan, a);
      assert.equal(e.di_gan, b);
    }
  }
});

test('克应表：甲行（甲加诸干）存在且可用于「甲」显示', () => {
  assert.equal(getKeYing('甲', '丙').name, '青龙返首');
  assert.equal(getKeYing('甲', '甲').name, '伏吟');
});

test('克应表：考试点 辛+癸 = 天牢华盖（含断语）', () => {
  const e = getKeYing('辛', '癸');
  assert.equal(e.name, '天牢华盖');
  assert.match(e.meaning, /日月失明/);
  assert.match(e.meaning, /误入天网/);
  assert.match(e.meaning, /动止乖张/);
});

test('克应表：常见组合抽查', () => {
  assert.equal(getKeYing('丙', '戊').name, '飞鸟跌穴');
  assert.equal(getKeYing('戊', '丙').name, '青龙返首');
  assert.equal(getKeYing('庚', '丙').name, '太白入荧');
  assert.equal(getKeYing('丁', '癸').name, '朱雀投江');
  assert.equal(getKeYing('戊', '戊').name, '伏吟');
  assert.equal(getKeYing('丙', '丁').name, '月奇朱雀');
});

test('克应表：术语只用「入墓」，不出现「入暮」', () => {
  const all = JSON.stringify(KE_YING);
  assert.ok(!all.includes('入暮'), '发现禁用写法「入暮」');
});
