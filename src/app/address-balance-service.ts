import type { AddressHistoryProvider } from '../bch/paytaca-address-history.js';
import { cashAddressToLockingBytecode } from '../bch/cashaddr.js';
import { SlpRecoveryIndex } from '../slp/recovery-index.js';
import type { SpendDiscoveryProvider } from '../slp/spend-discovery.js';
import type { ParentResolver } from '../slp/validator.js';

export interface AddressSlpUtxo {
  txid: string;
  vout: number;
  tokenId: string;
  amount: string;
  valueSatoshis: string;
}

export interface AddressSlpBalance {
  tokenId: string;
  amount: string;
  utxos: AddressSlpUtxo[];
}

export interface AddressBalanceSummary {
  address: string;
  historyTransactions: number;
  validSlpTransactions: number;
  balances: AddressSlpBalance[];
}

/**
 * Read-only address-scoped SLP recovery.
 *
 * Transaction history is only used to discover candidate transactions. Ownership
 * is established independently by matching each validated token output's locking
 * bytecode to the CashAddr locking script, then chain-wide spend discovery proves
 * whether the output remains unspent.
 */
export class SlpAddressBalanceService {
  constructor(
    private readonly resolver: ParentResolver,
    private readonly historyProvider: AddressHistoryProvider,
    private readonly spendProvider: SpendDiscoveryProvider,
  ) {}

  async getBalances(address: string): Promise<AddressBalanceSummary> {
    const normalizedAddress = address.trim().toLowerCase();
    const lockingBytecodeHex = Buffer.from(cashAddressToLockingBytecode(normalizedAddress)).toString('hex');
    const history = await this.historyProvider.getAddressHistory(normalizedAddress);
    const index = new SlpRecoveryIndex(this.resolver);

    for (const entry of history) {
      await index.indexSeed(entry.txid);
    }

    await index.refreshSpends(this.spendProvider);
    const snapshot = index.snapshot();
    const owned = snapshot.outputs.filter((output) =>
      !output.isMintBaton
      && output.spentBy === null
      && output.lockingBytecodeHex === lockingBytecodeHex
      && output.amount > 0n
    );

    const grouped = new Map<string, { amount: bigint; utxos: AddressSlpUtxo[] }>();
    for (const output of owned) {
      const current = grouped.get(output.tokenId) ?? { amount: 0n, utxos: [] };
      current.amount += output.amount;
      current.utxos.push({
        txid: output.txid,
        vout: output.vout,
        tokenId: output.tokenId,
        amount: output.amount.toString(),
        valueSatoshis: output.valueSatoshis.toString(),
      });
      grouped.set(output.tokenId, current);
    }

    const balances = [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tokenId, value]) => ({
        tokenId,
        amount: value.amount.toString(),
        utxos: value.utxos.sort((a, b) => a.txid.localeCompare(b.txid) || a.vout - b.vout),
      }));

    return {
      address: normalizedAddress,
      historyTransactions: history.length,
      validSlpTransactions: snapshot.transactions.filter((transaction) => transaction.validSlp).length,
      balances,
    };
  }
}
