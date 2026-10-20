export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function readErrorMessage(response: Response) {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
      return body.error;
    }
  } catch {
    // Non-JSON error responses use a status-based message below.
  }
  return `A solicitação falhou (HTTP ${response.status}).`;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  offlineCacheUserId?: string,
): Promise<T | undefined> {
  let response: Response;
  try {
    const endpoint = path.split('?')[0];
    const canCacheOffline = offlineCacheUserId
      && (endpoint === '/dashboard/data' || endpoint === '/reports/census-records');
    response = await fetch(`/api${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(canCacheOffline && (init.method ?? 'GET').toUpperCase() === 'GET'
          ? { 'X-PWA-Cache-User': offlineCacheUserId }
          : {}),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError('Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.', 0);
  }

  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }
  if (response.status === 204) return undefined;

  try {
    return await response.json() as T;
  } catch {
    throw new ApiError('O serviço retornou uma resposta inválida. Tente novamente.', response.status);
  }
}
