import test from 'node:test';
import assert from 'node:assert/strict';
import { renderExplorerPage, renderTokenDetailPage } from '../index.js';

test('renders the WOAHBIT read-only transaction explorer', () => {
  const page = renderExplorerPage();

  assert.match(page, /WOAHBIT/);
  assert.match(page, /64-character BCH transaction ID/);
  assert.match(page, /Read-only/);
  assert.match(page, /fetch\('\/validate\//);
  assert.match(page, /Valid SLP/);
});

test('renders a read-only canonical SLP token detail explorer', () => {
  const tokenId = 'ab'.repeat(32);
  const page = renderTokenDetailPage(tokenId);

  assert.match(page, /Canonical identity/);
  assert.match(page, /self-asserted display metadata/);
  assert.match(page, /64-character SLP GENESIS token ID/);
  assert.match(page, /fetch\('\/tokens\//);
  assert.match(page, /data-token-id="(?:ab){32}"/);
  assert.match(page, /No private keys, signing, minting, or broadcasting/);
  assert.match(page, /replaceChildren/);
  assert.doesNotMatch(page, /innerHTML/);
});

test('escapes an initial token id before rendering it into HTML', () => {
  const page = renderTokenDetailPage('\"><script>alert(1)</script>');

  assert.doesNotMatch(page, /data-token-id=""><script>/);
  assert.match(page, /&quot;&gt;&lt;script&gt;/);
});

test('renders BCH node connectivity status support', () => {
  const page = renderExplorerPage();

  assert.match(page, /id="node-status"/);
  assert.match(page, /fetch\('\/node-status'/);
  assert.match(page, /BCH node offline/);
  assert.match(page, /syncing/);
});
