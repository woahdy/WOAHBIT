import test from 'node:test';
import assert from 'node:assert/strict';
import { WoahbitValidationService } from '../index.js';
import type { BchTransaction } from '../index.js';

const txid = 'ab'.repeat(32);

const transaction: BchTransaction = {
  txid,
  inputs: [],
  outputs: [
    {
      valueSatoshis: 0n,
      lockingBytecode: Uint8Array.from(Buffer.from(
        '6a04534c500001010747454e4553495304574f414807574f41484249540000010000080000000000000064',
        'hex',
      )),
    },
    { valueSatoshis: 546n, lockingBytecode: Uint8Array.from([0x51]) },
  ],
};

test('returns a serialized app-facing validation summary', async () => {
  const service = new WoahbitValidationService({
    getTransaction: async (id) => id === txid ? transaction : null,
  });

  const result = await service.validateTransaction(txid.toUpperCase());
  assert.equal(result.found, true);
  assert.equal(result.validSlp, true);
  assert.equal(result.transactionType, 'GENESIS');
  assert.equal(result.tokenId, txid);
  assert.equal(result.tokenOutputs[0]?.amount, '100');
});

test('rejects malformed txids without querying the resolver', async () => {
  let calls = 0;
  const service = new WoahbitValidationService({
    getTransaction: async () => {
      calls += 1;
      return null;
    },
  });

  const result = await service.validateTransaction('not-a-txid');
  assert.equal(result.found, false);
  assert.equal(result.validSlp, false);
  assert.equal(result.reason, 'Invalid transaction id');
  assert.equal(calls, 0);
});

test('reports a missing blockchain transaction cleanly', async () => {
  const service = new WoahbitValidationService({ getTransaction: async () => null });
  const result = await service.validateTransaction('cd'.repeat(32));
  assert.equal(result.found, false);
  assert.equal(result.reason, 'Transaction not found');
  assert.deepEqual(result.tokenOutputs, []);
});
