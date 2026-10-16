import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import App from './App';
import { DATA } from './data/mockData';
import { maskCpf } from './utils/format';

const authenticatedUser = {
  sub: 'user-1',
  email: 'gestor@example.org',
  name: 'Gestora de Teste',
  roles: ['ADMIN'],
};

function response(body: unknown, status = 200) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installAuthenticatedApi() {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/auth/session')) return Promise.resolve(response(authenticatedUser));
    if (url.endsWith('/auth/logout')) return Promise.resolve(response(undefined, 204));
    if (url.startsWith('/api/dashboard/data')) return Promise.resolve(response(DATA));
    return Promise.resolve(response({ error: 'E-mail ou senha inválidos.' }, 401));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => installAuthenticatedApi());

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

test('exibe o painel e navega entre as páginas', async () => {
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Censo Previdenciário' })).toBeDefined();
  expect(await screen.findByRole('heading', { name: 'Resumo da folha por grupo' })).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Beneficiários por tipo' })).toBeDefined();
  expect(screen.getByText('Proventos e vencimentos')).toBeDefined();
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegação do painel' })).getByRole('button', { name: 'Relatórios' }));
  expect(screen.getByRole('heading', { name: 'Gerador de relatórios' })).toBeDefined();
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegação do painel' })).getByRole('button', { name: 'Visão geral' }));
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegação do painel' })).getByRole('button', { name: 'Base do censo' }));
  expect(screen.getByRole('heading', { name: 'Base do Censo Previdenciário' })).toBeDefined();
  expect(screen.getAllByText('MARIA JOSE DE OLIVEIRA').length).toBeGreaterThan(0);
});

test('filtra os registros por busca', async () => {
  render(<App />);
  await screen.findByRole('heading', { name: 'Censo Previdenciário' });
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegação do painel' })).getByRole('button', { name: 'Base do censo' }));
  fireEvent.change(screen.getByPlaceholderText('Nome, matrícula ou CPF'), { target: { value: 'MARIA JOSE' } });
  expect(screen.getByText('1 registro(s)')).toBeDefined();
  expect(screen.getAllByText('MARIA JOSE DE OLIVEIRA').length).toBeGreaterThan(0);
});

test('mascara CPFs completos e preserva os já mascarados', () => {
  expect(maskCpf('123.456.789-01')).toBe('***.***.***-01');
  expect(maskCpf('***.***.***-78')).toBe('***.***.***-78');
});

test('restaura sessão autenticada e carrega os dados analíticos da API', async () => {
  const fetchMock = installAuthenticatedApi();
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Censo Previdenciário' })).toBeDefined();
  expect(screen.getByText('Dados do sistema')).toBeDefined();
  expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', expect.objectContaining({ credentials: 'include' }));
  expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/data', expect.objectContaining({ credentials: 'include' }));
  expect(screen.getByRole('button', { name: 'Sair da sessão' })).toBeDefined();
  expect(DATA.records.length).toBeGreaterThan(0);
});

test('recarrega o dashboard ao mudar o regime global', async () => {
  const fetchMock = installAuthenticatedApi();
  render(<App />);
  await screen.findByRole('heading', { name: 'Censo Previdenciário' });
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'RETIRED' } });

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
    '/api/dashboard/data?category=RETIRED',
    expect.objectContaining({ credentials: 'include' }),
  ));
});

test('applies the pension regime and source filters to the dashboard request', async () => {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/auth/session')) return Promise.resolve(response(authenticatedUser));
    if (url.startsWith('/api/dashboard/data')) {
      return Promise.resolve(response({
        ...DATA,
        filterOptions: { regimes: ['IPSS'], sources: ['Dados fornecidos'] },
      }));
    }
    return Promise.resolve(response(undefined, 204));
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  await screen.findByRole('heading', { name: 'Censo Previdenciário' });
  fireEvent.change(screen.getByLabelText('Regime previdenciário'), { target: { value: 'IPSS' } });
  await screen.findByLabelText('Fonte');
  fireEvent.change(screen.getByLabelText('Fonte'), { target: { value: 'Dados fornecidos' } });

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
    '/api/dashboard/data?regime=IPSS&source=Dados+fornecidos',
    expect.objectContaining({ credentials: 'include' }),
  ));
});

