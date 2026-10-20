import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { OfflineMutation } from '../services/offlineStore';
import {
  enqueueMutation,
  listMutations,
  lockOfflineVault,
  offlineVaultConfigured,
  offlineVaultUnlocked,
  readMutationBody,
  removeMutation,
  unlockOfflineVault,
  updateEncryptedMutation,
} from '../services/offlineStore';
import { syncPendingMutations } from '../services/offlineSync';

interface OfflineInsuredDraftsProps {
  userId: string;
  canWrite: boolean;
  isOnline: boolean;
}

interface InsuredDraftPayload {
  id_segurado: string;
  nome_completo: string;
  cpf: string;
  data_nascimento: string;
  categoria: 'Ativo';
  status_recenseado: 'Recenseado' | 'Pendente' | 'Não Recenseado' | 'Em Análise' | 'Recusado';
  regime: string;
  fonte_dados: string;
  'tempo_contribuição_anos': number;
  valor_salario_base: number;
  valor_contribuicao: number;
  valor_beneficio: number;
  data_ultimo_recenseamento: string;
  periodo_referencia: string;
}

const emptyForm: InsuredDraftPayload = {
  id_segurado: '',
  nome_completo: '',
  cpf: '',
  data_nascimento: '',
  categoria: 'Ativo',
  status_recenseado: 'Recenseado',
  regime: '',
  fonte_dados: '',
  'tempo_contribuição_anos': 0,
  valor_salario_base: 0,
  valor_contribuicao: 0,
  valor_beneficio: 0,
  data_ultimo_recenseamento: '',
  periodo_referencia: '',
};

function statusLabel(status: OfflineMutation['status']): string {
  if (status === 'synced') return 'Sincronizado · cópia criptografada local';
  if (status === 'conflict') return 'Conflito · requer revisão';
  if (status === 'blocked') return 'Bloqueado · requer ação';
  return 'Pendente de sincronização';
}

