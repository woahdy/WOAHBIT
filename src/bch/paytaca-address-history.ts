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

function parseHistoryPayload(value: unknown, currentPage: number): { entries: AddressHistoryEntry[]; hasMore: boolean; explicitEnd: boolean } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BchRpcError('Paytaca BCH explorer returned an invalid address history payload');
  }

  const record = value as Record<string, unknown>;
  const key = (['transactions', 'txs', 'history'] as const)
    .find((candidate) => Object.prototype.hasOwnProperty.call(record, candidate));
  if (!key || !Array.isArray(record[key])) {
    throw new BchRpcError('Paytaca BCH explorer returned an invalid address history list');
  }
  const candidates = record[key] as unknown[];

  const entries: AddressHistoryEntry[] = [];
  for (const item of candidates) {
    if (typeof item === 'string') {
      const txid = normalizeTxid(item);
      if (!txid) throw new BchRpcError('Paytaca BCH explorer returned an invalid history txid');
      entries.push({ txid });
      continue;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new BchRpcError('Paytaca BCH explorer returned an invalid history entry');
    }
    const row = item as Record<string, unknown>;
    const txid = normalizeTxid(row.txid ?? row.tx_hash ?? row.hash);
    if (!txid) throw new BchRpcError('Paytaca BCH explorer returned an invalid history txid');
    const height = typeof row.height === 'number' && Number.isInteger(row.height) ? row.height : undefined;
    entries.push(height === undefined ? { txid } : { txid, height });
  }

  const hasSnakeMore = Object.prototype.hasOwnProperty.call(record, 'has_more');
  const hasCamelMore = Object.prototype.hasOwnProperty.call(record, 'hasMore');
  if (hasSnakeMore && hasCamelMore && record.has_more !== record.hasMore) {
    throw new BchRpcError('Paytaca BCH explorer returned contradictory pagination flags');
  }
  const moreFlag = hasSnakeMore ? record.has_more : record.hasMore;
  if ((hasSnakeMore || hasCamelMore) && typeof moreFlag !== 'boolean') {
    throw new BchRpcError('Paytaca BCH explorer returned an invalid pagination flag');
  }
  const hasSnakeNext = Object.prototype.hasOwnProperty.call(record, 'next_page');
  const hasCamelNext = Object.prototype.hasOwnProperty.call(record, 'nextPage');
  if (hasSnakeNext && hasCamelNext && record.next_page !== record.nextPage) {
    throw new BchRpcError('Paytaca BCH explorer returned contradictory next-page fields');
  }
  const nextPage = hasSnakeNext ? record.next_page : record.nextPage;
  if (moreFlag === false && nextPage != null && nextPage !== false) {
    throw new BchRpcError('Paytaca BCH explorer returned contradictory continuation metadata');
  }
  if (nextPage != null && nextPage !== false &&
      !(typeof nextPage === 'number' && Number.isSafeInteger(nextPage) && nextPage > 0) &&
      !(typeof nextPage === 'string' && nextPage.length > 0)) {
    throw new BchRpcError('Paytaca BCH explorer returned an invalid next page');
  }
  // This adapter requests numeric pages in order. A provider-supplied cursor or
  // nonsequential next-page hint must never be silently ignored: doing so can
  // omit transactions and understate SLP balances.
  if (moreFlag === true && nextPage === false) {
    throw new BchRpcError('Paytaca BCH explorer returned contradictory continuation metadata');
  }
  if (nextPage != null && nextPage !== false) {
    const nextPageNumber = typeof nextPage === 'number'
      ? nextPage
      : /^[1-9][0-9]*$/.test(nextPage) ? Number(nextPage) : NaN;
    if (!Number.isSafeInteger(nextPageNumber) || nextPageNumber !== currentPage + 1) {
      throw new BchRpcError('Paytaca BCH explorer returned an unsupported next-page cursor');
    }
  }
  const hasMore = moreFlag === true || (nextPage != null && nextPage !== false);
  if (hasMore && entries.length === 0) {
    throw new BchRpcError('Paytaca BCH explorer returned an empty continuation page');
  }
  // A full page does not imply another page when the explorer explicitly
  // declares completion. Without that declaration, keep probing and fail
  // closed at maxPages rather than silently truncating an exact-size page.
  const explicitEnd = moreFlag === false ||
    (moreFlag !== true && (hasSnakeNext || hasCamelNext) && (nextPage == null || nextPage === false));
  return { entries, hasMore, explicitEnd };
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
    for (const [name, value] of [['timeoutMs', this.timeoutMs], ['pageSize', this.pageSize], ['maxPages', this.maxPages]] as const) {
      if (!Number.isSafeInteger(value) || value <= 0) {
        throw new BchRpcError(`Invalid Paytaca address history ${name}`);
      }
    }
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
        const { entries, hasMore, explicitEnd } = parseHistoryPayload(await response.json(), page);
        for (const entry of entries) byTxid.set(entry.txid, entry);
        if (!hasMore && (explicitEnd || entries.length < this.pageSize)) return [...byTxid.values()];
      } finally {
        clearTimeout(timer);
      }
    }

    throw new BchRpcError('Paytaca BCH explorer address history pagination incomplete');
  }
}
