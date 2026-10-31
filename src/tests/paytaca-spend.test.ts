import test from 'node:test';
import assert from 'node:assert/strict';
import { PaytacaSpendDiscoveryProvider } from '../bch/paytaca-spend.js';

const fundingTxid = 'a'.repeat(64);
const spendingTxid = 'b'.repeat(64);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('returns null only when the chain index explicitly reports an unspent output', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    return jsonResponse({ txid: fundingTxid, vout: 1, status: 'unspent', spent: false });
  };

  const provider = new PaytacaSpendDiscoveryProvider({ baseUrl: 'https://example.test/' });
  assert.equal(await provider.getSpend({ txid: fundingTxid, vout: 1 }), null);
  assert.deepEqual(urls, [`https://example.test/api/bch/txout/${fundingTxid}/1`]);
});

test('resolves the spending transaction and input index for spent outputs', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.endsWith('/spender')) return jsonResponse({ txid: spendingTxid.toUpperCase(), input_index: 3 });
    return jsonResponse({ txid: fundingTxid, vout: 2, status: 'spent', spent: true, spender: '' });
  };

  const provider = new PaytacaSpendDiscoveryProvider({ baseUrl: 'https://example.test' });
  assert.deepEqual(await provider.getSpend({ txid: fundingTxid, vout: 2 }), { txid: spendingTxid, vin: 3 });
  assert.deepEqual(urls, [
    `https://example.test/api/bch/txout/${fundingTxid}/2`,
    `https://example.test/api/bch/txout/${fundingTxid}/2/spender`,
  ]);
});

test('does not misreport a known-spent output as unspent when spender lookup fails', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async (input) => {
    if (String(input).endsWith('/spender')) return jsonResponse({ error: 'Spender not found' }, 404);
    return jsonResponse({ status: 'spent', spent: true });
  };

  const provider = new PaytacaSpendDiscoveryProvider({ baseUrl: 'https://example.test' });
  await assert.rejects(
    () => provider.getSpend({ txid: fundingTxid, vout: 0 }),
    /BCH spend index HTTP 404/,
  );
});

test('rejects invalid outpoints before making network requests', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return jsonResponse({});
  };

  const provider = new PaytacaSpendDiscoveryProvider({ baseUrl: 'https://example.test' });
  await assert.rejects(() => provider.getSpend({ txid: 'nope', vout: 0 }), /Invalid transaction id/);
  await assert.rejects(() => provider.getSpend({ txid: fundingTxid, vout: -1 }), /Invalid output index/);
  assert.equal(called, false);
});

test('fails closed when status and spent fields contradict each other', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const provider = new PaytacaSpendDiscoveryProvider({ baseUrl: 'https://example.test' });
  for (const status of [
    { spent: false, status: 'spent' },
    { spent: true, status: 'unspent' },
  ]) {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return jsonResponse(status); };
    await assert.rejects(
      () => provider.getSpend({ txid: fundingTxid, vout: 1 }),
      /contradictory output status/,
    );
    assert.equal(calls, 1, 'do not request a spender for inconsistent status');
  }
});

test('fails closed on mismatched outpoint identity or malformed status fields', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const provider = new PaytacaSpendDiscoveryProvider({ baseUrl: 'https://example.test' });
  for (const payload of [
    { txid: spendingTxid, vout: 1, spent: false },
    { txid: fundingTxid, vout: 2, spent: false },
    { spent: 'false', status: 'unspent' },
    { spent: false, status: 'unknown' },
    { status: 'unknown' },
    {},
  ]) {
    globalThis.fetch = async () => jsonResponse(payload);
    await assert.rejects(() => provider.getSpend({ txid: fundingTxid, vout: 1 }));
  }
});

test('accepts either consistent status field on its own', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const provider = new PaytacaSpendDiscoveryProvider({ baseUrl: 'https://example.test' });
  for (const payload of [{ spent: false }, { status: 'unspent' }]) {
    globalThis.fetch = async () => jsonResponse(payload);
    assert.equal(await provider.getSpend({ txid: fundingTxid, vout: 1 }), null);
  }
});
