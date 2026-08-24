import type { BchTransaction } from '../slp/types.js';
import type { ParentResolver } from '../slp/validator.js';
import { BchRpcError, normalizeRpcTransaction } from './adapter.js';

export interface FullStackRestConfig {
  baseUrl: string;
  timeoutMs?: number;
}

type VerboseTransaction = Parameters<typeof normalizeRpcTransaction>[0];

function transactionPayload(value: unknown): VerboseTransaction {
  if (!value || typeof value !== 'object') {
    throw new BchRpcError('BCH REST returned an invalid transaction payload');
  }
  const record = value as Record<string, unknown>;
  const candidate = record.result && typeof record.result === 'object' ? record.result : record;
  return candidate as VerboseTransaction;
}

export class FullStackRestResolver implements ParentResolver {
  private readonly cache = new Map<string, BchTransaction | null>();

  constructor(private readonly config: FullStackRestConfig) {}

  async getTransaction(txid: string): Promise<BchTransaction | null> {
    const normalized = txid.toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) throw new BchRpcError('Invalid transaction id');
    if (this.cache.has(normalized)) return this.cache.get(normalized) ?? null;

    const baseUrl = this.config.baseUrl.replace(/\/+$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 15_000);
    try {
      const response = await fetch(
        `${baseUrl}/full-node/rawtransactions/getRawTransaction/${normalized}?verbose=true`,
        { headers: { accept: 'application/json' }, signal: controller.signal },
      );
      if (response.status === 404) {
        this.cache.set(normalized, null);
        return null;
      }
      if (!response.ok) throw new BchRpcError(`BCH REST HTTP ${response.status}`);
      const transaction = normalizeRpcTransaction(transactionPayload(await response.json()));
      this.cache.set(normalized, transaction);
      return transaction;
    } finally {
      clearTimeout(timer);
    }
  }
}

export class FallbackParentResolver implements ParentResolver {
  constructor(
    private readonly primary: ParentResolver,
    private readonly fallback: ParentResolver,
  ) {}

  async getTransaction(txid: string): Promise<BchTransaction | null> {
    try {
      const transaction = await this.primary.getTransaction(txid);
      if (transaction) return transaction;
    } catch {
      // Fall through to the read-only secondary provider.
    }
    return this.fallback.getTransaction(txid);
  }
}
