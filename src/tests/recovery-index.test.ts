import test from 'node:test';
import assert from 'node:assert/strict';
import { SlpRecoveryIndex } from '../index.js';
import type { BchTransaction } from '../index.js';

const genesisTxid = 'aa'.repeat(32);
const sendTxid = 'bb'.repeat(32);
const burnTxid = 'cc'.repeat(32);

function push(data: Uint8Array): Uint8Array {
  assert.ok(data.length <= 75);
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
  for (let index = 7; index >= 0; index--) {
    out[index] = Number(current & 0xffn);
    current >>= 8n;
  }
  return out;
}

function slp(...fields: Uint8Array[]): Uint8Array {
  return Uint8Array.from([0x6a, ...fields.flatMap((field) => [...push(field)])]);
}

function genesisScript(quantity: bigint): Uint8Array {
  return slp(
    hex('534c5000'), Uint8Array.from([1]), text('GENESIS'), text('WOAH'), text('WOAHDY'),
    new Uint8Array(), new Uint8Array(), Uint8Array.from([0]), new Uint8Array(), u64(quantity),
  );
}

function sendScript(tokenId: string, ...amounts: bigint[]): Uint8Array {
  return slp(hex('534c5000'), Uint8Array.from([1]), text('SEND'), hex(tokenId), ...amounts.map(u64));
}

function tx(txid: string, script: Uint8Array, inputs: BchTransaction['inputs'] = [], outputCount = 3): BchTransaction {
  return {
    txid,
    inputs,
    outputs: Array.from({ length: outputCount }, (_, index) => ({
      valueSatoshis: index === 0 ? 0n : 546n,
      lockingBytecode: index === 0 ? script : Uint8Array.from([0x51]),
    })),
  };
}

test('recovers a valid SLP ancestry and records known spends', async () => {
  const genesis = tx(genesisTxid, genesisScript(1000n), [], 2);
  const send = tx(
    sendTxid,
    sendScript(genesisTxid, 400n, 500n),
    [{ prevout: { txid: genesisTxid, vout: 1 } }],
    3,
  );
  const map = new Map([[genesisTxid, genesis], [sendTxid, send]]);
  const index = new SlpRecoveryIndex({ getTransaction: async (txid) => map.get(txid) ?? null });

  const recovered = await index.indexSeed(sendTxid);
  assert.equal(recovered?.validSlp, true);
  assert.equal(recovered?.tokenId, genesisTxid);

  const genesisOutput = index.getOutput(genesisTxid, 1);
  assert.equal(genesisOutput?.amount, 1000n);
  assert.equal(genesisOutput?.spentBy, sendTxid);

  const outputs = index.getTokenOutputs(genesisTxid);
  assert.deepEqual(outputs.map((output) => output.amount), [1000n, 400n, 500n]);
  assert.deepEqual(index.snapshot().tokenIds, [genesisTxid]);
});

test('marks a token output spent even when the spending transaction is not valid SLP', async () => {
  const genesis = tx(genesisTxid, genesisScript(1000n), [], 2);
  const burn: BchTransaction = {
    txid: burnTxid,
    inputs: [{ prevout: { txid: genesisTxid, vout: 1 } }],
    outputs: [{ valueSatoshis: 500n, lockingBytecode: Uint8Array.from([0x51]) }],
  };
  const map = new Map([[genesisTxid, genesis], [burnTxid, burn]]);
  const index = new SlpRecoveryIndex({ getTransaction: async (txid) => map.get(txid) ?? null });

  const recovered = await index.indexSeed(burnTxid);
  assert.equal(recovered?.validSlp, false);
  assert.equal(index.getOutput(genesisTxid, 1)?.spentBy, burnTxid);
});

test('rejects malformed seed transaction ids before resolver lookup', async () => {
  let calls = 0;
  const index = new SlpRecoveryIndex({ getTransaction: async () => { calls += 1; return null; } });
  await assert.rejects(() => index.indexSeed('not-a-txid'), /Invalid transaction id/);
  assert.equal(calls, 0);
});
