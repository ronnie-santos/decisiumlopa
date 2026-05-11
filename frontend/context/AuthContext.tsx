import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export interface PermissaoModulo {
  ler: boolean;
  criar: boolean;
  editar: boolean;
  excluir: boolean;
  exportar: boolean;
}

export interface UsuarioLogado {
  id: number;
  username: string;
  nome: string;
  perfil: string;
  permissoes: Record<string, PermissaoModulo>;
}

interface AuthContextType {
  usuario: UsuarioLogado | null;
  token: string | null;
  carregando: boolean;
  isAuthenticated: boolean;
  login: (username: string, senha: string) => Promise<void>;
  logout: () => void;
  temPermissao: (modulo: string, acao?: keyof PermissaoModulo) => boolean;
}

const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutos

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logout = useCallback(() => {
    setUsuario(null);
    setToken(null);
    localStorage.removeItem('lopa_token');
    localStorage.removeItem('lopa_refresh');
    localStorage.removeItem('lopa_last_activity');
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      logout();
    }, INACTIVITY_MS);
  }, [logout]);

  // Monitora atividade do usuário enquanto autenticado
  useEffect(() => {
    if (!usuario) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    const onActivity = () => resetInactivityTimer();

    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    resetInactivityTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity));
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      }
    };
  }, [usuario, resetInactivityTimer]);

  // Valida token salvo ao inicializar
  useEffect(() => {
    const storedToken = localStorage.getItem('lopa_token');
    if (!storedToken) {
      setCarregando(false);
      return;
    }

    const lastActivity = localStorage.getItem('lopa_last_activity');

    // Sem registro de atividade = sessão antiga sem controle de inatividade → força novo login
    if (!lastActivity) {
      localStorage.removeItem('lopa_token');
      localStorage.removeItem('lopa_refresh');
      setCarregando(false);
      return;
    }

    // Token inativo há mais de 30 minutos → limpa sessão
    const elapsed = Date.now() - parseInt(lastActivity, 10);
    if (elapsed > INACTIVITY_MS) {
      localStorage.removeItem('lopa_token');
      localStorage.removeItem('lopa_refresh');
      localStorage.removeItem('lopa_last_activity');
      setCarregando(false);
      return;
    }

    const controller = new AbortController();
    // Flag para distinguir abort do StrictMode (cleanup) do abort por timeout.
    // O abort do StrictMode não deve chamar setCarregando(false) — o segundo
    // mount fará isso. O abort por timeout DEVE chamar, para não travar a UI.
    let strictModeCleanup = false;
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${storedToken}` },
      signal: controller.signal,
    })
      .then(r => {
        if (!r.ok) throw new Error('Token invalido');
        return r.json();
      })
      .then((data: UsuarioLogado) => {
        setToken(storedToken);
        setUsuario(data);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        localStorage.removeItem('lopa_token');
        localStorage.removeItem('lopa_refresh');
        localStorage.removeItem('lopa_last_activity');
      })
      .finally(() => {
        clearTimeout(timeoutId);
        // Não chama setCarregando(false) apenas quando o abort veio do cleanup
        // do StrictMode — nesse caso o segundo mount já vai chamar.
        if (!strictModeCleanup) {
          setCarregando(false);
        }
      });

    return () => {
      strictModeCleanup = true;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, []);

  const login = async (username: string, senha: string) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, senha }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.detail ?? 'Erro ao autenticar');
    }
    const data = await r.json();
    localStorage.setItem('lopa_token', data.access_token);
    localStorage.setItem('lopa_refresh', data.refresh_token);
    localStorage.setItem('lopa_last_activity', String(Date.now()));
    // Reload completo garante estado React limpo após re-login (elimina overlays/modais presos)
    window.location.href = '/';
  };

  // Atualiza timestamp de última atividade periodicamente enquanto autenticado
  useEffect(() => {
    if (!usuario) return;
    const interval = setInterval(() => {
      if (localStorage.getItem('lopa_token')) {
        localStorage.setItem('lopa_last_activity', String(Date.now()));
      }
    }, 60_000); // a cada 1 minuto
    return () => clearInterval(interval);
  }, [usuario]);

  const temPermissao = (modulo: string, acao: keyof PermissaoModulo = 'ler'): boolean => {
    if (!usuario) return false;
    return usuario.permissoes[modulo]?.[acao] ?? false;
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        token,
        carregando,
        isAuthenticated: !!usuario,
        login,
        logout,
        temPermissao,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
