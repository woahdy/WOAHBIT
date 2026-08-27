import type { BchTransaction } from './types.js';
import { SlpValidator, type ParentResolver } from './validator.js';
import type { SpendDiscoveryProvider } from './spend-discovery.js';

export interface IndexedSlpTransaction {
  txid: string;
  validSlp: boolean;
  transactionType?: 'GENESIS' | 'MINT' | 'SEND';
  tokenId?: string;
  reason?: string;
}

export interface IndexedSlpOutput {
  txid: string;
  vout: number;
  tokenId: string;
  amount: bigint;
  isMintBaton: boolean;
  valueSatoshis: bigint;
  lockingBytecodeHex: string;
  spentBy: string | null;
}

export interface SlpRecoverySnapshot {
  seeds: string[];
  tokenIds: string[];
  transactions: IndexedSlpTransaction[];
  outputs: IndexedSlpOutput[];
}

function normalizeTxid(txid: string): string {
  return txid.trim().toLowerCase();
}

function outpointKey(txid: string, vout: number): string {
  return `${normalizeTxid(txid)}:${vout}`;
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

/**
 * Builds a read-only recovery view from one or more known BCH transactions.
 *
 * The index walks transaction ancestry through ParentResolver, validates SLP
 * independently, and records token outputs plus spends observed inside the
 * recovered graph. A null spentBy means "not spent by a transaction indexed
 * here" until refreshSpends() is called with a forward-chain provider.
 */
export class SlpRecoveryIndex {
  private readonly validator: SlpValidator;
  private readonly seeds = new Set<string>();
  private readonly transactions = new Map<string, IndexedSlpTransaction>();
  private readonly outputs = new Map<string, IndexedSlpOutput>();

  constructor(private readonly resolver: ParentResolver) {
    this.validator = new SlpValidator(resolver);
  }

  async indexSeed(txid: string): Promise<IndexedSlpTransaction | null> {
    const normalized = normalizeTxid(txid);
    if (!/^[0-9a-f]{64}$/.test(normalized)) {
      throw new Error('Invalid transaction id');
    }

    const transaction = await this.resolver.getTransaction(normalized);
    if (!transaction) return null;

    this.seeds.add(normalized);
    await this.indexTransaction(transaction, new Set<string>());
    return this.transactions.get(normalized) ?? null;
  }

  /** Refresh known SLP outputs against a chain-wide spend index. */
  async refreshSpends(provider: SpendDiscoveryProvider): Promise<void> {
    await Promise.all([...this.outputs.values()].map(async (output) => {
      const spend = await provider.getSpend({ txid: output.txid, vout: output.vout });
      output.spentBy = spend ? normalizeTxid(spend.txid) : null;
    }));
  }

  getOutput(txid: string, vout: number): IndexedSlpOutput | null {
    return this.outputs.get(outpointKey(txid, vout)) ?? null;
  }

  getTokenOutputs(tokenId: string): IndexedSlpOutput[] {
    const normalized = normalizeTxid(tokenId);
    return [...this.outputs.values()]
      .filter((output) => output.tokenId === normalized)
      .sort((a, b) => a.txid.localeCompare(b.txid) || a.vout - b.vout);
  }

  snapshot(): SlpRecoverySnapshot {
    return {
      seeds: [...this.seeds].sort(),
      tokenIds: [...new Set([...this.outputs.values()].map((output) => output.tokenId))].sort(),
      transactions: [...this.transactions.values()].sort((a, b) => a.txid.localeCompare(b.txid)),
      outputs: [...this.outputs.values()].sort((a, b) => a.txid.localeCompare(b.txid) || a.vout - b.vout),
    };
  }

  private async indexTransaction(tx: BchTransaction, visiting: Set<string>): Promise<void> {
    const txid = normalizeTxid(tx.txid);
    if (this.transactions.has(txid)) return;
    if (visiting.has(txid)) return;
    visiting.add(txid);

    for (const input of tx.inputs) {
      const parentTxid = normalizeTxid(input.prevout.txid);
      const parent = await this.resolver.getTransaction(parentTxid);
      if (parent) await this.indexTransaction(parent, visiting);

      const spent = this.outputs.get(outpointKey(parentTxid, input.prevout.vout));
      if (spent && spent.spentBy === null) spent.spentBy = txid;
    }

    const result = await this.validator.validate(tx);
    this.transactions.set(txid, {
      txid,
      validSlp: result.valid,
      transactionType: result.message?.transactionType,
      tokenId: result.tokenId,
      reason: result.reason,
    });

    if (result.valid) {
      for (const tokenOutput of result.tokenOutputs ?? []) {
        const chainOutput = tx.outputs[tokenOutput.vout];
        if (!chainOutput) continue;
        this.outputs.set(outpointKey(txid, tokenOutput.vout), {
          txid,
          vout: tokenOutput.vout,
          tokenId: tokenOutput.tokenId,
          amount: tokenOutput.amount,
          isMintBaton: tokenOutput.isMintBaton,
          valueSatoshis: chainOutput.valueSatoshis,
          lockingBytecodeHex: toHex(chainOutput.lockingBytecode),
          spentBy: null,
        });
      }
    }

    visiting.delete(txid);
  }
}
