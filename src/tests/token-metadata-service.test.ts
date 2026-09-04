import assert from 'node:assert/strict';
import test from 'node:test';
import { formatSlpAmount, SlpTokenMetadataService } from '../app/token-metadata-service.js';
import type { BchTransaction } from '../slp/types.js';

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
  const out = new Uint8Array(8);
  let current = value;
  for (let i = 7; i >= 0; i -= 1) {
    out[i] = Number(current & 0xffn);
    current >>= 8n;
  }
  return out;
}

function genesisScript(): Uint8Array {
  const fields = [
    hex('534c5000'), Uint8Array.from([1]), text('GENESIS'), text('WOAH'), text('WOAHBIT'),
    text('https://woahbit.com'), hex('11'.repeat(32)), Uint8Array.from([2]), Uint8Array.from([2]), u64(12345n),
  ];
  return Uint8Array.from([0x6a, ...fields.flatMap((field) => [...push(field)])]);
}

function genesisTransaction(): BchTransaction {
  return {
    txid: tokenId,
    inputs: [],
    outputs: [
      { valueSatoshis: 0n, lockingBytecode: genesisScript() },
      { valueSatoshis: 546n, lockingBytecode: new Uint8Array([0x51]) },
      { valueSatoshis: 546n, lockingBytecode: new Uint8Array([0x51]) },
    ],
  };
}

test('formats raw SLP amounts without losing precision', () => {
  assert.equal(formatSlpAmount(12345n, 2), '123.45');
  assert.equal(formatSlpAmount(1n, 4), '0.0001');
  assert.equal(formatSlpAmount(100n, 0), '100');
  assert.equal(formatSlpAmount(12345678901234567890n, 9), '12345678901.234567890');
});

test('returns display metadata only for a canonical validated GENESIS token id', async () => {
  const genesis = genesisTransaction();
  const service = new SlpTokenMetadataService({ getTransaction: async (id) => id === tokenId ? genesis : null });

  const result = await service.getTokenMetadata(tokenId.toUpperCase());

  assert.equal(result.tokenId, tokenId);
  assert.equal(result.found, true);
  assert.equal(result.validSlpGenesis, true);
  assert.equal(result.identityBasis, 'canonical-token-id');
  assert.equal(result.metadata?.name, 'WOAHBIT');
  assert.equal(result.metadata?.ticker, 'WOAH');
  assert.equal(result.metadata?.documentUri, 'https://woahbit.com');
  assert.equal(result.metadata?.documentHash, '11'.repeat(32));
  assert.equal(result.metadata?.initialQuantity, '12345');
  assert.equal(result.metadata?.initialQuantityDisplay, '123.45');
  assert.equal(result.metadata?.mintBatonVout, 2);
});

test('does not query the resolver for an invalid token id', async () => {
  let queried = false;
  const service = new SlpTokenMetadataService({
    getTransaction: async () => {
      queried = true;
      return null;
    },
  });

  const result = await service.getTokenMetadata('not-a-token-id');

  assert.equal(queried, false);
  assert.equal(result.found, false);
  assert.equal(result.validSlpGenesis, false);
  assert.equal(result.reason, 'Invalid token id');
});

test('validates the token id before normalization', async () => {
  let queries = 0;
  const service = new SlpTokenMetadataService({
    getTransaction: async () => {
      queries += 1;
      return genesisTransaction();
    },
  });

  for (const invalid of [` ${tokenId}`, `${tokenId} `, tokenId.slice(1), `${tokenId}0`, `${tokenId.slice(0, -1)}g`]) {
    const result = await service.getTokenMetadata(invalid);
    assert.equal(result.validSlpGenesis, false);
    assert.equal(result.reason, 'Invalid token id');
  }
  assert.equal(queries, 0);
});

test('rejects a valid non-GENESIS transaction as a token identity', async () => {
  const transaction = genesisTransaction();
  transaction.outputs[0] = { valueSatoshis: 0n, lockingBytecode: new Uint8Array([0x51]) };
  const service = new SlpTokenMetadataService({ getTransaction: async () => transaction });

  const result = await service.getTokenMetadata(tokenId);

  assert.equal(result.found, true);
  assert.equal(result.validSlpGenesis, false);
  assert.equal(result.metadata, undefined);
});
