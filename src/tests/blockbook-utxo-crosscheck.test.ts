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
  assert.equal(called, false);
});
