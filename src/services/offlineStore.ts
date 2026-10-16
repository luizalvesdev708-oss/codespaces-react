import type { AuthUser } from '../@types/auth';
import type { DashboardData } from '../@types/censo';

const DATABASE_NAME = 'censo-offline';
const DATABASE_VERSION = 1;
const SNAPSHOT_STORE = 'snapshots';
const STATE_STORE = 'state';
const MUTATION_STORE = 'mutations';

export type MutationMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type MutationStatus = 'pending' | 'conflict' | 'blocked' | 'synced';

export interface OfflineMutation {
  id: string;
  userId: string;
  path: string;
  method: MutationMethod;
  body?: unknown;
  encryptedBody?: { iv: string; ciphertext: string };
  entityKey?: string;
  createdAt: string;
  status: MutationStatus;
  error?: string;
}

interface OfflineSnapshot {
  userId: string;
  user: AuthUser;
  dashboard?: DashboardData;
  updatedAt: string;
}

interface StoredState {
  key: string;
  value: string;
}

interface OfflineVaultRecord {
  salt: string;
  verifier: { iv: string; ciphertext: string };
}

const unlockedVaults = new Map<string, CryptoKey>();
const VAULT_VERIFIER = 'censo-offline-vault-v1';
const PERSONAL_DATA_PATH = /^\/personnel\/insured-import$/u;

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(value.byteLength);
  new Uint8Array(buffer).set(value);
  return buffer;
}

async function deriveVaultKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  if (!globalThis.crypto?.subtle) throw new Error('Este navegador não oferece criptografia segura para rascunhos offline.');
  const material = await crypto.subtle.importKey('raw', toArrayBuffer(new TextEncoder().encode(passphrase)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toArrayBuffer(salt), iterations: 310_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptText(key: CryptoKey, value: string): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(new TextEncoder().encode(value)),
  );
  return { iv: base64Url(iv), ciphertext: base64Url(new Uint8Array(ciphertext)) };
}

async function decryptText(key: CryptoKey, value: { iv: string; ciphertext: string }): Promise<string> {
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(decodeBase64Url(value.iv)) },
      key,
      toArrayBuffer(decodeBase64Url(value.ciphertext)),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new Error('Frase secreta incorreta ou rascunho offline corrompido.');
  }
}

function vaultStateKey(userId: string): string {
  return `offline-vault:${userId}`;
}

export async function offlineVaultConfigured(userId: string): Promise<boolean> {
  const state = await withStore(STATE_STORE, 'readonly', async (store) => (
    await requestResult(store.get(vaultStateKey(userId))) as StoredState | undefined
  ));
  return Boolean(state);
}

export function offlineVaultUnlocked(userId: string): boolean {
  return unlockedVaults.has(userId);
}

export async function unlockOfflineVault(userId: string, passphrase: string, create = false): Promise<void> {
  if (passphrase.length < 12 || passphrase.length > 256) {
    throw new Error('A frase secreta deve ter entre 12 e 256 caracteres.');
  }
  const existing = await withStore(STATE_STORE, 'readonly', async (store) => (
    await requestResult(store.get(vaultStateKey(userId))) as StoredState | undefined
  ));
  if (!existing && !create) throw new Error('Ainda não há um cofre offline. Crie-o antes de guardar rascunhos.');
  if (existing && create) throw new Error('O cofre offline já existe. Desbloqueie-o com a frase secreta atual.');

  if (!existing) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveVaultKey(passphrase, salt);
    const verifier = await encryptText(key, VAULT_VERIFIER);
    await withStore(STATE_STORE, 'readwrite', async (store) => {
      store.add({ key: vaultStateKey(userId), value: JSON.stringify({ salt: base64Url(salt), verifier } satisfies OfflineVaultRecord) satisfies string } satisfies StoredState);
    });
    unlockedVaults.set(userId, key);
  } else {
    const record = JSON.parse(existing.value) as OfflineVaultRecord;
    const key = await deriveVaultKey(passphrase, decodeBase64Url(record.salt));
    if (await decryptText(key, record.verifier) !== VAULT_VERIFIER) {
      throw new Error('Frase secreta incorreta.');
    }
    unlockedVaults.set(userId, key);
  }
  window.dispatchEvent(new Event('offline-vault-change'));
}

export function lockOfflineVault(userId: string): void {
  unlockedVaults.delete(userId);
  window.dispatchEvent(new Event('offline-vault-change'));
}

async function encryptedBody(userId: string, body: unknown) {
  const key = unlockedVaults.get(userId);
  if (!key) throw new Error('Desbloqueie o cofre offline para enfileirar alterações.');
  return encryptText(key, JSON.stringify(body));
}

