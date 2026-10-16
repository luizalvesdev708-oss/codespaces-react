export const formatCount = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value);
export const formatMoney = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
export const formatPercent = (value: number, total: number) => total ? `${((value / total) * 100).toFixed(1).replace('.', ',')}%` : '0,0%';
export const formatCompetence = (value: string | null | undefined) => {
	if (!value) return 'Sem competência';
	const label = new Date(`${value.slice(0, 7)}-01T00:00:00.000Z`)
		.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' })
		.replace('.', '');
	return `${label.slice(0, 1).toLocaleUpperCase('pt-BR')}${label.slice(1)}`;
};
export const maskCpf = (value: string) => {
	const digits = value.replace(/\D/g, '');
	return digits.length === 11 ? `***.***.***-${digits.slice(-2)}` : value;
};