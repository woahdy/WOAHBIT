# WOAHBIT

WOAHBIT is a Bitcoin Cash application focused on legacy Simple Ledger Protocol (SLP) compatibility.

## Current MVP

The first core implementation provides:

- SLP Type 1 OP_RETURN parsing
- `GENESIS`, `MINT`, and `SEND` message decoding
- strict field-length and token-type checks
- recursive transaction-DAG validation through a pluggable BCH transaction resolver
- mint-baton authorization checks
- SEND input/output conservation checks
- typed token-output results suitable for wallet balance/history indexing
- address-scoped, spent-output-aware SLP balance recovery
- canonical token metadata resolved from validated GENESIS transactions
- read-only JSON endpoints for transaction validation, recovery, balances, and token details

## Development

Requires Node.js 20+.

```bash
npm install
npm run check
npm run build
```

## Architecture

`src/slp/parser.ts` parses SLP metadata from BCH output 0.

`src/slp/validator.ts` recursively validates token ancestry. The validator intentionally does not hard-code an explorer or indexer. Implement `ParentResolver.getTransaction(txid)` with a trusted BCH node/indexer adapter, then feed normalized BCH transactions to `SlpValidator`.

`src/app/token-metadata-service.ts` treats the 64-character GENESIS transaction ID as the token identity boundary. Human-readable names and tickers are exposed as self-asserted on-chain metadata and never used to merge or verify assets.

This separation lets WOAHBIT support an old SLP-aware data source, a modern BCH indexer, or a local node without changing consensus validation logic.

The explorer information architecture was informed by the public [blockparty-sh/slp-explorer](https://github.com/blockparty-sh/slp-explorer) project: address balances link back to canonical token IDs, and token detail views separate identity from display metadata. WOAHBIT independently implements those concepts on its existing TypeScript validator and current BCH providers; it does not depend on the reference project's legacy SLPDB backend.

## Read-only API

- `GET /validate/:txid` validates SLP Type 1 ancestry.
- `GET /recover/:txid` returns the recovered validated transaction graph.
- `GET /balances/:cashaddr` returns validated, address-owned, unspent balances with exact display amounts and GENESIS metadata.
- `GET /tokens/:tokenId` returns metadata only when the ID is a valid SLP GENESIS transaction.

## Safety / scope

This MVP is read/validate infrastructure. It does **not** import private keys, sign transactions, broadcast transactions, or assume an SLP transaction is valid merely because its OP_RETURN parses successfully.

## Next milestones

1. BCH/indexer adapter and address transaction history
2. wallet UTXO + validated SLP balance index
3. token metadata/history API
4. transaction builder and signing layer
5. mobile UI
