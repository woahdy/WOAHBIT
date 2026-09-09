import { cp, mkdir, writeFile } from 'node:fs/promises';
import { renderWalletPage } from '../dist/app/wallet-ui.js';

// Export the same read-only wallet as the Node server, without runtime secrets.
const output = new URL('../site-dist/', import.meta.url);
await mkdir(output, { recursive: true });
await cp(new URL('../docs/', import.meta.url), output, { recursive: true });
await writeFile(new URL('wallet.html', output), renderWalletPage());
