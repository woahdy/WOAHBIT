import test from 'node:test';
import assert from 'node:assert/strict';
import { serverConfigFromEnvironment } from '../app/runtime.js';

test('builds server config from environment variables', () => {
  const config = serverConfigFromEnvironment({
    WOAHBIT_RPC_URL: 'http://127.0.0.1:8332',
    WOAHBIT_RPC_USERNAME: 'rpcuser',
    WOAHBIT_RPC_PASSWORD: 'rpcpass',
    PORT: '8080',
  });

  assert.deepEqual(config, {
    rpcUrl: 'http://127.0.0.1:8332',
    rpcUsername: 'rpcuser',
    rpcPassword: 'rpcpass',
    port: 8080,
  });
});

test('requires an RPC URL', () => {
  assert.throws(
    () => serverConfigFromEnvironment({}),
    /WOAHBIT_RPC_URL is required/,
  );
});

test('rejects invalid ports', () => {
  assert.throws(
    () => serverConfigFromEnvironment({ WOAHBIT_RPC_URL: 'http://localhost:8332', PORT: '70000' }),
    /PORT must be an integer between 1 and 65535/,
  );
});
