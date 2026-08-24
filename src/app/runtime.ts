import type { WoahbitServerConfig } from './server.js';

export interface WoahbitEnvironment {
  WOAHBIT_RPC_URL?: string;
  WOAHBIT_RPC_USERNAME?: string;
  WOAHBIT_RPC_PASSWORD?: string;
  WOAHBIT_RPC_TIMEOUT_MS?: string;
  PORT?: string;
}

function parseInteger(name: string, value: string, minimum: number, maximum: number): number {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return parsed;
}

export function serverConfigFromEnvironment(environment: WoahbitEnvironment): WoahbitServerConfig {
  const rpcUrl = environment.WOAHBIT_RPC_URL?.trim();
  if (!rpcUrl) {
    throw new Error('WOAHBIT_RPC_URL is required');
  }

  const port = environment.PORT?.trim()
    ? parseInteger('PORT', environment.PORT, 1, 65535)
    : 3000;

  const rpcTimeoutMs = environment.WOAHBIT_RPC_TIMEOUT_MS?.trim()
    ? parseInteger('WOAHBIT_RPC_TIMEOUT_MS', environment.WOAHBIT_RPC_TIMEOUT_MS, 1000, 120000)
    : 15000;

  return {
    rpcUrl,
    rpcUsername: environment.WOAHBIT_RPC_USERNAME,
    rpcPassword: environment.WOAHBIT_RPC_PASSWORD,
    rpcTimeoutMs,
    port,
  };
}
