import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const AAD = Buffer.from('WOAHBIT treasury wallet secret v1', 'utf8');
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface WalletSecretEnvelope {
  version: 1;
  algorithm: typeof ALGORITHM;
  iv: string;
  ciphertext: string;
  authenticationTag: string;
}

function decodeBase64(name: string, value: string, expectedLength?: number): Buffer {
  if (!value || Buffer.from(value, 'base64').toString('base64') !== value) {
    throw new Error(`${name} must be canonical base64`);
  }
  const decoded = Buffer.from(value, 'base64');
  if (expectedLength !== undefined && decoded.length !== expectedLength) {
    decoded.fill(0);
    throw new Error(`${name} must decode to ${expectedLength} bytes`);
  }
  return decoded;
}

export function parseWalletEncryptionKey(encodedKey: string): Buffer {
  const trimmed = encodedKey.trim();
  if (!/^[A-Za-z0-9+/]{43}=$/.test(trimmed)) {
    throw new Error('WOAHBIT_WALLET_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }
  try {
    return decodeBase64('WOAHBIT_WALLET_ENCRYPTION_KEY', trimmed, KEY_BYTES);
  } catch {
    throw new Error('WOAHBIT_WALLET_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }
}

export function encryptWalletSecret(
  secret: Uint8Array,
  encodedKey: string,
): WalletSecretEnvelope {
  if (secret.length === 0) {
    throw new Error('Wallet secret must not be empty');
  }

  const key = parseWalletEncryptionKey(encodedKey);
  const iv = randomBytes(IV_BYTES);
  const plaintext = Buffer.from(secret);
  try {
    const cipher = createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(AAD);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authenticationTag = cipher.getAuthTag();
    return {
      version: 1,
      algorithm: ALGORITHM,
      iv: iv.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
      authenticationTag: authenticationTag.toString('base64'),
    };
  } finally {
    key.fill(0);
    plaintext.fill(0);
  }
}

export function decryptWalletSecret(
  envelope: WalletSecretEnvelope,
  encodedKey: string,
): Uint8Array {
  if (envelope.version !== 1 || envelope.algorithm !== ALGORITHM) {
    throw new Error('Unsupported wallet secret envelope');
  }

  const key = parseWalletEncryptionKey(encodedKey);
  const iv = decodeBase64('Wallet secret IV', envelope.iv, IV_BYTES);
  const ciphertext = decodeBase64('Wallet secret ciphertext', envelope.ciphertext);
  const authenticationTag = decodeBase64(
    'Wallet secret authentication tag',
    envelope.authenticationTag,
    TAG_BYTES,
  );

  let plaintext: Buffer | undefined;
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(AAD);
    decipher.setAuthTag(authenticationTag);
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return Uint8Array.from(plaintext);
  } finally {
    key.fill(0);
    iv.fill(0);
    ciphertext.fill(0);
    authenticationTag.fill(0);
    plaintext?.fill(0);
  }
}
