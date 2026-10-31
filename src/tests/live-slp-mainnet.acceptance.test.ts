import assert from 'node:assert/strict';
import test from 'node:test';
import { PaytacaAddressHistoryProvider } from '../bch/paytaca-address-history.js';
import { PaytacaTransactionResolver } from '../bch/paytaca-transaction.js';
import { BlockbookUtxoCrossCheckProvider } from '../bch/blockbook-utxo-crosscheck.js';
import { cashAddressToLockingBytecode, normalizeMainnetCashAddress } from '../bch/cashaddr.js';
import { PaytacaSpendDiscoveryProvider } from '../bch/paytaca-spend.js';
import { SlpAddressBalanceService } from '../app/address-balance-service.js';
import { SlpValidator } from '../slp/validator.js';
import { createWoahbitServer } from '../app/server.js';
import { formatSlpAmount, SlpTokenMetadataService } from '../app/token-metadata-service.js';

// SLP.dev documents this SOUR token GENESIS transaction as a canonical token ID.
// Keeping the anchor external to WOAHBIT prevents us from fabricating project-specific chain history.
const SOUR_TOKEN_ID = '6448381f9649ecacd8c30189cfbfee71a91b6b9738ea494fe33f8b8b51cbfca0';
// Blockchair's receipt for the same transaction records vout 1 at this BCH CashAddr.
const SOUR_GENESIS_RECIPIENT = 'bitcoincash:qp9xtga6v3s7d7wq39d2nvkpy9g95hzzzc3uhuxxef';
const runLive = process.env.SLP_LIVE_ACCEPTANCE === '1';

function independentUtxoProvider(): BlockbookUtxoCrossCheckProvider {
  const baseUrl = process.env.SLP_BLOCKBOOK_BASE_URL?.trim();
  assert.ok(baseUrl, 'SLP_BLOCKBOOK_BASE_URL is required for live dual-source UTXO acceptance');
  const apiKey = process.env.SLP_BLOCKBOOK_API_KEY?.trim();
  const apiKeyHeader = process.env.SLP_BLOCKBOOK_API_KEY_HEADER?.trim() || 'api-key';
  return new BlockbookUtxoCrossCheckProvider({
    baseUrl,
    confirmedOnly: true,
    timeoutMs: 20_000,
    headers: apiKey ? { [apiKeyHeader]: apiKey } : undefined,
  });
}

test('live mainnet: resolves and validates the documented SOUR SLP GENESIS', { skip: !runLive, timeout: 30_000 }, async () => {
  const resolver = new PaytacaTransactionResolver({ timeoutMs: 20_000 });
  const transaction = await resolver.getTransaction(SOUR_TOKEN_ID);

  assert.ok(transaction, 'documented SOUR GENESIS transaction must resolve from BCH mainnet');
  assert.equal(transaction.txid, SOUR_TOKEN_ID);

  const token = await new SlpTokenMetadataService(resolver).getTokenMetadata(SOUR_TOKEN_ID);
  assert.equal(token.found, true);
  assert.equal(token.validSlpGenesis, true);
  assert.equal(token.identityBasis, 'canonical-token-id');
  assert.equal(token.tokenId, SOUR_TOKEN_ID);
  assert.ok(token.metadata, 'validated GENESIS metadata must be available');
  assert.equal(token.metadata.tokenId, SOUR_TOKEN_ID);
  assert.equal(token.metadata.tokenType, 1);
  assert.ok(token.metadata.name.length > 0, 'GENESIS should expose a token name');
  assert.ok(token.metadata.ticker.length > 0, 'GENESIS should expose a token ticker');
});

