import { ApiError } from './api';
import {
  enqueueMutation,
  createMutationId,
  listMutations,
  readMutationBody,
  retryMutation,
  updateMutation,
} from './offlineStore';
import type { MutationMethod } from './offlineStore';

const activeSyncs = new Map<string, Promise<void>>();
const retryAttempts = new Map<string, number>();
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 300_000];

// O atraso crescente evita repetir requisições continuamente durante uma falha do serviço.
function scheduleRetry(userId: string): void {
  if (retryTimers.has(userId)) return;
  const attempt = retryAttempts.get(userId) ?? 0;
  const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
  retryAttempts.set(userId, attempt + 1);
  const timer = setTimeout(() => {
    retryTimers.delete(userId);
    if (navigator.onLine) {
      void syncPendingMutations(userId).catch((error: unknown) => {
        console.error('A nova tentativa de sincronização falhou.', error);
      });
    }
  }, delay);
  retryTimers.set(userId, timer);
}

function clearRetry(userId: string): void {
  const timer = retryTimers.get(userId);
  if (timer) clearTimeout(timer);
  retryTimers.delete(userId);
  retryAttempts.delete(userId);
}

export async function mutateOfflineFirst(
  userId: string,
  path: string,
  method: MutationMethod,
  body?: unknown,
  entityKey?: string,
): Promise<{ queued: boolean; response?: Response }> {
  const idempotencyKey = createMutationId();
  if (!navigator.onLine) {
    await enqueueMutation(userId, path, method, body, entityKey, 'pending', undefined, idempotencyKey);
    return { queued: true };
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Idempotency-Key': idempotencyKey,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    await enqueueMutation(userId, path, method, body, entityKey, 'pending', undefined, idempotencyKey);
    return { queued: true };
  }

  if (response.status === 409 || response.status === 412) {
    const message = `O servidor recusou a alteração por conflito (HTTP ${response.status}).`;
    await enqueueMutation(userId, path, method, body, entityKey, 'conflict', message, idempotencyKey);
    return { queued: true, response };
  }
  if (!response.ok) {
    throw new ApiError(`A alteração falhou (HTTP ${response.status}).`, response.status);
  }
  return { queued: false, response };
}

export function syncPendingMutations(userId: string): Promise<void> {
  const existingSync = activeSyncs.get(userId);
  if (existingSync) return existingSync;

  const sync = runSync(userId).finally(() => activeSyncs.delete(userId));
  activeSyncs.set(userId, sync);
  return sync;
}

async function runSync(userId: string): Promise<void> {
  if (!navigator.onLine) return;

  const mutations = await listMutations(userId);
  let shouldRetry = false;
  for (const mutation of mutations) {
    if (!navigator.onLine) break;
    if (mutation.status !== 'pending') continue;

    const body = await readMutationBody(userId, mutation.id);
    let response: Response;
    try {
      response = await fetch(`/api${mutation.path}`, {
        method: mutation.method,
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Idempotency-Key': mutation.id,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          'X-Offline-Updated-At': mutation.createdAt,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      shouldRetry = true;
      break;
    }

    if (response.ok) {
      await updateMutation(mutation.id, { status: 'synced', error: undefined });
      continue;
    }
    if (response.status === 409 || response.status === 412) {
      await updateMutation(mutation.id, {
        status: 'conflict',
        error: `Conflito informado pelo servidor (HTTP ${response.status}); requer revisão.`,
      });
      continue;
    }
    if (response.status === 401) {
      await updateMutation(mutation.id, {
        status: 'blocked',
        error: 'Sessão expirada; entre novamente para sincronizar esta alteração.',
      });
      break;
    }
    if (response.status >= 500) {
      shouldRetry = true;
      break;
    }

    await updateMutation(mutation.id, {
      status: 'blocked',
      error: `O servidor recusou esta alteração (HTTP ${response.status}).`,
    });
  }

  if (shouldRetry && navigator.onLine) scheduleRetry(userId);
  else clearRetry(userId);
}

export { retryMutation };
