import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createWoahbitServer } from '../app/server.js';
import type { BchTransaction } from '../slp/types.js';
import type { ParentResolver } from '../slp/validator.js';

const tokenId = 'ab'.repeat(32);

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
  const output = new Uint8Array(8);
  let current = value;
  for (let index = 7; index >= 0; index -= 1) {
    output[index] = Number(current & 0xffn);
    current >>= 8n;
  }
  return output;
}

function genesisTransaction(): BchTransaction {
  const fields = [
    hex('534c5000'), Uint8Array.from([1]), text('GENESIS'), text('WOAH'), text('WOAHBIT'),
    text('https://woahbit.com'), new Uint8Array(), Uint8Array.from([2]), new Uint8Array(), u64(12345n),
  ];
  return {
    txid: tokenId,
    inputs: [],
    outputs: [
      { valueSatoshis: 0n, lockingBytecode: Uint8Array.from([0x6a, ...fields.flatMap((field) => [...push(field)])]) },
      { valueSatoshis: 546n, lockingBytecode: new Uint8Array([0x51]) },
    ],
  };
}

async function request(path: string, resolver: ParentResolver): Promise<{ status: number; body: Record<string, unknown> }> {
  const server = createWoahbitServer({ rpcUrl: 'http://127.0.0.1:1', rpcTimeoutMs: 50, resolver });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('token metadata endpoint returns 400 without querying upstream for invalid input', async () => {
  let queries = 0;
  const resolver = { getTransaction: async () => { queries += 1; return null; } };

  const invalid = await request('/tokens/not-a-token-id', resolver);
  const whitespace = await request(`/tokens/%20${tokenId}`, resolver);
  const encoding = await request('/tokens/%ZZ', resolver);

  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.reason, 'Invalid token id');
  assert.equal(whitespace.status, 400);
  assert.equal(whitespace.body.reason, 'Invalid token id');
  assert.equal(encoding.status, 400);
  assert.equal(encoding.body.reason, 'Invalid token id encoding');
  assert.equal(queries, 0);
});

test('token metadata endpoint maps not-found, invalid genesis, and valid genesis results', async () => {
  const missing = await request(`/tokens/${'cd'.repeat(32)}`, { getTransaction: async () => null });
  const invalidGenesis = genesisTransaction();
  invalidGenesis.outputs[0] = { valueSatoshis: 0n, lockingBytecode: new Uint8Array([0x51]) };
  const invalid = await request(`/tokens/${tokenId}`, { getTransaction: async () => invalidGenesis });
  const valid = await request(`/tokens/${tokenId.toUpperCase()}`, { getTransaction: async () => genesisTransaction() });

  assert.equal(missing.status, 404);
  assert.equal(missing.body.reason, 'Token genesis transaction not found');
  assert.equal(invalid.status, 422);
  assert.equal(invalid.body.validSlpGenesis, false);
  assert.equal(valid.status, 200);
  assert.equal(valid.body.validSlpGenesis, true);
  assert.equal(valid.body.identityBasis, 'canonical-token-id');
  assert.equal((valid.body.metadata as Record<string, unknown>).initialQuantityDisplay, '123.45');
});

test('token metadata endpoint sanitizes unexpected upstream failures', async () => {
  const secret = 'rpc-password-and-internal-host';
  const result = await request(`/tokens/${tokenId}`, {
    getTransaction: async () => { throw new Error(secret); },
  });

  assert.equal(result.status, 500);
  assert.deepEqual(result.body, { error: 'Read-only service error' });
  assert.doesNotMatch(JSON.stringify(result.body), new RegExp(secret));
});
