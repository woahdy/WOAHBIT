import assert from 'node:assert/strict';
import test from 'node:test';
import { cashAddressToLockingBytecode } from '../bch/cashaddr.js';
import { planVerifiedSlpType1Send, type SlpSendVerificationSources } from '../slp/send-verification.js';
import type { BchTransaction, Outpoint } from '../slp/types.js';

const address = 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a';
const tokenId = 'aa'.repeat(32);
const outpoint: Outpoint = { txid: tokenId, vout: 1 };

function u64(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) { bytes[i] = Number(value & 255n); value >>= 8n; }
  return bytes;
}
function genesisScript(quantity: bigint): Uint8Array {
  const bytes = (value: string) => Uint8Array.from(Buffer.from(value, 'utf8'));
  const fields = [bytes('SLP\0'), Uint8Array.from([1]), bytes('GENESIS'), bytes('WOAH'), bytes('WOAHBIT'),
    new Uint8Array(), new Uint8Array(), Uint8Array.from([0]), new Uint8Array(), u64(quantity)];
  return Uint8Array.from([0x6a, ...fields.flatMap((field) => [field.length, ...field])]);
}

function fixture(): { tx: BchTransaction; sources: SlpSendVerificationSources } {
  const tx: BchTransaction = {
    txid: tokenId,
    inputs: [],
    outputs: [
      { valueSatoshis: 0n, lockingBytecode: genesisScript(100n) },
      { valueSatoshis: 546n, lockingBytecode: cashAddressToLockingBytecode(address) },
    ],
  };
  const sources: SlpSendVerificationSources = {
    resolver: { getTransaction: async (id) => id === tokenId ? tx : null },
    spendProvider: { getSpend: async () => null },
    independentUtxoProvider: { check: async () => ({ state: 'unspent' }) },
  };
  return { tx, sources };
}

test('derives exact quantity from chain validation instead of a caller flag', async () => {
  const { sources } = fixture();
  const plan = await planVerifiedSlpType1Send(tokenId, 60n, address, [outpoint], sources);
  assert.equal(plan.tokenInputQuantity, 100n);
  assert.deepEqual(plan.outputQuantities, [60n, 40n]);
  assert.equal(plan.tokenInputs[0]?.amount, 100n);
});

test('rejects output locked to another owner', async () => {
  const { tx, sources } = fixture();
  tx.outputs[1] = { valueSatoshis: 546n, lockingBytecode: Uint8Array.from([0x51]) };
  await assert.rejects(planVerifiedSlpType1Send(tokenId, 60n, address, [outpoint], sources), /not owned/);
});

test('rejects an already spent outpoint', async () => {
  const { sources } = fixture();
  sources.spendProvider.getSpend = async () => ({ txid: 'bb'.repeat(32) });
  await assert.rejects(planVerifiedSlpType1Send(tokenId, 60n, address, [outpoint], sources), /already spent/);
});

test('rejects missing or indeterminate independent UTXO evidence', async () => {
  for (const state of ['not-present', 'indeterminate'] as const) {
    const { sources } = fixture();
    sources.independentUtxoProvider.check = async () => ({ state });
    await assert.rejects(planVerifiedSlpType1Send(tokenId, 60n, address, [outpoint], sources), /Independent UTXO/);
  }
});

test('rejects wrong token ID and non-token output', async () => {
  const { sources } = fixture();
  await assert.rejects(planVerifiedSlpType1Send('bb'.repeat(32), 60n, address, [outpoint], sources), /valid ancestry/);
  await assert.rejects(planVerifiedSlpType1Send(tokenId, 60n, address, [{ ...outpoint, vout: 0 }], sources), /not owned/);
});

test('rejects duplicate, malformed, and unresolved outpoints', async () => {
  const { sources } = fixture();
  await assert.rejects(planVerifiedSlpType1Send(tokenId, 60n, address, [outpoint, outpoint], sources), /Duplicate/);
  await assert.rejects(planVerifiedSlpType1Send(tokenId, 60n, address, [{ ...outpoint, vout: -1 }], sources), /Invalid/);
  await assert.rejects(planVerifiedSlpType1Send(tokenId, 60n, address, [{ txid: 'cc'.repeat(32), vout: 1 }], sources), /could not be resolved/);
});

test('fails closed on provider errors', async () => {
  const { sources } = fixture();
  sources.spendProvider.getSpend = async () => { throw new Error('provider unavailable'); };
  await assert.rejects(planVerifiedSlpType1Send(tokenId, 60n, address, [outpoint], sources), /provider unavailable/);
});
