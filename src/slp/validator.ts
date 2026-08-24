import { parseSlpScript, SlpParseError } from './parser.js';
import type { BchTransaction, SlpValidationResult, TokenOutput } from './types.js';

export interface ParentResolver {
  getTransaction(txid: string): Promise<BchTransaction | null>;
}

export class SlpValidator {
  private readonly cache = new Map<string, SlpValidationResult>();

  constructor(private readonly resolver: ParentResolver) {}

  async validate(tx: BchTransaction, visiting = new Set<string>()): Promise<SlpValidationResult> {
    const cached = this.cache.get(tx.txid);
    if (cached) return cached;
    if (visiting.has(tx.txid)) return { valid: false, reason: 'Transaction dependency cycle detected' };
    visiting.add(tx.txid);

    let message;
    try {
      if (!tx.outputs[0]) throw new SlpParseError('Transaction has no output 0');
      message = parseSlpScript(tx.outputs[0].lockingBytecode);
    } catch (error) {
      const result = { valid: false, reason: error instanceof Error ? error.message : 'Invalid SLP script' };
      this.cache.set(tx.txid, result);
      visiting.delete(tx.txid);
      return result;
    }

    const fail = (reason: string): SlpValidationResult => {
      const result = { valid: false, reason, message };
      this.cache.set(tx.txid, result);
      visiting.delete(tx.txid);
      return result;
    };

    if (message.transactionType === 'GENESIS') {
      if (tx.outputs.length < 2) return fail('GENESIS requires token receiver output 1');
      if (message.batonVout !== null && message.batonVout >= tx.outputs.length) return fail('GENESIS mint baton output does not exist');
      const tokenId = tx.txid.toLowerCase();
      const tokenOutputs: TokenOutput[] = [{ vout: 1, tokenId, amount: message.initialQuantity, isMintBaton: false }];
      if (message.batonVout !== null) tokenOutputs.push({ vout: message.batonVout, tokenId, amount: 0n, isMintBaton: true });
      const result = { valid: true, message, tokenId, tokenOutputs };
      this.cache.set(tx.txid, result);
      visiting.delete(tx.txid);
      return result;
    }

    const tokenId = message.tokenId.toLowerCase();
    if (message.transactionType === 'MINT') {
      if (tx.outputs.length < 2) return fail('MINT requires token receiver output 1');
      if (message.batonVout !== null && message.batonVout >= tx.outputs.length) return fail('MINT baton output does not exist');
      let authorized = false;
      for (const input of tx.inputs) {
        const parent = await this.resolver.getTransaction(input.prevout.txid);
        if (!parent) continue;
        const parentResult = await this.validate(parent, visiting);
        const spent = parentResult.tokenOutputs?.find((o) => o.vout === input.prevout.vout);
        if (parentResult.valid && spent?.tokenId === tokenId && spent.isMintBaton) authorized = true;
      }
      if (!authorized) return fail('MINT does not spend a valid mint baton for this token');
      const tokenOutputs: TokenOutput[] = [{ vout: 1, tokenId, amount: message.additionalQuantity, isMintBaton: false }];
      if (message.batonVout !== null) tokenOutputs.push({ vout: message.batonVout, tokenId, amount: 0n, isMintBaton: true });
      const result = { valid: true, message, tokenId, tokenOutputs };
      this.cache.set(tx.txid, result);
      visiting.delete(tx.txid);
      return result;
    }

    let inputAmount = 0n;
    for (const input of tx.inputs) {
      const parent = await this.resolver.getTransaction(input.prevout.txid);
      if (!parent) continue;
      const parentResult = await this.validate(parent, visiting);
      const spent = parentResult.tokenOutputs?.find((o) => o.vout === input.prevout.vout);
      if (parentResult.valid && spent?.tokenId === tokenId && !spent.isMintBaton) inputAmount += spent.amount;
    }
    const outputAmount = message.outputQuantities.reduce((sum, amount) => sum + amount, 0n);
    if (inputAmount < outputAmount) return fail(`SEND creates ${outputAmount - inputAmount} token units without valid inputs`);
    if (message.outputQuantities.length + 1 > tx.outputs.length) return fail('SEND references token outputs that do not exist');
    const tokenOutputs = message.outputQuantities.map((amount, index) => ({ vout: index + 1, tokenId, amount, isMintBaton: false }));
    const result = { valid: true, message, tokenId, tokenOutputs };
    this.cache.set(tx.txid, result);
    visiting.delete(tx.txid);
    return result;
  }
}
