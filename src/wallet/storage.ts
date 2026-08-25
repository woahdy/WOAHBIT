import { chmod, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  decryptWalletSecret,
  encryptWalletSecret,
  type WalletSecretEnvelope,
} from './vault.js';

const STORAGE_VERSION = 1;
const FILE_MODE = 0o600;

export interface TreasuryWalletRecord {
  version: 1;
  kind: 'woahbit-treasury-secret';
  envelope: WalletSecretEnvelope;
}

function parseRecord(raw: string): TreasuryWalletRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Treasury wallet file is not valid JSON');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Treasury wallet file is invalid');
  }

  const record = parsed as Partial<TreasuryWalletRecord>;
  if (
    record.version !== STORAGE_VERSION ||
    record.kind !== 'woahbit-treasury-secret' ||
    !record.envelope ||
    typeof record.envelope !== 'object'
  ) {
    throw new Error('Unsupported treasury wallet file');
  }

  return record as TreasuryWalletRecord;
}

export async function treasuryWalletExists(path: string): Promise<boolean> {
  try {
    const handle = await open(path, 'r');
    await handle.close();
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

export async function saveTreasuryWalletSecret(
  path: string,
  secret: Uint8Array,
  encodedKey: string,
): Promise<void> {
  const record: TreasuryWalletRecord = {
    version: STORAGE_VERSION,
    kind: 'woahbit-treasury-secret',
    envelope: encryptWalletSecret(secret, encodedKey),
  };

  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  const serialized = `${JSON.stringify(record)}\n`;

  try {
    const handle = await open(temporaryPath, 'wx', FILE_MODE);
    try {
      await handle.writeFile(serialized, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }

    await rename(temporaryPath, path);
    await chmod(path, FILE_MODE);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function loadTreasuryWalletSecret(
  path: string,
  encodedKey: string,
): Promise<Uint8Array> {
  const record = parseRecord(await readFile(path, 'utf8'));
  return decryptWalletSecret(record.envelope, encodedKey);
}

export async function readTreasuryWalletRecord(
  path: string,
): Promise<TreasuryWalletRecord> {
  return parseRecord(await readFile(path, 'utf8'));
}
