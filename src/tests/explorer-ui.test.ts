import test from 'node:test';
import assert from 'node:assert/strict';
import { renderExplorerPage } from '../index.js';

test('renders the WOAHBIT read-only transaction explorer', () => {
  const page = renderExplorerPage();

  assert.match(page, /WOAHBIT/);
  assert.match(page, /64-character BCH transaction ID/);
  assert.match(page, /Read-only/);
  assert.match(page, /fetch\('\/validate\//);
  assert.match(page, /Valid SLP/);
});

test('renders BCH node connectivity status support', () => {
  const page = renderExplorerPage();

  assert.match(page, /id="node-status"/);
  assert.match(page, /fetch\('\/node-status'/);
  assert.match(page, /BCH node offline/);
  assert.match(page, /syncing/);
});