test('live mainnet: discovers SOUR GENESIS from its independently documented recipient address', { skip: !runLive, timeout: 30_000 }, async () => {
  const history = new PaytacaAddressHistoryProvider({ timeoutMs: 20_000 });
  const resolver = new PaytacaTransactionResolver({ timeoutMs: 20_000 });

  const entries = await history.getAddressHistory(SOUR_GENESIS_RECIPIENT);
  assert.ok(entries.some((entry) => entry.txid === SOUR_TOKEN_ID), 'recipient history must include the documented SOUR GENESIS');

  const transaction = await resolver.getTransaction(SOUR_TOKEN_ID);
  assert.ok(transaction, 'documented SOUR GENESIS transaction must resolve');
  assert.ok(transaction.outputs[1], 'SOUR GENESIS must have token receiver vout 1');
  assert.deepEqual(
    transaction.outputs[1].lockingBytecode,
    cashAddressToLockingBytecode(SOUR_GENESIS_RECIPIENT),
    'vout 1 must be locked to the independently documented recipient CashAddr',
  );
});

test('live mainnet: independently cross-checks the documented SOUR token outpoint', { skip: !runLive, timeout: 30_000 }, async () => {
  const result = await independentUtxoProvider().check(SOUR_GENESIS_RECIPIENT, { txid: SOUR_TOKEN_ID, vout: 1 });
  assert.notEqual(result.state, 'indeterminate', `independent UTXO provider must answer deterministically: ${result.reason ?? 'unknown error'}`);
  // This historical GENESIS outpoint is a discovery probe, not yet the permanent survivor fixture.
  // If it is spent, the test records that deterministically and the batch scanner must locate a current survivor.
  assert.ok(result.state === 'unspent' || result.state === 'not-present');
});

/**
 * A historical GENESIS is not proof of a currently spendable token output.
 * This opt-in gate requires independently established fixture data. Do not
 * populate these variables with guessed or historical-only blockchain data.
 */
