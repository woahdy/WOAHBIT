import { cashAddressToLockingBytecode, normalizeMainnetCashAddress } from '../bch/cashaddr.js';
import type { UtxoCrossCheckResult } from '../bch/blockbook-utxo-crosscheck.js';
import type { Outpoint } from './types.js';
import { planSlpType1Send, type SlpSendPlan, type ValidatedSlpUtxo, SlpSendPlanError } from './send-planner.js';
import { SlpValidator, type ParentResolver } from './validator.js';
import type { SpendDiscoveryProvider } from './spend-discovery.js';

const TXID = /^[0-9a-f]{64}$/;

export interface SlpUtxoCrossCheck {
  check(address: string, outpoint: Outpoint): Promise<UtxoCrossCheckResult>;
}

export interface SlpSendVerificationSources {
  resolver: ParentResolver;
  spendProvider: SpendDiscoveryProvider;
  independentUtxoProvider: SlpUtxoCrossCheck;
}

/**
 * Read-only, fail-closed preflight for unsigned Type-1 SEND planning.
 * The resulting plan is NOT authorization to sign or broadcast: all inputs
 * must be rechecked for ownership and spend status immediately before signing.
 */
export async function planVerifiedSlpType1Send(
  tokenId: string,
  recipientQuantity: bigint,
  ownerAddress: string,
  outpoints: readonly Outpoint[],
  sources: SlpSendVerificationSources,
): Promise<SlpSendPlan> {
  if (!TXID.test(tokenId)) throw new SlpSendPlanError('Token ID must be exactly 64 lowercase hexadecimal characters');
  if (outpoints.length === 0) throw new SlpSendPlanError('No token input outpoints provided');

  const address = normalizeMainnetCashAddress(ownerAddress);
  const ownerScript = Buffer.from(cashAddressToLockingBytecode(address)).toString('hex');
  const validator = new SlpValidator(sources.resolver);
  const seen = new Set<string>();
  const verified: ValidatedSlpUtxo[] = [];

  for (const outpoint of outpoints) {
    if (!outpoint || typeof outpoint.txid !== 'string' || !TXID.test(outpoint.txid) ||
        !Number.isSafeInteger(outpoint.vout) || outpoint.vout < 0 || outpoint.vout > 0xffff_ffff) {
      throw new SlpSendPlanError('Invalid token input outpoint');
    }
    const key = `${outpoint.txid}:${outpoint.vout}`;
    if (seen.has(key)) throw new SlpSendPlanError('Duplicate token input outpoint');
    seen.add(key);

    const tx = await sources.resolver.getTransaction(outpoint.txid);
    if (!tx || tx.txid !== outpoint.txid || !tx.outputs[outpoint.vout]) {
      throw new SlpSendPlanError('Token input transaction/output could not be resolved');
    }
    const actualScript = Buffer.from(tx.outputs[outpoint.vout]!.lockingBytecode).toString('hex');
    if (actualScript !== ownerScript) throw new SlpSendPlanError('Token input is not owned by the supplied CashAddr');

    const result = await validator.validate(tx);
    if (!result.valid || result.tokenId !== tokenId) {
      throw new SlpSendPlanError('Token input does not have valid ancestry for requested token ID');
    }
    const output = result.tokenOutputs?.find((entry) => entry.vout === outpoint.vout);
    if (!output || output.isMintBaton || output.amount <= 0n || output.tokenId !== tokenId) {
      throw new SlpSendPlanError('Token input is not a positive Type-1 token quantity output');
    }

    const spend = await sources.spendProvider.getSpend(outpoint);
    if (spend !== null) throw new SlpSendPlanError('Token input is already spent');

    const independent = await sources.independentUtxoProvider.check(address, outpoint);
    if (independent.state !== 'unspent') {
      throw new SlpSendPlanError('Independent UTXO check did not confirm unspent token input');
    }
    verified.push({ outpoint: { ...outpoint }, tokenId, amount: output.amount, validated: true });
  }

  return planSlpType1Send(tokenId, recipientQuantity, verified);
}
