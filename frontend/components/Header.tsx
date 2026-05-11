import React from 'react';
import { User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Header({ title }: { title: string }) {
  const { usuario } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-11 w-full items-center justify-between bg-white px-6 border-b border-slate-100">
      <div className="flex items-center gap-6">
        <h1 className="text-sm font-black text-slate-800 uppercase tracking-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-slate-700">{usuario?.nome}</span>
            <span className="text-[9px] font-bold text-[#B21212] uppercase tracking-widest">{usuario?.perfil}</span>
          </div>
          <div className="h-7 w-7 rounded-full bg-slate-100 border-2 border-slate-50 flex items-center justify-center text-slate-400 overflow-hidden">
            <img
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${usuario?.username}`}
              alt="Avatar"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
