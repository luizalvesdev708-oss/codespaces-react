// @vitest-environment node
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deleteOfflineVault,
  enqueueMutation,
  listMutations,
  lockOfflineVault,
  offlineVaultConfigured,
  offlineVaultUnlocked,
  readMutationBody,
  removeMutation,
  unlockOfflineVault,
  updateEncryptedMutation,
} from './offlineStore';
import { syncPendingMutations } from './offlineSync';

const userId = 'offline-vault-test-user';

afterEach(async () => {
  await deleteOfflineVault(userId);
  vi.unstubAllGlobals();
});

describe('encrypted offline drafts', () => {
  it('encrypts personal data at rest, rejects a wrong passphrase, and preserves it until manually deleted', async () => {
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('window', new EventTarget());
    await unlockOfflineVault(userId, 'uma frase secreta longa 2026', true);
    const draft = {
      id_segurado: 'SEG-TEST-1',
      nome_completo: 'Nome Privado',
      cpf: '12345678901',
    };
    const queued = await enqueueMutation(
      userId,
      '/personnel/insured-import',
      'POST',
      draft,
      draft.id_segurado,
    );

    await expect(offlineVaultConfigured(userId)).resolves.toBe(true);
    expect(queued.body).toBeUndefined();
    expect(queued.encryptedBody).toBeDefined();
    expect(JSON.stringify(queued.encryptedBody)).not.toContain(draft.cpf);
    expect(await readMutationBody(userId, queued.id)).toEqual(draft);
    await updateEncryptedMutation(userId, queued.id, { ...draft, nome_completo: 'Nome Atualizado' });
    expect((await listMutations(userId))[0]?.status).toBe('pending');
    const editedDraft = { ...draft, nome_completo: 'Nome Atualizado' };
    expect(await readMutationBody(userId, queued.id)).toEqual(editedDraft);
    vi.stubGlobal('navigator', { onLine: true });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual(editedDraft);
      return new Response(JSON.stringify({ idSegurado: editedDraft.id_segurado }), { status: 201 });
    });
    vi.stubGlobal('fetch', fetchMock);
    await syncPendingMutations(userId);
    expect(fetchMock).toHaveBeenCalledOnce();
    const syncedMutation = (await listMutations(userId))[0];
    expect(syncedMutation?.status).toBe('synced');
    expect(syncedMutation?.body).toBeUndefined();
    expect(syncedMutation?.encryptedBody).toBeDefined();

    lockOfflineVault(userId);
    expect(offlineVaultUnlocked(userId)).toBe(false);
    await expect(readMutationBody(userId, queued.id)).rejects.toThrow('Desbloqueie o cofre');
    await expect(unlockOfflineVault(userId, 'frase secreta incorreta 2026')).rejects.toThrow('Frase secreta incorreta');
    await unlockOfflineVault(userId, 'uma frase secreta longa 2026');
    expect((await listMutations(userId)).map(({ id }) => id)).toContain(queued.id);
    expect(await readMutationBody(userId, queued.id)).toEqual(editedDraft);

    await removeMutation(queued.id);
    expect(await listMutations(userId)).toEqual([]);
  });
});
