const DEFAULT_BASE_URL = 'http://localhost:8000';

export type WeeklySubmission = {
  id: string;
  week_start: string;
  week_end: string;
  planned_hours: number;
  actual_hours: number;
  client_version: string;
  created_at: string;
};

function resolveBaseUrl(): string {
  return process.env.E2E_BACKEND_URL || DEFAULT_BASE_URL;
}

export async function waitForBackend(timeoutMs = 30_000) {
  const base = resolveBaseUrl().replace(/\/$/, '');
  const start = Date.now();
  const deadline = start + timeoutMs;
  let lastErr: unknown;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/healthz`, { method: 'GET' });
      if (res.ok) return true;
      lastErr = new Error(`Status ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Backend not reachable: ${String(lastErr)}`);
}

export async function listWeeklySubmissions(limit = 10): Promise<WeeklySubmission[]> {
  const base = resolveBaseUrl().replace(/\/$/, '');
  const res = await fetch(`${base}/submissions/weekly?limit=${limit}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list submissions (${res.status}): ${text}`);
  }
  return res.json();
}
