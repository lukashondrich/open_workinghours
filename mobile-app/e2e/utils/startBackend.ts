import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../../');
const BACKEND_DIR = path.join(ROOT, 'backend');
const BACKEND_SCRIPT = path.join(ROOT, 'scripts', 'start-backend.sh');
const DEFAULT_DB = path.join(BACKEND_DIR, 'dev-e2e.db');
const DEFAULT_URL = 'http://localhost:8000';

type StartBackendOptions = {
  url?: string;
  dbUrl?: string;
  dbPath?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
};

export type BackendProcess = {
  url: string;
  dbPath: string;
  stop: () => Promise<void>;
};

async function waitForHealth(url: string, timeoutMs: number) {
  const start = Date.now();
  const deadline = start + timeoutMs;
  let lastErr: unknown;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/healthz`, { method: 'GET' });
      if (res.ok) return;
      lastErr = new Error(`Health returned ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Backend did not become healthy within ${timeoutMs}ms: ${String(lastErr)}`);
}

export async function startBackend({
  url = DEFAULT_URL,
  dbUrl = `sqlite:///./${path.basename(DEFAULT_DB)}`,
  dbPath = DEFAULT_DB,
  env = process.env,
  timeoutMs = 30_000,
}: StartBackendOptions = {}): Promise<BackendProcess> {
  // Ensure a clean DB before start
  await fs.rm(dbPath, { force: true });

  const childEnv = {
    ...env,
    DATABASE__URL: dbUrl,
    SECURITY__SECRET_KEY: env.SECURITY__SECRET_KEY ?? 'test-secret',
    SECURITY__ALLOWED_ORIGINS: env.SECURITY__ALLOWED_ORIGINS ?? '*',
    SECURITY__ALLOWED_HOSTS: env.SECURITY__ALLOWED_HOSTS ?? '*',
    PYTHONUNBUFFERED: '1',
  };

  const child = spawn(BACKEND_SCRIPT, {
    cwd: ROOT,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (data) => {
    process.stdout.write(`[backend] ${data}`);
  });
  child.stderr?.on('data', (data) => {
    process.stderr.write(`[backend] ${data}`);
  });

  // Wait for /healthz to respond
  await waitForHealth(url, timeoutMs);

  const stop = async () => {
    if (!child.killed) {
      child.kill('SIGTERM');
      await new Promise((resolve) => {
        child.once('exit', () => resolve(undefined));
        setTimeout(() => resolve(undefined), 5_000);
      });
    }
    await fs.rm(dbPath, { force: true });
  };

  return { url, dbPath, stop };
}
