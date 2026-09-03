import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createWoahbitServer } from '../app/server.js';

test('address balance endpoint rejects invalid CashAddr before querying upstream services', async () => {
  const server = createWoahbitServer({
    rpcUrl: 'http://127.0.0.1:1',
    rpcTimeoutMs: 50,
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/balances/not-a-cashaddr`);
    const body = await response.json() as { error?: string; message?: string };

    assert.equal(response.status, 400);
    assert.equal(body.error, 'Invalid CashAddr address');
    assert.match(body.message ?? '', /CashAddr/i);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
