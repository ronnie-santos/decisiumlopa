import React from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useAuth, PermissaoModulo } from '../context/AuthContext';

interface PrivateRouteProps {
  children: React.ReactNode;
  modulo?: string;
  acao?: keyof PermissaoModulo;
}

function SemPermissao() {
  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-30 flex h-11 w-full items-center bg-white px-6 border-b border-slate-100">
        <span className="text-sm font-black text-slate-800 uppercase tracking-tight">Acesso Negado</span>
      </div>
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center space-y-3 max-w-sm">
          <div className="flex justify-center">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
              <ShieldOff className="h-7 w-7 text-[#B21212]" />
            </div>
          </div>
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Sem Permissão</h2>
          <p className="text-sm text-slate-500">
            Você não tem permissão para acessar este módulo. Contate o administrador.
          </p>
        </div>
      </div>
    </div>
  );
}

export function PrivateRoute({ children, modulo, acao = 'ler' }: PrivateRouteProps) {
  const { isAuthenticated, temPermissao } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (modulo && !temPermissao(modulo, acao)) {
    return <SemPermissao />;
  }

  return <>{children}</>;
}
