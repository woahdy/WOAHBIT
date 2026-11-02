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
  value?: unknown;
  spent?: unknown;
  confirmations?: unknown;
}

function validOutpoint(outpoint: Outpoint): boolean {
  return /^[0-9a-f]{64}$/i.test(outpoint.txid.trim()) && Number.isSafeInteger(outpoint.vout) && outpoint.vout >= 0 && outpoint.vout <= 0xffff_ffff;
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

  async check(address: string, outpoint: Outpoint, expectedValueSatoshis?: string): Promise<UtxoCrossCheckResult> {
    // Optional third argument is required by the live-survivor acceptance path.
    // A UTXO with the right outpoint but an inconsistent BCH value is not proof.
    const validExpectedValue = expectedValueSatoshis === undefined ||
      (typeof expectedValueSatoshis === 'string' &&
        /^(0|[1-9][0-9]*)$/.test(expectedValueSatoshis) &&
        BigInt(expectedValueSatoshis) <= 0xffff_ffff_ffff_ffffn);
    if (!address.trim() || !validOutpoint(outpoint) || !validExpectedValue) {
      return { state: 'indeterminate', reason: 'invalid query' };
    }

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

      // Inspect the entire response before accepting an outpoint. Returning
      // on the first match would ignore malformed later entries or a duplicate
      // of the same outpoint with contradictory evidence.
      let matched = false;
      for (const item of payload as BlockbookUtxo[]) {
        if (!item || typeof item !== 'object' ||
            typeof item.txid !== 'string' || !/^[0-9a-f]{64}$/i.test(item.txid) ||
            !Number.isSafeInteger(item.vout) || (item.vout as number) < 0 ||
            (item.vout as number) > 0xffff_ffff) {
          return { state: 'indeterminate', reason: 'invalid UTXO entry' };
        }
        if (item.txid.toLowerCase() === outpoint.txid.trim().toLowerCase() && item.vout === outpoint.vout) {
          if (matched) return { state: 'indeterminate', reason: 'duplicate independent UTXO outpoint' };
          matched = true;
          // The UTXO endpoint must not contradict its own unspent/confirmed claim.
          // A provider that ignores ?confirmed=true cannot establish a survivor.
          if (item.spent !== undefined && item.spent !== false) {
            return { state: 'indeterminate', reason: 'independent UTXO spent flag contradicts unspent status' };
          }
          if (this.confirmedOnly &&
              (!Number.isSafeInteger(item.confirmations) || (item.confirmations as number) < 1)) {
            return { state: 'indeterminate', reason: 'independent UTXO is not confirmed' };
          }
          if (expectedValueSatoshis !== undefined) {
            if (typeof item.value !== 'string' ||
                !/^(0|[1-9][0-9]*)$/.test(item.value) ||
                BigInt(item.value) > 0xffff_ffff_ffff_ffffn) {
              return { state: 'indeterminate', reason: 'invalid independent UTXO value' };
            }
            if (BigInt(item.value) !== BigInt(expectedValueSatoshis)) {
              return { state: 'indeterminate', reason: 'independent UTXO value mismatch' };
            }
          }
        }
      }
      return { state: matched ? 'unspent' : 'not-present' };
    } catch (error) {
      return { state: 'indeterminate', reason: error instanceof Error ? error.message : String(error) };
    } finally {
      clearTimeout(timer);
    }
  }
}
