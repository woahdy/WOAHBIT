import assert from 'node:assert/strict';
import test from 'node:test';
import { cashAddressToLockingBytecode } from '../bch/cashaddr.js';
import { SlpAddressBalanceService } from '../app/address-balance-service.js';
import type { BchTransaction } from '../slp/types.js';

const address = 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a';
const txid = 'aa'.repeat(32);

function push(data: Uint8Array): Uint8Array {
  return Uint8Array.from([data.length, ...data]);
}

function text(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, 'utf8'));
}

function hex(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, 'hex'));
}

function u64(value: bigint): Uint8Array {
  const out = new Uint8Array(8);
  let current = value;
  for (let i = 7; i >= 0; i -= 1) {
    out[i] = Number(current & 0xffn);
    current >>= 8n;
  }
  return out;
}

function genesisScript(quantity: bigint): Uint8Array {
  const fields = [
    hex('534c5000'), Uint8Array.from([1]), text('GENESIS'), text('WOAH'), text('WOAHBIT'),
    new Uint8Array(), new Uint8Array(), Uint8Array.from([0]), new Uint8Array(), u64(quantity),
  ];
  return Uint8Array.from([0x6a, ...fields.flatMap((field) => [...push(field)])]);
}

test('CashAddr decoder derives the expected P2PKH locking bytecode', () => {
  assert.equal(
    Buffer.from(cashAddressToLockingBytecode(address)).toString('hex'),
    '76a91476a04053bda0a88bda5177b86a15c3b29f55987388ac',
  );
});

test('address balance service returns only owned, validated, unspent token outputs', async () => {
  const ownedScript = cashAddressToLockingBytecode(address);
  const genesis: BchTransaction = {
    txid,
    inputs: [],
    outputs: [
      { valueSatoshis: 0n, lockingBytecode: genesisScript(123n) },
      { valueSatoshis: 546n, lockingBytecode: ownedScript },
    ],
  };

  const service = new SlpAddressBalanceService(
    { getTransaction: async (id) => id === txid ? genesis : null },
    { getAddressHistory: async () => [{ txid, height: 900000 }] },
    { getSpend: async () => null },
  );

  const result = await service.getBalances(address.toUpperCase());
  assert.equal(result.address, address);
  assert.equal(result.historyTransactions, 1);
  assert.equal(result.validSlpTransactions, 1);
  assert.equal(result.balances.length, 1);
  assert.equal(result.balances[0]?.tokenId, txid);
  assert.equal(result.balances[0]?.amount, '123');
  assert.equal(result.balances[0]?.utxos[0]?.vout, 1);
});

test('address balance service excludes outputs proven spent', async () => {
  const genesis: BchTransaction = {
    txid,
    inputs: [],
    outputs: [
      { valueSatoshis: 0n, lockingBytecode: genesisScript(123n) },
      { valueSatoshis: 546n, lockingBytecode: cashAddressToLockingBytecode(address) },
    ],
  };

  const service = new SlpAddressBalanceService(
    { getTransaction: async (id) => id === txid ? genesis : null },
    { getAddressHistory: async () => [{ txid }] },
    { getSpend: async () => ({ txid: 'bb'.repeat(32), inputIndex: 0 }) },
  );

  const result = await service.getBalances(address);
  assert.deepEqual(result.balances, []);
});
