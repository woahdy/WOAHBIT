import test from 'node:test';
import assert from 'node:assert/strict';
import { BchRawTransactionRpcProvider } from '../bch/raw-transaction-rpc.js';

const txid = 'ab'.repeat(32);

function mocked(response: unknown, status = 200) {
  const requests: { url: string; init: RequestInit }[] = [];
  const transport = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init: init ?? {} });
    return Response.json(response, { status });
  }) as typeof fetch;
  return { transport, requests };
}

test('requests nonverbose BCH raw bytes without signing or broadcasting', async () => {
  const { transport, requests } = mocked({ result: '00AABB', error: null });
  const source = new BchRawTransactionRpcProvider({ url: 'https://rpc.example' }, transport);
  assert.equal(await source.getRawTransactionHex(txid), '00aabb');
  assert.equal(requests.length, 1);
  assert.equal(requests[0]!.init.redirect, 'error');
  const body = JSON.parse(String(requests[0]!.init.body));
  assert.equal(body.method, 'getrawtransaction');
  assert.deepEqual(body.params, [txid, false]);
});

test('returns null only for RPC transaction-not-found error', async () => {
  const { transport } = mocked({ result: null, error: { code: -5, message: 'not found' } });
  assert.equal(await new BchRawTransactionRpcProvider({ url: 'https://rpc.example' }, transport)
    .getRawTransactionHex(txid), null);
  const inconsistent = mocked({ result: '00', error: { code: -5 } });
  await assert.rejects(new BchRawTransactionRpcProvider({ url: 'https://rpc.example' }, inconsistent.transport)
    .getRawTransactionHex(txid));
});

test('rejects malformed hex, missing results, errors, and HTTP failures', async () => {
  for (const payload of [{ result: 'zz' }, { result: 'abc' }, { result: '' }, { result: 12 },
    { result: null }, { error: { code: -1, message: 'upstream error' } }]) {
    const { transport } = mocked(payload);
    await assert.rejects(new BchRawTransactionRpcProvider({ url: 'https://rpc.example' }, transport)
      .getRawTransactionHex(txid));
  }
  const { transport } = mocked({ result: '00' }, 503);
  await assert.rejects(new BchRawTransactionRpcProvider({ url: 'https://rpc.example' }, transport)
    .getRawTransactionHex(txid), /HTTP 503/);
});

test('rejects invalid txids and unsafe timeout configuration', async () => {
  const { transport, requests } = mocked({ result: '00' });
  const source = new BchRawTransactionRpcProvider({ url: 'https://rpc.example' }, transport);
  await assert.rejects(source.getRawTransactionHex(txid.toUpperCase()));
  await assert.rejects(source.getRawTransactionHex('a'));
  assert.equal(requests.length, 0);
  assert.throws(() => new BchRawTransactionRpcProvider({ url: 'https://rpc.example', timeoutMs: 0 }, transport));
  assert.throws(() => new BchRawTransactionRpcProvider({ url: '', timeoutMs: 100 }, transport));
});
