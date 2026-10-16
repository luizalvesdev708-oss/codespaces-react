import type { OfflineMutation } from '../services/offlineStore';

interface ConnectionStatusProps {
  isOnline: boolean;
  isSyncing: boolean;
  isUsingLocalData: boolean;
  pendingCount: number;
  conflictCount: number;
  blockedCount: number;
  mutations: OfflineMutation[];
  onRetryMutation: (id: string) => void;
  syncError: string;
}

export default function ConnectionStatus({
  isOnline,
  isSyncing,
  isUsingLocalData,
  pendingCount,
  conflictCount,
  blockedCount,
  mutations,
  onRetryMutation,
  syncError,
}: ConnectionStatusProps) {
  const isLocal = !isOnline || isUsingLocalData;
  const label = isSyncing
    ? 'Sincronizando dados...'
    : isLocal
      ? 'Offline (modo local)'
      : 'Online';
  const className = isSyncing ? 'is-syncing' : isLocal ? 'is-offline' : 'is-online';

  return (
    <div className={`connection-status ${className}`} role="status" aria-live="polite">
      <span className="connection-status__label">
        <span aria-hidden="true">{isSyncing ? '🔄' : isLocal ? '🟡' : '🟢'}</span>
        {label}
      </span>
      {(pendingCount > 0 || conflictCount > 0 || blockedCount > 0) && (
        <span className="connection-status__queue">
          {pendingCount > 0 && `${pendingCount} pendente(s)`}
          {conflictCount > 0 && `${pendingCount > 0 ? ' · ' : ''}${conflictCount} conflito(s)`}
          {blockedCount > 0 && `${pendingCount > 0 || conflictCount > 0 ? ' · ' : ''}${blockedCount} bloqueada(s)`}
        </span>
      )}
      {(conflictCount > 0 || blockedCount > 0) && (
        <details className="connection-status__details">
          <summary>Revisar fila</summary>
          <ul>
            {mutations.filter((mutation) => mutation.status === 'conflict' || mutation.status === 'blocked').map((mutation) => (
              <li key={mutation.id}>
                <span><strong>{mutation.status === 'conflict' ? 'Conflito' : 'Bloqueada'}:</strong> {mutation.method} {mutation.path}. {mutation.error}</span>
                <button type="button" onClick={() => onRetryMutation(mutation.id)} disabled={isSyncing}>
                  Tentar reenviar
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {syncError && <span className="connection-status__error" title={syncError}>{syncError}</span>}
    </div>
  );
}
