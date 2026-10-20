import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthUser } from '../@types/auth';
import { ApiError, apiRequest } from '../services/api';
import { clearOfflineSnapshot, deleteOfflineVault, readLastAuthenticatedUser, saveAuthenticatedUser } from '../services/offlineStore';

interface Credentials {
  email: string;
  password: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isOfflineSession: boolean;
  isLoading: boolean;
  sessionError: string;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => Promise<void>;
  retrySession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function getCurrentUser() {
  const currentUser = await apiRequest<AuthUser>('/auth/session');
  if (!currentUser) throw new ApiError('O serviço não retornou os dados da sessão.', 502);
  return currentUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isOfflineSession, setIsOfflineSession] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [sessionAttempt, setSessionAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setSessionError('');
    const restoreSession = async () => {
      try {
        if (!navigator.onLine) {
          const cachedUser = await readLastAuthenticatedUser();
          if (isCurrent && cachedUser) {
            setUser(cachedUser);
            setIsOfflineSession(true);
          } else if (isCurrent) {
            setSessionError('Sem conexão e sem uma sessão autenticada salva neste dispositivo.');
          }
          return;
        }
        const currentUser = await getCurrentUser();
        try {
          await saveAuthenticatedUser(currentUser);
        } catch (error) {
          console.warn('Não foi possível salvar a sessão para uso offline.', error);
        }
        if (isCurrent) {
          setUser(currentUser);
          setIsOfflineSession(false);
        }
      } catch (error: unknown) {
        if (!isCurrent) return;
        if (error instanceof ApiError && error.status === 401) {
          setUser(null);
          setIsOfflineSession(false);
          try {
            const cachedUser = await readLastAuthenticatedUser();
            if (cachedUser) {
              navigator.serviceWorker?.controller?.postMessage({
                type: 'CLEAR_USER_API_CACHE',
                userId: cachedUser.sub,
              });
              await clearOfflineSnapshot(cachedUser.sub);
            }
          } catch (storageError) {
            console.error('Não foi possível limpar a sessão local expirada.', storageError);
          }
          return;
        }
        if (error instanceof ApiError && error.status === 0) {
          try {
            const cachedUser = await readLastAuthenticatedUser();
            if (isCurrent && cachedUser) {
              setUser(cachedUser);
              setIsOfflineSession(true);
              return;
            }
          } catch (storageError) {
            console.error('Não foi possível restaurar a sessão offline.', storageError);
          }
        }
        setUser(null);
        setIsOfflineSession(false);
        setSessionError(error instanceof Error
          ? error.message
          : 'Não foi possível verificar sua sessão.');
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };
    void restoreSession();
    return () => {
      isCurrent = false;
    };
  }, [sessionAttempt]);

  useEffect(() => {
    if (!isOfflineSession) return;
    const retryWhenOnline = () => setSessionAttempt((attempt) => attempt + 1);
    window.addEventListener('online', retryWhenOnline);
    return () => window.removeEventListener('online', retryWhenOnline);
  }, [isOfflineSession]);

  const login = useCallback(async (credentials: Credentials) => {
    const authenticatedUser = await apiRequest<AuthUser>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (!authenticatedUser) throw new ApiError('O serviço não retornou os dados da sessão.', 502);
    try {
      await saveAuthenticatedUser(authenticatedUser);
    } catch (error) {
      console.warn('Não foi possível salvar a sessão para uso offline.', error);
    }
    setSessionError('');
    setIsOfflineSession(false);
    setUser(authenticatedUser);
  }, []);

  const logout = useCallback(async () => {
    await apiRequest<void>('/auth/logout', { method: 'POST' });
    if (user) {
      navigator.serviceWorker?.controller?.postMessage({
        type: 'CLEAR_USER_API_CACHE',
        userId: user.sub,
      });
      try {
        await Promise.all([
          clearOfflineSnapshot(user.sub),
          deleteOfflineVault(user.sub),
        ]);
      } catch (error) {
        console.error('Não foi possível remover os dados locais após sair.', error);
      }
    }
    setUser(null);
    setIsOfflineSession(false);
    setSessionError('');
  }, [user]);

  const retrySession = useCallback(() => setSessionAttempt((attempt) => attempt + 1), []);
  const value = useMemo(
    () => ({ user, isOfflineSession, isLoading, sessionError, login, logout, retrySession }),
    [user, isOfflineSession, isLoading, sessionError, login, logout, retrySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
