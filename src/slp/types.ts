export type SlpTransactionType = 'GENESIS' | 'MINT' | 'SEND';

export interface SlpGenesis {
  tokenType: number;
  transactionType: 'GENESIS';
  ticker: string;
  name: string;
  documentUri: string;
  documentHash: string | null;
  decimals: number;
  batonVout: number | null;
  initialQuantity: bigint;
}

export interface SlpMint {
  tokenType: number;
  transactionType: 'MINT';
  tokenId: string;
  batonVout: number | null;
  additionalQuantity: bigint;
}

export interface SlpSend {
  tokenType: number;
  transactionType: 'SEND';
  tokenId: string;
  outputQuantities: bigint[];
}

export type SlpMessage = SlpGenesis | SlpMint | SlpSend;

export interface Outpoint {
  txid: string;
  vout: number;
}

export interface TransactionInput {
  prevout: Outpoint;
}

export interface TransactionOutput {
  valueSatoshis: bigint;
  lockingBytecode: Uint8Array;
}

export interface BchTransaction {
  txid: string;
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
}

export interface TokenOutput {
  vout: number;
  tokenId: string;
  amount: bigint;
  isMintBaton: boolean;
}

export interface SlpValidationResult {
  valid: boolean;
  reason?: string;
  message?: SlpMessage;
  tokenId?: string;
  tokenOutputs?: TokenOutput[];
}
