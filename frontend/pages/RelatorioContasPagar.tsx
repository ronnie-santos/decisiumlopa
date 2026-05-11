import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Search, X, FileDown, TrendingDown, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '../utils/cn';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ContaRow {
  vencimento: string | null;
  fornecedor_nome: string;
  nota: string;
  valor: number;
  empresa_nome: string;
  valor_pago: number;
  situacao: boolean | null;
  parcela: string;
  quebra: string;
}

interface ContaGrupo {
  quebra: string;
  rows: ContaRow[];
  subtotal_valor: number;
  subtotal_pago: number;
  count: number;
}

interface RelatorioData {
  grupos: ContaGrupo[];
  total_valor: number;
  total_pago: number;
  total_registros: number;
  grupo_tipo: number;
}

interface Empresa {
  idempresa: number;
  nomefantasia: string;
  nome: string;
}

interface Fornecedor {
  idfornecedor: number;
  nomefantasia: string;
  nome: string;
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

// ── Radio Group ───────────────────────────────────────────────────────────────
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

// ── Component ─────────────────────────────────────────────────────────────────
export function RelatorioContasPagarPage() {
  const [dataDe, setDataDe] = useState(firstOfMonth());
  const [dataAte, setDataAte] = useState(today());
  const [situacao, setSituacao] = useState('todas');
  const [grupo, setGrupo] = useState('1');

  // Filtros opcionais
  const [filtrarFornecedor, setFiltrarFornecedor] = useState(false);
  const [fornecedorId, setFornecedorId] = useState('');
  const [filtrarEmpresa, setFiltrarEmpresa] = useState(false);
  const [empresaId, setEmpresaId] = useState('');

  // Dados de suporte
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

  // Estado do relatório
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RelatorioData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/empresas?limit=200')
      .then(r => r.json())
      .then(d => setEmpresas(Array.isArray(d) ? d : d.data ?? []))
      .catch(() => {});
    fetch('/api/fornecedores?limit=500')
      .then(r => r.json())
      .then(d => setFornecedores(Array.isArray(d) ? d : d.data ?? []))
      .catch(() => {});
  }, []);

  const handleBuscar = async () => {
    if (!dataDe || !dataAte) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const params = new URLSearchParams({ data_de: dataDe, data_ate: dataAte, grupo });
      if (situacao === 'abertas')   params.set('situacao', 'false');
      if (situacao === 'quitadas')  params.set('situacao', 'true');
      if (filtrarFornecedor && fornecedorId) params.set('idfornecedor', fornecedorId);
      if (filtrarEmpresa    && empresaId)    params.set('idempresa', empresaId);

      const res = await fetch(`/api/contas-pagar/relatorio?${params}`);
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
    setSituacao('todas');
    setGrupo('1');
    setFiltrarFornecedor(false);
    setFornecedorId('');
    setFiltrarEmpresa(false);
    setEmpresaId('');
    setData(null);
    setError(null);
  };

  const handleGerarPdf = () => {
    const params = new URLSearchParams({ data_de: dataDe, data_ate: dataAte, grupo });
    if (situacao === 'abertas')  params.set('situacao', 'false');
    if (situacao === 'quitadas') params.set('situacao', 'true');
    if (filtrarFornecedor && fornecedorId) params.set('idfornecedor', fornecedorId);
    if (filtrarEmpresa    && empresaId)    params.set('idempresa', empresaId);
    window.open(`/api/contas-pagar/relatorio/pdf?${params}`, '_blank');
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Relatório: Contas a Pagar" />

      <div className="p-5 space-y-4">

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border-l-4 border-[#B21212] p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total a Pagar</p>
                <h3 className="text-xl font-black text-slate-800">{brl(data.total_valor)}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{data.total_registros} conta{data.total_registros !== 1 ? 's' : ''}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center text-[#B21212] flex-shrink-0 ml-3">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-white rounded-xl border-l-4 border-emerald-500 p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Pago</p>
                <h3 className="text-xl font-black text-slate-800">{brl(data.total_pago)}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">contas quitadas</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0 ml-3">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-white rounded-xl border-l-4 border-amber-400 p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Saldo em Aberto</p>
                <h3 className="text-xl font-black text-slate-800">
                  {brl(data.grupos.reduce((s, g) =>
                    s + g.rows.filter(r => r.situacao === false).reduce((a, r) => a + r.valor, 0), 0
                  ))}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {data.grupos.reduce((s, g) => s + g.rows.filter(r => r.situacao === false).length, 0)} aberta{data.grupos.reduce((s, g) => s + g.rows.filter(r => r.situacao === false).length, 0) !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0 ml-3">
                <AlertCircle className="h-5 w-5" />
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm space-y-4">
          {/* Linha 1: datas + botões */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-44">
              <Input label="Vencimento de" type="date" value={dataDe} onChange={e => setDataDe(e.target.value)} />
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
              <Button className="gap-2" onClick={handleGerarPdf}>
                <FileDown className="h-4 w-4" />
                Gerar PDF
              </Button>
            )}
          </div>

          {/* Linha 2: Situação + Agrupamento */}
          <div className="flex flex-wrap gap-8 pt-1 border-t border-slate-50">
            <RadioGroup
              label="Situação das Contas"
              value={situacao}
              onChange={setSituacao}
              options={[
                { value: 'todas',    label: 'Quitadas e Abertas' },
                { value: 'abertas',  label: 'Somente Abertas' },
                { value: 'quitadas', label: 'Somente Quitadas' },
              ]}
            />
            <RadioGroup
              label="Agrupamento"
              value={grupo}
              onChange={setGrupo}
              options={[
                { value: '1', label: 'Normal' },
                { value: '2', label: 'Por Fornecedor' },
                { value: '3', label: 'Por Empresa' },
              ]}
            />
          </div>

          {/* Linha 3: filtros opcionais */}
          <div className="flex flex-wrap gap-6 pt-1 border-t border-slate-50 items-end">
            {/* Fornecedor */}
            <div className="flex flex-col gap-2">
              <Toggle
                checked={filtrarFornecedor}
                onChange={v => { setFiltrarFornecedor(v); if (!v) setFornecedorId(''); }}
                label="Filtrar por Fornecedor"
              />
              {filtrarFornecedor && (
                <select
                  value={fornecedorId}
                  onChange={e => setFornecedorId(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#B21212]/20 w-64"
                >
                  <option value="">Selecione um fornecedor</option>
                  {fornecedores.map(f => (
                    <option key={f.idfornecedor} value={String(f.idfornecedor)}>
                      {f.nomefantasia || f.nome}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Empresa */}
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

        {/* Estado inicial */}
        {!loading && !data && !error && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
              <TrendingDown className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600">Selecione o período de vencimento e clique em Buscar</p>
            <p className="text-xs text-slate-400 mt-1">Utilize os filtros opcionais para refinar o resultado.</p>
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
            {data.total_registros === 0 ? (
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 text-center text-sm text-slate-400">
                Nenhuma conta encontrada para o período e filtros selecionados.
              </div>
            ) : data.grupo_tipo === 1 ? (
              <>
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800">
                    <span className="text-sm font-bold text-white uppercase tracking-wide">Contas a Pagar</span>
                    <span className="text-xs text-slate-400">{data.total_registros} registro{data.total_registros !== 1 ? 's' : ''}</span>
                  </div>
                  <ContasTable rows={data.grupos[0]?.rows ?? []} />
                </div>
                <TotalBar totalValor={data.total_valor} totalPago={data.total_pago} totalRegistros={data.total_registros} />
              </>
            ) : (
              <>
                {data.grupos.map((grupo, gi) => (
                  <div key={gi} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800">
                      <span className="text-sm font-bold text-white uppercase tracking-wide">
                        {grupo.quebra || '—'}
                      </span>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-slate-400">{grupo.count} conta{grupo.count !== 1 ? 's' : ''}</span>
                        <span className="font-bold text-red-300">{brl(grupo.subtotal_valor)}</span>
                        <span className="font-bold text-emerald-400">{brl(grupo.subtotal_pago)} pago</span>
                      </div>
                    </div>
                    <ContasTable rows={grupo.rows} />
                  </div>
                ))}
                <TotalBar totalValor={data.total_valor} totalPago={data.total_pago} totalRegistros={data.total_registros} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function ContasTable({ rows }: { rows: ContaRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/70 border-b border-slate-100">
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Vencimento</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fornecedor</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nota / Parcela</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Valor</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empresa</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Valor Pago</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Situação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((row, idx) => {
            const isAberta = row.situacao === false;
            const notaStr = [row.nota, row.parcela].filter(Boolean).join(' / ');
            return (
              <tr
                key={idx}
                className={cn(
                  'transition-colors',
                  isAberta ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50/50'
                )}
              >
                <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">{fmtDate(row.vencimento)}</td>
                <td className="px-3 py-2 text-xs font-medium text-slate-800">{row.fornecedor_nome || '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{notaStr || '—'}</td>
                <td className="px-3 py-2 text-xs font-bold text-slate-800 text-right">{brl(row.valor)}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{row.empresa_nome || '—'}</td>
                <td className="px-3 py-2 text-xs text-right">
                  {row.valor_pago > 0
                    ? <span className="font-bold text-emerald-600">{brl(row.valor_pago)}</span>
                    : <span className="text-slate-300">—</span>
                  }
                </td>
                <td className="px-3 py-2 text-xs">
                  <span className={cn(
                    'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide',
                    isAberta ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  )}>
                    {isAberta ? 'Aberta' : 'Quitada'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TotalBar({ totalValor, totalPago, totalRegistros }: { totalValor: number; totalPago: number; totalRegistros: number }) {
  return (
    <div className="bg-slate-800 rounded-xl px-5 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4 text-white">
        <TrendingDown className="h-4 w-4 text-slate-400" />
        <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Total Geral</span>
        <span className="text-xs text-slate-500">· {totalRegistros} conta{totalRegistros !== 1 ? 's' : ''}</span>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">A Pagar</p>
          <p className="text-sm font-black text-red-300">{brl(totalValor)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Pago</p>
          <p className="text-sm font-black text-emerald-400">{brl(totalPago)}</p>
        </div>
      </div>
    </div>
  );
}
