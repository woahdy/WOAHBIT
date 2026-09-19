import type { Outpoint } from '../slp/types.js';
import { BchRpcError } from './adapter.js';

export type UtxoCrossCheckState = 'unspent' | 'not-present' | 'indeterminate';

export interface UtxoCrossCheckResult {
  state: UtxoCrossCheckState;
  reason?: string;
}

export interface BlockbookUtxoCrossCheckConfig {
  /** Blockbook API root ending at /api/v2. */
  baseUrl: string;
  timeoutMs?: number;
  confirmedOnly?: boolean;
  /** Optional deployment-supplied authentication headers. Never commit credentials. */
  headers?: Readonly<Record<string, string>>;
}

interface BlockbookUtxo {
  txid?: unknown;
  vout?: unknown;
}

function validOutpoint(outpoint: Outpoint): boolean {
  return /^[0-9a-f]{64}$/i.test(outpoint.txid.trim()) && Number.isSafeInteger(outpoint.vout) && outpoint.vout >= 0;
}

/**
 * Independent, read-only UTXO-set cross-check using the standard Blockbook v2
 * address UTXO endpoint. Provider/network failures fail closed as indeterminate.
 */
export class BlockbookUtxoCrossCheckProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly confirmedOnly: boolean;
  private readonly headers: Readonly<Record<string, string>>;

  constructor(config: BlockbookUtxoCrossCheckConfig) {
    if (!config.baseUrl?.trim()) throw new BchRpcError('Blockbook UTXO base URL is required');
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? 15_000;
    this.confirmedOnly = config.confirmedOnly ?? false;
    this.headers = { ...(config.headers ?? {}) };
  }

  async check(address: string, outpoint: Outpoint): Promise<UtxoCrossCheckResult> {
    if (!address.trim() || !validOutpoint(outpoint)) return { state: 'indeterminate', reason: 'invalid query' };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const suffix = this.confirmedOnly ? '?confirmed=true' : '';
      const response = await fetch(`${this.baseUrl}/utxo/${encodeURIComponent(address.trim())}${suffix}`, {
        headers: { accept: 'application/json', ...this.headers },
        signal: controller.signal,
      });
      if (!response.ok) return { state: 'indeterminate', reason: `HTTP ${response.status}` };
      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) return { state: 'indeterminate', reason: 'invalid payload' };

      for (const item of payload as BlockbookUtxo[]) {
        if (!item || typeof item !== 'object') return { state: 'indeterminate', reason: 'invalid UTXO entry' };
        if (typeof item.txid !== 'string' || !Number.isSafeInteger(item.vout)) {
          return { state: 'indeterminate', reason: 'invalid UTXO entry' };
        }
        if (item.txid.toLowerCase() === outpoint.txid.trim().toLowerCase() && item.vout === outpoint.vout) {
          return { state: 'unspent' };
        }
      }
      return { state: 'not-present' };
    } catch (error) {
      return { state: 'indeterminate', reason: error instanceof Error ? error.message : String(error) };
    } finally {
      clearTimeout(timer);
    }
  }
}
