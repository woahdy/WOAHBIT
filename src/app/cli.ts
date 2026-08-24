import { startWoahbitServer } from './server.js';
import { serverConfigFromEnvironment } from './runtime.js';

try {
  startWoahbitServer(serverConfigFromEnvironment(process.env));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
