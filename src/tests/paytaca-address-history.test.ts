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

test('Paytaca address history accepts a genuine empty history', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ transactions: [] }), { status: 200 })) as typeof fetch;
  try {
    const provider = new PaytacaAddressHistoryProvider({ baseUrl: 'https://example.test' });
    assert.deepEqual(await provider.getAddressHistory('bitcoincash:qexample'), []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Paytaca address history rejects missing or malformed history lists', async () => {
  const originalFetch = globalThis.fetch;
  for (const payload of [{ status: 'ok' }, { transactions: 'not-an-array' }, { transactions: [{ height: 123 }] }]) {
    globalThis.fetch = (async () => new Response(JSON.stringify(payload), { status: 200 })) as typeof fetch;
    try {
      const provider = new PaytacaAddressHistoryProvider({ baseUrl: 'https://example.test' });
      await assert.rejects(() => provider.getAddressHistory('bitcoincash:qexample'), /invalid address history list|invalid history txid/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
});

test('Paytaca address history rejects malformed pagination flags', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ transactions: [{ txid: tx1 }], has_more: 'false' }), { status: 200 })) as typeof fetch;
  try {
    const provider = new PaytacaAddressHistoryProvider({ baseUrl: 'https://example.test' });
    await assert.rejects(() => provider.getAddressHistory('bitcoincash:qexample'), /invalid pagination flag/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Paytaca address history rejects truncated history at the page limit', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ transactions: [{ txid: tx1 }] }), { status: 200 })) as typeof fetch;
  try {
    const provider = new PaytacaAddressHistoryProvider({ baseUrl: 'https://example.test', pageSize: 1, maxPages: 1 });
    await assert.rejects(() => provider.getAddressHistory('bitcoincash:qexample'), /pagination incomplete/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Paytaca address history follows a full page to a terminal empty page', async () => {
  const originalFetch = globalThis.fetch;
  let pages = 0;
  globalThis.fetch = (async () => {
    pages += 1;
    return new Response(JSON.stringify({ transactions: pages === 1 ? [{ txid: tx1 }] : [] }), { status: 200 });
  }) as typeof fetch;
  try {
    const provider = new PaytacaAddressHistoryProvider({ baseUrl: 'https://example.test', pageSize: 1, maxPages: 2 });
    assert.deepEqual((await provider.getAddressHistory('bitcoincash:qexample')).map((entry) => entry.txid), [tx1]);
    assert.equal(pages, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Paytaca address history rejects impossible pagination configuration', () => {
  for (const config of [{ pageSize: 0 }, { maxPages: -1 }, { timeoutMs: NaN }, { pageSize: 1.5 }]) {
    assert.throws(() => new PaytacaAddressHistoryProvider(config), /Invalid Paytaca address history/);
  }
});

test('Paytaca address history rejects conflicting pagination aliases and metadata', async () => {
  const originalFetch = globalThis.fetch;
  const payloads = [
    { transactions: [{ txid: tx1 }], has_more: false, hasMore: true },
    { transactions: [{ txid: tx1 }], has_more: null },
    { transactions: [{ txid: tx1 }], next_page: false, nextPage: 2 },
    { transactions: [{ txid: tx1 }], has_more: false, next_page: 2 },
  ];
  try {
    for (const payload of payloads) {
      globalThis.fetch = (async () => Response.json(payload)) as typeof fetch;
      const provider = new PaytacaAddressHistoryProvider({ baseUrl: 'https://example.test' });
      await assert.rejects(
        () => provider.getAddressHistory('bitcoincash:qexample'),
        /contradictory|invalid pagination flag/,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Paytaca address history accepts consistent pagination aliases', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({
    transactions: [{ txid: tx1 }],
    has_more: false, hasMore: false,
    next_page: null, nextPage: null,
  })) as typeof fetch;
  try {
    const provider = new PaytacaAddressHistoryProvider({ baseUrl: 'https://example.test' });
    assert.deepEqual((await provider.getAddressHistory('bitcoincash:qexample')).map((entry) => entry.txid), [tx1]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Paytaca address history accepts matching numeric and decimal-string next pages', async () => {
  const originalFetch = globalThis.fetch;
  let pages = 0;
  globalThis.fetch = (async () => {
    pages += 1;
    return Response.json(pages === 1
      ? { transactions: [{ txid: tx1 }], next_page: '2' }
      : { transactions: [{ txid: tx2 }], next_page: null });
  }) as typeof fetch;
  try {
    const provider = new PaytacaAddressHistoryProvider({ baseUrl: 'https://example.test' });
    assert.deepEqual((await provider.getAddressHistory('bitcoincash:qexample')).map((x) => x.txid), [tx1, tx2]);
    assert.equal(pages, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Paytaca address history rejects skipped pages and opaque cursors', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const next_page of [3, '3', 'opaque-cursor', '02', Number.MAX_SAFE_INTEGER]) {
      globalThis.fetch = (async () => Response.json({ transactions: [{ txid: tx1 }], next_page })) as typeof fetch;
      const provider = new PaytacaAddressHistoryProvider({ baseUrl: 'https://example.test' });
      await assert.rejects(() => provider.getAddressHistory('bitcoincash:qexample'), /unsupported next-page cursor/);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Paytaca address history rejects contradictory true continuation with false next page', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({ transactions: [{ txid: tx1 }], has_more: true, next_page: false })) as typeof fetch;
  try {
    const provider = new PaytacaAddressHistoryProvider({ baseUrl: 'https://example.test' });
    await assert.rejects(() => provider.getAddressHistory('bitcoincash:qexample'), /contradictory continuation metadata/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('Paytaca address history accepts explicitly terminal exact-size page', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  try {
    for (const terminalMetadata of [{ has_more: false }, { next_page: null }, { nextPage: false }]) {
      requests = 0;
      globalThis.fetch = (async () => {
        requests += 1;
        return Response.json({ transactions: [{ txid: tx1 }], ...terminalMetadata });
      }) as typeof fetch;
      const provider = new PaytacaAddressHistoryProvider({ baseUrl: 'https://example.test', pageSize: 1, maxPages: 1 });
      assert.deepEqual((await provider.getAddressHistory('bitcoincash:qexample')).map((x) => x.txid), [tx1]);
      assert.equal(requests, 1);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Paytaca address history still rejects ambiguous exact-size page at limit', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({ transactions: [{ txid: tx1 }] })) as typeof fetch;
  try {
    const provider = new PaytacaAddressHistoryProvider({ baseUrl: 'https://example.test', pageSize: 1, maxPages: 1 });
    await assert.rejects(() => provider.getAddressHistory('bitcoincash:qexample'), /pagination incomplete/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
