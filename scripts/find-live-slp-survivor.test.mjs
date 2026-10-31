import test from 'node:test';
import assert from 'node:assert/strict';
import { findLiveSurvivor } from './find-live-slp-survivor.mjs';

const address = 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a';
const baseUrl = 'https://example.org/api/v2';
const candidate = {
  cashaddr: address, txid: 'ab'.repeat(32), vout: 1,
  tokenId: 'cd'.repeat(32), amount: '1200', decimals: 3,
  displayAmount: '1.200', valueSatoshis: '546',
};
const options = {
  baseUrl,
  discover: async () => [candidate],
  crossCheck: async () => ({ state: 'unspent' }),
};

test('freezes all eight survivor fields only after independent UTXO confirmation', async () => {
  let checked;
  const result = await findLiveSurvivor([address], {
    ...options,
    crossCheck: async (a, outpoint) => {
      checked = [a, outpoint];
      return { state: 'unspent' };
    },
  });
  assert.deepEqual(checked, [address, { txid: candidate.txid, vout: 1 }]);
  assert.equal(result.fixture.SLP_ACCEPTANCE_RAW_QUANTITY, '1200');
  assert.equal(result.fixture.SLP_ACCEPTANCE_DISPLAY_QUANTITY, '1.200');
  assert.equal(result.fixture.SLP_BLOCKBOOK_BASE_URL, baseUrl);
  assert.equal(Object.keys(result.fixture).length, 8);
  assert.match(result.verifiedAt, /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/);
});

test('never treats a missing or indeterminate independent UTXO as spendable', async () => {
  for (const state of ['not-present', 'indeterminate', undefined]) {
    await assert.rejects(() => findLiveSurvivor([address], {
      ...options, crossCheck: async () => ({ state }),
    }), /No independently confirmed unspent/);
  }
});

test('does not accept invalid metadata, token IDs, quantity or display amounts', async () => {
  for (const patch of [
    { decimals: null }, { decimals: 10 }, { decimals: -1 },
    { txid: 'not-a-txid' }, { tokenId: 'bad' },
    { amount: '0' }, { amount: '18446744073709551616' },
    { displayAmount: '1.2' },
  ]) {
    let checked = false;
    const scan = () => findLiveSurvivor([address], {
      ...options,
      discover: async () => [{ ...candidate, ...patch }],
      crossCheck: async () => { checked = true; return { state: 'unspent' }; },
    });
    await assert.rejects(scan);
    assert.equal(checked, false, 'invalid ' + JSON.stringify(patch) + ' should never reach Blockbook');
  }
});

test('rejects mismatched owner address and discovery failures', async () => {
  await assert.rejects(() => findLiveSurvivor([address], {
    ...options, discover: async () => [{ ...candidate, cashaddr: 'bitcoincash:qbad' }],
  }), /mismatched owner/);
  await assert.rejects(() => findLiveSurvivor([address], {
    ...options, discover: async () => { throw new Error('Paytaca timeout'); },
  }), /Paytaca timeout/);
});

test('checks the next candidate when the first is spent, without accepting it', async () => {
  const second = { ...candidate, txid: 'ef'.repeat(32), vout: 2 };
  const checked = [];
  const result = await findLiveSurvivor([address], {
    ...options,
    discover: async () => [candidate, second],
    crossCheck: async (_, outpoint) => {
      checked.push(outpoint);
      return { state: outpoint.vout === 1 ? 'not-present' : 'unspent' };
    },
  });
  assert.equal(result.fixture.SLP_ACCEPTANCE_TXID, second.txid);
  assert.equal(result.inspected, 2);
  assert.equal(checked.length, 2);
});

test('rejects missing addresses and invalid independent provider', async () => {
  await assert.rejects(() => findLiveSurvivor([], options), /at least one/);
  await assert.rejects(() => findLiveSurvivor([address], { ...options, crossCheck: null }), /required/);
});

test('CLI rejects missing provider configuration before any chain request', async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(process.execPath, ['scripts/find-live-slp-survivor.mjs', address], {
    cwd: process.cwd(), env: { PATH: process.env.PATH }, encoding: 'utf8', timeout: 3000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /SLP_BLOCKBOOK_BASE_URL is required/);
});

test('CLI rejects insecure Blockbook endpoint before any chain request', async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(process.execPath, ['scripts/find-live-slp-survivor.mjs', address], {
    cwd: process.cwd(), env: { PATH: process.env.PATH, SLP_BLOCKBOOK_BASE_URL: 'http://example.org/api/v2' },
    encoding: 'utf8', timeout: 3000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must use HTTPS/);
});
