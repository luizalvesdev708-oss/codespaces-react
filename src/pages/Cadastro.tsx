import type { CensoRecord, DashboardData } from '../@types/censo';
import MetricCard from '../components/MetricCard';
import ExportButtons from '../components/ExportButtons';
import { formatCount, maskCpf } from '../utils/format';
interface CadastroProps { data: DashboardData; records: CensoRecord[] }
export default function Cadastro({ data, records }: CadastroProps) {
  const { censo } = data;
  return <>
    <div className="page-heading"><div><h1>Base do Censo Previdenciário</h1><p>Registros do arquivo de recenseamento · CPF mascarado</p></div><span className="status-badge">{formatCount(censo.registros)} registros</span></div>
    <section className="metric-grid" aria-label="Resumo do cadastro"><MetricCard label="Registros" value={formatCount(censo.registros)} /><MetricCard label="Concluídos" value={formatCount(censo.concluidos)} /><MetricCard label="Sem conclusão" value={formatCount(censo.sem_conclusao)} /><MetricCard label="Entidade(s)" value={formatCount(censo.entidades)} /><MetricCard label="Primeiro cadastro" value={censo.data_inicial} /><MetricCard label="Último cadastro" value={censo.data_final} /></section>
    <section className="panel panel--table"><div className="panel__title panel__title--row"><div><h2>Registros do recenseamento</h2><span>{formatCount(records.length)} registro(s)</span></div><ExportButtons records={records} /></div><div className="table-wrap table-wrap--records"><table><thead><tr><th>Nome</th><th>Matrícula</th><th>CPF</th><th>Cargo</th><th>Entidade</th><th>Cadastro</th><th>Conclusão</th><th>Último acesso</th><th>Status</th></tr></thead><tbody>
      {records.map((record, index) => <tr key={`${record.matricula}-${index}`}><td>{record.nome}</td><td>{record.matricula}</td><td>{maskCpf(record.cpf)}</td><td>{record.cargo}</td><td>{record.entidade}</td><td>{record.cadastro}</td><td>{record.conclusao || '—'}</td><td>{record.ultimoAcesso}</td><td><span className={`record-status${record.status === 'Concluído' ? ' record-status--done' : ''}`}>{record.status}</span></td></tr>)}
    </tbody></table>{!records.length && <p className="empty-state">Nenhum registro corresponde aos filtros.</p>}</div>
      <div className="record-list-mobile" aria-label="Registros do recenseamento">
        {records.map((record, index) => (
          <details className="record-card" key={`mobile-${record.matricula}-${index}`}>
            <summary>
              <span className="record-card__heading">
                <strong>{record.nome}</strong>
                <span className={`record-status${record.status === 'Concluído' ? ' record-status--done' : ''}`}>{record.status}</span>
              </span>
              <span className="record-card__meta">Matrícula {record.matricula} · {record.cargo}</span>
            </summary>
            <dl className="record-card__details">
              <div><dt>CPF</dt><dd>{maskCpf(record.cpf)}</dd></div>
              <div><dt>Entidade</dt><dd>{record.entidade}</dd></div>
              <div><dt>Cadastro</dt><dd>{record.cadastro}</dd></div>
              <div><dt>Conclusão</dt><dd>{record.conclusao || '—'}</dd></div>
              <div><dt>Último acesso</dt><dd>{record.ultimoAcesso}</dd></div>
            </dl>
          </details>
        ))}
        {!records.length && <p className="empty-state">Nenhum registro corresponde aos filtros.</p>}
      </div>
    </section>
  </>;
}