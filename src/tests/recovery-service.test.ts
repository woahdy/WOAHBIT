import assert from 'node:assert/strict';
import test from 'node:test';
import { WoahbitRecoveryService, type BchTransaction } from '../index.js';

const txid = 'aa'.repeat(32);

function push(data: Uint8Array): Uint8Array {
  return Uint8Array.from([data.length, ...data]);
}

function text(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, 'utf8'));
}

function hex(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, 'hex'));
}

function u64(value: bigint): Uint8Array {
  const out = new Uint8Array(8);
  let current = value;
  for (let i = 7; i >= 0; i--) {
    out[i] = Number(current & 0xffn);
    current >>= 8n;
  }
  return out;
}

function genesisScript(quantity: bigint): Uint8Array {
  const fields = [
    hex('534c5000'), Uint8Array.from([1]), text('GENESIS'), text('WOAH'), text('WOAHBIT'),
    new Uint8Array(), new Uint8Array(), Uint8Array.from([0]), new Uint8Array(), u64(quantity),
  ];
  return Uint8Array.from([0x6a, ...fields.flatMap((field) => [...push(field)])]);
}

const genesis: BchTransaction = {
  txid,
  inputs: [],
  outputs: [
    { valueSatoshis: 0n, lockingBytecode: genesisScript(123n) },
    { valueSatoshis: 546n, lockingBytecode: new Uint8Array([0x51]) },
  ],
};

test('recovery service serializes SLP outputs and forward spend state', async () => {
  const service = new WoahbitRecoveryService(
    { getTransaction: async (id) => id === txid ? genesis : null },
    { getSpend: async () => null },
  );

  const result = await service.recoverTransaction(txid.toUpperCase());
  assert.equal(result.found, true);
  assert.equal(result.validSlp, true);
  assert.equal(result.transactionType, 'GENESIS');
  assert.equal(result.tokenId, txid);
  assert.deepEqual(result.tokenIds, [txid]);
  assert.equal(result.outputs[0]?.amount, '123');
  assert.equal(result.outputs[0]?.valueSatoshis, '546');
  assert.equal(result.outputs[0]?.spentBy, null);
});

test('recovery service rejects malformed transaction ids without resolver calls', async () => {
  let calls = 0;
  const service = new WoahbitRecoveryService({ getTransaction: async () => { calls += 1; return null; } });
  const result = await service.recoverTransaction('not-a-txid');
  assert.equal(result.found, false);
  assert.equal(result.reason, 'Invalid transaction id');
  assert.equal(calls, 0);
});
