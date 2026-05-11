import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Lock, User, Eye, EyeOff } from 'lucide-react';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState('');
  const { login, isAuthenticated, carregando } = useAuth();

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111827]">
        <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setIsLoading(true);
    try {
      await login(username, senha);
      // Redirect handled declaratively by: if (isAuthenticated) return <Navigate to="/" replace />
    } catch (error: any) {
      setErro(error?.message ?? 'Erro ao autenticar');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#111827] p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-1">
            <img src="/image/logo_empresa.png" alt="Lopa Guindastes" className="w-[122px] h-[122px] object-contain" />
          </div>
          <h2 className="text-xl font-bold text-slate-300 uppercase tracking-widest">Acesso ao Sistema</h2>
          <p className="mt-2 text-sm text-slate-500">Logística e Transportes de Cargas Pesadas</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-[38px] h-4 w-4 text-slate-400 z-10" />
                <Input
                  label="USUÁRIO"
                  type="text"
                  placeholder="Digite seu usuário"
                  className="pl-10"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-[38px] h-4 w-4 text-slate-400 z-10" />
                <Input
                  label="SENHA"
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {erro && (
              <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700 font-medium">
                {erro}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-sm font-bold uppercase tracking-widest"
              disabled={isLoading}
            >
              {isLoading ? 'Autenticando...' : 'ENTRAR'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500">
          &copy; {new Date().getFullYear()} Lopa Guindastes. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
