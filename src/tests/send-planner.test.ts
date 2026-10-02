import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSlpScript, planSlpType1Send, buildSlpType1SendOpReturn } from '../index.js';
import type { ValidatedSlpUtxo } from '../index.js';

const tokenId = 'ab'.repeat(32);

function utxo(txidByte: string, vout: number, amount: bigint): ValidatedSlpUtxo {
  return {
    outpoint: { txid: txidByte.repeat(64), vout },
    tokenId,
    amount,
    validated: true,
  };
}

test('plans a conservative SLP Type 1 SEND with explicit token change', () => {
  const plan = planSlpType1Send(tokenId, 60n, [utxo('b', 1, 30n), utxo('a', 2, 50n)]);
  assert.deepEqual(plan.tokenInputs.map((input) => input.amount), [50n, 30n]);
  assert.equal(plan.tokenInputQuantity, 80n);
  assert.equal(plan.recipientQuantity, 60n);
  assert.equal(plan.tokenChangeQuantity, 20n);
  assert.deepEqual(plan.outputQuantities, [60n, 20n]);

  const parsed = parseSlpScript(plan.opReturn);
  assert.equal(parsed.transactionType, 'SEND');
  if (parsed.transactionType !== 'SEND') return;
  assert.equal(parsed.tokenId, tokenId);
  assert.deepEqual(parsed.outputQuantities, [60n, 20n]);
});

test('omits token change only for an exact token match', () => {
  const plan = planSlpType1Send(tokenId, 50n, [utxo('a', 1, 50n)]);
  assert.equal(plan.tokenChangeQuantity, 0n);
  assert.deepEqual(plan.outputQuantities, [50n]);
});

test('selection is deterministic regardless of caller input order', () => {
  const first = utxo('a', 2, 40n);
  const second = utxo('b', 1, 70n);
  const a = planSlpType1Send(tokenId, 80n, [second, first]);
  const b = planSlpType1Send(tokenId, 80n, [first, second]);
  assert.deepEqual(a.tokenInputs.map((input) => input.outpoint), b.tokenInputs.map((input) => input.outpoint));
  assert.deepEqual(a.outputQuantities, b.outputQuantities);
});

test('rejects insufficient quantity instead of implicitly burning or inventing tokens', () => {
  assert.throws(() => planSlpType1Send(tokenId, 101n, [utxo('a', 1, 100n)]), /Insufficient validated token quantity/);
});

test('rejects mixed token IDs and duplicate outpoints', () => {
  const wrong = { ...utxo('a', 1, 100n), tokenId: 'cd'.repeat(32) };
  assert.throws(() => planSlpType1Send(tokenId, 10n, [wrong]), /does not match/);

  const same = utxo('b', 2, 20n);
  assert.throws(() => planSlpType1Send(tokenId, 10n, [same, same]), /Duplicate token input/);
});

test('rejects malformed IDs, zero quantities and oversized SEND output lists', () => {
  assert.throws(() => planSlpType1Send('AB'.repeat(32), 1n, [utxo('a', 1, 1n)]), /64 lowercase hexadecimal/);
  assert.throws(() => planSlpType1Send(tokenId, 0n, [utxo('a', 1, 1n)]), /positive/);
  assert.throws(() => buildSlpType1SendOpReturn(tokenId, Array.from({ length: 20 }, () => 1n)), /1 to 19/);
});

test('never accepts an unvalidated input shape at runtime', () => {
  const unsafe = { ...utxo('a', 1, 10n), validated: false } as unknown as ValidatedSlpUtxo;
  assert.throws(() => planSlpType1Send(tokenId, 5n, [unsafe]), /validator-approved/);
});
