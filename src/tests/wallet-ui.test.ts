import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWalletPage } from '../index.js';

test('renders the company-only Badger-style wallet shell', () => {
  const page = renderWalletPage();

  assert.match(page, /WOAHBIT Wallet/);
  assert.match(page, /COMPANY TREASURY/);
  assert.match(page, /Receive and send/);
  assert.match(page, /BCH and SLP balances/);
  assert.match(page, /Connected Apps/);
  assert.match(page, /Reviewed BCH\/SLP sending/);
});

test('keeps wallet operations disabled before secure setup', () => {
  const page = renderWalletPage();

  assert.match(page, /Wallet not configured/);
  assert.match(page, /Vault key not configured/);
  assert.match(page, /Import company recovery phrase/);
  assert.match(page, /Signing and broadcasting remain disabled/);
  assert.match(page, /button class="primary" disabled/);
});

test('shows vault encryption readiness without enabling sensitive actions', () => {
  const page = renderWalletPage({ vaultReady: true });

  assert.match(page, /Vault encryption ready/);
  assert.match(page, /no recovery phrase is stored/i);
  assert.match(page, /Import company recovery phrase/);
  assert.match(page, /button class="secondary wide" disabled/);
});

test('adds a read-only SLP recovery lookup that accepts public txids only', () => {
  const page = renderWalletPage();

  assert.match(page, /Read-only recovery/);
  assert.match(page, /64-character BCH transaction ID/);
  assert.match(page, /fetch\('\/recover\/'/);
  assert.match(page, /\^\[0-9a-fA-F\]\{64\}\$/);
  assert.match(page, /No keys, seed phrases, or signing data/);
  assert.doesNotMatch(page, /type="password"/);
});

test('adds a read-only address portfolio backed by verified balance API', () => {
  const page = renderWalletPage();

  assert.match(page, /Verified SLP portfolio/);
  assert.match(page, /bitcoincash:\.\.\./);
  assert.match(page, /fetch\('\/balances\/'/);
  assert.match(page, /address-owned, unspent SLP outputs/);
  assert.match(page, /\/token\/.*encodeURIComponent\(tokenId\)/);
  assert.match(page, /textContent = metadata/);
  assert.doesNotMatch(page, /innerHTML/);
});
