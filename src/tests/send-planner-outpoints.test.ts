import test from 'node:test';
import assert from 'node:assert/strict';
import { planSlpType1Send, buildSlpType1SendOpReturn } from '../index.js';
import type { ValidatedSlpUtxo } from '../index.js';

const tokenId = 'ab'.repeat(32);
function input(vout: number, amount = 10n): ValidatedSlpUtxo {
  return { outpoint: { txid: 'a'.repeat(64), vout }, tokenId, amount, validated: true };
}

test('SEND planner rejects malformed outpoint indices', () => {
  for (const vout of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, 0x1_0000_0000]) {
    assert.throws(() => planSlpType1Send(tokenId, 5n, [input(vout)]), /Token input outpoint/);
  }
});

test('SEND planner rejects malformed transaction IDs', () => {
  const invalid = { ...input(1), outpoint: { txid: 'not-a-txid', vout: 1 } };
  assert.throws(() => planSlpType1Send(tokenId, 5n, [invalid]), /Token input outpoint/);
});

test('SEND quantities reject values larger than uint64', () => {
  const overflow = 1n << 64n;
  assert.throws(() => planSlpType1Send(tokenId, overflow, [input(1)]), /unsigned 64-bit/);
  assert.throws(() => buildSlpType1SendOpReturn(tokenId, [overflow]), /unsigned 64-bit/);
});
