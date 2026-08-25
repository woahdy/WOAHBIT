import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  loadTreasuryWalletSecret,
  readTreasuryWalletRecord,
  saveTreasuryWalletSecret,
  treasuryWalletExists,
} from '../wallet/storage.js';

const KEY = Buffer.alloc(32, 7).toString('base64');
const WRONG_KEY = Buffer.alloc(32, 8).toString('base64');

test('encrypted treasury storage round-trips without plaintext on disk', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'woahbit-wallet-'));
  const path = join(directory, 'treasury.wallet.json');
  const secret = Buffer.from('company treasury recovery material', 'utf8');

  assert.equal(await treasuryWalletExists(path), false);
  await saveTreasuryWalletSecret(path, secret, KEY);
  assert.equal(await treasuryWalletExists(path), true);

  const raw = await readFile(path, 'utf8');
  assert.equal(raw.includes(secret.toString('utf8')), false);

  const stored = await readTreasuryWalletRecord(path);
  assert.equal(stored.version, 1);
  assert.equal(stored.kind, 'woahbit-treasury-secret');
  assert.equal(stored.envelope.algorithm, 'aes-256-gcm');

  const recovered = await loadTreasuryWalletSecret(path, KEY);
  assert.equal(Buffer.from(recovered).toString('utf8'), secret.toString('utf8'));
  Buffer.from(recovered.buffer, recovered.byteOffset, recovered.byteLength).fill(0);

  const fileStat = await stat(path);
  assert.equal(fileStat.mode & 0o777, 0o600);
});

test('wrong encryption key cannot decrypt treasury storage', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'woahbit-wallet-'));
  const path = join(directory, 'treasury.wallet.json');

  await saveTreasuryWalletSecret(path, Buffer.from('secret'), KEY);
  await assert.rejects(() => loadTreasuryWalletSecret(path, WRONG_KEY));
});

test('malformed treasury wallet files are rejected before decryption', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'woahbit-wallet-'));
  const path = join(directory, 'treasury.wallet.json');

  await assert.rejects(() => loadTreasuryWalletSecret(path, KEY), /ENOENT/);
});
