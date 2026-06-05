import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Search, X, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { cn } from '../utils/cn';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DREItem {
  idfluxo: string;
  descricao: string;
  nivel: number;
  valor: number;
  ordem: string;
}

interface DREData {
  items: DREItem[];
  total_receitas: number;
  total_despesas: number;
  resultado: number;
}

interface Empresa {
  idempresa: number;
  nomefantasia: string;
  nome: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function today() {
  return new Date().toISOString().split('T')[0];
}

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ── RadioGroup ────────────────────────────────────────────────────────────────
function RadioGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
      <div className="flex flex-wrap gap-3">
        {options.map(opt => (
          <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="accent-[#B21212]"
            />
            <span className="text-xs text-slate-700">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
          checked ? 'bg-[#B21212]' : 'bg-slate-200'
        )}
      >
        <span className={cn(
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-1'
        )} />
      </div>
      <span className="text-xs text-slate-700">{label}</span>
    </label>
  );
}

// ── DRETable ──────────────────────────────────────────────────────────────────
const INDENT_CLS = ['pl-3', 'pl-7', 'pl-11', 'pl-16'] as const;

function DRETable({ items, resultado }: { items: DREItem[]; resultado: number }) {
  const positivo = resultado >= 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/70 border-b border-slate-100">
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-28 whitespace-nowrap">Conta</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrição</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right w-44">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {items.map(item => {
            const isRoot = item.nivel === 0;
            const isSub  = item.nivel === 1;
            const indent = INDENT_CLS[Math.min(item.nivel, 3)];

            return (
              <tr
                key={item.idfluxo}
                className={cn(
                  'transition-colors',
                  isRoot ? 'bg-slate-700' :
                  isSub  ? 'bg-slate-50 hover:bg-slate-100' :
                           'hover:bg-slate-50/50'
                )}
              >
                <td className={cn(
                  'px-3 py-2 text-xs font-mono whitespace-nowrap',
                  isRoot ? 'text-slate-300' : 'text-slate-400'
                )}>
                  {item.idfluxo}
                </td>
                <td className={cn(
                  'px-3 py-2 text-xs',
                  indent,
                  isRoot ? 'font-bold text-white uppercase tracking-wide' :
                  isSub  ? 'font-semibold text-slate-700' :
                           'text-slate-600'
                )}>
                  {item.descricao}
                </td>
                <td className={cn(
                  'px-3 py-2 text-xs text-right tabular-nums',
                  isRoot ? 'font-bold text-white' :
                  isSub  ? 'font-bold text-slate-700' :
                  item.valor >= 0 ? 'text-emerald-700' : 'text-[#B21212]'
                )}>
                  {brl(item.valor)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-500 bg-slate-800">
            <td colSpan={2} className="px-3 py-3 text-xs font-bold text-slate-300 uppercase tracking-widest text-right">
              Resultado Final
            </td>
            <td className={cn(
              'px-3 py-3 text-sm font-black text-right tabular-nums',
              positivo ? 'text-blue-300' : 'text-amber-300'
            )}>
              {brl(resultado)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function RelatorioDespesasReceitaPage() {
  const [empresas, setEmpresas]           = useState<Empresa[]>([]);
  const [dataDe, setDataDe]               = useState(firstOfMonth());
  const [dataAte, setDataAte]             = useState(today());
  const [tipoReceita, setTipoReceita]     = useState('ordens');
  const [tipoDespesa, setTipoDespesa]     = useState('vencidas');
  const [filtrarEmpresa, setFiltrarEmpresa] = useState(false);
  const [empresaId, setEmpresaId]         = useState('');
  const [loading, setLoading]             = useState(false);
  const [data, setData]                   = useState<DREData | null>(null);
  const [error, setError]                 = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/empresas?limit=200')
      .then(r => r.json())
      .then(d => setEmpresas(Array.isArray(d) ? d : d.data ?? []))
      .catch(() => {});
  }, []);

  const buildParams = () => {
    const params = new URLSearchParams({
      data_de:      dataDe,
      data_ate:     dataAte,
      tipo_receita: tipoReceita,
      tipo_despesa: tipoDespesa,
    });
    if (filtrarEmpresa && empresaId) params.set('idempresa', empresaId);
    return params;
  };

  const handleBuscar = async () => {
    if (!dataDe || !dataAte) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/fluxo-caixa/despesas-receita?${buildParams()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = body.detail;
        const msg =
          typeof detail === 'string' ? detail :
          Array.isArray(detail) ? detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ') :
          `Erro ${res.status}`;
        throw new Error(msg);
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
    setTipoReceita('ordens');
    setTipoDespesa('vencidas');
    setFiltrarEmpresa(false);
    setEmpresaId('');
    setData(null);
    setError(null);
  };

  const positivo = !data || data.resultado >= 0;

  return (
    <div className="flex flex-col h-full">
      <Header title="Relatório: Despesas vs Receita" />

      <div className="p-5 space-y-4">

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border-l-4 border-emerald-500 p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Receitas</p>
                <h3 className="text-xl font-black text-slate-800">{brl(data.total_receitas)}</h3>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0 ml-3">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-white rounded-xl border-l-4 border-[#B21212] p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Despesas</p>
                <h3 className="text-xl font-black text-slate-800">{brl(data.total_despesas)}</h3>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center text-[#B21212] flex-shrink-0 ml-3">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>

            <div className={cn(
              'bg-white rounded-xl border-l-4 p-4 shadow-sm flex items-center justify-between',
              positivo ? 'border-blue-500' : 'border-amber-400'
            )}>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Resultado</p>
                <h3 className={cn('text-xl font-black', positivo ? 'text-blue-700' : 'text-amber-600')}>
                  {brl(data.resultado)}
                </h3>
              </div>
              <div className={cn(
                'h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-3',
                positivo ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
              )}>
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm space-y-4">
          {/* Row 1: dates + buttons */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-44">
              <Input label="Período de" type="date" value={dataDe} onChange={e => setDataDe(e.target.value)} />
            </div>
            <div className="w-44">
              <Input label="Até" type="date" value={dataAte} onChange={e => setDataAte(e.target.value)} />
            </div>
            <Button className="gap-2" onClick={handleBuscar} disabled={loading || !dataDe || !dataAte}>
              <Search className="h-4 w-4" />
              {loading ? 'Buscando...' : 'Buscar'}
            </Button>
            <Button variant="secondary" className="gap-2" onClick={handleLimpar}>
              <X className="h-4 w-4" />
              Limpar
            </Button>
          </div>

          {/* Row 2: receita + despesa radio */}
          <div className="flex flex-wrap gap-8 pt-1 border-t border-slate-50">
            <RadioGroup
              label="Receitas"
              value={tipoReceita}
              onChange={setTipoReceita}
              options={[
                { value: 'ordens',        label: 'Ordens de Serviço' },
                { value: 'fat_gerados',   label: 'Faturamentos Gerados' },
                { value: 'fat_recebidos', label: 'Faturamentos Recebidos' },
              ]}
            />
            <RadioGroup
              label="Despesas"
              value={tipoDespesa}
              onChange={setTipoDespesa}
              options={[
                { value: 'vencidas', label: 'NF Vencidas no Período' },
                { value: 'pagas',    label: 'NF Pagas no Período' },
              ]}
            />
          </div>

          {/* Row 3: optional empresa filter */}
          <div className="flex flex-wrap gap-6 pt-1 border-t border-slate-50 items-end">
            <div className="flex flex-col gap-2">
              <Toggle
                checked={filtrarEmpresa}
                onChange={v => { setFiltrarEmpresa(v); if (!v) setEmpresaId(''); }}
                label="Filtrar por Empresa"
              />
              {filtrarEmpresa && (
                <select
                  value={empresaId}
                  onChange={e => setEmpresaId(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#B21212]/20 w-56"
                >
                  <option value="">Selecione uma empresa</option>
                  {empresas.map(e => (
                    <option key={e.idempresa} value={String(e.idempresa)}>
                      {e.nomefantasia || e.nome}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !data && !error && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
              <DollarSign className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600">Selecione o período e clique em Buscar</p>
            <p className="text-xs text-slate-400 mt-1">
              Os resultados são agrupados pelo plano de contas (Fluxo Financeiro).
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 text-center text-sm text-slate-400">
            Carregando...
          </div>
        )}

        {/* DRE result */}
        {data && !loading && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            {data.items.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400">
                Nenhum registro encontrado para o período e filtros selecionados.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-bold text-white uppercase tracking-wide">
                      DRE — Despesas vs Receita
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {data.items.length} conta{data.items.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <DRETable items={data.items} resultado={data.resultado} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
