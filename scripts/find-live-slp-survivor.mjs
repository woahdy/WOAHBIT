#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { validateSurvivorEnvironment } from './run-live-slp-survivor.mjs';

/**
 * Find an acceptance candidate from public addresses, without assuming that a
 * historical SLP transaction is still unspent. Both the WOAHBIT discovery
 * pipeline and an independent Blockbook UTXO set must agree before we print
 * a fixture. No keys, transaction construction, signing or broadcasting.
 */
export async function findLiveSurvivor(addresses, { discover, crossCheck, baseUrl }) {
  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error('Provide at least one public mainnet CashAddr to scan');
  }
  if (typeof discover !== 'function' || typeof crossCheck !== 'function') {
    throw new Error('Discovery and independent UTXO verification are required');
  }
  let inspected = 0;
  for (const address of [...new Set(addresses)]) {
    if (typeof address !== 'string' || !/^bitcoincash:[a-z0-9]{20,}$/.test(address)) {
      throw new Error('Every input must be a mainnet CashAddr');
    }
    // Discovery validates ancestry, script ownership, and Paytaca spend state.
    // An error must abort the scan, not be interpreted as an empty balance.
    const candidates = await discover(address);
    if (!Array.isArray(candidates)) throw new Error('SLP discovery returned an invalid result');
    for (const candidate of candidates) {
      inspected += 1;
      if (candidate.cashaddr !== address) throw new Error('SLP discovery returned a mismatched owner address');
      if (!Number.isSafeInteger(candidate.decimals) || candidate.decimals < 0 || candidate.decimals > 9) {
        continue; // Unknown metadata cannot establish the exact display amount.
      }
      const fixture = {
        SLP_BLOCKBOOK_BASE_URL: baseUrl,
        SLP_ACCEPTANCE_CASHADDR: address,
        SLP_ACCEPTANCE_TXID: candidate.txid,
        SLP_ACCEPTANCE_VOUT: String(candidate.vout),
        SLP_ACCEPTANCE_TOKEN_ID: candidate.tokenId,
        SLP_ACCEPTANCE_RAW_QUANTITY: candidate.amount,
        SLP_ACCEPTANCE_DECIMALS: String(candidate.decimals),
        SLP_ACCEPTANCE_DISPLAY_QUANTITY: candidate.displayAmount,
      };
      // Exact quantity, canonical ID and address structure are checked before
      // the independent provider is contacted.
      validateSurvivorEnvironment(fixture);
      const independent = await crossCheck(address, { txid: candidate.txid, vout: candidate.vout });
      if (independent?.state === 'unspent') {
        return { fixture, inspected, verifiedAt: new Date().toISOString() };
      }
    }
  }
  throw new Error('No independently confirmed unspent SLP output found among ' + inspected + ' discovered candidate(s)');
}

function validatedBlockbookBaseUrl(value) {
  if (!value) throw new Error('SLP_BLOCKBOOK_BASE_URL is required');
  let url;
  try { url = new URL(value); } catch { throw new Error('Invalid SLP_BLOCKBOOK_BASE_URL'); }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('Blockbook provider must use HTTPS (or loopback HTTP)');
  }
  if (url.username || url.password || url.search || url.hash ||
      !url.pathname.replace(new RegExp('/+$'), '').endsWith('/api/v2')) {
    throw new Error('Blockbook base URL must end in /api/v2 without credentials, query or fragment');
  }
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const baseUrl = validatedBlockbookBaseUrl(process.env.SLP_BLOCKBOOK_BASE_URL);
    const addresses = process.argv.slice(2);
    if (addresses.length === 0) throw new Error('Usage: npm run find:live-slp:survivor -- <public-cashaddr> [...]');
    const [discovery, tx, history, spend, blockbook] = await Promise.all([
      import('../dist/app/discover-slp-utxos.js'),
      import('../dist/bch/paytaca-transaction.js'),
      import('../dist/bch/paytaca-address-history.js'),
      import('../dist/bch/paytaca-spend.js'),
      import('../dist/bch/blockbook-utxo-crosscheck.js'),
    ]);
    const resolver = new tx.PaytacaTransactionResolver({ timeoutMs: 20_000 });
    const addressHistory = new history.PaytacaAddressHistoryProvider({ timeoutMs: 20_000 });
    const spends = new spend.PaytacaSpendDiscoveryProvider({ timeoutMs: 20_000 });
    const apiKey = process.env.SLP_BLOCKBOOK_API_KEY?.trim();
    const apiKeyHeader = process.env.SLP_BLOCKBOOK_API_KEY_HEADER?.trim() || 'api-key';
    const independent = new blockbook.BlockbookUtxoCrossCheckProvider({
      baseUrl, confirmedOnly: true, timeoutMs: 20_000,
      headers: apiKey ? { [apiKeyHeader]: apiKey } : undefined,
    });
    const result = await findLiveSurvivor(addresses, {
      baseUrl,
      discover: (address) => discovery.discoverSlpUtxos(address, resolver, addressHistory, spends),
      crossCheck: (address, outpoint) => independent.check(address, outpoint),
    });
    // Never print the Blockbook API key. A UTXO's unspent status is time-sensitive;
    // the separate live acceptance command must recheck it at execution time.
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
