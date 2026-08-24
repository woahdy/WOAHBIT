import type { SlpGenesis, SlpMessage, SlpMint, SlpSend } from './types.js';

const SLP_LOKAD_ID = '534c5000';

export class SlpParseError extends Error {}

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
const text = (bytes: Uint8Array): string => Buffer.from(bytes).toString('utf8');

function readPushes(script: Uint8Array): Uint8Array[] {
  if (script.length === 0 || script[0] !== 0x6a) throw new SlpParseError('SLP script must begin with OP_RETURN');
  const pushes: Uint8Array[] = [];
  let cursor = 1;
  while (cursor < script.length) {
    const opcode = script[cursor++];
    let length: number;
    if (opcode >= 0x01 && opcode <= 0x4b) length = opcode;
    else if (opcode === 0x4c) {
      if (cursor >= script.length) throw new SlpParseError('Truncated OP_PUSHDATA1');
      length = script[cursor++];
    } else if (opcode === 0x4d) {
      if (cursor + 1 >= script.length) throw new SlpParseError('Truncated OP_PUSHDATA2');
      length = script[cursor] | (script[cursor + 1] << 8);
      cursor += 2;
    } else throw new SlpParseError(`Non-push opcode 0x${opcode.toString(16)} in SLP OP_RETURN`);
    if (cursor + length > script.length) throw new SlpParseError('Push exceeds script length');
    pushes.push(script.slice(cursor, cursor + length));
    cursor += length;
  }
  return pushes;
}

function uintBE(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

function requireLength(bytes: Uint8Array, length: number, label: string): void {
  if (bytes.length !== length) throw new SlpParseError(`${label} must be ${length} bytes`);
}

function parseTokenType(bytes: Uint8Array): number {
  if (bytes.length < 1 || bytes.length > 2) throw new SlpParseError('Invalid token type field');
  const value = Number(uintBE(bytes));
  if (value !== 1) throw new SlpParseError(`Unsupported SLP token type ${value}; WOAHBIT currently supports Type 1`);
  return value;
}

function parseBaton(bytes: Uint8Array): number | null {
  if (bytes.length === 0) return null;
  requireLength(bytes, 1, 'Mint baton vout');
  const vout = bytes[0];
  if (vout < 2) throw new SlpParseError('Mint baton vout must be at least 2');
  return vout;
}

export function parseSlpScript(script: Uint8Array): SlpMessage {
  const p = readPushes(script);
  if (p.length < 3 || hex(p[0]) !== SLP_LOKAD_ID) throw new SlpParseError('Missing SLP lokad id');
  const tokenType = parseTokenType(p[1]);
  const transactionType = text(p[2]);

  if (transactionType === 'GENESIS') {
    if (p.length !== 10) throw new SlpParseError('GENESIS must contain exactly 10 push fields');
    if (p[6].length !== 0 && p[6].length !== 32) throw new SlpParseError('Document hash must be empty or 32 bytes');
    requireLength(p[7], 1, 'Decimals');
    if (p[7][0] > 9) throw new SlpParseError('Decimals must be between 0 and 9');
    requireLength(p[9], 8, 'Initial token quantity');
    const result: SlpGenesis = {
      tokenType,
      transactionType,
      ticker: text(p[3]),
      name: text(p[4]),
      documentUri: text(p[5]),
      documentHash: p[6].length ? hex(p[6]) : null,
      decimals: p[7][0],
      batonVout: parseBaton(p[8]),
      initialQuantity: uintBE(p[9]),
    };
    return result;
  }

  if (transactionType === 'MINT') {
    if (p.length !== 6) throw new SlpParseError('MINT must contain exactly 6 push fields');
    requireLength(p[3], 32, 'Token id');
    requireLength(p[5], 8, 'Additional token quantity');
    const result: SlpMint = {
      tokenType,
      transactionType,
      tokenId: hex(p[3]),
      batonVout: parseBaton(p[4]),
      additionalQuantity: uintBE(p[5]),
    };
    return result;
  }

  if (transactionType === 'SEND') {
    if (p.length < 5 || p.length > 23) throw new SlpParseError('SEND must contain 1 to 19 token output quantities');
    requireLength(p[3], 32, 'Token id');
    const quantities = p.slice(4).map((quantity) => {
      requireLength(quantity, 8, 'SEND quantity');
      return uintBE(quantity);
    });
    const result: SlpSend = {
      tokenType,
      transactionType,
      tokenId: hex(p[3]),
      outputQuantities: quantities,
    };
    return result;
  }

  throw new SlpParseError(`Unsupported SLP transaction type ${transactionType}`);
}
