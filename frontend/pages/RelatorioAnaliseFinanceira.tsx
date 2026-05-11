import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import {
  Search, X, FileDown,
  TrendingUp, TrendingDown, Scale, Hash,
  Users, Truck, Wrench, BarChart3,
} from 'lucide-react';
import { cn } from '../utils/cn';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Resumo {
  total_receitas: number;
  total_pago_receitas: number;
  qtd_receitas: number;
  total_despesas: number;
  total_pago_despesas: number;
  qtd_despesas: number;
  saldo: number;
  saldo_caixa: number;
}

interface ClienteRow {
  idcliente: number;
  nome: string;
  total_valor: number;
  total_pago: number;
  qtd: number;
}

interface FornecedorRow {
  idfornecedor: number;
  nome: string;
  total_valor: number;
  total_pago: number;
  qtd: number;
}

interface EquipRow {
  idequipamento: number;
  nome: string;
  placa: string;
  total_valor: number;
  total_pago?: number;
  qtd: number;
}

interface AnaliseData {
  resumo: Resumo;
  top_clientes: ClienteRow[];
  top_fornecedores: FornecedorRow[];
  top_equip_receitas: EquipRow[];
  top_equip_despesas: EquipRow[];
}

interface Empresa {
  idempresa: number;
  nomefantasia: string;
  nome: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const pct = (num: number, den: number) =>
  den > 0 ? `${Math.min((num / den) * 100, 100).toFixed(1)}%` : '—';

function today() {
  return new Date().toISOString().split('T')[0];
}
function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ── MiniBar ───────────────────────────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-0.5">
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${w}%` }} />
    </div>
  );
}

// ── SectionHeader ────────────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  title,
  count,
  iconColor = 'text-slate-400',
}: {
  icon: React.ElementType;
  title: string;
  count?: number;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800">
      <Icon className={cn('h-4 w-4', iconColor)} />
      <span className="text-sm font-bold text-white uppercase tracking-wide">{title}</span>
      {count !== undefined && (
        <span className="ml-auto text-[10px] text-slate-400">{count} registro{count !== 1 ? 's' : ''}</span>
      )}
    </div>
  );
}

// ── Top Clientes Table ────────────────────────────────────────────────────────
function TopClientesTable({ rows }: { rows: ClienteRow[] }) {
  const maxV = Math.max(...rows.map(r => r.total_valor), 1);
  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-100">
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-8">#</th>
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente</th>
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center w-16">Parcelas</th>
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right w-36">Total Esperado</th>
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right w-36">Recebido</th>
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right w-16">%</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {rows.map((row, i) => (
          <tr key={row.idcliente} className={cn('hover:bg-slate-50/50', i % 2 === 1 && 'bg-slate-50/30')}>
            <td className="px-3 py-2 text-xs font-bold text-slate-400">{i + 1}</td>
            <td className="px-3 py-2">
              <span className="text-xs font-semibold text-slate-800">{row.nome}</span>
              <MiniBar value={row.total_valor} max={maxV} color="bg-emerald-400" />
            </td>
            <td className="px-3 py-2 text-xs text-slate-500 text-center">{row.qtd}</td>
            <td className="px-3 py-2 text-xs font-mono text-slate-700 text-right">{brl(row.total_valor)}</td>
            <td className="px-3 py-2 text-xs font-mono font-semibold text-emerald-600 text-right">{brl(row.total_pago)}</td>
            <td className="px-3 py-2 text-xs text-right">
              <span className={cn(
                'font-bold',
                (row.total_pago / Math.max(row.total_valor, 1)) >= 0.8 ? 'text-emerald-600' : 'text-amber-500'
              )}>
                {pct(row.total_pago, row.total_valor)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Top Fornecedores Table ────────────────────────────────────────────────────
function TopFornecedoresTable({ rows }: { rows: FornecedorRow[] }) {
  const maxV = Math.max(...rows.map(r => r.total_valor), 1);
  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-100">
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-8">#</th>
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fornecedor</th>
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center w-16">Parcelas</th>
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right w-36">Total Esperado</th>
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right w-36">Pago</th>
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right w-16">%</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {rows.map((row, i) => (
          <tr key={row.idfornecedor} className={cn('hover:bg-slate-50/50', i % 2 === 1 && 'bg-slate-50/30')}>
            <td className="px-3 py-2 text-xs font-bold text-slate-400">{i + 1}</td>
            <td className="px-3 py-2">
              <span className="text-xs font-semibold text-slate-800">{row.nome}</span>
              <MiniBar value={row.total_valor} max={maxV} color="bg-red-400" />
            </td>
            <td className="px-3 py-2 text-xs text-slate-500 text-center">{row.qtd}</td>
            <td className="px-3 py-2 text-xs font-mono text-slate-700 text-right">{brl(row.total_valor)}</td>
            <td className="px-3 py-2 text-xs font-mono font-semibold text-red-600 text-right">{brl(row.total_pago)}</td>
            <td className="px-3 py-2 text-xs text-right">
              <span className={cn(
                'font-bold',
                (row.total_pago / Math.max(row.total_valor, 1)) >= 0.8 ? 'text-emerald-600' : 'text-amber-500'
              )}>
                {pct(row.total_pago, row.total_valor)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Top Equip Receitas Table ──────────────────────────────────────────────────
function TopEquipReceitasTable({ rows }: { rows: EquipRow[] }) {
  const maxV = Math.max(...rows.map(r => r.total_valor), 1);
  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-100">
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-8">#</th>
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equipamento</th>
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-24">Placa</th>
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center w-12">OS</th>
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right w-36">Total Receitas</th>
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right w-36">Recebido</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {rows.map((row, i) => (
          <tr key={row.idequipamento} className={cn('hover:bg-slate-50/50', i % 2 === 1 && 'bg-slate-50/30')}>
            <td className="px-3 py-2 text-xs font-bold text-slate-400">{i + 1}</td>
            <td className="px-3 py-2">
              <span className="text-xs font-semibold text-slate-800">{row.nome}</span>
              <MiniBar value={row.total_valor} max={maxV} color="bg-emerald-400" />
            </td>
            <td className="px-3 py-2 text-xs font-mono text-slate-500">{row.placa}</td>
            <td className="px-3 py-2 text-xs text-slate-500 text-center">{row.qtd}</td>
            <td className="px-3 py-2 text-xs font-mono text-slate-700 text-right">{brl(row.total_valor)}</td>
            <td className="px-3 py-2 text-xs font-mono font-semibold text-emerald-600 text-right">
              {row.total_pago !== undefined ? brl(row.total_pago) : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Top Equip Despesas Table ──────────────────────────────────────────────────
function TopEquipDespesasTable({ rows }: { rows: EquipRow[] }) {
  const maxV = Math.max(...rows.map(r => r.total_valor), 1);
  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-100">
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-8">#</th>
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equipamento</th>
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-24">Placa</th>
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center w-20">Compras</th>
          <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right w-40">Total Despesas</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {rows.map((row, i) => (
          <tr key={row.idequipamento} className={cn('hover:bg-slate-50/50', i % 2 === 1 && 'bg-slate-50/30')}>
            <td className="px-3 py-2 text-xs font-bold text-slate-400">{i + 1}</td>
            <td className="px-3 py-2">
              <span className="text-xs font-semibold text-slate-800">{row.nome}</span>
              <MiniBar value={row.total_valor} max={maxV} color="bg-red-400" />
            </td>
            <td className="px-3 py-2 text-xs font-mono text-slate-500">{row.placa}</td>
            <td className="px-3 py-2 text-xs text-slate-500 text-center">{row.qtd}</td>
            <td className="px-3 py-2 text-xs font-mono font-semibold text-red-600 text-right">{brl(row.total_valor)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Empty state inline ────────────────────────────────────────────────────────
function EmptySection({ label }: { label: string }) {
  return (
    <div className="px-4 py-6 text-center text-xs text-slate-400">{label}</div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function RelatorioAnaliseFinanceiraPage() {
  const [empresas, setEmpresas]   = useState<Empresa[]>([]);
  const [dataDe, setDataDe]       = useState(firstOfMonth());
  const [dataAte, setDataAte]     = useState(today());
  const [empresaId, setEmpresaId] = useState('');
  const [status, setStatus]       = useState('ambas');

  const [loading, setLoading]     = useState(false);
  const [data, setData]           = useState<AnaliseData | null>(null);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/empresas?limit=200')
      .then(r => r.json())
      .then(d => setEmpresas(Array.isArray(d) ? d : d.data ?? []))
      .catch(() => {});
  }, []);

  const buildParams = () => {
    const p = new URLSearchParams({ data_de: dataDe, data_ate: dataAte, status });
    if (empresaId) p.set('idempresa', empresaId);
    return p;
  };

  const handleBuscar = async () => {
    if (!dataDe || !dataAte) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/contas-receber/relatorio/analise?${buildParams()}`);
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
    setStatus('ambas');
    setData(null);
    setError(null);
  };

  const isPositivo = data ? data.resumo.saldo >= 0 : true;
  const isCaixaPos = data ? data.resumo.saldo_caixa >= 0 : true;

  return (
    <div className="flex flex-col h-full">
      <Header title="Relatório: Análise Financeira" />

      <div className="p-5 space-y-4">

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Receitas */}
            <div className="bg-white rounded-xl border-l-4 border-emerald-500 p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Receitas</p>
              <h3 className="text-lg font-black text-emerald-600">{brl(data.resumo.total_receitas)}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {pct(data.resumo.total_pago_receitas, data.resumo.total_receitas)} recebido
                · {data.resumo.qtd_receitas} parcelas
              </p>
              <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full"
                  style={{ width: pct(data.resumo.total_pago_receitas, data.resumo.total_receitas) }}
                />
              </div>
            </div>

            {/* Despesas */}
            <div className="bg-white rounded-xl border-l-4 border-[#B21212] p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Despesas</p>
              <h3 className="text-lg font-black text-[#B21212]">{brl(data.resumo.total_despesas)}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {pct(data.resumo.total_pago_despesas, data.resumo.total_despesas)} pago
                · {data.resumo.qtd_despesas} parcelas
              </p>
              <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-400 rounded-full"
                  style={{ width: pct(data.resumo.total_pago_despesas, data.resumo.total_despesas) }}
                />
              </div>
            </div>

            {/* Saldo esperado */}
            <div className={cn(
              'bg-white rounded-xl border-l-4 p-4 shadow-sm',
              isPositivo ? 'border-blue-500' : 'border-amber-400'
            )}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Saldo do Período</p>
              <h3 className={cn('text-lg font-black', isPositivo ? 'text-blue-600' : 'text-amber-500')}>
                {brl(data.resumo.saldo)}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {isPositivo ? 'Superávit' : 'Déficit'} esperado
              </p>
            </div>

            {/* Saldo caixa */}
            <div className={cn(
              'bg-white rounded-xl border-l-4 p-4 shadow-sm',
              isCaixaPos ? 'border-violet-500' : 'border-orange-400'
            )}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Saldo em Caixa</p>
              <h3 className={cn('text-lg font-black', isCaixaPos ? 'text-violet-600' : 'text-orange-500')}>
                {brl(data.resumo.saldo_caixa)}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Recebido − Pago efetivo</p>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm space-y-4">
          {/* Linha 1 — Datas e botões */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-44">
              <Input label="De" type="date" value={dataDe} onChange={e => setDataDe(e.target.value)} />
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
            {data && (
              <Button
                className="gap-2"
                onClick={() => window.open(`/api/contas-receber/relatorio/analise/pdf?${buildParams()}`, '_blank')}
              >
                <FileDown className="h-4 w-4" />
                Gerar PDF
              </Button>
            )}
          </div>

          {/* Linha 2 — Empresa + Status */}
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

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lançamentos</span>
              <div className="flex gap-3">
                {[
                  { value: 'pagas',   label: 'Somente Pagos' },
                  { value: 'abertas', label: 'Em Aberto' },
                  { value: 'ambas',   label: 'Ambos' },
                ].map(opt => (
                  <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      value={opt.value}
                      checked={status === opt.value}
                      onChange={() => setStatus(opt.value)}
                      className="accent-[#B21212]"
                    />
                    <span className="text-xs text-slate-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
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
            <p className="text-xs text-slate-400 mt-1">
              A análise consolidará receitas, despesas, clientes, fornecedores e equipamentos do período.
            </p>
          </div>
        )}

        {/* Carregando */}
        {loading && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 text-center text-sm text-slate-400">
            Carregando análise...
          </div>
        )}

        {/* Resultado */}
        {data && !loading && (
          <div className="space-y-4">

            {/* Top 10 Clientes */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <SectionHeader
                icon={Users}
                title="Top 10 Clientes — Maior Receita"
                count={data.top_clientes.length}
                iconColor="text-emerald-400"
              />
              {data.top_clientes.length > 0
                ? <TopClientesTable rows={data.top_clientes} />
                : <EmptySection label="Nenhum cliente encontrado no período." />
              }
            </div>

            {/* Top 10 Fornecedores */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <SectionHeader
                icon={Truck}
                title="Top 10 Fornecedores — Maior Despesa"
                count={data.top_fornecedores.length}
                iconColor="text-red-400"
              />
              {data.top_fornecedores.length > 0
                ? <TopFornecedoresTable rows={data.top_fornecedores} />
                : <EmptySection label="Nenhum fornecedor encontrado no período." />
              }
            </div>

            {/* Equip — Receitas */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <SectionHeader
                icon={Wrench}
                title="Equipamentos — Maiores Geradores de Receita"
                count={data.top_equip_receitas.length}
                iconColor="text-emerald-400"
              />
              {data.top_equip_receitas.length > 0
                ? <TopEquipReceitasTable rows={data.top_equip_receitas} />
                : <EmptySection label="Nenhum equipamento associado a receitas no período." />
              }
            </div>

            {/* Equip — Despesas */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <SectionHeader
                icon={Wrench}
                title="Equipamentos — Maiores Geradores de Despesa"
                count={data.top_equip_despesas.length}
                iconColor="text-red-400"
              />
              {data.top_equip_despesas.length > 0
                ? <TopEquipDespesasTable rows={data.top_equip_despesas} />
                : <EmptySection label="Nenhum equipamento associado a despesas no período." />
              }
            </div>

            {/* Barra de totais */}
            <div className="bg-slate-800 rounded-xl px-5 py-3 flex flex-wrap items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Receitas</span>
                <span className="text-sm font-black text-emerald-400">{brl(data.resumo.total_receitas)}</span>
              </div>
              <div className="border-l border-slate-600 pl-6 flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Despesas</span>
                <span className="text-sm font-black text-red-300">{brl(data.resumo.total_despesas)}</span>
              </div>
              <div className="border-l border-slate-600 pl-6 flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Saldo Esperado</span>
                <span className={cn('text-sm font-black', isPositivo ? 'text-blue-300' : 'text-amber-300')}>
                  {brl(data.resumo.saldo)}
                </span>
              </div>
              <div className="border-l border-slate-600 pl-6 flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Saldo em Caixa</span>
                <span className={cn('text-sm font-black', isCaixaPos ? 'text-violet-300' : 'text-orange-300')}>
                  {brl(data.resumo.saldo_caixa)}
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
          </div>
        )}

      </div>
    </div>
  );
}