async function decryptBody(userId: string, body: OfflineMutation): Promise<unknown> {
  if (body.encryptedBody) {
    const key = unlockedVaults.get(userId);
    if (!key) throw new Error('Desbloqueie o cofre offline para sincronizar alterações protegidas.');
    return JSON.parse(await decryptText(key, body.encryptedBody)) as unknown;
  }
  return body.body;
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Este navegador não oferece suporte ao armazenamento offline.'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
        database.createObjectStore(SNAPSHOT_STORE, { keyPath: 'userId' });
      }
      if (!database.objectStoreNames.contains(STATE_STORE)) {
        database.createObjectStore(STATE_STORE, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(MUTATION_STORE)) {
        const mutations = database.createObjectStore(MUTATION_STORE, { keyPath: 'id' });
        mutations.createIndex('by-user', 'userId');
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o armazenamento offline.'));
    request.onblocked = () => reject(new Error('O armazenamento offline está bloqueado por outra aba aberta.'));
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  return withStores([storeName], mode, async (transaction) => (
    operation(transaction.objectStore(storeName))
  ));
}

async function withStores<T>(
  storeNames: string[],
  mode: IDBTransactionMode,
  operation: (transaction: IDBTransaction) => Promise<T>,
): Promise<T> {
  const database = await openDatabase();
  const transaction = database.transaction(storeNames, mode);
  let transactionSettled = false;
  const completion = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      transactionSettled = true;
      resolve();
    };
    transaction.onerror = () => reject(transaction.error ?? new Error('Falha ao gravar dados offline.'));
    transaction.onabort = () => {
      transactionSettled = true;
      reject(transaction.error ?? new Error('A transação offline foi cancelada.'));
    };
  });

  try {
    const result = await operation(transaction);
    await completion;
    return result;
  } catch (error) {
    if (!transactionSettled) transaction.abort();
    await completion.catch(() => undefined);
    throw error;
  } finally {
    database.close();
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha ao acessar os dados offline.'));
  });
}

export async function saveAuthenticatedUser(user: AuthUser): Promise<void> {
  await withStores([SNAPSHOT_STORE, STATE_STORE], 'readwrite', async (transaction) => {
    const snapshots = transaction.objectStore(SNAPSHOT_STORE);
    const stateStore = transaction.objectStore(STATE_STORE);
    const previousUser = await requestResult(stateStore.get('lastUserId')) as StoredState | undefined;
    if (previousUser && previousUser.value !== user.sub) snapshots.delete(previousUser.value);
    const existing = await requestResult(snapshots.get(user.sub)) as OfflineSnapshot | undefined;
    snapshots.put({ ...existing, userId: user.sub, user, updatedAt: new Date().toISOString() });
    stateStore.put({ key: 'lastUserId', value: user.sub } satisfies StoredState);
  });
}

export async function readLastAuthenticatedUser(): Promise<AuthUser | null> {
  const state = await withStore(STATE_STORE, 'readonly', async (store) => (
    await requestResult(store.get('lastUserId')) as StoredState | undefined
  ));
  if (!state) return null;
  const snapshot = await withStore(SNAPSHOT_STORE, 'readonly', async (store) => (
    await requestResult(store.get(state.value)) as OfflineSnapshot | undefined
  ));
  return snapshot?.user ?? null;
}

export async function saveDashboardSnapshot(userId: string, dashboard: DashboardData): Promise<void> {
  await withStore(SNAPSHOT_STORE, 'readwrite', async (store) => {
    const existing = await requestResult(store.get(userId)) as OfflineSnapshot | undefined;
    if (!existing) throw new Error('Não há uma sessão autenticada para associar ao painel offline.');
    store.put({ ...existing, dashboard, updatedAt: new Date().toISOString() } satisfies OfflineSnapshot);
  });
}

export async function readDashboardSnapshot(userId: string): Promise<DashboardData | null> {
  return withStore(SNAPSHOT_STORE, 'readonly', async (store) => {
    const snapshot = await requestResult(store.get(userId)) as OfflineSnapshot | undefined;
    return snapshot?.dashboard ?? null;
  });
}

export async function clearOfflineSnapshot(userId: string): Promise<void> {
  await withStores([SNAPSHOT_STORE, STATE_STORE], 'readwrite', async (transaction) => {
    transaction.objectStore(SNAPSHOT_STORE).delete(userId);
    const stateStore = transaction.objectStore(STATE_STORE);
    const current = await requestResult(stateStore.get('lastUserId')) as StoredState | undefined;
    if (current?.value === userId) stateStore.delete('lastUserId');
  });
}

