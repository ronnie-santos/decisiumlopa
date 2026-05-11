import React, { useState } from 'react';
import { Header } from '../components/Header';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Search, X, Percent, TrendingDown, FileDown } from 'lucide-react';
import { cn } from '../utils/cn';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ComissaoRow {
  tipo: 'os' | 'desconto';
  data: string | null;
  idordem: number | null;
  numero_os: number | null;
  cliente_nome: string;
  cidade_servico: string;
  equipamento_nome: string;
  empresa_fantasia: string;
  horario: string;
  km_total: number;
  valor_os: number;
  comissao: number;
  observacao: string;
  funcionario_id: number;
  funcionario_nome: string;
}

interface Grupo {
  funcionario_id: number;
  funcionario_nome: string;
  rows: ComissaoRow[];
  subtotal: number;
}

interface RelatorioData {
  grupos: Grupo[];
  total_geral: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

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
export function ComissaoPage() {
  const [dataDe, setDataDe] = useState(firstOfMonth());
  const [dataAte, setDataAte] = useState(today());
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RelatorioData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBuscar = async () => {
    if (!dataDe || !dataAte) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const params = new URLSearchParams({ data_de: dataDe, data_ate: dataAte });
      const res = await fetch(`/api/ordens/relatorio/comissao?${params}`);
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
    setData(null);
    setError(null);
  };

  const totalRows = data?.grupos.reduce((s, g) => s + g.rows.length, 0) ?? 0;

  return (
    <div className="flex flex-col h-full">
      <Header title="Relatório: Comissão de Funcionários" />

      <div className="p-5 space-y-4">

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border-l-4 border-[#B21212] p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total de Comissões</p>
                <h3 className="text-xl font-black text-slate-800">{brl(data.total_geral)}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{totalRows} lançamento{totalRows !== 1 ? 's' : ''} · {data.grupos.length} funcionário{data.grupos.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center text-[#B21212] flex-shrink-0 ml-3">
                <Percent className="h-5 w-5" />
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-44">
              <Input
                label="De"
                type="date"
                value={dataDe}
                onChange={e => setDataDe(e.target.value)}
              />
            </div>
            <div className="w-44">
              <Input
                label="Até"
                type="date"
                value={dataAte}
                onChange={e => setDataAte(e.target.value)}
              />
            </div>
            <Button
              className="gap-2"
              onClick={handleBuscar}
              disabled={loading || !dataDe || !dataAte}
            >
              <Search className="h-4 w-4" />
              {loading ? 'Buscando...' : 'Buscar'}
            </Button>
            <Button
              variant="secondary"
              className="gap-2"
              onClick={handleLimpar}
            >
              <X className="h-4 w-4" />
              Limpar
            </Button>
            {data && (
              <Button
                className="gap-2"
                onClick={() => {
                  const params = new URLSearchParams({ data_de: dataDe, data_ate: dataAte });
                  window.open(`/api/ordens/relatorio/comissao/pdf?${params}`, '_blank');
                }}
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
              <Percent className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600">Selecione o período e clique em Buscar</p>
            <p className="text-xs text-slate-400 mt-1">O relatório será gerado com as comissões do período selecionado.</p>
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
                Nenhuma comissão encontrada para o período selecionado.
              </div>
            ) : (
              <>
                {data.grupos.map(grupo => (
                  <div key={grupo.funcionario_id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    {/* Cabeçalho do funcionário */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800">
                      <span className="text-sm font-bold text-white uppercase tracking-wide">
                        {grupo.funcionario_nome || `Funcionário #${grupo.funcionario_id}`}
                      </span>
                    </div>

                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/70 border-b border-slate-100">
                          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data</th>
                          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">OS</th>
                          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente</th>
                          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cidade</th>
                          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equipamento</th>
                          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empresa</th>
                          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">KM</th>
                          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Valor OS</th>
                          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Comissão</th>
                          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Obs</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {grupo.rows.map((row, idx) => (
                          <tr
                            key={idx}
                            className={cn(
                              "transition-colors",
                              row.tipo === 'desconto'
                                ? 'bg-red-50/40 hover:bg-red-50'
                                : 'hover:bg-slate-50/50'
                            )}
                          >
                            <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">{fmtDate(row.data)}</td>
                            <td className="px-3 py-2 text-xs text-slate-600">
                              {row.numero_os
                                ? `#${String(row.numero_os).padStart(4, '0')}`
                                : row.idordem ? `ID ${row.idordem}` : '—'
                              }
                            </td>
                            <td className="px-3 py-2 text-xs font-medium text-slate-800">{row.cliente_nome || '—'}</td>
                            <td className="px-3 py-2 text-xs text-slate-600">{row.cidade_servico || '—'}</td>
                            <td className="px-3 py-2 text-xs text-slate-600">{row.equipamento_nome || '—'}</td>
                            <td className="px-3 py-2 text-xs text-slate-600">{row.empresa_fantasia || '—'}</td>
                            <td className="px-3 py-2 text-xs text-slate-600 text-right">{row.km_total > 0 ? row.km_total : '—'}</td>
                            <td className="px-3 py-2 text-xs text-slate-600 text-right">
                              {row.valor_os > 0 ? brl(row.valor_os) : '—'}
                            </td>
                            <td className={cn(
                              "px-3 py-2 text-xs font-bold text-right",
                              row.comissao < 0 ? 'text-red-600' : 'text-emerald-600'
                            )}>
                              {brl(row.comissao)}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-400 italic">
                              {row.observacao || ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-200 bg-slate-50">
                          <td colSpan={8} className="px-3 py-2 text-xs font-bold text-slate-700 text-right uppercase tracking-wide">
                            Subtotal {grupo.funcionario_nome}
                          </td>
                          <td className={cn(
                            "px-3 py-2 text-sm font-black text-right",
                            grupo.subtotal < 0 ? 'text-red-600' : 'text-emerald-600'
                          )}>
                            {brl(grupo.subtotal)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ))}

                {/* Total geral */}
                <div className="bg-slate-800 rounded-xl px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <TrendingDown className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Total Geral</span>
                    <span className="text-xs text-slate-500">· {data.grupos.length} funcionário{data.grupos.length !== 1 ? 's' : ''}</span>
                  </div>
                  <span className={cn(
                    "text-lg font-black",
                    data.total_geral < 0 ? 'text-red-400' : 'text-emerald-400'
                  )}>
                    {brl(data.total_geral)}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