test('shows the protected offline registration workflow to an authorized operator', async () => {
  render(<App />);
  await screen.findByRole('heading', { name: 'Censo Previdenciário' });
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegação do painel' })).getByRole('button', { name: 'Segurados' }));

  expect(await screen.findByRole('heading', { name: 'Cadastro offline protegido' })).toBeDefined();
  expect(screen.getByLabelText('Crie uma frase secreta (12+ caracteres)')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Criar e desbloquear cofre' })).toBeDefined();
  expect(screen.getByText(/Cópias sincronizadas permanecem até exclusão manual/u)).toBeDefined();
});

test('redireciona sessão anônima para login e mostra erros de credenciais', async () => {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => (
    String(input).endsWith('/auth/session')
      ? Promise.resolve(response({ error: 'Authentication required' }, 401))
      : Promise.resolve(response({ error: 'E-mail ou senha inválidos.' }, 401))
  )));
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Bem-vindo' })).toBeDefined();
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'gestor@example.org' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-incorreta' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  expect((await screen.findByRole('alert')).textContent).toContain('E-mail ou senha inválidos.');
});

test('valida o e-mail e a senha obrigatórios no formulário de login', async () => {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => (
    String(input).endsWith('/auth/session')
      ? Promise.resolve(response({ error: 'Authentication required' }, 401))
      : Promise.resolve(response({ error: 'E-mail ou senha inválidos.' }, 401))
  )));
  render(<App />);
  await screen.findByRole('heading', { name: 'Bem-vindo' });
  const email = screen.getByLabelText('E-mail') as HTMLInputElement;
  const password = screen.getByLabelText('Senha') as HTMLInputElement;
  expect(email.required).toBe(true);
  expect(password.required).toBe(true);
  expect(email.checkValidity()).toBe(false);
  fireEvent.change(email, { target: { value: 'endereco-invalido' } });
  expect(email.checkValidity()).toBe(false);
});

test('login e logout sincronizam a sessão com o backend', async () => {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/auth/session')) {
      return Promise.resolve(response({ error: 'Authentication required' }, 401));
    }
    if (url.endsWith('/auth/login')) return Promise.resolve(response(authenticatedUser));
    if (url.endsWith('/auth/logout')) return Promise.resolve(response(undefined, 204));
    if (url.endsWith('/dashboard/data')) return Promise.resolve(response(DATA));
    return Promise.resolve(response({ error: 'Not found' }, 404));
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  fireEvent.change(await screen.findByLabelText('E-mail'), { target: { value: 'gestor@example.org' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'Senha-forte-123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  expect(await screen.findByRole('heading', { name: 'Censo Previdenciário' })).toBeDefined();
  expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({ email: 'gestor@example.org', password: 'Senha-forte-123' }),
  }));
  fireEvent.click(screen.getByRole('button', { name: 'Sair da sessão' }));
  expect(await screen.findByRole('heading', { name: 'Bem-vindo' })).toBeDefined();
  expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }));
});

test('mantém o painel e informa quando o backend não consegue encerrar a sessão', async () => {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => (
    String(input).endsWith('/auth/logout')
      ? Promise.resolve(response({ error: 'Serviço indisponível.' }, 503))
      : String(input).endsWith('/dashboard/data')
        ? Promise.resolve(response(DATA))
      : Promise.resolve(response(authenticatedUser))
  )));
  render(<App />);
  await screen.findByRole('heading', { name: 'Censo Previdenciário' });
  fireEvent.click(screen.getByRole('button', { name: 'Sair da sessão' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível encerrar a sessão');
  expect(screen.getByRole('heading', { name: 'Censo Previdenciário' })).toBeDefined();
});

test('abre e fecha o menu retrátil por controle acessível', async () => {
  render(<App />);
  const trigger = await screen.findByRole('button', { name: 'Abrir menu de navegação' });
  fireEvent.click(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('complementary', { name: 'Navegação e filtros' }).classList.contains('is-open')).toBe(true);
  fireEvent.click(within(screen.getByRole('complementary', { name: 'Navegação e filtros' })).getByRole('button', { name: 'Fechar menu' }));
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});

test('abre filtros em diálogo móvel com fechamento por Escape', async () => {
  render(<App />);
  const trigger = await screen.findByRole('button', { name: 'Abrir filtros' });
  fireEvent.click(trigger);
  expect(screen.getByRole('dialog', { name: 'Filtros' })).toBeDefined();
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Filtros' })).toBeNull();
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});