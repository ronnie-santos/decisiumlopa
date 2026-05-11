import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Search, X, ClipboardList, FileDown, TrendingUp, Clock, Hash } from 'lucide-react';
import { cn } from '../utils/cn';

// ── Types ─────────────────────────────────────────────────────────────────────
interface OrdemRow {
  data: string | null;
  idordem: number;
  numero_os: number | null;
  cliente_nome: string;
  empresa_fantasia: string;
  equipamento_nome: string;
  funcionario_nome: string;
  cidade_servico: string;
  cidade_entrega: string;
  horario: string;
  total_horas: number;
  valor_hora: number;
  km_total: number;
  valor_km: number;
  saida: number;
  pedagio: number;
  escolta: number;
  desconto: number;
  seguro: number;
  valor_os: number;
  situacao: boolean | null;
  quebra: string;
}

interface OrdemGrupo {
  quebra: string;
  rows: OrdemRow[];
  subtotal_valor_os: number;
  subtotal_horas: number;
  count: number;
}

interface RelatorioData {
  grupos: OrdemGrupo[];
  total_valor_os: number;
  total_horas: number;
  total_registros: number;
  grupo_tipo: number;
}

interface Empresa {
  idempresa: number;
  id: string;
  nomefantasia: string;
  nome: string;
}

