import type { BchTransaction } from '../slp/types.js';
import type { ParentResolver } from '../slp/validator.js';
import { BchRpcError, normalizeRpcTransaction } from './adapter.js';

export interface PaytacaTransactionResolverConfig {
  baseUrl?: string;
  timeoutMs?: number;
}

type VerboseTransaction = Parameters<typeof normalizeRpcTransaction>[0];

function normalizeTxid(txid: string): string {
  const normalized = txid.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) throw new BchRpcError('Invalid transaction id');
  return normalized;
}

function transactionPayload(value: unknown): VerboseTransaction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BchRpcError('Paytaca BCH explorer returned an invalid transaction payload');
  }
  const record = value as Record<string, unknown>;
  const candidate = record.result && typeof record.result === 'object' && !Array.isArray(record.result)
    ? record.result
    : record;
  return candidate as VerboseTransaction;
}

/** Read-only transaction resolver backed by Paytaca's BCH explorer API. */
export class PaytacaTransactionResolver implements ParentResolver {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly cache = new Map<string, BchTransaction | null>();

  constructor(config: PaytacaTransactionResolverConfig = {}) {
    this.baseUrl = (config.baseUrl ?? 'https://bchexplorer.info').replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? 15_000;
  }

  async getTransaction(txid: string): Promise<BchTransaction | null> {
    const normalized = normalizeTxid(txid);
    if (this.cache.has(normalized)) return this.cache.get(normalized) ?? null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/api/bch/tx/${normalized}`, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      if (response.status === 404) {
        this.cache.set(normalized, null);
        return null;
      }
      if (!response.ok) throw new BchRpcError(`Paytaca BCH explorer HTTP ${response.status}`);

      const transaction = normalizeRpcTransaction(transactionPayload(await response.json()));
      if (transaction.txid !== normalized) {
        throw new BchRpcError('Paytaca BCH explorer returned a mismatched transaction id');
      }
      this.cache.set(normalized, transaction);
      return transaction;
    } finally {
      clearTimeout(timer);
    }
  }
}
