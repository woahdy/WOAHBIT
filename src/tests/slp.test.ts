import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSlpScript, SlpValidator } from '../index.js';
import type { BchTransaction } from '../index.js';

const txidA = 'aa'.repeat(32);
const txidB = 'bb'.repeat(32);
const txidC = 'cc'.repeat(32);

function push(data: Uint8Array): Uint8Array {
  assert.ok(data.length <= 75, 'test helper only supports direct pushes');
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

function slp(...fields: Uint8Array[]): Uint8Array {
  return Uint8Array.from([0x6a, ...fields.flatMap((field) => [...push(field)])]);
}

function genesisScript(quantity = 1000n, batonVout: number | null = null): Uint8Array {
  return slp(
    hex('534c5000'),
    Uint8Array.from([1]),
    text('GENESIS'),
    text('WOAH'),
    text('WOAHBIT'),
    new Uint8Array(),
    new Uint8Array(),
    Uint8Array.from([0]),
    batonVout === null ? new Uint8Array() : Uint8Array.from([batonVout]),
    u64(quantity),
  );
}

function sendScript(tokenId: string, ...amounts: bigint[]): Uint8Array {
  return slp(
    hex('534c5000'),
    Uint8Array.from([1]),
    text('SEND'),
    hex(tokenId),
    ...amounts.map(u64),
  );
}

function mintScript(tokenId: string, quantity: bigint, batonVout: number | null = null): Uint8Array {
  return slp(
    hex('534c5000'),
    Uint8Array.from([1]),
    text('MINT'),
    hex(tokenId),
    batonVout === null ? new Uint8Array() : Uint8Array.from([batonVout]),
    u64(quantity),
  );
}

function tx(txid: string, script: Uint8Array, inputs: BchTransaction['inputs'] = [], outputCount = 3): BchTransaction {
  return {
    txid,
    inputs,
    outputs: Array.from({ length: outputCount }, (_, index) => ({
      valueSatoshis: index === 0 ? 0n : 546n,
      lockingBytecode: index === 0 ? script : new Uint8Array([0x51]),
    })),
  };
}

test('parses SLP Type 1 GENESIS', () => {
  const parsed = parseSlpScript(genesisScript(123n, 2));
  assert.equal(parsed.transactionType, 'GENESIS');
  if (parsed.transactionType !== 'GENESIS') return;
  assert.equal(parsed.ticker, 'WOAH');
  assert.equal(parsed.name, 'WOAHBIT');
  assert.equal(parsed.initialQuantity, 123n);
  assert.equal(parsed.batonVout, 2);
});

test('rejects unsupported token type', () => {
  const script = slp(hex('534c5000'), Uint8Array.from([2]), text('SEND'), hex(txidA), u64(1n));
  assert.throws(() => parseSlpScript(script), /Unsupported SLP token type 2/);
});

test('validates GENESIS and conservative SEND chain', async () => {
  const genesis = tx(txidA, genesisScript(1000n, null), [], 2);
  const send = tx(txidB, sendScript(txidA, 400n, 500n), [{ prevout: { txid: txidA, vout: 1 } }], 3);
  const map = new Map([[txidA, genesis], [txidB, send]]);
  const validator = new SlpValidator({ getTransaction: async (id) => map.get(id) ?? null });

  const genesisResult = await validator.validate(genesis);
  assert.equal(genesisResult.valid, true);
  assert.equal(genesisResult.tokenOutputs?.[0]?.amount, 1000n);

  const sendResult = await validator.validate(send);
  assert.equal(sendResult.valid, true);
  assert.deepEqual(sendResult.tokenOutputs?.map((o) => o.amount), [400n, 500n]);
});

test('rejects SEND that creates tokens', async () => {
  const genesis = tx(txidA, genesisScript(100n, null), [], 2);
  const send = tx(txidB, sendScript(txidA, 101n), [{ prevout: { txid: txidA, vout: 1 } }], 2);
  const map = new Map([[txidA, genesis]]);
  const validator = new SlpValidator({ getTransaction: async (id) => map.get(id) ?? null });
  const result = await validator.validate(send);
  assert.equal(result.valid, false);
  assert.match(result.reason ?? '', /creates 1 token units/);
});

test('requires a valid mint baton', async () => {
  const genesis = tx(txidA, genesisScript(100n, 2), [], 3);
  const mint = tx(txidC, mintScript(txidA, 50n, 2), [{ prevout: { txid: txidA, vout: 2 } }], 3);
  const map = new Map([[txidA, genesis], [txidC, mint]]);
  const validator = new SlpValidator({ getTransaction: async (id) => map.get(id) ?? null });
  const result = await validator.validate(mint);
  assert.equal(result.valid, true);
  assert.equal(result.tokenOutputs?.[0]?.amount, 50n);
  assert.equal(result.tokenOutputs?.[1]?.isMintBaton, true);
});