test('live mainnet: survivor SLP outpoint is dual-source unspent and HTTP balance-reproducible',
  { skip: !runLive || process.env.SLP_LIVE_SURVIVOR_ACCEPTANCE !== '1', timeout: 180_000 }, async () => {
    const required = (name: string): string => {
      const value = process.env[name]?.trim();
      assert.ok(value, `${name} must contain an independently verified fixture value`);
      return value;
    };
    const address = normalizeMainnetCashAddress(required('SLP_ACCEPTANCE_CASHADDR'));
    const txid = required('SLP_ACCEPTANCE_TXID');
    const voutString = required('SLP_ACCEPTANCE_VOUT');
    const tokenId = required('SLP_ACCEPTANCE_TOKEN_ID');
    const rawQuantity = required('SLP_ACCEPTANCE_RAW_QUANTITY');
    const decimalsString = required('SLP_ACCEPTANCE_DECIMALS');
    const displayQuantity = required('SLP_ACCEPTANCE_DISPLAY_QUANTITY');
    assert.match(txid, /^[0-9a-f]{64}$/);
    assert.match(tokenId, /^[0-9a-f]{64}$/);
    assert.match(voutString, /^(0|[1-9][0-9]*)$/);
    assert.match(decimalsString, /^(0|[1-9][0-9]*)$/);
    assert.match(rawQuantity, /^[1-9][0-9]*$/);
    const vout = Number(voutString);
    const decimals = Number(decimalsString);
    assert.ok(Number.isSafeInteger(vout) && vout <= 0xffff_ffff);
    assert.ok(Number.isSafeInteger(decimals) && decimals <= 9);
    const quantity = BigInt(rawQuantity);
    assert.equal(formatSlpAmount(quantity, decimals), displayQuantity);

    const resolver = new PaytacaTransactionResolver({ timeoutMs: 20_000 });
    const spendProvider = new PaytacaSpendDiscoveryProvider({ timeoutMs: 20_000 });
    const outpoint = { txid, vout };
    const tx = await resolver.getTransaction(txid);
    assert.ok(tx, 'fixture transaction must resolve');
    assert.equal(tx.txid, txid);
    assert.ok(tx.outputs[vout], 'fixture output must exist');
    assert.deepEqual(tx.outputs[vout].lockingBytecode, cashAddressToLockingBytecode(address),
      'fixture output must be owned by the frozen CashAddr');

    const validated = await new SlpValidator(resolver).validate(tx);
    assert.equal(validated.valid, true, 'SLP ancestry must recursively validate');
    assert.equal(validated.tokenId, tokenId, 'token identity must match canonical GENESIS');
    const tokenOutput = validated.tokenOutputs?.find((output) => output.vout === vout);
    assert.ok(tokenOutput && !tokenOutput.isMintBaton, 'fixture must be a quantity output, not a baton');
    assert.equal(tokenOutput.amount, quantity);

    assert.equal(await spendProvider.getSpend(outpoint), null,
      'Paytaca forward-spend provider must explicitly confirm unspent');
    const independent = await independentUtxoProvider().check(address, outpoint);
    assert.equal(independent.state, 'unspent',
      `independent UTXO set must contain exact outpoint: ${independent.reason ?? 'not found'}`);

    const token = await new SlpTokenMetadataService(resolver).getTokenMetadata(tokenId);
    assert.equal(token.validSlpGenesis, true);
    assert.equal(token.metadata?.decimals, decimals);

    const balance = await new SlpAddressBalanceService(
      resolver, new PaytacaAddressHistoryProvider({ timeoutMs: 20_000 }), spendProvider,
    ).getBalances(address);
    assert.equal(balance.address, address);
    const group = balance.balances.find((entry) => entry.tokenId === tokenId);
    assert.ok(group, 'address balances must include canonical token ID');
    assert.ok(group.utxos.some((utxo) => utxo.txid === txid && utxo.vout === vout &&
      utxo.tokenId === tokenId && utxo.amount === rawQuantity),
      'balance service must reproduce exact verified survivor UTXO and quantity');
    assert.ok(BigInt(group.amount) >= quantity);
    assert.equal(group.displayAmount, formatSlpAmount(BigInt(group.amount), decimals));

    // Exercise the real read-only HTTP route on an ephemeral loopback listener.
    // No signing, broadcasting or BCH RPC requests are performed.
    const server = createWoahbitServer({
      rpcUrl: 'http://127.0.0.1:8332',
      resolver,
      rpcTimeoutMs: 20_000,
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => reject(error);
        server.once('error', onError);
        server.listen(0, '127.0.0.1', () => {
          server.off('error', onError);
          resolve();
        });
      });
      const listeningAddress = server.address();
      assert.ok(listeningAddress && typeof listeningAddress !== 'string');
      const response = await fetch(
        `http://127.0.0.1:${listeningAddress.port}/balances/${encodeURIComponent(address)}`,
      );
      assert.equal(response.status, 200, 'GET /balances/:cashaddr must succeed');
      const api: unknown = await response.json();
      assert.ok(api && typeof api === 'object' && 'balances' in api);
      const groups = (api as { balances: Array<{
        tokenId: string;
        amount: string;
        displayAmount: string;
        utxos: Array<{ txid: string; vout: number; tokenId: string; amount: string; valueSatoshis: string }>;
      }> }).balances;
      assert.ok(Array.isArray(groups), 'balance endpoint must return token groups');
      const apiGroup = groups.find((entry) => entry.tokenId === tokenId);
      assert.ok(apiGroup, 'balance endpoint must include the survivor token');
      assert.equal(apiGroup.amount, group.amount);
      assert.equal(apiGroup.displayAmount, group.displayAmount);
      assert.ok(apiGroup.utxos.some((utxo) => utxo.txid === txid && utxo.vout === vout &&
        utxo.tokenId === tokenId && utxo.amount === rawQuantity &&
        utxo.valueSatoshis === tx.outputs[vout]!.valueSatoshis.toString()),
        'GET /balances must reproduce survivor outpoint, raw token amount and BCH value');
    } finally {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => server.close((error) =>
          error ? reject(error) : resolve()));
      }
    }
  });
