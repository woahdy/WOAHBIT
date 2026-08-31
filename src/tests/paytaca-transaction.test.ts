import test from 'node:test';
import assert from 'node:assert/strict';
import { PaytacaTransactionResolver } from '../bch/paytaca-transaction.js';

const txid = 'a'.repeat(64);
const prevTxid = 'b'.repeat(64);

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('normalizes a Paytaca transaction payload', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input) => {
    assert.equal(String(input), `https://example.test/api/bch/tx/${txid}`);
    return response(200, {
      txid,
      vin: [{ txid: prevTxid, vout: 2 }],
      vout: [{ value: 0.00000546, scriptPubKey: { hex: '6a' } }],
    });
  };

  const resolver = new PaytacaTransactionResolver({ baseUrl: 'https://example.test/' });
  const transaction = await resolver.getTransaction(txid.toUpperCase());

  assert.deepEqual(transaction, {
    txid,
    inputs: [{ prevout: { txid: prevTxid, vout: 2 } }],
    outputs: [{ valueSatoshis: 546n, lockingBytecode: Uint8Array.from([0x6a]) }],
  });
});

test('returns null for a missing transaction', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => response(404, { error: 'not found' });

  const resolver = new PaytacaTransactionResolver({ baseUrl: 'https://example.test' });
  assert.equal(await resolver.getTransaction(txid), null);
});

test('rejects a mismatched response txid', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => response(200, { txid: 'c'.repeat(64), vin: [], vout: [] });

  const resolver = new PaytacaTransactionResolver({ baseUrl: 'https://example.test' });
  await assert.rejects(() => resolver.getTransaction(txid), /mismatched transaction id/);
});
