import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { BchJsonRpcResolver } from '../bch/adapter.js';
import { WoahbitValidationService } from './validation-service.js';

export interface WoahbitServerConfig {
  rpcUrl: string;
  rpcUsername?: string;
  rpcPassword?: string;
  port?: number;
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function pathname(request: IncomingMessage): string {
  return new URL(request.url ?? '/', 'http://localhost').pathname;
}

export function createWoahbitServer(config: WoahbitServerConfig) {
  const resolver = new BchJsonRpcResolver({
    url: config.rpcUrl,
    username: config.rpcUsername,
    password: config.rpcPassword,
  });
  const service = new WoahbitValidationService(resolver);

  return createServer(async (request, response) => {
    try {
      if (request.method !== 'GET') {
        json(response, 405, { error: 'Method not allowed' });
        return;
      }

      const path = pathname(request);
      if (path === '/health') {
        json(response, 200, { ok: true, service: 'woahbit', mode: 'read-only' });
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
    console.log(`WOAHBIT read-only API listening on http://localhost:${port}`);
  });
  return server;
}
