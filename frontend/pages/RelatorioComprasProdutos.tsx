import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Search, X, FileDown, ShoppingCart, Package } from 'lucide-react';
import { cn } from '../utils/cn';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ItemRow {
  emissao: string | null;
  fornecedor_nome: string;
  nota: string;
  empresa_nome: string;
  produto_descricao: string;
  equipamento_nome: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  situacao: boolean | null;
  vencimento_de: string | null;
  vencimento_ate: string | null;
}

interface RelatorioData {
  rows: ItemRow[];
  total_valor: number;
  total_registros: number;
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

interface Produto {
  idproduto: number;
  descricao: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtDate = (s: string | null) => {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};

const fmtQty = (v: number) =>
  Number.isInteger(v) ? String(v) : v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

function today() {
  return new Date().toISOString().split('T')[0];
}

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
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
export function RelatorioComprasProdutosPage() {
  const [dataDe, setDataDe] = useState(firstOfMonth());
  const [dataAte, setDataAte] = useState(today());

  // Filtros opcionais
  const [filtrarFornecedor, setFiltrarFornecedor] = useState(false);
  const [fornecedorId, setFornecedorId] = useState('');
  const [filtrarEmpresa, setFiltrarEmpresa] = useState(false);
  const [empresaId, setEmpresaId] = useState('');
  const [filtrarProduto, setFiltrarProduto] = useState(false);
  const [produtoId, setProdutoId] = useState('');

  // Dados de suporte
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);

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
    fetch('/api/produtos?limit=1000')
      .then(r => r.json())
      .then(d => setProdutos(Array.isArray(d) ? d : d.data ?? []))
      .catch(() => {});
  }, []);

  const buildParams = () => {
    const params = new URLSearchParams({ data_de: dataDe, data_ate: dataAte });
    if (filtrarFornecedor && fornecedorId) params.set('idfornecedor', fornecedorId);
    if (filtrarEmpresa    && empresaId)    params.set('idempresa', empresaId);
    if (filtrarProduto    && produtoId)    params.set('idproduto', produtoId);
    return params;
  };

  const handleBuscar = async () => {
    if (!dataDe || !dataAte) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/contas-pagar/relatorio-compras?${buildParams()}`);
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
    setFiltrarFornecedor(false);
    setFornecedorId('');
    setFiltrarEmpresa(false);
    setEmpresaId('');
    setFiltrarProduto(false);
    setProdutoId('');
    setData(null);
    setError(null);
  };

  const handleGerarPdf = () => {
    window.open(`/api/contas-pagar/relatorio-compras/pdf?${buildParams()}`, '_blank');
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Relatório: Contas a Pagar e Produtos" />

      <div className="p-5 space-y-4">

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border-l-4 border-[#B21212] p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total de Itens</p>
                <h3 className="text-xl font-black text-slate-800">{data.total_registros}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">linhas no relatório</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center text-[#B21212] flex-shrink-0 ml-3">
                <Package className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-white rounded-xl border-l-4 border-indigo-500 p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Valor Total das Compras</p>
                <h3 className="text-xl font-black text-slate-800">{brl(data.total_valor)}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">soma dos itens</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0 ml-3">
                <ShoppingCart className="h-5 w-5" />
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm space-y-4">
          {/* Linha 1: datas + botões */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-44">
              <Input label="Emissão de" type="date" value={dataDe} onChange={e => setDataDe(e.target.value)} />
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

          {/* Linha 2: filtros opcionais */}
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

            {/* Produto/Serviço */}
            <div className="flex flex-col gap-2">
              <Toggle
                checked={filtrarProduto}
                onChange={v => { setFiltrarProduto(v); if (!v) setProdutoId(''); }}
                label="Filtrar por Produto / Serviço"
              />
              {filtrarProduto && (
                <select
                  value={produtoId}
                  onChange={e => setProdutoId(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#B21212]/20 w-72"
                >
                  <option value="">Selecione um produto / serviço</option>
                  {produtos.map(p => (
                    <option key={p.idproduto} value={String(p.idproduto)}>
                      {p.descricao}
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
              <ShoppingCart className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600">Selecione o período de emissão e clique em Buscar</p>
            <p className="text-xs text-slate-400 mt-1">Utilize os filtros opcionais para refinar por fornecedor, empresa ou produto.</p>
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
                Nenhum registro encontrado para o período e filtros selecionados.
              </div>
            ) : (
              <>
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800">
                    <span className="text-sm font-bold text-white uppercase tracking-wide">Itens de Compra</span>
                    <span className="text-xs text-slate-400">{data.total_registros} item{data.total_registros !== 1 ? 'ns' : ''}</span>
                  </div>
                  <ItemsTable rows={data.rows} />
                </div>
                <TotalBar totalValor={data.total_valor} totalRegistros={data.total_registros} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function ItemsTable({ rows }: { rows: ItemRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/70 border-b border-slate-100">
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Emissão</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nota</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empresa</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fornecedor</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Produto / Serviço</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equipamento</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Qtd</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Vlr Unit</th>
            <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Vlr Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((row, idx) => {
            const isAberto = row.situacao === false;
            return (
              <tr
                key={idx}
                className={cn(
                  'transition-colors',
                  isAberto ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50/50'
                )}
              >
                <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">{fmtDate(row.emissao)}</td>
                <td className="px-3 py-2 text-xs">
                  <span className={cn(
                    'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide',
                    isAberto ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  )}>
                    {isAberto ? 'Aberto' : 'Quitado'}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">{row.nota || '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{row.empresa_nome || '—'}</td>
                <td className="px-3 py-2 text-xs font-medium text-slate-800">{row.fornecedor_nome || '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-700">{row.produto_descricao || '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{row.equipamento_nome || '—'}</td>
                <td className="px-3 py-2 text-xs text-center text-slate-600">{fmtQty(row.quantidade)}</td>
                <td className="px-3 py-2 text-xs text-right text-slate-600">{brl(row.valor_unitario)}</td>
                <td className="px-3 py-2 text-xs text-right font-bold text-slate-800">{brl(row.valor_total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TotalBar({ totalValor, totalRegistros }: { totalValor: number; totalRegistros: number }) {
  return (
    <div className="bg-slate-800 rounded-xl px-5 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4 text-white">
        <ShoppingCart className="h-4 w-4 text-slate-400" />
        <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Total Geral</span>
        <span className="text-xs text-slate-500">· {totalRegistros} item{totalRegistros !== 1 ? 'ns' : ''}</span>
      </div>
      <div className="text-right">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest">Valor Total</p>
        <p className="text-sm font-black text-indigo-300">{brl(totalValor)}</p>
      </div>
    </div>
  );
}
