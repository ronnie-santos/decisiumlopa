import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { Button } from '../components/ui/Button';

export function SemAcessoPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
      <div className="text-center space-y-4 max-w-sm">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
            <ShieldOff className="h-8 w-8 text-[#B21212]" />
          </div>
        </div>
        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Acesso Negado</h1>
        <p className="text-sm text-slate-500">
          Você não tem permissão para acessar esta página. Contate o administrador do sistema.
        </p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Voltar
        </Button>
      </div>
    </div>
  );
}
