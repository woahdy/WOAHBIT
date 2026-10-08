import type { Outpoint } from './types.js';

const MAX_U64 = 0xffff_ffff_ffff_ffffn;
const TOKEN_ID = /^[0-9a-f]{64}$/;

export interface ValidatedSlpUtxo {
  outpoint: Outpoint;
  tokenId: string;
  amount: bigint;
  validated: true;
  isMintBaton?: false;
}

export interface SlpSendPlan {
  tokenId: string;
  tokenInputs: ValidatedSlpUtxo[];
  tokenInputQuantity: bigint;
  recipientQuantity: bigint;
  tokenChangeQuantity: bigint;
  outputQuantities: bigint[];
  opReturn: Uint8Array;
}

export class SlpSendPlanError extends Error {}

function push(data: Uint8Array): number[] {
  if (data.length <= 75) return [data.length, ...data];
  if (data.length <= 255) return [0x4c, data.length, ...data];
  throw new SlpSendPlanError('SLP field exceeds supported push size');
}

function u64(value: bigint): Uint8Array {
  if (value < 0n || value > MAX_U64) throw new SlpSendPlanError('Token quantity must fit unsigned 64-bit integer');
  const bytes = new Uint8Array(8);
  let remaining = value;
  for (let i = 7; i >= 0; i--) {
    bytes[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return bytes;
}

function text(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, 'ascii'));
}

function hex(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, 'hex'));
}

export function buildSlpType1SendOpReturn(tokenId: string, quantities: readonly bigint[]): Uint8Array {
  if (!TOKEN_ID.test(tokenId)) throw new SlpSendPlanError('Token ID must be exactly 64 lowercase hexadecimal characters');
  if (quantities.length < 1 || quantities.length > 19) throw new SlpSendPlanError('SLP SEND requires 1 to 19 token output quantities');
  for (const quantity of quantities) {
    if (quantity <= 0n) throw new SlpSendPlanError('SLP SEND output quantities must be positive');
    u64(quantity);
  }

  const fields = [
    hex('534c5000'),
    Uint8Array.from([1]),
    text('SEND'),
    hex(tokenId),
    ...quantities.map(u64),
  ];
  return Uint8Array.from([0x6a, ...fields.flatMap((field) => push(field))]);
}

function compareOutpoints(a: ValidatedSlpUtxo, b: ValidatedSlpUtxo): number {
  const txid = a.outpoint.txid.localeCompare(b.outpoint.txid);
  return txid || a.outpoint.vout - b.outpoint.vout;
}

export function planSlpType1Send(
  tokenId: string,
  recipientQuantity: bigint,
  available: readonly ValidatedSlpUtxo[],
): SlpSendPlan {
  if (!TOKEN_ID.test(tokenId)) throw new SlpSendPlanError('Token ID must be exactly 64 lowercase hexadecimal characters');
  if (recipientQuantity <= 0n) throw new SlpSendPlanError('Recipient token quantity must be positive');
  u64(recipientQuantity);

  const seen = new Set<string>();
  const candidates = [...available].sort(compareOutpoints);
  for (const candidate of candidates) {
    if (candidate.validated !== true) throw new SlpSendPlanError('All token inputs must be validator-approved');
    if (candidate.isMintBaton) throw new SlpSendPlanError('Mint baton cannot be used as a token quantity input');
    if (candidate.tokenId !== tokenId) throw new SlpSendPlanError('Token input does not match requested token ID');
    if (candidate.amount <= 0n) throw new SlpSendPlanError('Token input quantity must be positive');
    u64(candidate.amount);
    if (!candidate.outpoint || typeof candidate.outpoint.txid !== 'string' || !TOKEN_ID.test(candidate.outpoint.txid) ||
        !Number.isSafeInteger(candidate.outpoint.vout) || candidate.outpoint.vout < 0 ||
        candidate.outpoint.vout > 0xffff_ffff) {
      throw new SlpSendPlanError('Token input outpoint must contain a 64-character lowercase txid and uint32 vout');
    }
    const key = `${candidate.outpoint.txid}:${candidate.outpoint.vout}`;
    if (seen.has(key)) throw new SlpSendPlanError('Duplicate token input outpoint');
    seen.add(key);
  }

  const selected: ValidatedSlpUtxo[] = [];
  let total = 0n;
  for (const candidate of candidates) {
    selected.push(candidate);
    total += candidate.amount;
    if (total >= recipientQuantity) break;
  }
  if (total < recipientQuantity) throw new SlpSendPlanError('Insufficient validated token quantity');
  if (total > MAX_U64) throw new SlpSendPlanError('Selected token quantity exceeds unsigned 64-bit range');

  const change = total - recipientQuantity;
  const outputQuantities = change === 0n ? [recipientQuantity] : [recipientQuantity, change];
  const outputTotal = outputQuantities.reduce((sum, value) => sum + value, 0n);
  if (outputTotal !== total) throw new SlpSendPlanError('Token conservation invariant failed');

  return {
    tokenId,
    tokenInputs: selected,
    tokenInputQuantity: total,
    recipientQuantity,
    tokenChangeQuantity: change,
    outputQuantities,
    opReturn: buildSlpType1SendOpReturn(tokenId, outputQuantities),
  };
}
