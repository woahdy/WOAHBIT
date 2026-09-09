import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { renderWalletPage } from '../app/wallet-ui.js';

test('Vercel output includes the current read-only wallet and existing homepage', async () => {
  execFileSync(process.execPath, ['scripts/build-site.mjs']);
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  assert.equal(config.buildCommand, 'npm run build:site');
  assert.equal(config.cleanUrls, true);
  const wallet = await readFile(`${config.outputDirectory}/wallet.html`, 'utf8');
  assert.equal(wallet, renderWalletPage());
  assert.match(wallet, /Signing and broadcasting remain disabled/);
  assert.match(wallet, /button class="primary" disabled/);
  assert.doesNotMatch(wallet, /type="password"|method:\s*['"]POST['"]/);
  assert.equal(await readFile(`${config.outputDirectory}/index.html`, 'utf8'), await readFile('docs/index.html', 'utf8'));
});
