import assert from 'node:assert/strict';
import test from 'node:test';
import { cashAddressToLockingBytecode } from '../bch/cashaddr.js';
import { discoverSlpUtxos } from '../app/discover-slp-utxos.js';
import type { BchTransaction } from '../slp/types.js';

const address = 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a';
const tokenId = 'aa'.repeat(32);

function genesisScript(quantity: bigint, decimals: number): Uint8Array {
  const ascii = (value: string) => Uint8Array.from(Buffer.from(value, 'ascii'));
  const u64 = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) { u64[i] = Number(quantity & 255n); quantity >>= 8n; }
  const fields = [ascii('SLP\0'), Uint8Array.of(1), ascii('GENESIS'), ascii('WOAH'),
    ascii('WOAHBIT'), new Uint8Array(), new Uint8Array(), Uint8Array.of(decimals),
    new Uint8Array(), u64];
  return Uint8Array.from([0x6a, ...fields.flatMap((field) => [field.length, ...field])]);
}

for (const [raw, decimals, display] of [
  [1200n, 3, '1.200'],
  [5n, 3, '0.005'],
  [100n, 0, '100'],
] as const) {
  test(`SLP discovery amount ${raw} with ${decimals} decimals is canonical ${display}`, async () => {
    const tx: BchTransaction = {
      txid: tokenId, inputs: [], outputs: [
        { valueSatoshis: 0n, lockingBytecode: genesisScript(raw, decimals) },
        { valueSatoshis: 546n, lockingBytecode: cashAddressToLockingBytecode(address) },
      ],
    };
    const utxos = await discoverSlpUtxos(
      address,
      { getTransaction: async (id) => id === tokenId ? tx : null },
      { getAddressHistory: async () => [{ txid: tokenId }] },
      { getSpend: async () => null },
    );
    assert.equal(utxos.length, 1);
    assert.equal(utxos[0]?.tokenId, tokenId);
    assert.equal(utxos[0]?.amount, raw.toString());
    assert.equal(utxos[0]?.decimals, decimals);
    assert.equal(utxos[0]?.displayAmount, display);
  });
}
