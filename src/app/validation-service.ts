import type { BchTransaction, SlpValidationResult, TokenOutput } from '../slp/types.js';
import type { ParentResolver } from '../slp/validator.js';
import { SlpValidator } from '../slp/validator.js';

export interface ValidationSummary {
  txid: string;
  found: boolean;
  validSlp: boolean;
  transactionType?: 'GENESIS' | 'MINT' | 'SEND';
  tokenId?: string;
  reason?: string;
  tokenOutputs: Array<{
    vout: number;
    tokenId: string;
    amount: string;
    isMintBaton: boolean;
  }>;
}

function serializeOutputs(outputs: TokenOutput[] | undefined): ValidationSummary['tokenOutputs'] {
  return (outputs ?? []).map((output) => ({
    vout: output.vout,
    tokenId: output.tokenId,
    amount: output.amount.toString(),
    isMintBaton: output.isMintBaton,
  }));
}

export class WoahbitValidationService {
  private readonly validator: SlpValidator;

  constructor(private readonly resolver: ParentResolver) {
    this.validator = new SlpValidator(resolver);
  }

  async validateTransaction(txid: string): Promise<ValidationSummary> {
    const normalized = txid.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) {
      return {
        txid: normalized,
        found: false,
        validSlp: false,
        reason: 'Invalid transaction id',
        tokenOutputs: [],
      };
    }

    const transaction = await this.resolver.getTransaction(normalized);
    if (!transaction) {
      return {
        txid: normalized,
        found: false,
        validSlp: false,
        reason: 'Transaction not found',
        tokenOutputs: [],
      };
    }

    return this.validateLoadedTransaction(transaction);
  }

  async validateLoadedTransaction(transaction: BchTransaction): Promise<ValidationSummary> {
    const result: SlpValidationResult = await this.validator.validate(transaction);
    return {
      txid: transaction.txid.toLowerCase(),
      found: true,
      validSlp: result.valid,
      transactionType: result.message?.transactionType,
      tokenId: result.tokenId,
      reason: result.reason,
      tokenOutputs: serializeOutputs(result.tokenOutputs),
    };
  }
}
