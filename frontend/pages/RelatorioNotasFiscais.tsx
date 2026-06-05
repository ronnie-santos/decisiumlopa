import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Search, X, FileText, FileDown, TrendingUp, Hash, DollarSign, Landmark } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface NotaRow {
  idnota: number;
  numero: number | null;
  data_emissao: string | null;
  cliente_nome: string;
  valor_nota: number;
  iss: number;
  inss: number;
  resp_imposto: string;
}

interface Grupo {
  idempresa: number;
  empresa_nome: string;
  empresa_fantasia: string;
  rows: NotaRow[];
  subtotal_valor: number;
  subtotal_iss: number;
  subtotal_inss: number;
  count: number;
}

interface RelatorioData {
  grupos: Grupo[];
  total_valor: number;
  total_iss: number;
  total_inss: number;
  total_notas: number;
}

interface Empresa {
  idempresa: number;
  nome: string;
  nomefantasia: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);

const fmtDate = (s: string | null) => {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};

function today() {
  return new Date().toISOString().split('T')[0];
}

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function RelatorioNotasFiscaisPage() {
  const [dataDe, setDataDe]       = useState(firstOfMonth());
  const [dataAte, setDataAte]     = useState(today());
  const [empresaId, setEmpresaId] = useState('');
  const [empresas, setEmpresas]   = useState<Empresa[]>([]);

  const [loading, setLoading] = useState(false);
  const [data, setData]       = useState<RelatorioData | null>(null);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/empresas?limit=200')
      .then(r => r.json())
      .then(d => setEmpresas(Array.isArray(d) ? d : d.data ?? []))
      .catch(() => {});
  }, []);

  const buildParams = () => {
    const params = new URLSearchParams({ data_ini: dataDe, data_fim: dataAte });
    if (empresaId) params.set('idempresa', empresaId);
    return params;
  };

  const handleBuscar = async () => {
    if (!dataDe || !dataAte) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/notas-fiscais/relatorio/notas-emitidas?${buildParams()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Erro ${res.status}`);
      }
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar relatório.');
    } finally {
      setLoading(false);
    }
  };

  const handleLimpar = () => {
    setDataDe(firstOfMonth());
    setDataAte(today());
    setEmpresaId('');
    setData(null);
    setError(null);
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Relatório: Notas Fiscais Emitidas" />

      <div className="p-5 space-y-4">

        {/* Summary cards  **/}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border-l-4 border-[#B21212] p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total de Notas</p>
                <h3 className="text-xl font-black text-slate-800">{data.total_notas}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{data.grupos.length} empresa{data.grupos.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center text-[#B21212] flex-shrink-0 ml-3">
                <Hash className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-white rounded-xl border-l-4 border-emerald-500 p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Valor Total NFs</p>
                <h3 className="text-xl font-black text-slate-800">{brl(data.total_valor)}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">soma do período</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0 ml-3">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-white rounded-xl border-l-4 border-sky-500 p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total ISS</p>
                <h3 className="text-xl font-black text-slate-800">{brl(data.total_iss)}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">resp. imposto = S</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 flex-shrink-0 ml-3">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-white rounded-xl border-l-4 border-violet-500 p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total INSS</p>
                <h3 className="text-xl font-black text-slate-800">{brl(data.total_inss)}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">retenção previdência</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600 flex-shrink-0 ml-3">
                <Landmark className="h-5 w-5" />
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-44">
              <Input label="De" type="date" value={dataDe} onChange={e => setDataDe(e.target.value)} />
            </div>
            <div className="w-44">
              <Input label="Até" type="date" value={dataAte} onChange={e => setDataAte(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Empresa</span>
              <select
                value={empresaId}
                onChange={e => setEmpresaId(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#B21212]/20 w-56"
              >
                <option value="">Todas as empresas</option>
                {empresas.map(e => (
                  <option key={e.idempresa} value={String(e.idempresa)}>
                    {e.nomefantasia || e.nome}
                  </option>
                ))}
              </select>
            </div>
            <Button className="gap-2" onClick={handleBuscar} disabled={loading || !dataDe || !dataAte}>
              <Search className="h-4 w-4" />
              {loading ? 'Buscando...' : 'Buscar'}
            </Button>
            <Button variant="secondary" className="gap-2" onClick={handleLimpar}>
              <X className="h-4 w-4" />
              Limpar
            </Button>
            {data && data.total_notas > 0 && (
              <Button
                className="gap-2"
                onClick={() => window.open(`/api/notas-fiscais/relatorio/notas-emitidas/pdf?${buildParams()}`, '_blank')}
              >
                <FileDown className="h-4 w-4" />
                Gerar PDF
              </Button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Estado inicial */}
        {!loading && !data && !error && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
              <FileText className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600">Selecione o período e clique em Buscar</p>
            <p className="text-xs text-slate-400 mt-1">Filtre por empresa específica ou consulte todas de uma vez.</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 text-center text-sm text-slate-400">
            Carregando...
          </div>
        )}

        {/* Resultado */}
        {data && !loading && (
          <div className="space-y-4">
            {data.grupos.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 text-center text-sm text-slate-400">
                Nenhuma nota fiscal encontrada para o período e filtros selecionados.
              </div>
            ) : (
              <>
                {data.grupos.map(grupo => (
                  <div key={grupo.idempresa} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    {/* Cabeçalho da empresa */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800">
                      <span className="text-sm font-bold text-white uppercase tracking-wide">
                        {grupo.empresa_fantasia || grupo.empresa_nome || `Empresa #${grupo.idempresa}`}
                      </span>
                      <span className="text-xs text-slate-400">
                        {grupo.count} nota{grupo.count !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[640px]">
                        <thead>
                          <tr className="bg-slate-50/70 border-b border-slate-100">
                            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Data</th>
                            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente</th>
                            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nº NF</th>
                            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Valor NF</th>
                            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">ISS</th>
                            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">INSS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {grupo.rows.map((row) => (
                            <tr key={row.idnota} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">
                                {fmtDate(row.data_emissao)}
                              </td>
                              <td className="px-3 py-2 text-xs font-medium text-slate-800">
                                {row.cliente_nome || '—'}
                              </td>
                              <td className="px-3 py-2 text-xs text-slate-600">
                                {row.numero ? `#${String(row.numero).padStart(5, '0')}` : `ID ${row.idnota}`}
                              </td>
                              <td className="px-3 py-2 text-xs font-bold text-emerald-600 text-right">
                                {brl(row.valor_nota)}
                              </td>
                              <td className="px-3 py-2 text-xs text-right">
                                {row.iss > 0 ? (
                                  <span className="text-sky-600 font-medium">{brl(row.iss)}</span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-xs text-violet-600 text-right">
                                {row.inss > 0 ? brl(row.inss) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-slate-200 bg-slate-50">
                            <td colSpan={3} className="px-3 py-2 text-xs font-bold text-slate-700 text-right uppercase tracking-wide">
                              Subtotal {grupo.empresa_fantasia || grupo.empresa_nome}
                            </td>
                            <td className="px-3 py-2 text-sm font-black text-emerald-600 text-right">
                              {brl(grupo.subtotal_valor)}
                            </td>
                            <td className="px-3 py-2 text-sm font-black text-sky-600 text-right">
                              {grupo.subtotal_iss > 0 ? brl(grupo.subtotal_iss) : '—'}
                            </td>
                            <td className="px-3 py-2 text-sm font-black text-violet-600 text-right">
                              {grupo.subtotal_inss > 0 ? brl(grupo.subtotal_inss) : '—'}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ))}

                {/* Total Geral */}
                <div className="bg-slate-800 rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-white">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Total Geral</span>
                    <span className="text-xs text-slate-500">
                      · {data.total_notas} nota{data.total_notas !== 1 ? 's' : ''}
                      · {data.grupos.length} empresa{data.grupos.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-6">
                    {data.total_inss > 0 && (
                      <div className="text-right">
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">INSS</p>
                        <p className="text-sm font-black text-violet-400">{brl(data.total_inss)}</p>
                      </div>
                    )}
                    {data.total_iss > 0 && (
                      <div className="text-right">
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">ISS</p>
                        <p className="text-sm font-black text-sky-400">{brl(data.total_iss)}</p>
                      </div>
                    )}
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest">Valor Total</p>
                      <p className="text-lg font-black text-emerald-400">{brl(data.total_valor)}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
