import assert from 'node:assert/strict';
import test from 'node:test';
import { PaytacaTransactionResolver } from '../bch/paytaca-transaction.js';
import { SlpTokenMetadataService } from '../app/token-metadata-service.js';

// SLP.dev documents this SOUR token GENESIS transaction as a canonical token ID.
// Keeping the anchor external to WOAHBIT prevents us from fabricating project-specific chain history.
const SOUR_TOKEN_ID = '6448381f9649ecacd8c30189cfbfee71a91b6b9738ea494fe33f8b8b51cbfca0';
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
