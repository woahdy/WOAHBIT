import type { BchTransaction } from '../slp/types.js';
import type { ParentResolver } from '../slp/validator.js';

interface RpcInput { txid?: string; vout?: number }
interface RpcOutput { value: number | string; scriptPubKey?: { hex?: string } }
interface RpcTransaction { txid: string; vin: RpcInput[]; vout: RpcOutput[] }
interface RpcResponse<T> { result?: T; error?: { code: number; message: string } | null }

export interface BchRpcConfig {
  url: string;
  username?: string;
  password?: string;
  timeoutMs?: number;
}

export class BchRpcError extends Error {}

function sats(value: number | string): bigint {
  const text = String(value);
  const [wholeRaw, fractionRaw = ''] = text.split('.');
  const whole = wholeRaw || '0';
  const fraction = fractionRaw.padEnd(8, '0').slice(0, 8);
  if (!/^-?\d+$/.test(whole) || !/^\d{8}$/.test(fraction)) throw new BchRpcError(`Invalid BCH amount: ${text}`);
  const negative = whole.startsWith('-');
  const absoluteWhole = negative ? whole.slice(1) : whole;
  const result = BigInt(absoluteWhole || '0') * 100_000_000n + BigInt(fraction);
  return negative ? -result : result;
}

function bytecode(hex: string | undefined): Uint8Array {
  if (!hex) return new Uint8Array();
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) throw new BchRpcError('Invalid locking bytecode hex');
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

export function normalizeRpcTransaction(tx: RpcTransaction): BchTransaction {
  if (!/^[0-9a-fA-F]{64}$/.test(tx.txid)) throw new BchRpcError('RPC transaction has an invalid txid');
  return {
    txid: tx.txid.toLowerCase(),
    inputs: tx.vin.flatMap((input) => {
      if (!input.txid || input.vout === undefined) return [];
      return [{ prevout: { txid: input.txid.toLowerCase(), vout: input.vout } }];
    }),
    outputs: tx.vout.map((output) => ({
      valueSatoshis: sats(output.value),
      lockingBytecode: bytecode(output.scriptPubKey?.hex),
    })),
  };
}

export class BchJsonRpcResolver implements ParentResolver {
  private id = 0;
  private readonly cache = new Map<string, BchTransaction | null>();

  constructor(private readonly config: BchRpcConfig) {}

  async getTransaction(txid: string): Promise<BchTransaction | null> {
    const normalized = txid.toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) throw new BchRpcError('Invalid transaction id');
    if (this.cache.has(normalized)) return this.cache.get(normalized) ?? null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 15_000);
    const credentials = this.config.username === undefined ? undefined : Buffer.from(`${this.config.username}:${this.config.password ?? ''}`).toString('base64');
    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(credentials ? { authorization: `Basic ${credentials}` } : {}),
        },
        body: JSON.stringify({ jsonrpc: '1.0', id: ++this.id, method: 'getrawtransaction', params: [normalized, true] }),
        signal: controller.signal,
      });
      if (!response.ok) throw new BchRpcError(`BCH RPC HTTP ${response.status}`);
      const payload = await response.json() as RpcResponse<RpcTransaction>;
      if (payload.error) {
        if (payload.error.code === -5) {
          this.cache.set(normalized, null);
          return null;
        }
        throw new BchRpcError(`BCH RPC ${payload.error.code}: ${payload.error.message}`);
      }
      if (!payload.result) throw new BchRpcError('BCH RPC returned no transaction');
      const transaction = normalizeRpcTransaction(payload.result);
      this.cache.set(normalized, transaction);
      return transaction;
    } finally {
      clearTimeout(timer);
    }
  }
}
