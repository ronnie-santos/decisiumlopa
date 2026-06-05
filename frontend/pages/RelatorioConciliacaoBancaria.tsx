import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { FileDown, DollarSign, Hash, X } from 'lucide-react';
import { cn } from '../utils/cn';

// ── Types ─────────────────────────────────────────────────────────────────────
interface PagamentoRow {
  data: string | null;
  forma_pagamento: string;
  fornecedor: string;
  documento: string;
  empresa: string;
  valor: number;
}

interface GrupoRow {
  data: string | null;
  forma_pagamento: string;
  items: PagamentoRow[];
  subtotal: number;
  qtd: number;
}

interface ConciliacaoData {
  grupos: GrupoRow[];
  total_geral: number;
  qtd_registros: number;
}

interface EmpresaItem {
  idempresa: number;
  nomefantasia: string;
  nome: string;
}

interface FormaPagamentoItem {
  idformapgto: number;
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

// ── Page ──────────────────────────────────────────────────────────────────────
export function RelatorioConciliacaoBancariaPage() {
  // Auxiliares
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamentoItem[]>([]);

  // Filtros
  const [dataDe, setDataDe]           = useState(firstOfMonth());
  const [dataAte, setDataAte]         = useState(today());
  const [empresaId, setEmpresaId]     = useState('');
  const [formaPgtoId, setFormaPgtoId] = useState('');

  // Estado do relatório
  const [loading, setLoading] = useState(false);
  const [data, setData]       = useState<ConciliacaoData | null>(null);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/empresas?limit=200')
      .then(r => r.json())
      .then(d => setEmpresas(Array.isArray(d) ? d : d.data ?? []))
      .catch(() => {});

    fetch('/api/formapagamento?situacao=ATIVO')
      .then(r => r.json())
      .then(d => setFormasPagamento(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const buildParams = () => {
    const params = new URLSearchParams({ data_de: dataDe, data_ate: dataAte });
    if (empresaId)   params.set('idempresa',   empresaId);
    if (formaPgtoId) params.set('idformapgto', formaPgtoId);
    return params;
  };

  const handleBuscar = async () => {
    if (!dataDe || !dataAte) {
      setError('Informe o período de pagamento.');
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/conciliacao/relatorio?${buildParams()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = body.detail;
        const msg =
          typeof detail === 'string'
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
    setFormaPgtoId('');
    setData(null);
    setError(null);
  };

  const handleGerarPdf = () => {
    if (!dataDe || !dataAte) return;
    window.open(`/api/conciliacao/relatorio/pdf?${buildParams()}`, '_blank');
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Conciliação Bancária — Extrato de Despesas Pagas" />

      <div className="p-5 space-y-4">

        {/* ── Cards de resumo ── */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border-l-4 border-[#B21212] p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                  Total Pago no Período
                </p>
                <h3 className="text-xl font-black text-slate-800">{brl(data.total_geral)}</h3>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center text-[#B21212] flex-shrink-0 ml-3">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-white rounded-xl border-l-4 border-slate-400 p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                  Registros Encontrados
                </p>
                <h3 className="text-xl font-black text-slate-800">{data.qtd_registros}</h3>
              </div>
              <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 flex-shrink-0 ml-3">
                <Hash className="h-5 w-5" />
              </div>
            </div>
          </div>
        )}

        {/* ── Filtros + ações ── */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="flex flex-wrap items-end gap-3">

            {/* Período */}
            <div className="flex flex-col gap-1 min-w-[130px]">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Data de *
              </label>
              <input
                type="date"
                value={dataDe}
                onChange={e => setDataDe(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#B21212] focus:border-[#B21212]"
              />
            </div>

            <div className="flex flex-col gap-1 min-w-[130px]">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Data até *
              </label>
              <input
                type="date"
                value={dataAte}
                onChange={e => setDataAte(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#B21212] focus:border-[#B21212]"
              />
            </div>

            {/* Empresa */}
            <div className="flex flex-col gap-1 min-w-[200px]">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Empresa
              </label>
              <select
                value={empresaId}
                onChange={e => setEmpresaId(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#B21212] focus:border-[#B21212] bg-white"
              >
                <option value="">Todas as empresas</option>
                {empresas.map(e => (
                  <option key={e.idempresa} value={String(e.idempresa)}>
                    {e.nomefantasia || e.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Forma de Pagamento */}
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Forma de Pagamento
              </label>
              <select
                value={formaPgtoId}
                onChange={e => setFormaPgtoId(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#B21212] focus:border-[#B21212] bg-white"
              >
                <option value="">Todas as formas</option>
                {formasPagamento.map(f => (
                  <option key={f.idformapgto} value={String(f.idformapgto)}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Botões */}
            <div className="flex gap-2 items-end ml-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLimpar}
                className="text-slate-500 gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                Limpar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGerarPdf}
                disabled={!data || data.qtd_registros === 0}
                className="gap-1.5"
              >
                <FileDown className="h-3.5 w-3.5" />
                Exportar PDF
              </Button>
              <Button
                size="sm"
                onClick={handleBuscar}
                disabled={loading}
                className="gap-1.5"
              >
                {loading ? (
                  <div className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : null}
                Gerar Relatório
              </Button>
            </div>
          </div>

          {error && (
            <p className="mt-3 text-xs text-red-600 font-medium">{error}</p>
          )}
        </div>

        {/* ── Tabela de resultados ── */}
        {data && data.qtd_registros > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Data Pgto
                    </th>
                    <th className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Forma Pagamento
                    </th>
                    <th className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider">
                      Fornecedor
                    </th>
                    <th className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Documento
                    </th>
                    <th className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider">
                      Empresa
                    </th>
                    <th className="text-right px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.grupos.map((grupo, gIdx) => (
                    <React.Fragment key={gIdx}>
                      {/* ── Cabeçalho do grupo ── */}
                      <tr className="bg-slate-700">
                        <td colSpan={6} className="px-3 py-2 font-bold text-white text-[11px] tracking-wide">
                          {fmtDate(grupo.data)}
                          <span className="mx-2 opacity-50">·</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-400/20 text-blue-200 border border-blue-400/30">
                            {grupo.forma_pagamento}
                          </span>
                          <span className="ml-2 text-slate-400 font-normal text-[10px]">
                            {grupo.qtd} item{grupo.qtd !== 1 ? 'ns' : ''}
                          </span>
                        </td>
                      </tr>

                      {/* ── Linhas do grupo ── */}
                      {grupo.items.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className={cn(
                            'border-b border-slate-50 hover:bg-slate-50 transition-colors',
                            rIdx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white',
                          )}
                        >
                          <td className="px-3 py-2 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                            {fmtDate(row.data)}
                          </td>
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                            {row.forma_pagamento}
                          </td>
                          <td className="px-3 py-2 text-slate-700 max-w-[200px] truncate">
                            {row.fornecedor}
                          </td>
                          <td className="px-3 py-2 text-slate-500 font-mono">
                            {row.documento}
                          </td>
                          <td className="px-3 py-2 text-slate-600 max-w-[180px] truncate">
                            {row.empresa}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">
                            {brl(row.valor)}
                          </td>
                        </tr>
                      ))}

                      {/* ── Subtotal do grupo ── */}
                      <tr className="bg-slate-100 border-t border-slate-200">
                        <td colSpan={5} className="px-3 py-2 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider pr-4">
                          Subtotal
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-700 whitespace-nowrap">
                          {brl(grupo.subtotal)}
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-800">
                    <td colSpan={5} className="px-3 py-3 text-xs font-bold text-white uppercase tracking-wider">
                      Total Geral — {data.qtd_registros} registro{data.qtd_registros !== 1 ? 's' : ''}
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-black text-white whitespace-nowrap">
                      {brl(data.total_geral)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Estado vazio após busca */}
        {data && data.qtd_registros === 0 && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-3">
              <DollarSign className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-tight">
              Nenhum pagamento encontrado
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Não há registros de pagamento para o período e filtros selecionados.
            </p>
          </div>
        )}

        {/* Estado inicial (antes de buscar) */}
        {!data && !loading && !error && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-[#B21212] mb-3">
              <DollarSign className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-tight">
              Selecione o período e clique em Gerar Relatório
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Exibe todos os pagamentos registrados em <strong>pagamentos_cp</strong> no intervalo de datas informado.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
