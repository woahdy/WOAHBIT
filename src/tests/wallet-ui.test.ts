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
  assert.match(page, /iPhone app/);
});

test('keeps wallet operations disabled before secure setup', () => {
  const page = renderWalletPage();

  assert.match(page, /Wallet not configured/);
  assert.match(page, /Import company recovery phrase/);
  assert.match(page, /Signing and broadcasting remain disabled/);
  assert.match(page, /button class="primary" disabled/);
});
