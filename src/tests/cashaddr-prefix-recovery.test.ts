import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cashAddressToLockingBytecode,
  normalizeMainnetCashAddress,
} from '../bch/cashaddr.js';

const LEGACY_SLP = 'simpleledger:qpg90d3x8wuhkqqtt9kx03d964j058xsn5ragr8xc5';
const MODERN_BCH = 'bitcoincash:qpg90d3x8wuhkqqtt9kx03d964j058xsn50xrcjxx2';

test('normalizes an independently documented legacy SLP address to bitcoincash', () => {
  assert.equal(normalizeMainnetCashAddress(LEGACY_SLP), MODERN_BCH);
});

test('legacy and modern forms resolve to the exact same locking bytecode', () => {
  assert.deepEqual(
    cashAddressToLockingBytecode(LEGACY_SLP),
    cashAddressToLockingBytecode(MODERN_BCH),
  );
});

test('modern bitcoincash form is stable under normalization', () => {
  assert.equal(normalizeMainnetCashAddress(MODERN_BCH), MODERN_BCH);
});
