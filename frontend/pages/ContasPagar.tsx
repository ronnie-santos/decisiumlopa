import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { InputCurrency } from '../components/ui/InputCurrency';
import { Modal } from '../components/ui/Modal';
import {
  Search, Check, ChevronLeft, ChevronRight,
  AlertCircle, CheckCircle2, AlertTriangle, RotateCcw,
  Clock
} from 'lucide-react';
import { cn } from '../utils/cn';

// ── Local interfaces ──────────────────────────────────────────────────────────

interface ContasPagarAPI {
  idcontaspagar: number;
  idcompras: number | null;
  vencimento: string | null;
  valor: number | null;
  valor_pago: number | null;
  situacao: boolean | null;
  parcela: string | null;
  ultimo_pagamento: string | null;
  desconto: number | null;
  observacao: string | null;
  valor_original: number | null;
  fornecedor_nome: string | null;
  nota_numero: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const today = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function fmtCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function getStatus(c: ContasPagarAPI): 'PAGO' | 'PENDENTE' | 'ATRASADO' {
  if (c.situacao === true) return 'PAGO';
  if (c.vencimento && c.vencimento < today()) return 'ATRASADO';
  return 'PENDENTE';
}

const STATUS_COLORS = {
  PENDENTE: 'bg-blue-50 text-blue-600 border-blue-100',
  PAGO:     'bg-emerald-50 text-emerald-600 border-emerald-100',
  ATRASADO: 'bg-red-50 text-red-600 border-red-100',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ContasPagarPage() {
  // ── Data ────────────────────────────────────────────────────────────────────
  const [contas, setContas]       = useState<ContasPagarAPI[]>([]);
  const [loading, setLoading]     = useState(true);

  // ── Paginação ────────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [statsAPI, setStatsAPI] = useState({ total_pago: 0, total_pendente: 0, total_atrasado: 0, qtd_pago: 0, qtd_pendente: 0, qtd_atrasado: 0 });
  const PER_PAGE = 50;

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [filterFornecedor, setFilterFornecedor] = useState('');
  const [filterVencDe, setFilterVencDe]         = useState('');
  const [filterVencAte, setFilterVencAte]       = useState('');
  const [filterStatus, setFilterStatus]         = useState('PENDENTE');

  // ── Formas de Pagamento ───────────────────────────────────────────────────────
  const [formasPagamento, setFormasPagamento] = useState<{ idformapgto: number; nome: string }[]>([]);

  // ── Baixa (Settle) Modal ─────────────────────────────────────────────────────
  const [settleTarget, setSettleTarget]               = useState<ContasPagarAPI | null>(null);
  const [isSettleOpen, setIsSettleOpen]               = useState(false);
  const [settleAmountPaid, setSettleAmountPaid]       = useState(0);
  const [settleDate, setSettleDate]                   = useState(today);
  const [settleObs, setSettleObs]                     = useState('');
  const [settleFormaPagamento, setSettleFormaPagamento] = useState<number | null>(null);
  const [paying, setPaying]                           = useState(false);
  const [payError, setPayError]                       = useState<string | null>(null);
  const [paySuccess, setPaySuccess]                   = useState(false);

  // ── Cancelar Baixa Modal ──────────────────────────────────────────────────────
  const [cancelTarget, setCancelTarget]       = useState<ContasPagarAPI | null>(null);
  const [isCancelOpen, setIsCancelOpen]       = useState(false);
  const [cancelling, setCancelling]           = useState(false);
  const [cancelError, setCancelError]         = useState<string | null>(null);
  const [cancelWarning, setCancelWarning]     = useState<string | null>(null);


  // ── Load data ────────────────────────────────────────────────────────────────
  const loadData = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('skip', String((p - 1) * PER_PAGE));
      params.set('limit', String(PER_PAGE));
      if (filterFornecedor) params.set('fornecedor', filterFornecedor);
      if (filterVencDe)     params.set('venc_de', filterVencDe);
      if (filterVencAte)    params.set('venc_ate', filterVencAte);
      if (filterStatus)     params.set('status', filterStatus);

      const res  = await fetch(`/api/contas-pagar?${params}`);
      const json = await res.json();
      const data: ContasPagarAPI[] = Array.isArray(json.data) ? json.data : [];
      data.sort((a, b) => {
        if (!a.vencimento && !b.vencimento) return 0;
        if (!a.vencimento) return 1;
        if (!b.vencimento) return -1;
        return a.vencimento.localeCompare(b.vencimento);
      });
      setContas(data);
      setTotalRecords(json.total ?? 0);
      setStatsAPI({
        total_pago:     json.total_pago     ?? 0,
        total_pendente: json.total_pendente ?? 0,
        total_atrasado: json.total_atrasado ?? 0,
        qtd_pago:       json.qtd_pago       ?? 0,
        qtd_pendente:   json.qtd_pendente   ?? 0,
        qtd_atrasado:   json.qtd_atrasado   ?? 0,
      });
    } finally {
      setLoading(false);
    }
  }, [filterFornecedor, filterVencDe, filterVencAte, filterStatus]);

  useEffect(() => { loadData(page); }, [page, loadData]);

  useEffect(() => {
    fetch('/api/formapagamento?situacao=ATIVO')
      .then(r => r.json())
      .then(d => setFormasPagamento(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // ── Aplicar filtros (reseta para página 1) ────────────────────────────────
  const handleFilter = () => {
    if (page === 1) loadData(1);
    else setPage(1);
  };

  // ── Card values (server-side aggregation) ─────────────────────────────────
  const totalPendente = statsAPI.total_pendente;
  const totalPago     = statsAPI.total_pago;
  const totalAtrasado = statsAPI.total_atrasado;
  const qtdPendente   = statsAPI.qtd_pendente;
  const qtdAtrasado   = statsAPI.qtd_atrasado;
  const totalPages    = Math.max(1, Math.ceil(totalRecords / PER_PAGE));

  // ── Handlers: Baixa ──────────────────────────────────────────────────────────
  const handleOpenSettle = (c: ContasPagarAPI) => {
    if (getStatus(c) === 'PAGO') {
      setCancelWarning('Este título já está pago. Não é possível realizar uma nova baixa.');
      return;
    }
    setSettleTarget(c);
    setSettleAmountPaid(c.valor ?? 0);
    setSettleDate(today());
    setSettleObs(c.observacao ?? '');
    setSettleFormaPagamento(null);
    setPayError(null);
    setIsSettleOpen(true);
  };

  const handleConfirmSettle = async () => {
    if (!settleTarget) return;
    if (!settleFormaPagamento) {
      setPayError('Selecione a forma de pagamento para registrar a baixa.');
      return;
    }
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetch(`/api/contas-pagar/${settleTarget.idcontaspagar}/pagar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor_pago: settleAmountPaid,
          data_pagamento: settleDate,
          observacao: settleObs || null,
          idformapgto: settleFormaPagamento,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setPayError(err.detail ?? 'Erro ao registrar pagamento.');
        return;
      }
      setIsSettleOpen(false);
      setPaySuccess(true);
      await loadData(page);
    } finally {
      setPaying(false);
    }
  };

  // ── Handlers: Cancelar Baixa ─────────────────────────────────────────────────
  const handleOpenCancelar = (c: ContasPagarAPI) => {
    const status = getStatus(c);
    if (status !== 'PAGO') {
      setCancelWarning('Esta conta ainda não foi baixada. O cancelamento de baixa só é permitido para contas com situação PAGO.');
      return;
    }
    setCancelTarget(c);
    setCancelError(null);
    setIsCancelOpen(true);
  };

  const handleConfirmCancelar = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/contas-pagar/${cancelTarget.idcontaspagar}/cancelar-baixa`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCancelError(err.detail ?? 'Erro ao cancelar baixa.');
        return;
      }
      setIsCancelOpen(false);
      await loadData(page);
    } finally {
      setCancelling(false);
    }
  };


  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <Header title="Contas a Pagar" />

      <div className="p-5 space-y-4">

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border-l-4 border-blue-500 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Pendente</p>
              <h3 className="text-xl font-black text-slate-800">{fmtCurrency(totalPendente)}</h3>
              <p className="text-[10px] text-blue-500 font-bold mt-0.5">{qtdPendente} contas <span className="text-slate-400 font-normal">em aberto</span></p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 flex-shrink-0 ml-3">
              <Clock className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border-l-4 border-emerald-500 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Pago</p>
              <h3 className="text-xl font-black text-slate-800">{fmtCurrency(totalPago)}</h3>
              <p className="text-[10px] text-emerald-500 font-bold mt-0.5">{statsAPI.qtd_pago} contas <span className="text-slate-400 font-normal">baixadas</span></p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500 flex-shrink-0 ml-3">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border-l-4 border-red-500 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total em Atraso</p>
              <h3 className="text-xl font-black text-slate-800">{fmtCurrency(totalAtrasado)}</h3>
              <p className="text-[10px] text-red-500 font-bold mt-0.5">{qtdAtrasado} contas <span className="text-slate-400 font-normal">vencidas</span></p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center text-red-500 flex-shrink-0 ml-3">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                label="Fornecedor"
                placeholder="Nome do fornecedor..."
                value={filterFornecedor}
                onChange={e => setFilterFornecedor(e.target.value)}
              />
            </div>
            <div className="w-40">
              <Input label="Vencimento De" type="date" value={filterVencDe} onChange={e => setFilterVencDe(e.target.value)} />
            </div>
            <div className="w-40">
              <Input label="Até" type="date" value={filterVencAte} onChange={e => setFilterVencAte(e.target.value)} />
            </div>
            <div className="w-44">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Status</label>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
              >
                <option value="">Todos os Status</option>
                <option value="PENDENTE">Pendente</option>
                <option value="PAGO">Pago</option>
                <option value="ATRASADO">Atrasado</option>
              </select>
            </div>
            <Button variant="secondary" className="gap-2" onClick={handleFilter}>
              <Search className="h-4 w-4" />
              Filtrar
            </Button>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Conta ID</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fornecedor</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Parcela</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vencimento</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && (
                <tr><td colSpan={7} className="px-4 py-2 text-center text-sm text-slate-400">Carregando...</td></tr>
              )}
              {!loading && contas.map(c => {
                const status = getStatus(c);
                return (
                  <tr key={c.idcontaspagar} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-4 py-2">
                      <span className="text-xs font-bold text-[#B21212]">#{c.idcontaspagar}</span>
                      {c.nota_numero && (
                        <span className="block text-[10px] text-slate-400">NF {c.nota_numero}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs font-bold text-slate-700">
                        {c.fornecedor_nome ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">{c.parcela ?? '—'}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">{fmtDate(c.vencimento)}</td>
                    <td className="px-4 py-2">
                      <span className="text-xs font-bold text-slate-700">{fmtCurrency(c.valor ?? 0)}</span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={cn(
                        'inline-flex px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border',
                        STATUS_COLORS[status]
                      )}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-emerald-600"
                          onClick={() => handleOpenSettle(c)}
                          title="Baixar"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        {status === 'PAGO' && (
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-amber-600"
                            onClick={() => handleOpenCancelar(c)}
                            title="Cancelar Baixa"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && contas.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-2 text-center text-sm text-slate-400">Nenhuma conta encontrada.</td></tr>
              )}
            </tbody>
          </table>

          <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Mostrando {contas.length} de {totalRecords} contas
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="h-4 w-4" /></Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === '...'
                    ? <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 text-xs">…</span>
                    : <Button key={p} variant={page === p ? 'default' : 'outline'} className="h-8 w-8 p-0 text-xs font-bold" onClick={() => setPage(p as number)}>{p}</Button>
                )}
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      </div>

      {/* ══ Modal: Baixa de Conta a Pagar ════════════════════════════════════ */}
      <Modal
        isOpen={isSettleOpen}
        onClose={() => setIsSettleOpen(false)}
        title="Baixa de Conta a Pagar"
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsSettleOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmSettle} disabled={paying} className="bg-emerald-600 hover:bg-emerald-700">
              {paying ? 'Salvando...' : 'Confirmar Pagamento'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Conta</p>
                <p className="text-sm font-bold text-slate-700">#{settleTarget?.idcontaspagar}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {settleTarget?.fornecedor_nome ?? '—'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Parcela</p>
                <p className="text-sm font-bold text-slate-700">{settleTarget?.parcela ?? '—'}</p>
                <p className="text-xs text-slate-500 mt-0.5">Venc: {fmtDate(settleTarget?.vencimento)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Valor Original</p>
                <p className="text-sm font-bold text-slate-700">{fmtCurrency(settleTarget?.valor ?? 0)}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Forma de Pagamento <span className="text-red-500">*</span>
            </label>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20"
              value={settleFormaPagamento ?? ''}
              onChange={e => setSettleFormaPagamento(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Selecione a forma de pagamento...</option>
              {formasPagamento.map(fp => (
                <option key={fp.idformapgto} value={fp.idformapgto}>{fp.nome}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InputCurrency
              label="Valor Pago (R$)"
              value={settleAmountPaid}
              onChange={v => setSettleAmountPaid(v)}
            />
            <Input
              label="Data de Pagamento"
              type="date"
              value={settleDate}
              onChange={e => setSettleDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Observação</label>
            <textarea
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 min-h-[64px] resize-none"
              placeholder="Observação sobre o pagamento..."
              value={settleObs}
              onChange={e => setSettleObs(e.target.value)}
            />
          </div>

          {payError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-xs text-red-600 font-medium">{payError}</p>
            </div>
          )}

          <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100 flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">Valor a Baixar:</span>
            <span className="text-lg font-black text-emerald-700">{fmtCurrency(settleAmountPaid)}</span>
          </div>
        </div>
      </Modal>

      {/* ══ Modal: Baixa realizada com sucesso ═══════════════════════════════ */}
      <Modal
        isOpen={paySuccess}
        onClose={() => setPaySuccess(false)}
        title="Pagamento Registrado"
        className="max-w-md"
        footer={<Button onClick={() => setPaySuccess(false)} className="px-8">OK</Button>}
      >
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-800">Baixa realizada com sucesso!</h4>
            <p className="text-sm text-slate-500 mt-1">O pagamento foi registrado e a conta foi marcada como paga.</p>
          </div>
        </div>
      </Modal>


      {/* ══ Modal: Aviso — não pode cancelar baixa ═══════════════════════════ */}
      <Modal
        isOpen={cancelWarning !== null}
        onClose={() => setCancelWarning(null)}
        title="Operação não permitida"
        className="max-w-md"
        footer={<Button onClick={() => setCancelWarning(null)} className="px-8">Entendido</Button>}
      >
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="h-16 w-16 bg-amber-50 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-800">Não é possível cancelar a baixa</h4>
            <p className="text-sm text-slate-500 mt-1">{cancelWarning}</p>
          </div>
        </div>
      </Modal>

      {/* ══ Modal: Confirmar Cancelamento de Baixa ═══════════════════════════ */}
      <Modal
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        title="Cancelar Baixa"
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsCancelOpen(false)}>Voltar</Button>
            <Button
              onClick={handleConfirmCancelar}
              disabled={cancelling}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {cancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-100">
            <RotateCcw className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Esta ação irá reverter o pagamento registrado.</p>
              <p className="text-xs text-amber-600 mt-1">O valor pago e a data de pagamento serão zerados e a conta voltará ao status pendente.</p>
            </div>
          </div>
          {cancelTarget && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Conta</p>
                <p className="text-sm font-bold text-slate-700">#{cancelTarget.idcontaspagar}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Parcela</p>
                <p className="text-sm font-bold text-slate-700">{cancelTarget.parcela ?? '—'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Valor Pago</p>
                <p className="text-sm font-bold text-slate-700">{fmtCurrency(cancelTarget.valor_pago ?? 0)}</p>
              </div>
            </div>
          )}
          {cancelError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-100 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {cancelError}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
