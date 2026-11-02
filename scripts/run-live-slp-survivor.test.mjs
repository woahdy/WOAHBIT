import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { validateSurvivorEnvironment, REQUIRED, assertSurvivorTestExecuted, SURVIVOR_TEST_NAME } from './run-live-slp-survivor.mjs';

const fixture = {
  SLP_BLOCKBOOK_BASE_URL: 'https://example.org/api/v2',
  SLP_ACCEPTANCE_CASHADDR: 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
  SLP_ACCEPTANCE_TXID: 'ab'.repeat(32),
  SLP_ACCEPTANCE_VOUT: '1',
  SLP_ACCEPTANCE_TOKEN_ID: 'cd'.repeat(32),
  SLP_ACCEPTANCE_RAW_QUANTITY: '1200',
  SLP_ACCEPTANCE_DECIMALS: '3',
  SLP_ACCEPTANCE_DISPLAY_QUANTITY: '1.200',
};

test('requires all eight independently established survivor fixture fields', () => {
  assert.equal(REQUIRED.length, 8);
  assert.throws(() => validateSurvivorEnvironment({}), /Missing live survivor fixture variables/);
  for (const name of REQUIRED) {
    const partial = { ...fixture };
    delete partial[name];
    assert.throws(() => validateSurvivorEnvironment(partial), new RegExp(name));
  }
});

test('enables both live acceptance switches explicitly', () => {
  const result = validateSurvivorEnvironment({ ...fixture, SLP_LIVE_ACCEPTANCE: '0', SLP_LIVE_SURVIVOR_ACCEPTANCE: '0' });
  assert.equal(result.SLP_LIVE_ACCEPTANCE, '1');
  assert.equal(result.SLP_LIVE_SURVIVOR_ACCEPTANCE, '1');
});

test('rejects malformed outpoints, decimals, quantity and insecure remote provider', () => {
  const cases = [
    ['SLP_ACCEPTANCE_TXID', 'A'.repeat(64)],
    ['SLP_ACCEPTANCE_VOUT', '4294967296'],
    ['SLP_ACCEPTANCE_VOUT', '-1'],
    ['SLP_ACCEPTANCE_DECIMALS', '10'],
    ['SLP_ACCEPTANCE_RAW_QUANTITY', '0'],
    ['SLP_BLOCKBOOK_BASE_URL', 'http://example.org/api/v2'],
    ['SLP_BLOCKBOOK_BASE_URL', 'https://example.org/'],
    ['SLP_ACCEPTANCE_CASHADDR', 'simpleledger:abc'],
  ];
  for (const [key, value] of cases) {
    assert.throws(() => validateSurvivorEnvironment({ ...fixture, [key]: value }), undefined, `${key} should reject ${value}`);
  }
});

test('CLI fails before npm build or network calls when fixture is absent', () => {
  const result = spawnSync(process.execPath, ['scripts/run-live-slp-survivor.mjs'], {
    cwd: process.cwd(), env: { PATH: process.env.PATH }, encoding: 'utf8', timeout: 3000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing live survivor fixture variables/);
});


test('strict survivor gate rejects zero matched tests despite a successful Node exit', () => {
  const empty = 'TAP version 13\n1..0\n# tests 0\n# pass 0\n# fail 0\n';
  assert.throws(() => assertSurvivorTestExecuted(empty), /did not execute/);
});

test('strict survivor gate rejects a skipped or unrelated passing test', () => {
  const skipped = `TAP version 13\nok 1 - ${SURVIVOR_TEST_NAME} # SKIP\n1..1\n# pass 0\n# fail 0\n`;
  assert.throws(() => assertSurvivorTestExecuted(skipped), /did not execute/);
  const unrelated = 'TAP version 13\nok 1 - historical GENESIS probe\n1..1\n# pass 1\n# fail 0\n';
  assert.throws(() => assertSurvivorTestExecuted(unrelated), /did not execute/);
});

test('strict survivor gate accepts exactly one actual passing survivor test', () => {
  const passing = `TAP version 13\n# Subtest: ${SURVIVOR_TEST_NAME}\nok 1 - ${SURVIVOR_TEST_NAME}\n1..1\n# tests 1\n# pass 1\n# fail 0\n# skipped 0\n`;
  assert.doesNotThrow(() => assertSurvivorTestExecuted(passing));
});

test('strict survivor gate rejects duplicate survivor passes or other failures', () => {
  const duplicate = `TAP version 13\nok 1 - ${SURVIVOR_TEST_NAME}\nok 2 - ${SURVIVOR_TEST_NAME}\n1..2\n# pass 2\n# fail 0\n`;
  assert.throws(() => assertSurvivorTestExecuted(duplicate), /did not execute/);
  const failing = `TAP version 13\nok 1 - ${SURVIVOR_TEST_NAME}\nnot ok 2 - another test\n1..2\n# pass 1\n# fail 1\n`;
  assert.throws(() => assertSurvivorTestExecuted(failing), /did not execute/);
});


test('fixture display quantity must match exact uint64 raw amount and decimals', () => {
  for (const [key, value] of [
    ['SLP_ACCEPTANCE_DISPLAY_QUANTITY', '1.2'],
    ['SLP_ACCEPTANCE_DISPLAY_QUANTITY', '1.2000'],
    ['SLP_ACCEPTANCE_DISPLAY_QUANTITY', '1.201'],
    ['SLP_ACCEPTANCE_RAW_QUANTITY', '18446744073709551616'],
  ]) {
    assert.throws(() => validateSurvivorEnvironment({ ...fixture, [key]: value }),
      undefined, `${key} should reject ${value}`);
  }
  assert.doesNotThrow(() => validateSurvivorEnvironment({
    ...fixture, SLP_ACCEPTANCE_RAW_QUANTITY: '1', SLP_ACCEPTANCE_DECIMALS: '9',
    SLP_ACCEPTANCE_DISPLAY_QUANTITY: '0.000000001',
  }));
  assert.doesNotThrow(() => validateSurvivorEnvironment({
    ...fixture, SLP_ACCEPTANCE_RAW_QUANTITY: '18446744073709551615',
    SLP_ACCEPTANCE_DECIMALS: '0', SLP_ACCEPTANCE_DISPLAY_QUANTITY: '18446744073709551615',
  }));
});

test('rejects provider URL query, fragment, and embedded credentials before network access', () => {
  for (const value of [
    'https://example.org/api/v2?key=secret',
    'https://example.org/api/v2#fragment',
    'https://user:pass@example.org/api/v2',
  ]) {
    assert.throws(() => validateSurvivorEnvironment({ ...fixture, SLP_BLOCKBOOK_BASE_URL: value }),
      undefined, `Blockbook URL should reject ${value}`);
  }
  assert.doesNotThrow(() => validateSurvivorEnvironment({
    ...fixture, SLP_BLOCKBOOK_BASE_URL: 'https://example.org/addon/1118/api/v2/',
  }));
});

test('rejects trailing characters after a CashAddr fixture', () => {
  assert.throws(() => validateSurvivorEnvironment({
    ...fixture, SLP_ACCEPTANCE_CASHADDR: `${fixture.SLP_ACCEPTANCE_CASHADDR}!garbage`,
  }), /SLP_ACCEPTANCE_CASHADDR/);
});
