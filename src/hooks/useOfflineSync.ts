import { useCallback, useEffect, useState } from 'react';
import { listMutations } from '../services/offlineStore';
import type { OfflineMutation } from '../services/offlineStore';
import { retryMutation as retryStoredMutation, syncPendingMutations } from '../services/offlineSync';

export function useOfflineSync(userId: string) {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [mutations, setMutations] = useState<OfflineMutation[]>([]);
  const [syncError, setSyncError] = useState('');

  const refreshQueue = useCallback(async () => {
    try {
      setMutations(await listMutations(userId));
      setSyncError('');
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Não foi possível consultar a fila offline.');
    }
  }, [userId]);

  const synchronize = useCallback(async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    setSyncError('');
    try {
      await syncPendingMutations(userId);
      await refreshQueue();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Não foi possível sincronizar as alterações.');
    } finally {
      setIsSyncing(false);
    }
  }, [refreshQueue, userId]);

  const retryMutation = useCallback(async (id: string) => {
    try {
      await retryStoredMutation(id);
      await refreshQueue();
      if (navigator.onLine) await synchronize();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Não foi possível reenfileirar a alteração.');
    }
  }, [refreshQueue, synchronize]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void synchronize();
    };
    const handleOffline = () => setIsOnline(false);
    const handleQueueChange = () => {
      void refreshQueue();
      if (navigator.onLine) void synchronize();
    };
    const handleVaultChange = () => {
      if (navigator.onLine) void synchronize();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-queue-change', handleQueueChange);
    window.addEventListener('offline-vault-change', handleVaultChange);
    void refreshQueue();
    if (navigator.onLine) void synchronize();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-queue-change', handleQueueChange);
      window.removeEventListener('offline-vault-change', handleVaultChange);
    };
  }, [refreshQueue, synchronize]);

  return {
    isOnline,
    isSyncing,
    pendingCount: mutations.filter((mutation) => mutation.status === 'pending').length,
    conflictCount: mutations.filter((mutation) => mutation.status === 'conflict').length,
    blockedCount: mutations.filter((mutation) => mutation.status === 'blocked').length,
    mutations,
    retryMutation,
    syncError,
  };
}
