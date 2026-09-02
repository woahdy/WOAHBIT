const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATORS = [
  0x98f2bc8e61n,
  0x79b76d99e2n,
  0xf33e5fb3c4n,
  0xae2eabe2a8n,
  0x1e4f43e470n,
];

function polymod(values: number[]): bigint {
  let checksum = 1n;
  for (const value of values) {
    const top = checksum >> 35n;
    checksum = ((checksum & 0x07ffffffffn) << 5n) ^ BigInt(value);
    for (let i = 0; i < GENERATORS.length; i += 1) {
      if (((top >> BigInt(i)) & 1n) !== 0n) checksum ^= GENERATORS[i]!;
    }
  }
  return checksum ^ 1n;
}

function prefixExpand(prefix: string): number[] {
  return [...prefix].map((char) => char.charCodeAt(0) & 0x1f).concat(0);
}

function convertBits(data: number[], fromBits: number, toBits: number, pad: boolean): number[] {
  let accumulator = 0;
  let bits = 0;
  const result: number[] = [];
  const maxValue = (1 << toBits) - 1;
  const maxAccumulator = (1 << (fromBits + toBits - 1)) - 1;

  for (const value of data) {
    if (value < 0 || value >> fromBits !== 0) throw new Error('Invalid CashAddr payload');
    accumulator = ((accumulator << fromBits) | value) & maxAccumulator;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      result.push((accumulator >> bits) & maxValue);
    }
  }

  if (pad) {
    if (bits > 0) result.push((accumulator << (toBits - bits)) & maxValue);
  } else if (bits >= fromBits || ((accumulator << (toBits - bits)) & maxValue) !== 0) {
    throw new Error('Invalid CashAddr padding');
  }

  return result;
}

export interface DecodedCashAddress {
  prefix: string;
  type: 'p2pkh' | 'p2sh';
  hash: Uint8Array;
}

/** Decode a mainnet/testnet CashAddr and verify its checksum and payload length. */
export function decodeCashAddress(address: string): DecodedCashAddress {
  const trimmed = address.trim();
  if (!trimmed) throw new Error('Address required');
  if (trimmed !== trimmed.toLowerCase() && trimmed !== trimmed.toUpperCase()) {
    throw new Error('CashAddr cannot mix letter case');
  }

  const normalized = trimmed.toLowerCase();
  const colon = normalized.indexOf(':');
  const prefix = colon >= 0 ? normalized.slice(0, colon) : 'bitcoincash';
  const payloadText = colon >= 0 ? normalized.slice(colon + 1) : normalized;
  if (!prefix || payloadText.length < 9) throw new Error('Invalid CashAddr');

  const payload = [...payloadText].map((char) => {
    const value = CHARSET.indexOf(char);
    if (value < 0) throw new Error('Invalid CashAddr character');
    return value;
  });

  if (polymod([...prefixExpand(prefix), ...payload]) !== 0n) {
    throw new Error('Invalid CashAddr checksum');
  }

  const bytes = convertBits(payload.slice(0, -8), 5, 8, false);
  if (bytes.length < 2) throw new Error('Invalid CashAddr payload');
  const version = bytes[0]!;
  if ((version & 0x80) !== 0) throw new Error('Unsupported CashAddr version');

  const typeBits = (version >> 3) & 0x0f;
  const sizeBits = version & 0x07;
  const expectedHashSize = [20, 24, 28, 32, 40, 48, 56, 64][sizeBits];
  const hash = Uint8Array.from(bytes.slice(1));
  if (expectedHashSize === undefined || hash.length !== expectedHashSize) {
    throw new Error('Invalid CashAddr hash size');
  }

  if (typeBits === 0) return { prefix, type: 'p2pkh', hash };
  if (typeBits === 1) return { prefix, type: 'p2sh', hash };
  throw new Error('Unsupported CashAddr type');
}

/** Convert a supported CashAddr into the standard locking bytecode controlling its UTXOs. */
export function cashAddressToLockingBytecode(address: string): Uint8Array {
  const decoded = decodeCashAddress(address);
  if (decoded.hash.length !== 20) {
    throw new Error('Only 20-byte P2PKH/P2SH CashAddr scripts are supported');
  }

  if (decoded.type === 'p2pkh') {
    return Uint8Array.from([0x76, 0xa9, 0x14, ...decoded.hash, 0x88, 0xac]);
  }
  return Uint8Array.from([0xa9, 0x14, ...decoded.hash, 0x87]);
}
