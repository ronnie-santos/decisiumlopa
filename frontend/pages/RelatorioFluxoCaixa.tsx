import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from '../components/Header';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import {
  Search, X, FileDown,
  TrendingUp, TrendingDown, DollarSign,
  CheckCircle, AlertCircle,
} from 'lucide-react';
import { cn } from '../utils/cn';

// ── Types ─────────────────────────────────────────────────────────────────────
interface EntradaRow {
  vencimento: string | null;
  valor: number;
  valor_pago: number;
  situacao: boolean | null;
  parcela: string;
  cliente_nome: string;
  empresa_nome: string;
  equipamento_nome: string;
  numero_os: number | null;
}

interface SaidaRow {
  vencimento: string | null;
  valor: number;
  valor_pago: number;
  situacao: boolean | null;
  parcela: string;
  nota: string;
  fornecedor_nome: string;
  empresa_nome: string;
}

interface FluxoData {
  receitas: EntradaRow[];
  despesas: SaidaRow[];
  total_receitas: number;
  total_despesas: number;
  total_recebido: number;
  total_pago: number;
  saldo: number;
  saldo_caixa: number;
  qtd_receitas: number;
  qtd_despesas: number;
}

interface Empresa {
  idempresa: number;
  nomefantasia: string;
  nome: string;
}

