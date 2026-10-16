import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import TrendChart from './TrendChart';

test('limits date labels and highlights only key values for dense series', () => {
  const entries: [string, number][] = [
    ['06/03/2026', 18],
    ['01/03/2026', 2],
    ['05/03/2026', 25],
    ['02/03/2026', 8],
    ['04/03/2026', 17],
    ['03/03/2026', 12],
  ];
  const { container } = render(<TrendChart entries={entries} />);

  expect(screen.getByRole('img', { name: 'Cadastros por data: 82 registros em 6 datas' })).toBeDefined();
  expect(container.querySelectorAll('.trend-chart__label')).toHaveLength(5);
  expect(container.querySelectorAll('.trend-chart__value')).toHaveLength(3);
  expect(container.querySelector('.trend-chart__label')?.textContent).toBe('01/03');
  expect(container.querySelectorAll('.trend-chart__point title')[0]?.textContent).toBe('01/03/2026: 2 cadastros');
});

test('shows a helpful empty state when there are no dates', () => {
  render(<TrendChart entries={[]} />);

  expect(screen.getByText('Não há cadastros no período selecionado.')).toBeDefined();
});
