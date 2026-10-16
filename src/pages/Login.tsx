import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';

export default function Login() {
  const { login, sessionError, retrySession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
    } catch (cause) {
      setError(cause instanceof ApiError
        ? cause.message
        : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <span className="brand__mark" aria-hidden="true">C</span>
          <span>Censo Previdenciário</span>
        </div>
        <p className="login-eyebrow">Acesso seguro</p>
        <h1 id="login-title">Bem-vindo</h1>
        <p className="login-description">Entre com suas credenciais para acessar o painel.</p>
        {sessionError && (
          <div className="auth-alert" role="alert">
            <span>{sessionError}</span>
            <button type="button" onClick={retrySession}>Tentar novamente</button>
          </div>
        )}
        {error && <p className="auth-alert" role="alert">{error}</p>}
        <form className="login-form" onSubmit={submit}>
          <label className="login-field" htmlFor="login-email">
            <span>E-mail</span>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              required
              disabled={isSubmitting}
            />
          </label>
          <label className="login-field" htmlFor="login-password">
            <span>Senha</span>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              maxLength={128}
              required
              disabled={isSubmitting}
            />
          </label>
          <button className="login-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <><span className="login-spinner" aria-hidden="true" /> Entrando…</> : 'Entrar'}
          </button>
        </form>
        <p className="login-security-note">Sua sessão é protegida por cookie seguro e não armazena a senha neste dispositivo.</p>
      </section>
    </main>
  );
}
