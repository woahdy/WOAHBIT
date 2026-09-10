import { PaytacaAddressHistoryProvider } from '../bch/paytaca-address-history.js';
import { PaytacaSpendDiscoveryProvider } from '../bch/paytaca-spend.js';
import { PaytacaTransactionResolver } from '../bch/paytaca-transaction.js';
import { discoverSlpUtxos } from './discover-slp-utxos.js';

const address = process.argv[2]?.trim();

if (!address) {
  console.error('Usage: npm run discover:slp-utxos -- <cashaddr>');
  process.exitCode = 2;
} else {
  try {
    const resolver = new PaytacaTransactionResolver();
    const historyProvider = new PaytacaAddressHistoryProvider();
    const spendProvider = new PaytacaSpendDiscoveryProvider();
    const utxos = await discoverSlpUtxos(address, resolver, historyProvider, spendProvider);
    process.stdout.write(`${JSON.stringify(utxos, null, 2)}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
