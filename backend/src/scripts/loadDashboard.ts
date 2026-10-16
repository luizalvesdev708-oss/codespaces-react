import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

interface Credentials {
  email: string;
  password: string;
}

function percentile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}

async function credentialsFor(baseUrl: URL): Promise<Credentials> {
  if (process.env.LOAD_TEST_EMAIL && process.env.LOAD_TEST_PASSWORD) {
    return { email: process.env.LOAD_TEST_EMAIL, password: process.env.LOAD_TEST_PASSWORD };
  }
  if (baseUrl.hostname !== '127.0.0.1' && baseUrl.hostname !== 'localhost' && baseUrl.hostname !== '::1') {
    throw new Error('For remote targets, provide LOAD_TEST_EMAIL and LOAD_TEST_PASSWORD explicitly.');
  }
  const filePath = path.resolve(process.cwd(), '.local-admin-credentials.json');
  const value = JSON.parse(await readFile(filePath, 'utf8')) as Credentials;
  if (!value.email || !value.password) throw new Error('Local development credentials file is malformed.');
  return value;
}

async function runLoadTest() {
  const baseUrl = new URL(process.env.LOAD_TEST_BASE_URL ?? 'http://127.0.0.1:4000/api');
  const apiUrl = (pathname: string) => new URL(`${baseUrl.pathname.replace(/\/+$/u, '')}${pathname}`, baseUrl.origin);
  const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? 50);
  const durationSeconds = Number(process.env.LOAD_TEST_DURATION_SECONDS ?? 60);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 200) {
    throw new Error('LOAD_TEST_CONCURRENCY must be an integer from 1 to 200.');
  }
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 600) {
    throw new Error('LOAD_TEST_DURATION_SECONDS must be an integer from 1 to 600.');
  }

  const credentials = await credentialsFor(baseUrl);
  const login = await fetch(apiUrl('/auth/login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify(credentials),
    signal: AbortSignal.timeout(10_000),
  });
  if (!login.ok) throw new Error(`Load-test authentication failed with HTTP ${login.status}.`);
  const cookie = login.headers.get('set-cookie')?.split(';', 1)[0];
  if (!cookie?.startsWith('rpps_session=')) throw new Error('Authentication response did not include the expected session cookie.');
  await login.body?.cancel();

  const endAt = Date.now() + durationSeconds * 1000;
  const latencies: number[] = [];
  const failureReasons = new Map<string, number>();
  let completed = 0;
  let failed = 0;
  const dashboardUrl = apiUrl('/dashboard/data');
  const worker = async () => {
    while (Date.now() < endAt) {
      const started = performance.now();
      try {
        const response = await fetch(dashboardUrl, {
          headers: { cookie },
          signal: AbortSignal.timeout(10_000),
        });
        await response.body?.cancel();
        if (!response.ok) {
          failed += 1;
          const reason = `HTTP_${response.status}`;
          failureReasons.set(reason, (failureReasons.get(reason) ?? 0) + 1);
        } else completed += 1;
        latencies.push(performance.now() - started);
      } catch (error) {
        failed += 1;
        const reason = error instanceof Error ? error.name : 'UnknownError';
        failureReasons.set(reason, (failureReasons.get(reason) ?? 0) + 1);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const total = completed + failed;
  const report = {
    target: `${dashboardUrl.origin}${dashboardUrl.pathname}`,
    concurrency,
    durationSeconds,
    requests: total,
    successful: completed,
    failed,
    failureReasons: Object.fromEntries(failureReasons),
    requestsPerSecond: Number((total / durationSeconds).toFixed(2)),
    latencyMs: {
      p50: Number(percentile(latencies, 0.5).toFixed(2)),
      p95: Number(percentile(latencies, 0.95).toFixed(2)),
      p99: Number(percentile(latencies, 0.99).toFixed(2)),
    },
  };
  console.info(JSON.stringify(report, null, 2));
  if (failed) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runLoadTest().catch((error: unknown) => {
    console.error('Dashboard load test could not complete.');
    console.error(error instanceof Error ? error.message : 'Unexpected load-test failure.');
    process.exitCode = 1;
  });
}