export default function OfflineInsuredDrafts({ userId, canWrite, isOnline }: OfflineInsuredDraftsProps) {
  const [configured, setConfigured] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [vaultError, setVaultError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [mutations, setMutations] = useState<OfflineMutation[]>([]);
  const [drafts, setDrafts] = useState<Array<{ id: string; data: InsuredDraftPayload }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMutationId, setEditingMutationId] = useState<string | null>(null);
  const isCreatingVault = !configured;

  const personalMutations = useMemo(
    () => mutations.filter((mutation) => mutation.path === '/personnel/insured-import'),
    [mutations],
  );

  const refresh = useCallback(async () => {
    const [hasVault, queue] = await Promise.all([
      offlineVaultConfigured(userId),
      listMutations(userId),
    ]);
    const isUnlocked = offlineVaultUnlocked(userId);
    setConfigured(hasVault);
    setUnlocked(isUnlocked);
    setMutations(queue);
    if (!isUnlocked) {
      setDrafts([]);
      setForm(emptyForm);
      setEditingMutationId(null);
      return;
    }
    const decrypted = await Promise.all(queue
      .filter((mutation) => mutation.path === '/personnel/insured-import')
      .map(async (mutation) => ({
        id: mutation.id,
        data: await readMutationBody(userId, mutation.id) as InsuredDraftPayload,
      })));
    setDrafts(decrypted);
  }, [userId]);

  useEffect(() => {
    void refresh().catch((error: unknown) => {
      setVaultError(error instanceof Error ? error.message : 'Não foi possível consultar os rascunhos locais.');
    });
    const refreshOnChange = () => {
      void refresh().catch((error: unknown) => {
        setVaultError(error instanceof Error ? error.message : 'Não foi possível atualizar os rascunhos locais.');
      });
    };
    window.addEventListener('offline-queue-change', refreshOnChange);
    window.addEventListener('offline-vault-change', refreshOnChange);
    return () => {
      window.removeEventListener('offline-queue-change', refreshOnChange);
      window.removeEventListener('offline-vault-change', refreshOnChange);
    };
  }, [refresh]);

  const unlockVault = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setVaultError('');
    setNotice('');
    if (isCreatingVault && passphrase !== confirmation) {
      setVaultError('As frases secretas não correspondem.');
      return;
    }
    try {
      await unlockOfflineVault(userId, passphrase, isCreatingVault);
      setPassphrase('');
      setConfirmation('');
      await refresh();
      if (isOnline) {
        await syncPendingMutations(userId);
        await refresh();
      }
      setNotice(isCreatingVault
        ? 'Cofre criado e desbloqueado neste dispositivo. Guarde a frase secreta; ela não pode ser recuperada.'
        : 'Cofre desbloqueado. Os rascunhos pendentes serão sincronizados quando houver conexão.');
    } catch (error) {
      setVaultError(error instanceof Error ? error.message : 'Não foi possível desbloquear o cofre offline.');
    }
  };

  const lockVault = () => {
    lockOfflineVault(userId);
    setDrafts([]);
    setForm(emptyForm);
    setEditingMutationId(null);
    setNotice('Cofre bloqueado. Os rascunhos continuam criptografados no dispositivo.');
  };

  const submitDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setVaultError('');
    setNotice('');
    if (!unlocked) {
      setVaultError('Desbloqueie o cofre antes de guardar um registro offline.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingMutationId) {
        await updateEncryptedMutation(userId, editingMutationId, form);
      } else {
        await enqueueMutation(userId, '/personnel/insured-import', 'POST', form, form.id_segurado);
      }
      setForm(emptyForm);
      setEditingMutationId(null);
      if (isOnline) await syncPendingMutations(userId);
      await refresh();
      setNotice(isOnline
        ? 'Registro enviado ao servidor. A cópia criptografada permanece neste dispositivo até você excluí-la.'
        : 'Rascunho criptografado e salvo no dispositivo; será sincronizado ao reconectar.');
    } catch (error) {
      setVaultError(error instanceof Error ? error.message : 'Não foi possível salvar o rascunho.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const editDraft = (id: string) => {
    const draft = drafts.find((item) => item.id === id);
    if (!draft) {
      setVaultError('Desbloqueie o cofre para editar este rascunho.');
      return;
    }
    setForm(draft.data);
    setEditingMutationId(id);
    setVaultError('');
    setNotice('O rascunho foi carregado no formulário. Salvar reenviará sua versão atualizada.');
  };

  const cancelEdit = () => {
    setForm(emptyForm);
    setEditingMutationId(null);
    setNotice('');
  };

  const deleteDraft = async (id: string) => {
    if (!window.confirm('Excluir permanentemente a cópia criptografada deste dispositivo?')) return;
    try {
      await removeMutation(id);
      await refresh();
      setNotice('Cópia local excluída. Se já foi sincronizada, o registro no servidor não foi removido.');
    } catch (error) {
      setVaultError(error instanceof Error ? error.message : 'Não foi possível excluir o rascunho local.');
    }
  };

  if (!canWrite) return null;

  const setField = <K extends keyof InsuredDraftPayload>(key: K, value: InsuredDraftPayload[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <section className="panel offline-insured" aria-labelledby="offline-insured-title">
      <h2 id="offline-insured-title" className="panel__title">Cadastro offline protegido</h2>
      <p className="offline-insured__note">Rascunhos cifrados com AES-GCM no dispositivo. A frase secreta nunca é armazenada nem enviada. Sair apaga os rascunhos deste dispositivo; apagar uma cópia local não remove um registro já enviado ao servidor.</p>
      <div className="offline-insured__vault">
        <strong>{unlocked ? 'Cofre desbloqueado neste dispositivo' : configured ? 'Cofre bloqueado' : 'Cofre ainda não configurado'}</strong>
        {unlocked ? <button className="button button--quiet" type="button" onClick={lockVault}>Bloquear cofre</button> : (
          <form onSubmit={(event) => void unlockVault(event)} className="offline-insured__unlock">
            <label className="report-field">
              <span>{isCreatingVault ? 'Crie uma frase secreta (12+ caracteres)' : 'Frase secreta do cofre'}</span>
              <input
                type="password"
                autoComplete={isCreatingVault ? 'new-password' : 'current-password'}
                minLength={12}
                maxLength={256}
                required
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
              />
            </label>
            {isCreatingVault && <label className="report-field">
              <span>Confirme a frase secreta</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={256}
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>}
            <button className="button button--primary" type="submit">{isCreatingVault ? 'Criar e desbloquear cofre' : 'Desbloquear cofre'}</button>
          </form>
        )}
      </div>
      {unlocked && <form className="offline-insured__form" onSubmit={(event) => void submitDraft(event)}>
        <h3>{editingMutationId ? 'Editar rascunho local' : 'Novo registro de segurado ativo'}</h3>
        <div className="offline-insured__grid">
          <label className="report-field"><span>ID do segurado</span><input required maxLength={80} value={form.id_segurado} onChange={(event) => setField('id_segurado', event.target.value)} /></label>
          <label className="report-field"><span>Nome completo</span><input required minLength={3} maxLength={160} value={form.nome_completo} onChange={(event) => setField('nome_completo', event.target.value)} /></label>
          <label className="report-field"><span>CPF</span><input required inputMode="numeric" value={form.cpf} onChange={(event) => setField('cpf', event.target.value)} /></label>
          <label className="report-field"><span>Data de nascimento</span><input required type="date" value={form.data_nascimento} onChange={(event) => setField('data_nascimento', event.target.value)} /></label>
          <label className="report-field"><span>Status do recenseamento</span><select value={form.status_recenseado} onChange={(event) => setField('status_recenseado', event.target.value as InsuredDraftPayload['status_recenseado'])}><option>Recenseado</option><option>Pendente</option><option>Não Recenseado</option><option>Em Análise</option><option>Recusado</option></select></label>
          <label className="report-field"><span>Regime previdenciário</span><input required maxLength={80} value={form.regime} onChange={(event) => setField('regime', event.target.value)} /></label>
          <label className="report-field"><span>Fonte dos dados</span><input required maxLength={120} value={form.fonte_dados} onChange={(event) => setField('fonte_dados', event.target.value)} /></label>
          <label className="report-field"><span>Tempo de contribuição (anos)</span><input required type="number" min="0" max="100" step="0.01" value={form['tempo_contribuição_anos']} onChange={(event) => setField('tempo_contribuição_anos', Number(event.target.value))} /></label>
          <label className="report-field"><span>Salário-base (R$)</span><input required type="number" min="0" step="0.01" value={form.valor_salario_base} onChange={(event) => setField('valor_salario_base', Number(event.target.value))} /></label>
          <label className="report-field"><span>Contribuição (R$)</span><input required type="number" min="0" step="0.01" value={form.valor_contribuicao} onChange={(event) => setField('valor_contribuicao', Number(event.target.value))} /></label>
          <label className="report-field"><span>Benefício (R$)</span><input required type="number" min="0" step="0.01" value={form.valor_beneficio} onChange={(event) => setField('valor_beneficio', Number(event.target.value))} /></label>
          <label className="report-field"><span>Data do último recenseamento</span><input required type="date" value={form.data_ultimo_recenseamento} onChange={(event) => setField('data_ultimo_recenseamento', event.target.value)} /></label>
          <label className="report-field"><span>Período de referência</span><input required placeholder="Março/2026 — Agosto/2026" value={form.periodo_referencia} onChange={(event) => setField('periodo_referencia', event.target.value)} /></label>
        </div>
        <div className="offline-insured__form-actions">
          <button className="button button--primary" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando…' : isOnline ? editingMutationId ? 'Atualizar e sincronizar' : 'Salvar e sincronizar' : editingMutationId ? 'Atualizar rascunho offline' : 'Salvar rascunho offline'}</button>
          {editingMutationId && <button className="button button--quiet" type="button" onClick={cancelEdit}>Cancelar edição</button>}
        </div>
      </form>}
      {personalMutations.length > 0 && <div className="offline-insured__draft-list">
        <h3>Rascunhos preservados neste dispositivo ({personalMutations.length})</h3>
        {!unlocked && <p>Desbloqueie o cofre para ver os detalhes. Os registros continuam cifrados.</p>}
        {unlocked && personalMutations.map((mutation) => {
          const draft = drafts.find((item) => item.id === mutation.id)?.data;
          return <article className="offline-insured__draft" key={mutation.id}>
            <span><strong>{draft?.id_segurado ?? 'Registro protegido'}</strong>{draft?.nome_completo ? ` · ${draft.nome_completo}` : ''}<br /><small>{statusLabel(mutation.status)}</small></span>
            <div className="offline-insured__draft-actions">
              <button className="button button--quiet" type="button" onClick={() => editDraft(mutation.id)} disabled={!unlocked}>Editar</button>
              <button className="button button--quiet" type="button" onClick={() => void deleteDraft(mutation.id)}>Excluir cópia local</button>
            </div>
          </article>;
        })}
      </div>}
      {notice && <p role="status" className="offline-insured__notice">{notice}</p>}
      {vaultError && <p role="alert" className="report-export__error">{vaultError}</p>}
    </section>
  );
}
