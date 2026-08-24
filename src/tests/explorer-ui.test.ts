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
