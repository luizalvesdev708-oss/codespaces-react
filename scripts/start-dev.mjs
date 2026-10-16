import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendDirectory = path.join(rootDirectory, 'backend');
const environmentPath = path.join(backendDirectory, '.env');
const credentialsPath = path.join(backendDirectory, '.local-admin-credentials.json');
const composePath = path.join(backendDirectory, 'compose.dev.yml');

function randomHex(bytes = 32) {
  return randomBytes(bytes).toString('hex');
}

async function pathExists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

async function createLocalConfiguration() {
  if (await pathExists(environmentPath) && await pathExists(credentialsPath)) return;
  if (await pathExists(environmentPath) || await pathExists(credentialsPath)) {
    throw new Error(
      'Found a partial local setup. Keep both backend/.env and backend/.local-admin-credentials.json, or remove both to regenerate the local development setup.',
    );
  }

  const databasePassword = randomHex();
  const credentials = {
    email: 'admin@local.test',
    name: 'Administrador local',
    password: randomHex(24),
  };
  const environment = [
    'NODE_ENV=development',
    'PORT=4000',
    `DATABASE_URL=postgresql://rpps_local:${databasePassword}@127.0.0.1:5432/rpps_dev?schema=public`,
    'CORS_ORIGINS=http://localhost:3000',
    `AUTH_JWT_SECRET=${randomHex()}`,
    'AUTH_JWT_ISSUER=rpps-censo-api',
    'AUTH_JWT_AUDIENCE=rpps-censo-web',
    `PII_ENCRYPTION_KEY=${randomHex()}`,
    `PII_LOOKUP_HMAC_KEY=${randomHex()}`,
    'POSTGRES_USER=rpps_local',
    `POSTGRES_PASSWORD=${databasePassword}`,
    'POSTGRES_DB=rpps_dev',
    '',
  ].join('\n');

  await writeFile(environmentPath, environment, { mode: 0o600, flag: 'wx' });
  await writeFile(credentialsPath, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  await chmod(environmentPath, 0o600);
  await chmod(credentialsPath, 0o600);
  console.info('Created private local development configuration and a one-time administrator account.');
  console.info(`Local development login: ${credentials.email}`);
  console.info(`Local development password: ${credentials.password}`);
  console.info('The password is saved only in the ignored file backend/.local-admin-credentials.json.');
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? rootDirectory,
      stdio: 'inherit',
      env: process.env,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${signal ?? `code ${code}`}`));
    });
  });
}

function startProcess(command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  child.once('error', (error) => {
    console.error(`Could not start ${command}:`, error);
    process.exitCode = 1;
  });
  return child;
}

async function main() {
  await createLocalConfiguration();
  await run('docker', [
    'compose',
    '--env-file',
    environmentPath,
    '-f',
    composePath,
    'up',
    '--detach',
    '--wait',
  ]);
  await run('npm', ['run', 'db:deploy', '--prefix', 'backend']);
  await run('npm', ['run', 'dev:ensure-user', '--prefix', 'backend']);

  const api = startProcess('npm', ['run', 'dev', '--prefix', 'backend'], rootDirectory);
  const frontend = startProcess('npm', ['start'], rootDirectory);
  const children = [api, frontend];
  const shutdown = () => {
    children.forEach((child) => {
      if (child.exitCode === null) child.kill('SIGTERM');
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  children.forEach((child) => {
    child.once('exit', (code) => {
      if (code !== 0 && code !== null) process.exitCode = code;
      shutdown();
    });
  });
}

main().catch((error) => {
  console.error('Could not start the development stack.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
