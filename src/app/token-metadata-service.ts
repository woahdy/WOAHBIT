import type { SlpGenesis } from '../slp/types.js';
import { SlpValidator, type ParentResolver } from '../slp/validator.js';

export interface SlpTokenMetadata {
  tokenId: string;
  tokenType: number;
  ticker: string;
  name: string;
  documentUri: string;
  documentHash: string | null;
  decimals: number;
  initialQuantity: string;
  initialQuantityDisplay: string;
  mintBatonVout: number | null;
}

export interface TokenMetadataSummary {
  tokenId: string;
  found: boolean;
  validSlpGenesis: boolean;
  identityBasis: 'canonical-token-id';
  metadata?: SlpTokenMetadata;
  reason?: string;
}

function normalizeTokenId(tokenId: string): string {
  return tokenId.trim().toLowerCase();
}

export function formatSlpAmount(amount: bigint, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 9) {
    throw new Error('SLP decimals must be an integer between 0 and 9');
  }
  if (amount < 0n) throw new Error('SLP amount cannot be negative');
  if (decimals === 0) return amount.toString();

  const digits = amount.toString().padStart(decimals + 1, '0');
  return `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`;
}

function serializeMetadata(tokenId: string, genesis: SlpGenesis): SlpTokenMetadata {
  return {
    tokenId,
    tokenType: genesis.tokenType,
    ticker: genesis.ticker,
    name: genesis.name,
    documentUri: genesis.documentUri,
    documentHash: genesis.documentHash,
    decimals: genesis.decimals,
    initialQuantity: genesis.initialQuantity.toString(),
    initialQuantityDisplay: formatSlpAmount(genesis.initialQuantity, genesis.decimals),
    mintBatonVout: genesis.batonVout,
  };
}

/**
 * Resolves token display metadata only from a validated SLP GENESIS transaction.
 *
 * Names and tickers are self-asserted on-chain metadata. The canonical token ID
 * remains the identity boundary, so this service never treats a matching name or
 * ticker as proof that two tokens are the same asset.
 */
export class SlpTokenMetadataService {
  private readonly validator: SlpValidator;

  constructor(private readonly resolver: ParentResolver) {
    this.validator = new SlpValidator(resolver);
  }

  async getTokenMetadata(tokenId: string): Promise<TokenMetadataSummary> {
    const normalized = normalizeTokenId(tokenId);
    const base = { tokenId: normalized, identityBasis: 'canonical-token-id' as const };

    if (!/^[0-9a-f]{64}$/.test(normalized)) {
      return { ...base, found: false, validSlpGenesis: false, reason: 'Invalid token id' };
    }

    const transaction = await this.resolver.getTransaction(normalized);
    if (!transaction) {
      return { ...base, found: false, validSlpGenesis: false, reason: 'Token genesis transaction not found' };
    }

    if (transaction.txid.toLowerCase() !== normalized) {
      return { ...base, found: true, validSlpGenesis: false, reason: 'Resolver returned a different transaction id' };
    }

    const result = await this.validator.validate(transaction);
    if (!result.valid || result.message?.transactionType !== 'GENESIS' || result.tokenId !== normalized) {
      return {
        ...base,
        found: true,
        validSlpGenesis: false,
        reason: result.reason ?? 'Token ID must reference a valid SLP GENESIS transaction',
      };
    }

    return {
      ...base,
      found: true,
      validSlpGenesis: true,
      metadata: serializeMetadata(normalized, result.message),
    };
  }
}
