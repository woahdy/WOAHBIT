import type { WoahbitServerConfig } from './server.js';

export interface WoahbitEnvironment {
  WOAHBIT_RPC_URL?: string;
  WOAHBIT_RPC_USERNAME?: string;
  WOAHBIT_RPC_PASSWORD?: string;
  PORT?: string;
}

export function serverConfigFromEnvironment(environment: WoahbitEnvironment): WoahbitServerConfig {
  const rpcUrl = environment.WOAHBIT_RPC_URL?.trim();
  if (!rpcUrl) {
    throw new Error('WOAHBIT_RPC_URL is required');
  }

  let port = 3000;
  if (environment.PORT?.trim()) {
    port = Number.parseInt(environment.PORT, 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('PORT must be an integer between 1 and 65535');
    }
  }

  return {
    rpcUrl,
    rpcUsername: environment.WOAHBIT_RPC_USERNAME,
    rpcPassword: environment.WOAHBIT_RPC_PASSWORD,
    port,
  };
}
