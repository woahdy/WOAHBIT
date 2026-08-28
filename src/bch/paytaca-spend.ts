import type { Outpoint } from '../slp/types.js';
import type { OutpointSpend, SpendDiscoveryProvider } from '../slp/spend-discovery.js';
import { BchRpcError } from './adapter.js';

export interface PaytacaSpendDiscoveryConfig {
  baseUrl?: string;
  timeoutMs?: number;
}

interface TxOutStatusPayload {
  txid?: unknown;
  vout?: unknown;
  status?: unknown;
  spent?: unknown;
}

interface SpenderPayload {
  txid?: unknown;
  input_index?: unknown;
}

function normalizeTxid(txid: string): string {
  const normalized = txid.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) throw new BchRpcError('Invalid transaction id');
  return normalized;
}

function validateVout(vout: number): number {
  if (!Number.isSafeInteger(vout) || vout < 0) throw new BchRpcError('Invalid output index');
  return vout;
}

function payloadRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BchRpcError('BCH spend index returned an invalid payload');
  }
  return value as Record<string, unknown>;
}

/**
 * Read-only SpendDiscoveryProvider backed by Paytaca's BCH explorer API.
 *
 * The adapter deliberately checks output status before asking for a spender.
 * A provider failure to identify a spender for a known-spent output is treated
 * as an error rather than being misreported as an unspent token output.
 */
export class PaytacaSpendDiscoveryProvider implements SpendDiscoveryProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: PaytacaSpendDiscoveryConfig = {}) {
    this.baseUrl = (config.baseUrl ?? 'https://bchexplorer.info').replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? 15_000;
  }

  async getSpend(outpoint: Outpoint): Promise<OutpointSpend | null> {
    const txid = normalizeTxid(outpoint.txid);
    const vout = validateVout(outpoint.vout);
    const status = await this.fetchJson(`${this.baseUrl}/api/bch/txout/${txid}/${vout}`) as TxOutStatusPayload;

    if (status.spent === false || status.status === 'unspent') return null;
    if (status.spent !== true && status.status !== 'spent') {
      throw new BchRpcError('BCH spend index returned an unknown output status');
    }

    const spender = await this.fetchJson(`${this.baseUrl}/api/bch/txout/${txid}/${vout}/spender`) as SpenderPayload;
    if (typeof spender.txid !== 'string') {
      throw new BchRpcError('BCH spend index did not identify the spending transaction');
    }

    const spendingTxid = normalizeTxid(spender.txid);
    const vin = typeof spender.input_index === 'number' && Number.isSafeInteger(spender.input_index) && spender.input_index >= 0
      ? spender.input_index
      : undefined;
    return vin === undefined ? { txid: spendingTxid } : { txid: spendingTxid, vin };
  }

  private async fetchJson(url: string): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new BchRpcError(`BCH spend index HTTP ${response.status}`);
      return payloadRecord(await response.json());
    } finally {
      clearTimeout(timer);
    }
  }
}
