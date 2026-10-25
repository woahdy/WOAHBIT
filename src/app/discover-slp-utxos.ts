import { SlpAddressBalanceService } from './address-balance-service.js';
import { formatSlpAmount } from './token-metadata-service.js';
import type { AddressHistoryProvider } from '../bch/paytaca-address-history.js';
import type { SpendDiscoveryProvider } from '../slp/spend-discovery.js';
import type { ParentResolver } from '../slp/validator.js';

export interface DiscoveredSlpUtxo {
  cashaddr: string;
  txid: string;
  vout: number;
  tokenId: string;
  amount: string;
  displayAmount: string;
  decimals: number | null;
  valueSatoshis: string;
}

/**
 * Discover validator-proven, address-owned, currently-unspent SLP outputs.
 *
 * This is intentionally read-only and delegates ownership, recursive SLP
 * validation, and fail-closed spend discovery to SlpAddressBalanceService.
 */
export async function discoverSlpUtxos(
  address: string,
  resolver: ParentResolver,
  historyProvider: AddressHistoryProvider,
  spendProvider: SpendDiscoveryProvider,
): Promise<DiscoveredSlpUtxo[]> {
  const summary = await new SlpAddressBalanceService(
    resolver,
    historyProvider,
    spendProvider,
  ).getBalances(address);

  return summary.balances.flatMap((balance) => {
    const decimals = balance.metadata?.decimals ?? null;
    return balance.utxos.map((utxo) => ({
      cashaddr: summary.address,
      txid: utxo.txid,
      vout: utxo.vout,
      tokenId: balance.tokenId,
      amount: utxo.amount,
      displayAmount: decimals === null ? utxo.amount : formatSlpAmount(BigInt(utxo.amount), decimals),
      decimals,
      valueSatoshis: utxo.valueSatoshis,
    }));
  });
}