export async function deleteOfflineVault(userId: string): Promise<void> {
  const mutations = await listMutations(userId);
  await withStores([MUTATION_STORE, STATE_STORE], 'readwrite', async (transaction) => {
    const mutationStore = transaction.objectStore(MUTATION_STORE);
    mutations.forEach((mutation) => mutationStore.delete(mutation.id));
    transaction.objectStore(STATE_STORE).delete(vaultStateKey(userId));
  });
  lockOfflineVault(userId);
  window.dispatchEvent(new Event('offline-queue-change'));
}

function validateMutationPath(path: string): void {
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/auth') || path.includes('://')) {
    throw new Error('A fila offline aceita apenas rotas relativas da API que não sejam de autenticação.');
  }
}

export function createMutationId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function enqueueMutation(
  userId: string,
  path: string,
  method: MutationMethod,
  body?: unknown,
  entityKey?: string,
  status: MutationStatus = 'pending',
  error?: string,
  id = createMutationId(),
): Promise<OfflineMutation> {
  validateMutationPath(path);
  const encrypted = body === undefined || PERSONAL_DATA_PATH.test(path)
    ? body === undefined ? undefined : await encryptedBody(userId, body)
    : undefined;
  const mutation: OfflineMutation = {
    id,
    userId,
    path,
    method,
    ...(body === undefined ? {} : encrypted ? { encryptedBody: encrypted } : { body }),
    ...(entityKey ? { entityKey } : {}),
    createdAt: new Date().toISOString(),
    status,
    ...(error ? { error } : {}),
  };
  await withStore(MUTATION_STORE, 'readwrite', async (store) => {
    store.add(mutation);
  });
  window.dispatchEvent(new Event('offline-queue-change'));
  return mutation;
}

export async function updateEncryptedMutation(userId: string, id: string, body: unknown): Promise<void> {
  const key = unlockedVaults.get(userId);
  if (!key) throw new Error('Desbloqueie o cofre offline para editar rascunhos.');
  const initial = await withStore(MUTATION_STORE, 'readonly', async (store) => (
    await requestResult(store.get(id)) as OfflineMutation | undefined
  ));
  if (!initial || initial.userId !== userId || !PERSONAL_DATA_PATH.test(initial.path)) {
    throw new Error('O rascunho pessoal não existe neste dispositivo.');
  }
  const encrypted = await encryptText(key, JSON.stringify(body));
  await withStore(MUTATION_STORE, 'readwrite', (store) => new Promise<void>((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const mutation = request.result as OfflineMutation | undefined;
      if (!mutation || mutation.userId !== userId || !PERSONAL_DATA_PATH.test(mutation.path)) {
        reject(new Error('O rascunho pessoal não existe mais neste dispositivo.'));
        return;
      }
      const updated = { ...mutation };
      delete updated.body;
      delete updated.error;
      store.put({
        ...updated,
        encryptedBody: encrypted,
        createdAt: new Date().toISOString(),
        status: 'pending',
      } satisfies OfflineMutation);
      resolve();
    };
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o rascunho offline.'));
  }));
  window.dispatchEvent(new Event('offline-queue-change'));
}

export async function listMutations(userId: string): Promise<OfflineMutation[]> {
  return withStore(MUTATION_STORE, 'readonly', async (store) => {
    const mutations = await requestResult(store.index('by-user').getAll(userId)) as OfflineMutation[];
    return mutations.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  });
}

  export async function readMutationBody(userId: string, id: string): Promise<unknown> {
    return withStore(MUTATION_STORE, 'readonly', async (store) => {
      const mutation = await requestResult(store.get(id)) as OfflineMutation | undefined;
      if (!mutation) throw new Error('Rascunho offline não existe mais.');
      return decryptBody(userId, mutation);
    });
  }

export async function updateMutation(
  id: string,
  update: Pick<OfflineMutation, 'status'> & Partial<Pick<OfflineMutation, 'error'>>,
): Promise<void> {
  await withStore(MUTATION_STORE, 'readwrite', async (store) => {
    const mutation = await requestResult(store.get(id)) as OfflineMutation | undefined;
    if (!mutation) return;
    store.put({ ...mutation, ...update });
  });
  window.dispatchEvent(new Event('offline-queue-change'));
}

export async function removeMutation(id: string): Promise<void> {
  await withStore(MUTATION_STORE, 'readwrite', async (store) => {
    store.delete(id);
  });
  window.dispatchEvent(new Event('offline-queue-change'));
}

export async function retryMutation(id: string): Promise<void> {
  await updateMutation(id, { status: 'pending', error: undefined });
}
