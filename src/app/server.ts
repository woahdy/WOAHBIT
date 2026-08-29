import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { BchJsonRpcResolver } from '../bch/adapter.js';
import { FallbackParentResolver, FullStackRestResolver } from '../bch/fullstack-rest.js';
import { PaytacaSpendDiscoveryProvider } from '../bch/paytaca-spend.js';
import { renderExplorerPage } from './explorer-ui.js';
import { renderWalletPage } from './wallet-ui.js';
import { WoahbitRecoveryService } from './recovery-service.js';
import { WoahbitValidationService } from './validation-service.js';

export interface WoahbitServerConfig {
  rpcUrl: string;
  rpcUsername?: string;
  rpcPassword?: string;
  rpcTimeoutMs?: number;
  fallbackApiUrl?: string;
  spendDiscoveryApiUrl?: string;
  walletVaultReady?: boolean;
  port?: number;
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function html(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  response.end(body);
}

function pathname(request: IncomingMessage): string {
  return new URL(request.url ?? '/', 'http://localhost').pathname;
}

export function createWoahbitServer(config: WoahbitServerConfig) {
  const rpcResolver = new BchJsonRpcResolver({
    url: config.rpcUrl,
    username: config.rpcUsername,
    password: config.rpcPassword,
    timeoutMs: config.rpcTimeoutMs,
  });
  const resolver = config.fallbackApiUrl
    ? new FallbackParentResolver(
        rpcResolver,
        new FullStackRestResolver({ baseUrl: config.fallbackApiUrl, timeoutMs: config.rpcTimeoutMs }),
      )
    : rpcResolver;
  const service = new WoahbitValidationService(resolver);
  const spendProvider = new PaytacaSpendDiscoveryProvider({
    baseUrl: config.spendDiscoveryApiUrl,
    timeoutMs: config.rpcTimeoutMs,
  });
  const recoveryService = new WoahbitRecoveryService(resolver, spendProvider);
  const walletVaultReady = config.walletVaultReady === true;

  return createServer(async (request, response) => {
    try {
      if (request.method !== 'GET') {
        json(response, 405, { error: 'Method not allowed' });
        return;
      }

      const path = pathname(request);
      if (path === '/') {
        html(response, 200, renderExplorerPage());
        return;
      }

      if (path === '/wallet') {
        html(response, 200, renderWalletPage({ vaultReady: walletVaultReady }));
        return;
      }

      if (path === '/wallet-status') {
        json(response, 200, {
          configured: false,
          vaultReady: walletVaultReady,
          recoveryPhraseStored: false,
          signingEnabled: false,
          broadcastingEnabled: false,
        });
        return;
      }

      if (path === '/health') {
        json(response, 200, { ok: true, service: 'woahbit', mode: 'read-only' });
        return;
      }

      if (path === '/node-status') {
        try {
          const status = await rpcResolver.getNodeStatus();
          json(response, 200, status);
        } catch (error) {
          json(response, 503, {
            connected: false,
            error: 'BCH node unavailable',
            message: error instanceof Error ? error.message : 'Unknown error',
            fallbackConfigured: Boolean(config.fallbackApiUrl),
          });
        }
        return;
      }

      const recoveryMatch = path.match(/^\/recover\/([0-9a-fA-F]{64})$/);
      if (recoveryMatch?.[1]) {
        const result = await recoveryService.recoverTransaction(recoveryMatch[1]);
        json(response, result.found ? 200 : 404, result);
        return;
      }

      const match = path.match(/^\/validate\/([0-9a-fA-F]{64})$/);
      if (match?.[1]) {
        const result = await service.validateTransaction(match[1]);
        json(response, result.found ? 200 : 404, result);
        return;
      }

      json(response, 404, { error: 'Not found' });
    } catch (error) {
      json(response, 500, {
        error: 'Validation service error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}

export function startWoahbitServer(config: WoahbitServerConfig) {
  const port = config.port ?? 3000;
  const server = createWoahbitServer(config);
  server.listen(port, () => {
    console.log(`WOAHBIT read-only app listening on http://localhost:${port}`);
  });
  return server;
}
