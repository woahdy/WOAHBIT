import assert from 'node:assert/strict';
import test from 'node:test';
import { PaytacaAddressHistoryProvider } from '../bch/paytaca-address-history.js';
import { PaytacaTransactionResolver } from '../bch/paytaca-transaction.js';
import { cashAddressToLockingBytecode } from '../bch/cashaddr.js';
import { SlpTokenMetadataService } from '../app/token-metadata-service.js';

// SLP.dev documents this SOUR token GENESIS transaction as a canonical token ID.
// Keeping the anchor external to WOAHBIT prevents us from fabricating project-specific chain history.
const SOUR_TOKEN_ID = '6448381f9649ecacd8c30189cfbfee71a91b6b9738ea494fe33f8b8b51cbfca0';
// Blockchair's receipt for the same transaction records vout 1 at this BCH CashAddr.
const SOUR_GENESIS_RECIPIENT = 'bitcoincash:qp9xtga6v3s7d7wq39d2nvkpy9g95hzzzc3uhuxxef';
const runLive = process.env.SLP_LIVE_ACCEPTANCE === '1';

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
