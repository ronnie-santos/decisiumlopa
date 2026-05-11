import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import {
  Search, X, FileDown, BarChart3,
  TrendingUp, TrendingDown, Scale,
} from 'lucide-react';
import { cn } from '../utils/cn';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DRENode {
  idfluxo: string;
  descricao: string;
  nivel: number;
  fluxo_pai: string;
  tipo: string;
  movimento: string;
  valor: number;
}

interface DREData {
  nodes: DRENode[];
  total_entradas: number;
  total_saidas: number;
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
      <div className="flex gap-3">
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

// ── Linha DRE ─────────────────────────────────────────────────────────────────
const NIVEL_STYLES: Record<number, string> = {
  0: 'bg-slate-800 text-white font-black uppercase tracking-wide',
  1: 'bg-slate-600 text-white font-bold',
  2: 'bg-slate-100 text-slate-700 font-semibold',
  3: 'bg-white text-slate-600',
};
const NIVEL_INDENT: Record<number, string> = {
  0: 'pl-3',
  1: 'pl-6',
  2: 'pl-10',
  3: 'pl-14',
};

function DRERow({ node }: { node: DRENode }) {
  const nivel = Math.min(node.nivel ?? 3, 3);
  const rowStyle = NIVEL_STYLES[nivel] ?? NIVEL_STYLES[3];
  const indent   = NIVEL_INDENT[nivel] ?? NIVEL_INDENT[3];

  const valorColor =
    node.valor > 0
      ? 'text-emerald-500'
      : node.valor < 0
        ? 'text-red-400'
        : 'text-slate-400';

  const valorFinal = nivel <= 1 ? `font-bold ${valorColor}` : valorColor;
  const fontSize   = nivel <= 1 ? 'text-xs' : 'text-[11px]';

  return (
    <tr className={cn('border-b border-slate-700/10 transition-colors', rowStyle)}>
      <td className={cn('py-1.5 text-[10px] font-mono whitespace-nowrap', indent, fontSize)}>
        {node.idfluxo}
      </td>
      <td className={cn('px-3 py-1.5', fontSize)}>
        {node.descricao}
      </td>
      <td className={cn('px-3 py-1.5 text-right font-mono whitespace-nowrap', fontSize, valorFinal)}>
        {brl(node.valor)}
      </td>
    </tr>
  );
}

// ── DRE Table ─────────────────────────────────────────────────────────────────
function DRETable({ nodes }: { nodes: DRENode[] }) {
  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-200">
          <th className="pl-3 pr-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-28">Código</th>
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrição</th>
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right w-36">Valor</th>
        </tr>
      </thead>
      <tbody>
        {nodes.map((node, idx) => (
          <DRERow key={`${node.idfluxo}-${idx}`} node={node} />
        ))}
      </tbody>
    </table>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function RelatorioDREPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  // Filtros
  const [dataDe, setDataDe]           = useState(firstOfMonth());
  const [dataAte, setDataAte]         = useState(today());
  const [empresaId, setEmpresaId]     = useState('');
  const [statusCp, setStatusCp]       = useState('ambas');
  const [statusCr, setStatusCr]       = useState('ambas');

  // Estado
  const [loading, setLoading]         = useState(false);
  const [data, setData]               = useState<DREData | null>(null);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/empresas?limit=200')
      .then(r => r.json())
      .then(d => setEmpresas(Array.isArray(d) ? d : d.data ?? []))
      .catch(() => {});
  }, []);

  const buildParams = () => {
    const params = new URLSearchParams({
      data_de:   dataDe,
      data_ate:  dataAte,
      status_cp: statusCp,
      status_cr: statusCr,
    });
    if (empresaId) params.set('idempresa', empresaId);
    return params;
  };

  const handleBuscar = async () => {
    if (!dataDe || !dataAte) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/contas-receber/relatorio/dre?${buildParams()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = body.detail;
        const msg = typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ')
            : `Erro ${res.status}`;
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
    setEmpresaId('');
    setStatusCp('ambas');
    setStatusCr('ambas');
    setData(null);
    setError(null);
  };

  const isPositivo = data ? data.resultado >= 0 : true;

  return (
    <div className="flex flex-col h-full">
      <Header title="Relatório: DRE — Demonstrativo de Resultado do Exercício" />

      <div className="p-5 space-y-4">

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border-l-4 border-emerald-500 p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Entradas</p>
                <h3 className="text-xl font-black text-emerald-600">{brl(data.total_entradas)}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Receitas do período</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 ml-3">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
            </div>

            <div className="bg-white rounded-xl border-l-4 border-[#B21212] p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Saídas</p>
                <h3 className="text-xl font-black text-[#B21212]">{brl(data.total_saidas)}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Despesas do período</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0 ml-3">
                <TrendingDown className="h-5 w-5 text-[#B21212]" />
              </div>
            </div>

            <div className={cn(
              'bg-white rounded-xl border-l-4 p-4 shadow-sm flex items-center justify-between',
              isPositivo ? 'border-blue-500' : 'border-amber-400'
            )}>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Resultado Final</p>
                <h3 className={cn('text-xl font-black', isPositivo ? 'text-blue-600' : 'text-amber-500')}>
                  {brl(data.resultado)}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{isPositivo ? 'Superávit' : 'Déficit'}</p>
              </div>
              <div className={cn(
                'h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-3',
                isPositivo ? 'bg-blue-50' : 'bg-amber-50'
              )}>
                <Scale className={cn('h-5 w-5', isPositivo ? 'text-blue-500' : 'text-amber-500')} />
              </div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm space-y-4">
          {/* Linha 1 — Datas e botões */}
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
            <Button variant="secondary" className="gap-2" onClick={handleLimpar}>
              <X className="h-4 w-4" />
              Limpar
            </Button>
            {data && (
              <Button
                className="gap-2"
                onClick={() => window.open(`/api/contas-receber/relatorio/dre/pdf?${buildParams()}`, '_blank')}
              >
                <FileDown className="h-4 w-4" />
                Gerar PDF
              </Button>
            )}
          </div>

          {/* Linha 2 — Empresa + Status CP + Status CR */}
          <div className="border-t border-slate-50 pt-4 flex flex-wrap items-start gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Empresa</span>
              <select
                value={empresaId}
                onChange={e => setEmpresaId(e.target.value)}
                className="text-xs border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#B21212] min-w-[180px]"
              >
                <option value="">Todas as Empresas</option>
                {empresas.map(emp => (
                  <option key={emp.idempresa} value={String(emp.idempresa)}>
                    {emp.nomefantasia || emp.nome}
                  </option>
                ))}
              </select>
            </div>

            <RadioGroup
              label="Contas a Pagar"
              options={[
                { value: 'pagas',  label: 'Somente Pagas' },
                { value: 'abertas', label: 'Em Aberto' },
                { value: 'ambas',  label: 'Ambas' },
              ]}
              value={statusCp}
              onChange={setStatusCp}
            />

            <RadioGroup
              label="Contas a Receber"
              options={[
                { value: 'pagas',  label: 'Somente Pagas' },
                { value: 'abertas', label: 'Em Aberto' },
                { value: 'ambas',  label: 'Ambas' },
              ]}
              value={statusCr}
              onChange={setStatusCr}
            />
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Estado inicial */}
        {!loading && !data && !error && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
              <BarChart3 className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600">Selecione o período e clique em Buscar</p>
            <p className="text-xs text-slate-400 mt-1">O DRE será gerado com base no plano de contas do período selecionado.</p>
          </div>
        )}

        {/* Carregando */}
        {loading && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 text-center text-sm text-slate-400">
            Carregando...
          </div>
        )}

        {/* Resultado */}
        {data && !loading && (
          <div className="space-y-3">
            {data.nodes.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 text-center text-sm text-slate-400">
                Nenhum lançamento encontrado para o período selecionado.
              </div>
            ) : (
              <>
                {/* Tabela DRE */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800">
                    <BarChart3 className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-bold text-white uppercase tracking-wide">
                      Demonstrativo de Resultado
                    </span>
                    <span className="ml-auto text-[10px] text-slate-400">
                      {data.nodes.length} lançamento{data.nodes.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <DRETable nodes={data.nodes} />
                </div>

                {/* Barra de totais */}
                <div className="bg-slate-800 rounded-xl px-5 py-3 flex flex-wrap items-center gap-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Entradas</span>
                    <span className="text-sm font-black text-emerald-400">{brl(data.total_entradas)}</span>
                  </div>
                  <div className="border-l border-slate-600 pl-6 flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Saídas</span>
                    <span className="text-sm font-black text-red-300">{brl(data.total_saidas)}</span>
                  </div>
                  <div className="border-l border-slate-600 pl-6 flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resultado Final</span>
                    <span className={cn(
                      'text-sm font-black',
                      isPositivo ? 'text-blue-300' : 'text-amber-300'
                    )}>
                      {brl(data.resultado)}
                    </span>
                  </div>
                  <div className="ml-auto">
                    <span className={cn(
                      'text-xs font-bold px-3 py-1 rounded-full',
                      isPositivo
                        ? 'bg-emerald-900/50 text-emerald-300'
                        : 'bg-amber-900/50 text-amber-300'
                    )}>
                      {isPositivo ? 'SUPERÁVIT' : 'DÉFICIT'}
                    </span>
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
