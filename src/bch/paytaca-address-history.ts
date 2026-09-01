import { BchRpcError } from './adapter.js';

export interface AddressHistoryEntry {
  txid: string;
  height?: number;
}

export interface AddressHistoryProvider {
  getAddressHistory(address: string): Promise<AddressHistoryEntry[]>;
}

export interface PaytacaAddressHistoryProviderConfig {
  baseUrl?: string;
  timeoutMs?: number;
  pageSize?: number;
  maxPages?: number;
}

function normalizeTxid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(normalized) ? normalized : null;
}

function parseHistoryPayload(value: unknown): { entries: AddressHistoryEntry[]; hasMore: boolean } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BchRpcError('Paytaca BCH explorer returned an invalid address history payload');
  }

  const record = value as Record<string, unknown>;
  const candidates = Array.isArray(record.transactions)
    ? record.transactions
    : Array.isArray(record.txs)
      ? record.txs
      : Array.isArray(record.history)
        ? record.history
        : [];

  const entries: AddressHistoryEntry[] = [];
  for (const item of candidates) {
    if (typeof item === 'string') {
      const txid = normalizeTxid(item);
      if (txid) entries.push({ txid });
      continue;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const txid = normalizeTxid(row.txid ?? row.tx_hash ?? row.hash);
    if (!txid) continue;
    const height = typeof row.height === 'number' && Number.isInteger(row.height) ? row.height : undefined;
    entries.push(height === undefined ? { txid } : { txid, height });
  }

  const hasMore = record.has_more === true || record.hasMore === true || record.next_page != null || record.nextPage != null;
  return { entries, hasMore };
}

/** Read-only address transaction history backed by Paytaca's BCH explorer/Fulcrum index. */
export class PaytacaAddressHistoryProvider implements AddressHistoryProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly pageSize: number;
  private readonly maxPages: number;

  constructor(config: PaytacaAddressHistoryProviderConfig = {}) {
    this.baseUrl = (config.baseUrl ?? 'https://bchexplorer.info').replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? 15_000;
    this.pageSize = config.pageSize ?? 100;
    this.maxPages = config.maxPages ?? 100;
  }

  async getAddressHistory(address: string): Promise<AddressHistoryEntry[]> {
    const normalizedAddress = address.trim();
    if (!normalizedAddress) throw new BchRpcError('Address required');

    const byTxid = new Map<string, AddressHistoryEntry>();
    for (let page = 1; page <= this.maxPages; page += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const url = `${this.baseUrl}/api/bch/address/${encodeURIComponent(normalizedAddress)}/txs?page=${page}&limit=${this.pageSize}`;
        const response = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
        if (!response.ok) throw new BchRpcError(`Paytaca BCH explorer HTTP ${response.status}`);
        const { entries, hasMore } = parseHistoryPayload(await response.json());
        for (const entry of entries) byTxid.set(entry.txid, entry);
        if (entries.length < this.pageSize && !hasMore) break;
      } finally {
        clearTimeout(timer);
      }
    }

    return [...byTxid.values()];
  }
}
