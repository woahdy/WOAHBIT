import { BchRpcError, type BchRpcConfig } from './adapter.js';

const TXID = /^[0-9a-f]{64}$/;
const MAX_RAW_TX_HEX_CHARS = 8_000_000;

export interface RawBchTransactionProvider {
  getRawTransactionHex(txid: string): Promise<string | null>;
}

/**
 * Fetch serialized BCH transaction bytes for independent CashTokens inspection.
 * This adapter is read-only; it never signs, constructs or broadcasts a transaction.
 */
export class BchRawTransactionRpcProvider implements RawBchTransactionProvider {
  constructor(
    private readonly config: BchRpcConfig,
    private readonly transport: typeof fetch = fetch,
  ) {
    if (typeof config.url !== 'string' || !config.url) {
      throw new BchRpcError('BCH RPC URL is required');
    }
    if (config.timeoutMs !== undefined &&
        (!Number.isSafeInteger(config.timeoutMs) || config.timeoutMs < 1 || config.timeoutMs > 120_000)) {
      throw new BchRpcError('BCH RPC timeout must be between 1 and 120000 milliseconds');
    }
  }

  async getRawTransactionHex(txid: string): Promise<string | null> {
    if (typeof txid !== 'string' || !TXID.test(txid)) {
      throw new BchRpcError('Invalid raw transaction id');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 15_000);
    try {
      const authorization = this.config.username === undefined ? undefined :
        `Basic ${Buffer.from(`${this.config.username}:${this.config.password ?? ''}`).toString('base64')}`;
      const response = await this.transport(this.config.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(authorization ? { authorization } : {}),
        },
        body: JSON.stringify({
          jsonrpc: '1.0',
          id: 'woahbit-raw-read',
          method: 'getrawtransaction',
          params: [txid, false],
        }),
        signal: controller.signal,
        redirect: 'error',
      });
      if (!response.ok) throw new BchRpcError(`BCH raw transaction RPC HTTP ${response.status}`);
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new BchRpcError('BCH raw transaction RPC returned invalid JSON');
      }
      const result = payload as { result?: unknown; error?: unknown };
      if (result.error != null) {
        if (result.result == null && typeof result.error === 'object' &&
            'code' in result.error && result.error.code === -5) return null;
        throw new BchRpcError('BCH raw transaction RPC returned an error');
      }
      if (typeof result.result !== 'string' || result.result.length === 0 ||
          result.result.length % 2 !== 0 || result.result.length > MAX_RAW_TX_HEX_CHARS ||
          !/^[0-9a-fA-F]+$/.test(result.result)) {
        throw new BchRpcError('BCH raw transaction RPC returned invalid raw hex');
      }
      return result.result.toLowerCase();
    } finally {
      clearTimeout(timer);
    }
  }
}
