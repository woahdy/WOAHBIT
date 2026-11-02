#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Match exactly one survivor test. Node's test runner can exit successfully when
// --test-name-pattern matches zero tests, so success alone is not sufficient.
export const SURVIVOR_TEST_NAME = 'live mainnet: survivor SLP outpoint is dual-source unspent and HTTP balance-reproducible';

export const REQUIRED = [
  'SLP_BLOCKBOOK_BASE_URL',
  'SLP_ACCEPTANCE_CASHADDR',
  'SLP_ACCEPTANCE_TXID',
  'SLP_ACCEPTANCE_VOUT',
  'SLP_ACCEPTANCE_TOKEN_ID',
  'SLP_ACCEPTANCE_RAW_QUANTITY',
  'SLP_ACCEPTANCE_DECIMALS',
  'SLP_ACCEPTANCE_DISPLAY_QUANTITY',
];

export function validateSurvivorEnvironment(env) {
  const missing = REQUIRED.filter((key) => !env[key]?.trim());
  if (missing.length) throw new Error(`Missing live survivor fixture variables: ${missing.join(', ')}`);
  for (const key of ['SLP_ACCEPTANCE_TXID', 'SLP_ACCEPTANCE_TOKEN_ID']) {
    if (!/^[0-9a-f]{64}$/.test(env[key])) throw new Error(`${key} must be 64 lowercase hex characters`);
  }
  if (!/^(0|[1-9][0-9]*)$/.test(env.SLP_ACCEPTANCE_VOUT) ||
      !Number.isSafeInteger(Number(env.SLP_ACCEPTANCE_VOUT)) ||
      Number(env.SLP_ACCEPTANCE_VOUT) > 0xffffffff) {
    throw new Error('SLP_ACCEPTANCE_VOUT must be a uint32 integer');
  }
  if (!/^[1-9][0-9]*$/.test(env.SLP_ACCEPTANCE_RAW_QUANTITY) ||
      BigInt(env.SLP_ACCEPTANCE_RAW_QUANTITY) > 0xffff_ffff_ffff_ffffn) {
    throw new Error('SLP_ACCEPTANCE_RAW_QUANTITY must be a positive uint64 integer');
  }
  if (!/^(0|[1-9])$/.test(env.SLP_ACCEPTANCE_DECIMALS)) {
    throw new Error('SLP_ACCEPTANCE_DECIMALS must be between 0 and 9');
  }
  // Fail early on a mismatched display fixture, before running any network calls.
  // The live test still independently checks canonical token metadata and amounts.
  const raw = BigInt(env.SLP_ACCEPTANCE_RAW_QUANTITY);
  const decimals = Number(env.SLP_ACCEPTANCE_DECIMALS);
  const scale = 10n ** BigInt(decimals);
  const expectedDisplay = decimals === 0 ? raw.toString() :
    `${raw / scale}.${(raw % scale).toString().padStart(decimals, '0')}`;
  if (env.SLP_ACCEPTANCE_DISPLAY_QUANTITY !== expectedDisplay) {
    throw new Error('SLP_ACCEPTANCE_DISPLAY_QUANTITY must exactly match raw quantity and decimals');
  }
  // These are structural prechecks only. The live acceptance test verifies
  // CashAddr checksum, chain ancestry, ownership and spend status.
  if (!/^bitcoincash:[a-z0-9]{20,}$/.test(env.SLP_ACCEPTANCE_CASHADDR)) {
    throw new Error('SLP_ACCEPTANCE_CASHADDR must be a mainnet CashAddr');
  }
  try {
    const url = new URL(env.SLP_BLOCKBOOK_BASE_URL);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) {
      throw new Error('Blockbook URL must use HTTPS (or loopback HTTP for local testing)');
    }
    if (url.username || url.password || url.search || url.hash) {
      throw new Error('Blockbook base URL cannot contain credentials, query or fragment');
    }
    if (!url.pathname.replace(/\/+$/, '').endsWith('/api/v2')) {
      throw new Error('Blockbook base URL must end with /api/v2');
    }
  } catch {
    throw new Error('SLP_BLOCKBOOK_BASE_URL must be a valid HTTPS URL (or loopback HTTP)');
  }
  return {
    ...env,
    SLP_LIVE_ACCEPTANCE: '1',
    SLP_LIVE_SURVIVOR_ACCEPTANCE: '1',
  };
}

/** Fail closed if the requested live survivor test was skipped or never run. */
export function assertSurvivorTestExecuted(tapOutput) {
  const lines = tapOutput.split(/\r?\n/).map((line) => line.trim());
  const passes = lines.filter((line) =>
    /^ok [1-9][0-9]* - /.test(line) &&
    line.split(/ - /, 2)[1] === SURVIVOR_TEST_NAME,
  );
  const passSummary = lines.find((line) => /^# pass [0-9]+$/.test(line));
  const failSummary = lines.find((line) => /^# fail [0-9]+$/.test(line));
  if (passes.length !== 1 || passSummary !== '# pass 1' || failSummary !== '# fail 0') {
    throw new Error('Live survivor acceptance did not execute and pass exactly once');
  }
}

function run(command, args, env) {
  const result = spawnSync(command, args, { env, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const env = validateSurvivorEnvironment(process.env);
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    run(npm, ['run', 'build'], env);
    // Run only the required survivor acceptance, not unrelated historical probes.
    // Capture TAP and require an actual passing subtest; zero matched tests can
    // otherwise exit 0, silently bypassing the live-mainnet acceptance gate.
    const result = spawnSync(process.execPath, [
      '--test', '--test-reporter=tap', '--test-name-pattern', `^${SURVIVOR_TEST_NAME}$`,
      'dist/tests/live-slp-mainnet.acceptance.test.js',
    ], { env, encoding: 'utf8', shell: false, maxBuffer: 4 * 1024 * 1024 });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Live survivor acceptance failed (exit ${result.status ?? 'unknown'})`);
    assertSurvivorTestExecuted(result.stdout ?? '');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
