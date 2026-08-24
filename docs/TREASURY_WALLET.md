# WOAHBIT company treasury wallet

WOAHBIT's first wallet is intentionally single-tenant: it is for Guillotrise LLC treasury
assets, not customer deposits.

## Security boundary

The wallet secret must be encrypted before it is stored. The encryption key must be supplied
by a deployment secret manager and must never be committed, written to logs, returned by an
HTTP endpoint, or stored beside the encrypted wallet envelope.

Generate a 32-byte key for the deployment secret manager:

```bash
openssl rand -base64 32
```

Store the result as `WOAHBIT_WALLET_ENCRYPTION_KEY` in the host's secret manager. Do not
paste the value into issues, pull requests, chat, screenshots, or `.env` files.

The current vault uses AES-256-GCM authenticated encryption with a fresh 96-bit nonce for
each encryption. A modified envelope or a different key cannot decrypt successfully.

## Delivery stages

1. **Encrypted vault foundation** — encrypt and decrypt wallet secret material; no endpoints.
2. **Receive-only treasury** — derive a BCH/SLP deposit address and display validated balances.
3. **Transaction builder** — token-aware UTXO selection, BCH fee inputs, SLP change, and burn
   protection; produce an unsigned transaction for review.
4. **Controlled signing** — unlock only for one operation, require explicit authorization,
   sign server-side, zero temporary secret buffers, and record a non-secret audit event.
5. **Broadcasting** — disabled by default; add transaction limits, destination allowlisting,
   idempotency, rate limiting, and a separate approval step before enabling mainnet.

## Backup requirement

Before the wallet receives funds, create an offline recovery backup and test restoration with
a separate, empty test wallet. Losing both the encrypted envelope and the recovery backup can
make the treasury permanently inaccessible.

## Not yet implemented

This foundation does not yet derive addresses, store an actual seed, calculate balances, sign
transactions, or broadcast transactions. Never send funds to WOAHBIT until the receive-only
stage has passed automated tests and an independent recovery test.
