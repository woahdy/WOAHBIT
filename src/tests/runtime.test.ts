import test from 'node:test';
import assert from 'node:assert/strict';
import { serverConfigFromEnvironment } from '../app/runtime.js';

test('builds server config from environment variables', () => {
  const config = serverConfigFromEnvironment({
    WOAHBIT_RPC_URL: 'http://127.0.0.1:8332',
    WOAHBIT_RPC_USERNAME: 'rpcuser',
    WOAHBIT_RPC_PASSWORD: 'rpcpass',
    WOAHBIT_RPC_TIMEOUT_MS: '12000',
    WOAHBIT_FALLBACK_API_URL: 'https://bch.fullstack.cash/v6/',
    WOAHBIT_WALLET_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    PORT: '8080',
  });

  assert.deepEqual(config, {
    rpcUrl: 'http://127.0.0.1:8332',
    rpcUsername: 'rpcuser',
    rpcPassword: 'rpcpass',
    rpcTimeoutMs: 12000,
    fallbackApiUrl: 'https://bch.fullstack.cash/v6/',
    walletVaultReady: true,
    port: 8080,
  });
});

test('uses safe runtime defaults', () => {
  const config = serverConfigFromEnvironment({
    WOAHBIT_RPC_URL: 'http://127.0.0.1:8332',
  });

  assert.equal(config.port, 3000);
  assert.equal(config.rpcTimeoutMs, 15000);
  assert.equal(config.fallbackApiUrl, undefined);
  assert.equal(config.walletVaultReady, false);
});

test('ignores an empty fallback API URL', () => {
  const config = serverConfigFromEnvironment({
    WOAHBIT_RPC_URL: 'http://127.0.0.1:8332',
    WOAHBIT_FALLBACK_API_URL: '   ',
  });
  assert.equal(config.fallbackApiUrl, undefined);
});

test('requires an RPC URL', () => {
  assert.throws(
    () => serverConfigFromEnvironment({}),
    /WOAHBIT_RPC_URL is required/,
  );
});

test('rejects invalid ports', () => {
  for (const port of ['70000', '3000abc', '0', '-1', '3.5']) {
    assert.throws(
      () => serverConfigFromEnvironment({ WOAHBIT_RPC_URL: 'http://localhost:8332', PORT: port }),
      /PORT must be an integer between 1 and 65535/,
    );
  }
});

test('rejects invalid RPC timeouts', () => {
  for (const timeout of ['999', '120001', '5000ms', '-1']) {
    assert.throws(
      () => serverConfigFromEnvironment({
        WOAHBIT_RPC_URL: 'http://localhost:8332',
        WOAHBIT_RPC_TIMEOUT_MS: timeout,
      }),
      /WOAHBIT_RPC_TIMEOUT_MS must be an integer between 1000 and 120000/,
    );
  }
});

test('rejects an invalid wallet encryption key at startup', () => {
  assert.throws(
    () => serverConfigFromEnvironment({
      WOAHBIT_RPC_URL: 'http://localhost:8332',
      WOAHBIT_WALLET_ENCRYPTION_KEY: 'not-a-valid-key',
    }),
    /WOAHBIT_WALLET_ENCRYPTION_KEY must be a base64-encoded 32-byte key/,
  );
});
