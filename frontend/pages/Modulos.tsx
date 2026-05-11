import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Input } from '../components/ui/Input';
import { X, Search } from 'lucide-react';
import { Modulo } from '../types';
import { cn } from '../utils/cn';

export function ModulosPage() {
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/admin/modulos')
      .then(r => r.ok ? r.json() : [])
      .then((data: Modulo[]) => setModulos(data))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = modulos.filter(m =>
    m.nome.toLowerCase().includes(search.toLowerCase()) ||
    m.codigo.toLowerCase().includes(search.toLowerCase()) ||
    (m.descricao ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <Header title="Módulos do Sistema" />

      <div className="p-5 space-y-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20"
              placeholder="Buscar módulo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={() => setSearch('')} className="h-10 px-4 text-sm font-semibold text-slate-500 border border-slate-200 rounded-md hover:bg-slate-50 flex items-center gap-2">
            <X className="h-4 w-4" />Limpar
          </button>
          <span className="text-xs text-slate-400 self-center">
            {filtered.length} módulo{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-[#B21212]/20 border-t-[#B21212] rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Carregando...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">Nenhum módulo encontrado.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['ID', 'Nome', 'Código', 'Descrição', 'Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.idmodulo} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-xs font-bold text-[#B21212]">{m.idmodulo}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{m.nome}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{m.codigo}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{m.descricao || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                        m.ativo ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500')}>
                        {m.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