interface EquipamentoItem {
  idequipamento: number;
  nome: string;
  placa: string | null;
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

// ── EquipamentoAutocomplete ───────────────────────────────────────────────────
function EquipamentoAutocomplete({
  value,
  onChange,
}: {
  value: EquipamentoItem | null;
  onChange: (eq: EquipamentoItem | null) => void;
}) {
  const [query, setQuery]               = useState('');
  const [suggestions, setSuggestions]   = useState<EquipamentoItem[]>([]);
  const [loading, setLoading]           = useState(false);
  const [open, setOpen]                 = useState(false);
  const [activeIdx, setActiveIdx]       = useState(-1);
  const debounceRef                     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef                    = useRef<HTMLDivElement>(null);
  const inputRef                        = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const fetchSuggestions = useCallback((q: string) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    fetch(`/api/equipamentos?search=${encodeURIComponent(q)}&limit=10`)
      .then(r => r.json())
      .then(d => { setSuggestions(Array.isArray(d) ? d : []); setOpen(true); setActiveIdx(-1); })
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (value) onChange(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(q), 300);
  };

  const handleSelect = (eq: EquipamentoItem) => {
    onChange(eq);
    setQuery('');
    setOpen(false);
    setSuggestions([]);
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
    setSuggestions([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); handleSelect(suggestions[activeIdx]); }
  };

  const equiplabel = value ? `${value.nome}${value.placa ? ` — ${value.placa}` : ''}` : '';

  return (
    <div ref={containerRef} className="relative w-64">
      <div className={cn(
        'flex items-center h-9 rounded-lg border bg-white px-2.5 gap-1.5 transition-colors',
        open ? 'border-[#B21212] ring-1 ring-[#B21212]/20' : 'border-slate-200 hover:border-slate-300',
      )}>
        <Search className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder={value ? equiplabel : 'Buscar equipamento...'}
          value={value ? '' : query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (!value && query.length >= 2) setOpen(true); }}
          className={cn(
            'flex-1 min-w-0 text-xs outline-none bg-transparent',
            value
              ? 'placeholder:text-slate-800 placeholder:font-semibold'
              : 'placeholder:text-slate-400 text-slate-700',
          )}
        />
        {loading && (
          <div className="h-3.5 w-3.5 border-2 border-slate-200 border-t-[#B21212] rounded-full animate-spin flex-shrink-0" />
        )}
        {(value || query) && !loading && (
          <button
            onClick={handleClear}
            className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden">
          {suggestions.map((eq, idx) => (
            <button
              key={eq.idequipamento}
              onMouseDown={e => { e.preventDefault(); handleSelect(eq); }}
              className={cn(
                'w-full text-left px-3 py-2 flex flex-col gap-0.5 transition-colors',
                idx === activeIdx
                  ? 'bg-[#B21212] text-white'
                  : 'hover:bg-slate-50 text-slate-700',
              )}
            >
              <span className="text-xs font-semibold">{eq.nome}</span>
              {eq.placa && (
                <span className={cn('text-[10px]', idx === activeIdx ? 'text-red-200' : 'text-slate-400')}>
                  {eq.placa}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {open && !loading && suggestions.length === 0 && query.length >= 2 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg px-3 py-2.5 text-xs text-slate-400 text-center">
          Nenhum equipamento encontrado
        </div>
      )}
    </div>
  );
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

// ── Page ──────────────────────────────────────────────────────────────────────
export function RelatorioFluxoCaixaPage() {
  // Dados auxiliares
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  // Filtros
  const [dataDe, setDataDe] = useState(firstOfMonth());
  const [dataAte, setDataAte] = useState(today());
  const [statusReceber, setStatusReceber] = useState('ambas');
  const [statusPagar, setStatusPagar] = useState('ambas');
  const [filtrarEmpresa, setFiltrarEmpresa] = useState(false);
  const [empresaId, setEmpresaId] = useState('');
  const [filtrarEquipamento, setFiltrarEquipamento] = useState(false);
  const [equipamentoSel, setEquipamentoSel] = useState<EquipamentoItem | null>(null);

  // Estado do relatório
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FluxoData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/empresas?limit=200')
      .then(r => r.json())
      .then(d => setEmpresas(Array.isArray(d) ? d : d.data ?? []))
      .catch(() => {});
  }, []);

  const buildParams = () => {
    const params = new URLSearchParams({
      data_de: dataDe,
      data_ate: dataAte,
      status_receber: statusReceber,
      status_pagar: statusPagar,
    });
    if (filtrarEmpresa && empresaId)                          params.set('idempresa', empresaId);
    if (filtrarEquipamento && equipamentoSel?.idequipamento) params.set('idequipamento', String(equipamentoSel.idequipamento));
    return params;
  };

  const handleBuscar = async () => {
    if (!dataDe || !dataAte) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/fluxo-caixa/relatorio?${buildParams()}`);
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
    setStatusReceber('ambas');
    setStatusPagar('ambas');
    setFiltrarEmpresa(false);
    setEmpresaId('');
    setFiltrarEquipamento(false);
    setEquipamentoSel(null);
    setData(null);
    setError(null);
  };

  const handleGerarPdf = () => {
    window.open(`/api/fluxo-caixa/relatorio/pdf?${buildParams()}`, '_blank');
  };

  const saldoPositivo = !data || data.saldo >= 0;

  return (
    <div className="flex flex-col h-full">
      <Header title="Relatório: Fluxo de Caixa" />

      <div className="p-5 space-y-4">

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Entradas */}
            <div className="bg-white rounded-xl border-l-4 border-emerald-500 p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Entradas</p>
                <h3 className="text-xl font-black text-slate-800">{brl(data.total_receitas)}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {data.qtd_receitas} registro{data.qtd_receitas !== 1 ? 's' : ''} · recebido: {brl(data.total_recebido)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0 ml-3">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>

            {/* Saídas */}
            <div className="bg-white rounded-xl border-l-4 border-[#B21212] p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Saídas</p>
                <h3 className="text-xl font-black text-slate-800">{brl(data.total_despesas)}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {data.qtd_despesas} registro{data.qtd_despesas !== 1 ? 's' : ''} · pago: {brl(data.total_pago)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center text-[#B21212] flex-shrink-0 ml-3">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>

            {/* Saldo */}
            <div className={cn(
              'bg-white rounded-xl border-l-4 p-4 shadow-sm flex items-center justify-between',
              saldoPositivo ? 'border-blue-500' : 'border-amber-400'
            )}>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Saldo do Período</p>
                <h3 className={cn(
                  'text-xl font-black',
                  saldoPositivo ? 'text-blue-700' : 'text-amber-600'
                )}>
                  {brl(data.saldo)}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">saldo caixa: {brl(data.saldo_caixa)}</p>
              </div>
              <div className={cn(
                'h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-3',
                saldoPositivo ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
              )}>
                <DollarSign className="h-5 w-5" />
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

          {/* Linha 2: status receber + status pagar */}
          <div className="flex flex-wrap gap-8 pt-1 border-t border-slate-50">
            <RadioGroup
              label="Contas a Receber"
              value={statusReceber}
              onChange={setStatusReceber}
              options={[
                { value: 'ambas',   label: 'Pagas e Abertas' },
                { value: 'abertas', label: 'Somente Abertas' },
                { value: 'pagas',   label: 'Somente Pagas' },
              ]}
            />
            <RadioGroup
              label="Contas a Pagar"
              value={statusPagar}
              onChange={setStatusPagar}
              options={[
                { value: 'ambas',   label: 'Pagas e Abertas' },
                { value: 'abertas', label: 'Somente Abertas' },
                { value: 'pagas',   label: 'Somente Pagas' },
              ]}
            />
          </div>

          {/* Linha 3: filtros opcionais */}
          <div className="flex flex-wrap gap-6 pt-1 border-t border-slate-50 items-end">
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

            {/* Equipamento */}
            <div className="flex flex-col gap-2">
              <Toggle
                checked={filtrarEquipamento}
                onChange={v => { setFiltrarEquipamento(v); if (!v) setEquipamentoSel(null); }}
                label="Filtrar por Equipamento"
              />
              {filtrarEquipamento && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Equipamento</span>
                  <EquipamentoAutocomplete
                    value={equipamentoSel}
                    onChange={setEquipamentoSel}
                  />
                </div>
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
              <DollarSign className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600">Selecione o período de vencimento e clique em Buscar</p>
            <p className="text-xs text-slate-400 mt-1">Filtre por empresa ou equipamento para analisar o rendimento por ativo.</p>
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
            {data.qtd_receitas === 0 && data.qtd_despesas === 0 ? (
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 text-center text-sm text-slate-400">
                Nenhum registro encontrado para o período e filtros selecionados.
              </div>
            ) : (
              <>
                {/* Seção ENTRADAS */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-400" />
                      <span className="text-sm font-bold text-white uppercase tracking-wide">
                        Entradas — Contas a Receber
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-slate-400">{data.qtd_receitas} registro{data.qtd_receitas !== 1 ? 's' : ''}</span>
                      <span className="font-bold text-emerald-400">{brl(data.total_receitas)}</span>
                    </div>
                  </div>
                  <EntradasTable rows={data.receitas} totalValor={data.total_receitas} totalRecebido={data.total_recebido} />
                </div>

                {/* Seção SAÍDAS */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-400" />
                      <span className="text-sm font-bold text-white uppercase tracking-wide">
                        Saídas — Contas a Pagar
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-slate-400">{data.qtd_despesas} registro{data.qtd_despesas !== 1 ? 's' : ''}</span>
                      <span className="font-bold text-red-300">{brl(data.total_despesas)}</span>
                    </div>
                  </div>
                  <SaidasTable rows={data.despesas} totalValor={data.total_despesas} totalPago={data.total_pago} />
                </div>

                {/* Barra de saldo final */}
                <div className="bg-slate-800 rounded-xl px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <DollarSign className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Resumo do Período</span>
                    <span className="text-xs text-slate-500">
                      · {data.qtd_receitas + data.qtd_despesas} registro{data.qtd_receitas + data.qtd_despesas !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest">Entradas</p>
                      <p className="text-sm font-black text-emerald-400">{brl(data.total_receitas)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest">Saídas</p>
                      <p className="text-sm font-black text-red-300">{brl(data.total_despesas)}</p>
                    </div>
                    <div className="text-right border-l border-slate-600 pl-6">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest">Saldo</p>
                      <p className={cn(
                        'text-sm font-black',
                        saldoPositivo ? 'text-blue-300' : 'text-amber-300'
                      )}>
                        {brl(data.saldo)}
                      </p>
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

// ── Sub-componentes ───────────────────────────────────────────────────────────
function EntradasTable({
  rows,
  totalValor,
  totalRecebido,
}: {
  rows: EntradaRow[];
  totalValor: number;
  totalRecebido: number;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-slate-400 text-center">Nenhuma entrada encontrada para os filtros selecionados.</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/70 border-b border-slate-100">
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Vencimento</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empresa</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equipamento</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Nº OS</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Parcela</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Valor</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Recebido</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Situação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((row, idx) => {
            const isAberta = row.situacao === false;
            return (
              <tr
                key={idx}
                className={cn(
                  'transition-colors',
                  isAberta ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50/50'
                )}
              >
                <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">{fmtDate(row.vencimento)}</td>
                <td className="px-3 py-2 text-xs font-medium text-slate-800">{row.cliente_nome || '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{row.empresa_nome || '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{row.equipamento_nome || '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-500 text-center">
                  {row.numero_os ? `#${String(row.numero_os).padStart(4, '0')}` : '—'}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500 text-center">{row.parcela || '—'}</td>
                <td className="px-3 py-2 text-xs font-bold text-slate-800 text-right">{brl(row.valor)}</td>
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
        <tfoot>
          <tr className="border-t-2 border-slate-200 bg-slate-50">
            <td colSpan={6} className="px-3 py-2 text-xs font-bold text-slate-700 text-right uppercase tracking-wide">
              Subtotal Entradas
            </td>
            <td className="px-3 py-2 text-sm font-black text-right text-emerald-600">{brl(totalValor)}</td>
            <td className="px-3 py-2 text-sm font-black text-right text-slate-600">{brl(totalRecebido)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function SaidasTable({
  rows,
  totalValor,
  totalPago,
}: {
  rows: SaidaRow[];
  totalValor: number;
  totalPago: number;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-slate-400 text-center">Nenhuma saída encontrada para os filtros selecionados.</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/70 border-b border-slate-100">
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Vencimento</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fornecedor</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empresa</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nota / Parcela</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Valor</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Pago</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Situação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((row, idx) => {
            const isAberta = row.situacao === false;
            const notaStr = [row.nota !== '—' ? row.nota : '', row.parcela].filter(Boolean).join(' / ');
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
                <td className="px-3 py-2 text-xs text-slate-600">{row.empresa_nome || '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{notaStr || '—'}</td>
                <td className="px-3 py-2 text-xs font-bold text-slate-800 text-right">{brl(row.valor)}</td>
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
        <tfoot>
          <tr className="border-t-2 border-slate-200 bg-slate-50">
            <td colSpan={4} className="px-3 py-2 text-xs font-bold text-slate-700 text-right uppercase tracking-wide">
              Subtotal Saídas
            </td>
            <td className="px-3 py-2 text-sm font-black text-right text-red-600">{brl(totalValor)}</td>
            <td className="px-3 py-2 text-sm font-black text-right text-slate-600">{brl(totalPago)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
