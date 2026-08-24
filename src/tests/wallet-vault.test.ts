import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptWalletSecret,
  encryptWalletSecret,
  parseWalletEncryptionKey,
  type WalletSecretEnvelope,
} from '../wallet/vault.js';

const encryptionKey = Buffer.alloc(32, 7).toString('base64');
const differentKey = Buffer.alloc(32, 8).toString('base64');
const walletSecret = Buffer.from(
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  'utf8',
);

test('encrypts and decrypts a wallet secret', () => {
  const envelope = encryptWalletSecret(walletSecret, encryptionKey);

  assert.equal(envelope.version, 1);
  assert.equal(envelope.algorithm, 'aes-256-gcm');
  assert.notEqual(envelope.ciphertext, walletSecret.toString('base64'));
  assert.deepEqual(
    decryptWalletSecret(envelope, encryptionKey),
    Uint8Array.from(walletSecret),
  );
});

test('uses a fresh nonce for every encrypted wallet secret', () => {
  const first = encryptWalletSecret(walletSecret, encryptionKey);
  const second = encryptWalletSecret(walletSecret, encryptionKey);

  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
});

test('rejects modified encrypted wallet secrets', () => {
  const envelope = encryptWalletSecret(walletSecret, encryptionKey);
  const tag = Buffer.from(envelope.authenticationTag, 'base64');
  tag[0] ^= 1;
  const modified: WalletSecretEnvelope = {
    ...envelope,
    authenticationTag: tag.toString('base64'),
  };

  assert.throws(() => decryptWalletSecret(modified, encryptionKey));
});

test('rejects decryption with a different key', () => {
  const envelope = encryptWalletSecret(walletSecret, encryptionKey);

  assert.throws(() => decryptWalletSecret(envelope, differentKey));
});

test('requires an exact 32-byte base64 encryption key', () => {
  for (const key of ['', 'not-base64', Buffer.alloc(31).toString('base64')]) {
    assert.throws(
      () => parseWalletEncryptionKey(key),
      /WOAHBIT_WALLET_ENCRYPTION_KEY must be a base64-encoded 32-byte key/,
    );
  }
});

test('rejects an empty wallet secret', () => {
  assert.throws(
    () => encryptWalletSecret(new Uint8Array(), encryptionKey),
    /Wallet secret must not be empty/,
  );
});
