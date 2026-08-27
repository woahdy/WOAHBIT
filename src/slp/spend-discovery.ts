import type { Outpoint } from './types.js';

export interface OutpointSpend {
  txid: string;
  vin?: number;
}

/**
 * Read-only chain-index capability used to determine whether an outpoint has
 * been consumed anywhere in the BCH chain. Implementations may use an indexed
 * BCH node or another trusted chain index, but must not infer unspent status
 * from transaction ancestry alone.
 */
export interface SpendDiscoveryProvider {
  getSpend(outpoint: Outpoint): Promise<OutpointSpend | null>;
}
