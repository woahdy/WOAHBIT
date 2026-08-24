import test from 'node:test';
import assert from 'node:assert/strict';
import type { BchTransaction } from '../slp/types.js';
import type { ParentResolver } from '../slp/validator.js';
import { FallbackParentResolver } from '../bch/fullstack-rest.js';

const txid = 'a'.repeat(64);
const transaction: BchTransaction = { txid, inputs: [], outputs: [] };

class Resolver implements ParentResolver {
  calls = 0;
  constructor(private readonly value: BchTransaction | null | Error) {}
  async getTransaction(): Promise<BchTransaction | null> {
    this.calls += 1;
    if (this.value instanceof Error) throw this.value;
    return this.value;
  }
}

test('uses primary transaction when available', async () => {
  const primary = new Resolver(transaction);
  const fallback = new Resolver(null);
  const resolver = new FallbackParentResolver(primary, fallback);

  assert.equal(await resolver.getTransaction(txid), transaction);
  assert.equal(primary.calls, 1);
  assert.equal(fallback.calls, 0);
});

test('falls back when primary misses', async () => {
  const primary = new Resolver(null);
  const fallback = new Resolver(transaction);
  const resolver = new FallbackParentResolver(primary, fallback);

  assert.equal(await resolver.getTransaction(txid), transaction);
  assert.equal(fallback.calls, 1);
});

test('falls back when primary errors', async () => {
  const primary = new Resolver(new Error('offline'));
  const fallback = new Resolver(transaction);
  const resolver = new FallbackParentResolver(primary, fallback);

  assert.equal(await resolver.getTransaction(txid), transaction);
  assert.equal(fallback.calls, 1);
});
