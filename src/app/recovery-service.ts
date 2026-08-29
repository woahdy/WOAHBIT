import type { ParentResolver } from '../slp/validator.js';
import { SlpRecoveryIndex } from '../slp/recovery-index.js';
import type { SpendDiscoveryProvider } from '../slp/spend-discovery.js';

export interface RecoveryOutputSummary {
  txid: string;
  vout: number;
  tokenId: string;
  amount: string;
  isMintBaton: boolean;
  valueSatoshis: string;
  lockingBytecodeHex: string;
  spentBy: string | null;
}

export interface RecoverySummary {
  seed: string;
  found: boolean;
  validSlp: boolean;
  transactionType?: 'GENESIS' | 'MINT' | 'SEND';
  tokenId?: string;
  reason?: string;
  tokenIds: string[];
  transactions: Array<{
    txid: string;
    validSlp: boolean;
    transactionType?: 'GENESIS' | 'MINT' | 'SEND';
    tokenId?: string;
    reason?: string;
  }>;
  outputs: RecoveryOutputSummary[];
}

function serializeOutput(output: ReturnType<SlpRecoveryIndex['snapshot']>['outputs'][number]): RecoveryOutputSummary {
  return {
    txid: output.txid,
    vout: output.vout,
    tokenId: output.tokenId,
    amount: output.amount.toString(),
    isMintBaton: output.isMintBaton,
    valueSatoshis: output.valueSatoshis.toString(),
    lockingBytecodeHex: output.lockingBytecodeHex,
    spentBy: output.spentBy,
  };
}

export class WoahbitRecoveryService {
  constructor(
    private readonly resolver: ParentResolver,
    private readonly spendProvider?: SpendDiscoveryProvider,
  ) {}

  async recoverTransaction(txid: string): Promise<RecoverySummary> {
    const normalized = txid.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) {
      return {
        seed: normalized,
        found: false,
        validSlp: false,
        reason: 'Invalid transaction id',
        tokenIds: [],
        transactions: [],
        outputs: [],
      };
    }

    const index = new SlpRecoveryIndex(this.resolver);
    const seed = await index.indexSeed(normalized);
    if (!seed) {
      return {
        seed: normalized,
        found: false,
        validSlp: false,
        reason: 'Transaction not found',
        tokenIds: [],
        transactions: [],
        outputs: [],
      };
    }

    if (this.spendProvider) await index.refreshSpends(this.spendProvider);
    const snapshot = index.snapshot();

    return {
      seed: normalized,
      found: true,
      validSlp: seed.validSlp,
      transactionType: seed.transactionType,
      tokenId: seed.tokenId,
      reason: seed.reason,
      tokenIds: snapshot.tokenIds,
      transactions: snapshot.transactions,
      outputs: snapshot.outputs.map(serializeOutput),
    };
  }
}
