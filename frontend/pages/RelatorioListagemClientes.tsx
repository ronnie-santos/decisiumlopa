import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Search, X, FileDown, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../utils/cn';

const PAGE_SIZE = 50;

interface Endereco {
  idcliend?: number;
  tipo_logradouro?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  idestado?: string | null;
  idcidade?: number | null;
  cep?: string | null;
  complemento?: string | null;
  tipo_endereco?: string | null;
}

interface ContatoItem {
  idclienteforma?: number;
  idformacontato?: number | null;
  valor?: string | null;
}

interface Cliente {
  idcliente: number;
  nome: string | null;
  nomefantasia: string | null;
  cnpj_cpf: string | null;
  ie_rg: string | null;
  tipo: string | null;
  status: string | null;
  enderecos: Endereco[];
  contatos: ContatoItem[];
}

export function RelatorioListagemClientesPage() {
  const [todos, setTodos]         = useState<Cliente[]>([]);
  const [filtered, setFiltered]   = useState<Cliente[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searched, setSearched]   = useState(false);
  const [formaContatoMap, setFormaContatoMap] = useState<Record<number, string>>({});

  const [filterNome, setFilterNome]     = useState('');
  const [filterTipo, setFilterTipo]     = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch('/api/clientes?limit=5000').then(r => r.ok ? r.json() : { data: [] }),
      fetch('/api/formacontato').then(r => r.ok ? r.json() : []),
    ]).then(([json, formas]) => {
      setTodos(Array.isArray(json) ? json : (json.data ?? []));
      if (Array.isArray(formas)) {
        const map: Record<number, string> = {};
        formas.forEach((f: { idformacontato: number; nome: string }) => {
          map[f.idformacontato] = f.nome;
        });
        setFormaContatoMap(map);
      }
    }).catch(() => {}).finally(() => setInitialLoading(false));
  }, []);

  const tipos      = [...new Set(todos.map(c => c.tipo).filter(Boolean))] as string[];
  const statusList = [...new Set(todos.map(c => c.status).filter(Boolean))] as string[];

  const applyFilter = (nome: string, tipo: string, status: string) =>
    todos.filter(c => {
      const n = (c.nomefantasia || c.nome || '').toLowerCase();
      if (nome   && !n.includes(nome.toLowerCase())) return false;
      if (tipo   && c.tipo   !== tipo)               return false;
      if (status && c.status !== status)             return false;
      return true;
    });

  const handleBuscar = () => {
    setFiltered(applyFilter(filterNome, filterTipo, filterStatus));
    setSearched(true);
    setPage(0);
  };

  const handleLimpar = () => {
    setFilterNome('');
    setFilterTipo('');
    setFilterStatus('');
    setFiltered([]);
    setSearched(false);
    setPage(0);
  };

  const buildPdfParams = () => {
    const p = new URLSearchParams();
    if (filterNome)   p.set('nome',   filterNome);
    if (filterTipo)   p.set('tipo',   filterTipo);
    if (filterStatus) p.set('status', filterStatus);
    return p;
  };

  const formatEnderecos = (enderecos: Endereco[]): string => {
    if (!enderecos?.length) return '—';
    return enderecos.map(e => {
      const logradouro = [e.tipo_logradouro, e.logradouro, e.numero].filter(Boolean).join(' ');
      const loc        = [e.idestado, e.cep].filter(Boolean).join(' - ');
      return [logradouro, loc].filter(Boolean).join('\n');
    }).filter(Boolean).join('\n\n');
  };

  const formatContatos = (contatos: ContatoItem[]): string => {
    if (!contatos?.length) return '—';
    return contatos
      .filter(c => c.valor)
      .map(c => {
        const tipo = c.idformacontato ? formaContatoMap[c.idformacontato] : null;
        return tipo ? `${tipo}: ${c.valor}` : c.valor!;
      })
      .join('\n') || '—';
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Relatório: Listagem de Clientes" />

      <div className="p-5 space-y-4">

        {/* Summary card — aparece só depois de buscar */}
        {searched && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border-l-4 border-[#B21212] p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                  Clientes Encontrados
                </p>
                <h3 className="text-xl font-black text-slate-800">{filtered.length}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  de {todos.length} cadastrado{todos.length !== 1 ? 's' : ''} no sistema
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center text-[#B21212] flex-shrink-0 ml-3">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                label="Nome / Fantasia"
                placeholder="Buscar cliente..."
                value={filterNome}
                onChange={e => setFilterNome(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleBuscar()}
              />
            </div>

            <div className="w-40">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
                Tipo
              </label>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#B21212]/20"
                value={filterTipo}
                onChange={e => setFilterTipo(e.target.value)}
              >
                <option value="">Todos</option>
                {tipos.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="w-40">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
                Status
              </label>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#B21212]/20"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
              >
                <option value="">Todos</option>
                {statusList.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <Button
              className="gap-2"
              onClick={handleBuscar}
              disabled={initialLoading}
            >
              <Search className="h-4 w-4" />
              {initialLoading ? 'Carregando...' : 'Buscar'}
            </Button>
            <Button variant="secondary" className="gap-2" onClick={handleLimpar}>
              <X className="h-4 w-4" />
              Limpar
            </Button>
            {searched && (
              <Button
                className="gap-2"
                onClick={() => window.open(`/api/clientes/relatorio/pdf?${buildPdfParams()}`, '_blank')}
              >
                <FileDown className="h-4 w-4" />
                Gerar PDF
              </Button>
            )}
          </div>
        </div>

        {/* Estado inicial */}
        {!searched && !initialLoading && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
              <Users className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600">
              Aplique os filtros desejados e clique em Buscar
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {todos.length} cliente{todos.length !== 1 ? 's' : ''} disponíve{todos.length !== 1 ? 'is' : 'l'} para consulta.
            </p>
          </div>
        )}

        {/* Carregando dados iniciais */}
        {initialLoading && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 text-center text-sm text-slate-400">
            Carregando clientes...
          </div>
        )}

        {/* Resultado */}
        {searched && (() => {
          const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
          const pageRows   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
          return (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800">
              <Users className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-bold text-white uppercase tracking-wide">
                Listagem de Clientes
              </span>
              <span className="ml-auto text-[10px] text-slate-400">
                {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100">
                  <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-10">#</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome / Fantasia</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">CNPJ / CPF</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">IE / RG</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Endereço</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contatos</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pageRows.map((c, idx) => (
                  <tr key={c.idcliente} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-2 text-xs text-slate-400">{page * PAGE_SIZE + idx + 1}</td>
                    <td className="px-3 py-2">
                      <p className="text-xs font-bold text-slate-800">{c.nomefantasia || c.nome || '—'}</p>
                      {c.nomefantasia && c.nome && (
                        <p className="text-[10px] text-slate-400">{c.nome}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{c.cnpj_cpf || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{c.ie_rg || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 max-w-[200px]">
                      {c.enderecos?.length
                        ? c.enderecos.map((e, i) => {
                            const logradouro = [e.tipo_logradouro, e.logradouro, e.numero].filter(Boolean).join(' ');
                            const loc        = [e.idestado, e.cep].filter(Boolean).join(' - ');
                            return (
                              <div key={i} className={i > 0 ? 'mt-1 pt-1 border-t border-slate-100' : ''}>
                                {logradouro && <p>{logradouro}</p>}
                                {loc        && <p className="text-[10px] text-slate-400">{loc}</p>}
                              </div>
                            );
                          })
                        : <span className="text-slate-400">—</span>
                      }
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 max-w-[180px]">
                      {c.contatos?.filter(ct => ct.valor).length
                        ? c.contatos.filter(ct => ct.valor).map((ct, i) => {
                            const tipo = ct.idformacontato ? formaContatoMap[ct.idformacontato] : null;
                            return (
                              <div key={i} className={i > 0 ? 'mt-0.5' : ''}>
                                {tipo
                                  ? <><span className="font-semibold text-slate-500">{tipo}:</span> {ct.valor}</>
                                  : ct.valor
                                }
                              </div>
                            );
                          })
                        : <span className="text-slate-400">—</span>
                      }
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={cn(
                        'inline-flex px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border',
                        c.status === 'ATIVO'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      )}>
                        {c.status || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                      Nenhum cliente encontrado com os filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="px-4 py-2.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                {filtered.length} cliente{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
                {totalPages > 1 && ` — Página ${page + 1} de ${totalPages}`}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const p = totalPages <= 7 ? i : page < 4 ? i : page > totalPages - 4 ? totalPages - 7 + i : page - 3 + i;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={cn(
                          'h-7 w-7 flex items-center justify-center rounded-md text-xs font-semibold border',
                          p === page
                            ? 'bg-[#B21212] text-white border-[#B21212]'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                        )}
                      >
                        {p + 1}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page === totalPages - 1}
                    className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
          );
        })()}

      </div>
    </div>
  );
}