interface Equipamento {
  idequipamento: number;
  id: string;
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

const fmtHoras = (h: number) => (h > 0 ? `${h.toFixed(1)}h` : '—');

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
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
          checked ? 'bg-[#B21212]' : 'bg-slate-200'
        )}
      >
        <span
          className={cn(
            'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-1'
          )}
        />
      </div>
      <span className="text-xs text-slate-700">{label}</span>
    </label>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export function RelatorioOrdensPage() {
  const [dataDe, setDataDe] = useState(firstOfMonth());
  const [dataAte, setDataAte] = useState(today());
  const [situacao, setSituacao] = useState('todas');
  const [grupo, setGrupo] = useState('1');

  // Filtros opcionais
  const [filtrarEmpresa, setFiltrarEmpresa] = useState(false);
  const [empresaId, setEmpresaId] = useState('');
  const [filtrarEquipamento, setFiltrarEquipamento] = useState(false);
  const [equipamentoId, setEquipamentoId] = useState('');

  // Dados de suporte
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);

  // Estado do relatório
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RelatorioData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Carregar listas de suporte
  useEffect(() => {
    fetch('/api/empresas?limit=200')
      .then(r => r.json())
      .then(d => setEmpresas(Array.isArray(d) ? d : d.data ?? []))
      .catch(() => {});
    fetch('/api/equipamentos?limit=500')
      .then(r => r.json())
      .then(d => setEquipamentos(Array.isArray(d) ? d : d.data ?? []))
      .catch(() => {});
  }, []);

  const handleBuscar = async () => {
    if (!dataDe || !dataAte) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const params = new URLSearchParams({
        data_de: dataDe,
        data_ate: dataAte,
        grupo,
      });
      if (situacao === 'abertas')   params.set('situacao', 'false');
      if (situacao === 'faturadas') params.set('situacao', 'true');
      if (filtrarEmpresa && empresaId)      params.set('idempresa', empresaId);
      if (filtrarEquipamento && equipamentoId) params.set('idequipamento', equipamentoId);

      const res = await fetch(`/api/ordens/relatorio/ordens?${params}`);
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
    setSituacao('todas');
    setGrupo('1');
    setFiltrarEmpresa(false);
    setEmpresaId('');
    setFiltrarEquipamento(false);
    setEquipamentoId('');
    setData(null);
    setError(null);
  };

  const handleGerarPdf = () => {
    const params = new URLSearchParams({
      data_de: dataDe,
      data_ate: dataAte,
      grupo,
    });
    if (situacao === 'abertas')   params.set('situacao', 'false');
    if (situacao === 'faturadas') params.set('situacao', 'true');
    if (filtrarEmpresa && empresaId)         params.set('idempresa', empresaId);
    if (filtrarEquipamento && equipamentoId) params.set('idequipamento', equipamentoId);
    window.open(`/api/ordens/relatorio/ordens/pdf?${params}`, '_blank');
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Relatório: Ordens de Serviço" />

      <div className="p-5 space-y-4">

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border-l-4 border-[#B21212] p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total de Ordens</p>
                <h3 className="text-xl font-black text-slate-800">{data.total_registros}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {data.grupos.length} grupo{data.grupos.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center text-[#B21212] flex-shrink-0 ml-3">
                <Hash className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-white rounded-xl border-l-4 border-emerald-500 p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Valor Total OS</p>
                <h3 className="text-xl font-black text-slate-800">{brl(data.total_valor_os)}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">soma do período</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0 ml-3">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-white rounded-xl border-l-4 border-sky-500 p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total de Horas</p>
                <h3 className="text-xl font-black text-slate-800">{fmtHoras(data.total_horas)}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">horas trabalhadas</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 flex-shrink-0 ml-3">
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm space-y-4">
          {/* Linha 1: datas + botões */}
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
              <Button className="gap-2" onClick={handleGerarPdf}>
                <FileDown className="h-4 w-4" />
                Gerar PDF
              </Button>
            )}
          </div>

          {/* Linha 2: Situação + Agrupamento */}
          <div className="flex flex-wrap gap-8 pt-1 border-t border-slate-50">
            <RadioGroup
              label="Situação das Ordens"
              value={situacao}
              onChange={setSituacao}
              options={[
                { value: 'todas',    label: 'Faturadas e Abertas' },
                { value: 'abertas',  label: 'Somente Abertas' },
                { value: 'faturadas', label: 'Somente Faturadas' },
              ]}
            />
            <RadioGroup
              label="Agrupamento"
              value={grupo}
              onChange={setGrupo}
              options={[
                { value: '1', label: 'Normal' },
                { value: '2', label: 'Por Cliente' },
                { value: '3', label: 'Por Empresa' },
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
                onChange={v => { setFiltrarEquipamento(v); if (!v) setEquipamentoId(''); }}
                label="Filtrar por Equipamento"
              />
              {filtrarEquipamento && (
                <select
                  value={equipamentoId}
                  onChange={e => setEquipamentoId(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#B21212]/20 w-56"
                >
                  <option value="">Selecione um equipamento</option>
                  {equipamentos.map(eq => (
                    <option key={eq.idequipamento} value={String(eq.idequipamento)}>
                      {eq.nome}
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
              <ClipboardList className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600">Selecione o período e clique em Buscar</p>
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
                Nenhuma ordem encontrada para o período e filtros selecionados.
              </div>
            ) : data.grupo_tipo === 1 ? (
              /* ── Tabela plana (sem agrupamento) ── */
              <>
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800">
                    <span className="text-sm font-bold text-white uppercase tracking-wide">
                      Ordens de Serviço
                    </span>
                    <span className="text-xs text-slate-400">{data.total_registros} registro{data.total_registros !== 1 ? 's' : ''}</span>
                  </div>
                  <OrdensTable rows={data.grupos[0]?.rows ?? []} />
                </div>
                <TotalBar totalValor={data.total_valor_os} totalHoras={data.total_horas} totalRegistros={data.total_registros} />
              </>
            ) : (
              /* ── Tabela agrupada ── */
              <>
                {data.grupos.map((grupo, gi) => (
                  <div key={gi} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800">
                      <span className="text-sm font-bold text-white uppercase tracking-wide">
                        {grupo.quebra || '—'}
                      </span>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span>{grupo.count} OS</span>
                        <span>{fmtHoras(grupo.subtotal_horas)}</span>
                        <span className="font-bold text-emerald-400">{brl(grupo.subtotal_valor_os)}</span>
                      </div>
                    </div>
                    <OrdensTable rows={grupo.rows} />
                  </div>
                ))}
                <TotalBar totalValor={data.total_valor_os} totalHoras={data.total_horas} totalRegistros={data.total_registros} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function OrdensTable({ rows }: { rows: OrdemRow[] }) {
  const brl = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[900px]">
        <thead>
          <tr className="bg-slate-50/70 border-b border-slate-100">
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Data</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">OS</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equipamento</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cidade Serv.</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Horário</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Horas</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">KM</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Valor OS</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Situação</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empresa</th>
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
                  isAberta ? 'bg-green-50/40 hover:bg-green-50' : 'hover:bg-slate-50/50'
                )}
              >
                <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">
                  {row.data ? (() => { const [y,m,d]=row.data!.split('-'); return `${d}/${m}/${y}`; })() : '—'}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {row.numero_os ? `#${String(row.numero_os).padStart(4,'0')}` : row.idordem ? `ID ${row.idordem}` : '—'}
                </td>
                <td className="px-3 py-2 text-xs font-medium text-slate-800">{row.cliente_nome || '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{row.equipamento_nome || '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{row.cidade_servico || '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-600 whitespace-pre-line">{row.horario || '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-600 text-right">
                  {row.total_horas > 0 ? `${row.total_horas.toFixed(1)}h` : '—'}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600 text-right">
                  {row.km_total > 0 ? row.km_total : '—'}
                </td>
                <td className="px-3 py-2 text-xs font-bold text-emerald-600 text-right">
                  {row.valor_os > 0 ? brl(row.valor_os) : '—'}
                </td>
                <td className="px-3 py-2 text-xs">
                  <span className={cn(
                    'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide',
                    isAberta
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-600'
                  )}>
                    {isAberta ? 'Em Aberto' : row.situacao === true ? 'Faturada' : '—'}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{row.empresa_fantasia || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TotalBar({
  totalValor,
  totalHoras,
  totalRegistros,
}: {
  totalValor: number;
  totalHoras: number;
  totalRegistros: number;
}) {
  const brl = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="bg-slate-800 rounded-xl px-5 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4 text-white">
        <ClipboardList className="h-4 w-4 text-slate-400" />
        <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Total Geral</span>
        <span className="text-xs text-slate-500">· {totalRegistros} ordem{totalRegistros !== 1 ? 's' : ''}</span>
        {totalHoras > 0 && (
          <span className="text-xs text-sky-400 font-bold">{totalHoras.toFixed(1)}h</span>
        )}
      </div>
      <span className="text-lg font-black text-emerald-400">{brl(totalValor)}</span>
    </div>
  );
}
