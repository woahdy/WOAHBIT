import { PaytacaAddressHistoryProvider } from '../bch/paytaca-address-history.js';
import { PaytacaSpendDiscoveryProvider } from '../bch/paytaca-spend.js';
import { PaytacaTransactionResolver } from '../bch/paytaca-transaction.js';
import { discoverSlpUtxos } from './discover-slp-utxos.js';

const addresses = [...new Set(process.argv.slice(2).map((value) => value.trim()).filter(Boolean))];

if (addresses.length === 0) {
  console.error('Usage: npm run discover:slp-utxos:batch -- <address> [address ...]');
  process.exitCode = 2;
} else {
  const resolver = new PaytacaTransactionResolver();
  const historyProvider = new PaytacaAddressHistoryProvider();
  const spendProvider = new PaytacaSpendDiscoveryProvider();

  const results = [];
  for (const address of addresses) {
    try {
      const utxos = await discoverSlpUtxos(address, resolver, historyProvider, spendProvider);
      results.push({ address, ok: true, utxos });
    } catch (error) {
      results.push({
        address,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        utxos: [],
      });
    }
  }

  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  if (results.some((result) => !result.ok)) process.exitCode = 1;
}
