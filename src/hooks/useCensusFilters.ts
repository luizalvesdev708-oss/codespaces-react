import { useMemo, useState } from 'react';
import type { DashboardData } from '../@types/censo';

export function useCensusFilters(data: DashboardData) {
  const [cargo, setCargo] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const records = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return data.records.filter((record) => (
      (!cargo || record.cargo === cargo)
      && (!status || record.status === status)
      && (!query || `${record.nome} ${record.matricula} ${record.cpf}`.toLocaleLowerCase('pt-BR').includes(query))
    ));
  }, [cargo, data.records, search, status]);

  const cargos = useMemo(
    () => Object.keys(data.cargo_counts).sort((first, second) => first.localeCompare(second, 'pt-BR')),
    [data.cargo_counts],
  );

  const clear = () => {
    setCargo('');
    setStatus('');
    setSearch('');
  };

  return { cargo, status, search, records, cargos, setCargo, setStatus, setSearch, clear };
}
