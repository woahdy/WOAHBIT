import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createWoahbitServer } from '../app/server.js';

test('token metadata endpoint rejects an invalid canonical token id before querying upstream services', async () => {
  const server = createWoahbitServer({
    rpcUrl: 'http://127.0.0.1:1',
    rpcTimeoutMs: 50,
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/tokens/not-a-token-id`);
    const body = await response.json() as {
      tokenId?: string;
      validSlpGenesis?: boolean;
      identityBasis?: string;
      reason?: string;
    };

    assert.equal(response.status, 400);
    assert.equal(body.tokenId, 'not-a-token-id');
    assert.equal(body.validSlpGenesis, false);
    assert.equal(body.identityBasis, 'canonical-token-id');
    assert.equal(body.reason, 'Invalid token id');
  } finally {
    server.close();
    await once(server, 'close');
  }
});
