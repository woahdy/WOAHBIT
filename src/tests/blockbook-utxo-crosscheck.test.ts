import test from 'node:test';
import assert from 'node:assert/strict';
import { BlockbookUtxoCrossCheckProvider } from '../bch/blockbook-utxo-crosscheck.js';

const txid = 'a'.repeat(64);
const address = 'bitcoincash:qptest';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('confirms an exact address-scoped outpoint present in the independent UTXO set', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => jsonResponse([{ txid: txid.toUpperCase(), vout: 2, value: '546' }]);

  const provider = new BlockbookUtxoCrossCheckProvider({ baseUrl: 'https://example.test/api/v2/' });
  assert.deepEqual(await provider.check(address, { txid, vout: 2 }), { state: 'unspent' });
});

test('sends deployment-configured headers without putting credentials in the URL', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let seenUrl = '';
  let seenHeaders: Headers | undefined;
  globalThis.fetch = async (input, init) => {
    seenUrl = String(input);
    seenHeaders = new Headers(init?.headers);
    return jsonResponse([{ txid, vout: 2 }]);
  };

  const provider = new BlockbookUtxoCrossCheckProvider({
    baseUrl: 'https://example.test/api/v2',
    headers: { 'api-key': 'deployment-secret' },
  });
  assert.deepEqual(await provider.check(address, { txid, vout: 2 }), { state: 'unspent' });
  assert.equal(seenHeaders?.get('api-key'), 'deployment-secret');
  assert.equal(seenUrl.includes('deployment-secret'), false);
});

test('reports not-present only for a valid successful UTXO-set response', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => jsonResponse([{ txid: 'b'.repeat(64), vout: 0 }]);

  const provider = new BlockbookUtxoCrossCheckProvider({ baseUrl: 'https://example.test/api/v2' });
  assert.deepEqual(await provider.check(address, { txid, vout: 2 }), { state: 'not-present' });
});

test('fails closed on HTTP errors and malformed payloads', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const provider = new BlockbookUtxoCrossCheckProvider({ baseUrl: 'https://example.test/api/v2' });

  globalThis.fetch = async () => jsonResponse({ error: 'down' }, 503);
  assert.deepEqual(await provider.check(address, { txid, vout: 0 }), { state: 'indeterminate', reason: 'HTTP 503' });

  globalThis.fetch = async () => jsonResponse({ utxos: [] });
  assert.deepEqual(await provider.check(address, { txid, vout: 0 }), { state: 'indeterminate', reason: 'invalid payload' });

  globalThis.fetch = async () => jsonResponse([{ txid, vout: '0' }]);
  assert.deepEqual(await provider.check(address, { txid, vout: 0 }), { state: 'indeterminate', reason: 'invalid UTXO entry' });
});

test('fails closed on invalid query input without a network request', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let called = false;
  globalThis.fetch = async () => { called = true; return jsonResponse([]); };

  const provider = new BlockbookUtxoCrossCheckProvider({ baseUrl: 'https://example.test/api/v2' });
  assert.deepEqual(await provider.check('', { txid, vout: 0 }), { state: 'indeterminate', reason: 'invalid query' });
  assert.deepEqual(await provider.check(address, { txid: 'bad', vout: 0 }), { state: 'indeterminate', reason: 'invalid query' });
  assert.deepEqual(await provider.check(address, { txid, vout: 0x1_0000_0000 }), { state: 'indeterminate', reason: 'invalid query' });
  assert.equal(called, false);
});

test('requires independent BCH satoshi value to match the validated output', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let payload: unknown = [{ txid, vout: 2, value: '546' }];
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return jsonResponse(payload); };
  const provider = new BlockbookUtxoCrossCheckProvider({ baseUrl: 'https://example.test/api/v2' });

  assert.deepEqual(await provider.check(address, { txid, vout: 2 }, '546'), { state: 'unspent' });
  assert.deepEqual(await provider.check(address, { txid, vout: 2 }, '547'),
    { state: 'indeterminate', reason: 'independent UTXO value mismatch' });
  payload = [{ txid, vout: 2 }];
  assert.deepEqual(await provider.check(address, { txid, vout: 2 }, '546'),
    { state: 'indeterminate', reason: 'invalid independent UTXO value' });
  payload = [{ txid, vout: 2, value: 'not-a-number' }];
  assert.deepEqual(await provider.check(address, { txid, vout: 2 }, '546'),
    { state: 'indeterminate', reason: 'invalid independent UTXO value' });
  const before = calls;
  assert.deepEqual(await provider.check(address, { txid, vout: 2 }, '546.0'),
    { state: 'indeterminate', reason: 'invalid query' });
  assert.equal(calls, before, 'invalid expected BCH value must not reach the provider');
});


test('fails closed on duplicate matching outpoints even if the first value agrees', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => jsonResponse([
    { txid, vout: 2, value: '546' },
    { txid: txid.toUpperCase(), vout: 2, value: '547' },
  ]);
  const provider = new BlockbookUtxoCrossCheckProvider({ baseUrl: 'https://example.test/api/v2' });
  assert.deepEqual(await provider.check(address, { txid, vout: 2 }, '546'),
    { state: 'indeterminate', reason: 'duplicate independent UTXO outpoint' });
});

test('does not accept a matching outpoint before validating all provider entries', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let payload: unknown = [];
  globalThis.fetch = async () => jsonResponse(payload);
  const provider = new BlockbookUtxoCrossCheckProvider({ baseUrl: 'https://example.test/api/v2' });

  for (const invalid of [
    { txid: 'not-a-txid', vout: 0 },
    { txid: 'b'.repeat(64), vout: -1 },
    { txid: 'b'.repeat(64), vout: 0x1_0000_0000 },
    { txid: 'b'.repeat(64), vout: '0' },
    null,
  ]) {
    payload = [{ txid, vout: 2, value: '546' }, invalid];
    assert.deepEqual(await provider.check(address, { txid, vout: 2 }, '546'),
      { state: 'indeterminate', reason: 'invalid UTXO entry' });
  }
});
