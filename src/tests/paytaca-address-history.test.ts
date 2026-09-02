import assert from 'node:assert/strict';
import test from 'node:test';
import { PaytacaAddressHistoryProvider } from '../bch/paytaca-address-history.js';

const tx1 = '11'.repeat(32);
const tx2 = '22'.repeat(32);

test('Paytaca address history normalizes and deduplicates transactions', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    calls.push(String(input));
    return new Response(JSON.stringify({
      transactions: [
        { txid: tx1.toUpperCase(), height: 900001 },
        { tx_hash: tx2, height: 900002 },
        { txid: tx1 },
      ],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    const provider = new PaytacaAddressHistoryProvider({ baseUrl: 'https://example.test', pageSize: 100 });
    const history = await provider.getAddressHistory('bitcoincash:qexample');
    assert.deepEqual(history, [
      { txid: tx1 },
      { txid: tx2, height: 900002 },
    ]);
    assert.equal(calls.length, 1);
    assert.match(calls[0], /\/api\/bch\/address\/bitcoincash%3Aqexample\/txs\?page=1&limit=100$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Paytaca address history follows explicit pagination', async () => {
  const originalFetch = globalThis.fetch;
  let page = 0;
  globalThis.fetch = (async () => {
    page += 1;
    const body = page === 1
      ? { transactions: [{ txid: tx1 }], has_more: true }
      : { transactions: [{ txid: tx2 }], has_more: false };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    const provider = new PaytacaAddressHistoryProvider({ baseUrl: 'https://example.test', pageSize: 100 });
    const history = await provider.getAddressHistory('bitcoincash:qexample');
    assert.deepEqual(history.map((entry) => entry.txid), [tx1, tx2]);
    assert.equal(page, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Paytaca address history rejects empty addresses', async () => {
  const provider = new PaytacaAddressHistoryProvider({ baseUrl: 'https://example.test' });
  await assert.rejects(() => provider.getAddressHistory('   '), /Address required/);
});
