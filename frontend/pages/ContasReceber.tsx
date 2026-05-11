import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import {
  Search,
  Check,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '../utils/cn';

// ── Local types ───────────────────────────────────────────────────────────────
interface ContaReceberAPI {
  idcontasreceber: number;
  idfechamento: number | null;
  vencimento: string | null;
  valor: number | null;
  valor_pago: number | null;
  situacao: boolean | null;
  parcela: string | null;
  ultimo_pagamento: string | null;
  cliente_nome: string | null;  // vem do JOIN no backend
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: string | null): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ContasReceberPage() {
  const today = new Date().toISOString().split('T')[0];

  // ── Data ──────────────────────────────────────────────────────────────────
  const [contas, setContas] = useState<ContaReceberAPI[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Paginação ─────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [statsAPI, setStatsAPI] = useState({
    total_pago: 0, total_pendente: 0, total_atrasado: 0,
    qtd_pendente: 0, qtd_atrasado: 0,
  });
  const PER_PAGE = 50;

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterCliente, setFilterCliente] = useState('');
  const [filterVencDe, setFilterVencDe] = useState('');
  const [filterVencAte, setFilterVencAte] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // ── Settle (Baixar) modal ─────────────────────────────────────────────────
  const [editingItem, setEditingItem] = useState<ContaReceberAPI | null>(null);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleData, setSettleData] = useState({ amountPaid: 0, paymentDate: today });
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccess, setPaySuccess] = useState(false);

  // ── Cancel Baixa ─────────────────────────────────────────────────────────
  const [cancelTarget, setCancelTarget] = useState<ContaReceberAPI | null>(null);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [cancelWarning, setCancelWarning] = useState<string | null>(null);

  // ── Load data (server-side filters) ──────────────────────────────────────
  const loadData = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('skip', String((p - 1) * PER_PAGE));
      params.set('limit', String(PER_PAGE));
      if (filterCliente) params.set('cliente', filterCliente);
      if (filterVencDe)  params.set('venc_de', filterVencDe);
      if (filterVencAte) params.set('venc_ate', filterVencAte);
      if (filterStatus)  params.set('status', filterStatus);

      const res  = await fetch(`/api/contas-receber?${params}`);
      const json = await res.json();
      setContas(Array.isArray(json.data) ? json.data : []);
      setTotalRecords(json.total ?? 0);
      setStatsAPI({
        total_pago:     json.total_pago     ?? 0,
        total_pendente: json.total_pendente ?? 0,
        total_atrasado: json.total_atrasado ?? 0,
        qtd_pendente:   json.qtd_pendente   ?? 0,
        qtd_atrasado:   json.qtd_atrasado   ?? 0,
      });
    } finally {
      setLoading(false);
    }
  }, [filterCliente, filterVencDe, filterVencAte, filterStatus]);

  useEffect(() => { loadData(page); }, [page, loadData]);

  const handleFilter = () => {
    if (page === 1) loadData(1);
    else setPage(1);
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalPendente = statsAPI.total_pendente;
  const totalPago     = statsAPI.total_pago;
  const totalAtrasado = statsAPI.total_atrasado;
  const qtdPendente   = statsAPI.qtd_pendente;
  const qtdAtrasado   = statsAPI.qtd_atrasado;
  const totalPages    = Math.max(1, Math.ceil(totalRecords / PER_PAGE));

  // ── Handlers: Settle ─────────────────────────────────────────────────────
  const handleOpenSettleModal = (item: ContaReceberAPI) => {
    setEditingItem(item);
    setSettleData({ amountPaid: item.valor ?? 0, paymentDate: today });
    setPayError(null);
    setIsSettleModalOpen(true);
  };

  const handleConfirmSettle = async () => {
    if (!editingItem) return;
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetch(`/api/contas-receber/${editingItem.idcontasreceber}/pagar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor_pago: settleData.amountPaid, data_pagamento: settleData.paymentDate }),
      });
      if (!res.ok) {
        const err = await res.json();
        setPayError(err.detail ?? 'Erro ao registrar pagamento.');
        return;
      }
      setIsSettleModalOpen(false);
      setPaySuccess(true);
      await loadData(page);
    } finally {
      setPaying(false);
    }
  };

  // ── Handlers: Cancel Baixa ────────────────────────────────────────────────
  const handleOpenCancelBaixa = (item: ContaReceberAPI) => {
    const status = getStatus(item);
    if (status !== 'PAGO') {
      setCancelWarning('Esta conta ainda não foi baixada. O cancelamento de baixa só é permitido para contas com situação PAGO.');
      return;
    }
    setCancelTarget(item);
    setCancelError(null);
    setIsCancelConfirmOpen(true);
  };

  const handleConfirmCancelBaixa = async () => {
    if (!cancelTarget) return;
    setCanceling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/contas-receber/${cancelTarget.idcontasreceber}/cancelar-baixa`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        const err = await res.json();
        setCancelError(err.detail ?? 'Erro ao cancelar baixa.');
        return;
      }
      setIsCancelConfirmOpen(false);
      setCancelSuccess(true);
      await loadData(page);
    } finally {
      setCanceling(false);
      setCancelTarget(null);
    }
  };

  // ── Formatting ────────────────────────────────────────────────────────────
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const statusColors = {
    'PENDENTE': 'bg-blue-50 text-blue-600 border-blue-100',
    'PAGO':     'bg-emerald-50 text-emerald-600 border-emerald-100',
    'ATRASADO': 'bg-red-50 text-red-600 border-red-100',
  } as const;

  const getStatus = (c: ContaReceberAPI): keyof typeof statusColors => {
    if (c.situacao === true) return 'PAGO';
    if (c.vencimento && c.vencimento < today) return 'ATRASADO';
    return 'PENDENTE';
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <Header title="Contas a Receber" />

      <div className="p-5 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border-l-4 border-blue-500 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Pendente</p>
              <h3 className="text-xl font-black text-slate-800">{formatCurrency(totalPendente)}</h3>
              <p className="text-[10px] text-blue-500 font-bold mt-0.5">
                {qtdPendente} {qtdPendente === 1 ? 'fatura' : 'faturas'}{' '}
                <span className="text-slate-400 font-normal">em aberto</span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 flex-shrink-0 ml-3">
              <Clock className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border-l-4 border-emerald-500 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Pago</p>
              <h3 className="text-xl font-black text-slate-800">{formatCurrency(totalPago)}</h3>
              <p className="text-[10px] text-emerald-500 font-bold mt-0.5">
                <span className="text-slate-400 font-normal">recebimentos baixados</span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500 flex-shrink-0 ml-3">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border-l-4 border-red-500 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total em Atraso</p>
              <h3 className="text-xl font-black text-slate-800">{formatCurrency(totalAtrasado)}</h3>
              <p className="text-[10px] text-red-500 font-bold mt-0.5">
                {qtdAtrasado} {qtdAtrasado === 1 ? 'fatura' : 'faturas'}{' '}
                <span className="text-slate-400 font-normal">em atraso</span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center text-red-500 flex-shrink-0 ml-3">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Filters Card */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                label="Cliente"
                placeholder="Nome do cliente..."
                value={filterCliente}
                onChange={e => setFilterCliente(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFilter()}
              />
            </div>
            <div className="w-40">
              <Input
                label="Vencimento De"
                type="date"
                value={filterVencDe}
                onChange={e => setFilterVencDe(e.target.value)}
              />
            </div>
            <div className="w-40">
              <Input
                label="Até"
                type="date"
                value={filterVencAte}
                onChange={e => setFilterVencAte(e.target.value)}
              />
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
            <Button variant="default" className="gap-2" onClick={handleFilter}>
              <Search className="h-4 w-4" />
              Filtrar
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setFilterCliente('');
                setFilterVencDe('');
                setFilterVencAte('');
                setFilterStatus('');
                if (page === 1) loadData(1);
                else setPage(1);
              }}
            >
              Limpar
            </Button>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fechamento</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vencimento</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-2 text-center text-sm text-slate-400">Carregando...</td>
                </tr>
              ) : contas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-2 text-center text-sm text-slate-400">Nenhum registro encontrado.</td>
                </tr>
              ) : (
                contas.map((c) => {
                  const status = getStatus(c);
                  return (
                    <tr key={c.idcontasreceber} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-4 py-2">
                        <span className="text-xs font-bold text-[#B21212]">#{c.idfechamento}</span>
                        {c.parcela && (
                          <span className="ml-2 text-xs text-slate-400">{c.parcela}</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-xs font-bold text-slate-700">
                          {c.cliente_nome ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">{fmtDate(c.vencimento)}</td>
                      <td className="px-4 py-2">
                        <span className="text-xs font-bold text-slate-700">{formatCurrency(c.valor ?? 0)}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={cn(
                          "inline-flex px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border",
                          statusColors[status]
                        )}>
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-600"
                            onClick={() => handleOpenCancelBaixa(c)}
                            title="Cancelar Baixa"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-emerald-600"
                            onClick={() => handleOpenSettleModal(c)}
                            title="Baixar"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Footer */}
          <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {totalRecords === 0
                ? 'Nenhum registro encontrado'
                : `Exibindo ${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, totalRecords)} de ${totalRecords} registros`}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) => p === '...'
                    ? <span key={`e${idx}`} className="px-1 text-xs text-slate-400">...</span>
                    : <Button key={p} variant={p === page ? 'default' : 'outline'} className="h-8 w-8 p-0 text-xs font-bold" onClick={() => setPage(p as number)}>{p}</Button>
                  )}
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Settlement (Baixa) Modal */}
      <Modal
        isOpen={isSettleModalOpen}
        onClose={() => setIsSettleModalOpen(false)}
        title="Baixa de Contas a Receber"
        footer={
          <div className="flex gap-3 w-full">
            {payError && (
              <p className="flex-1 text-xs text-red-600 flex items-center">{payError}</p>
            )}
            <div className="flex gap-3 ml-auto">
              <Button variant="outline" onClick={() => setIsSettleModalOpen(false)} disabled={paying}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmSettle} className="bg-emerald-600 hover:bg-emerald-700" disabled={paying}>
                {paying ? 'Salvando...' : 'Confirmar Pagamento'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fechamento / Cliente</p>
                <p className="text-sm font-bold text-slate-700">
                  #{editingItem?.idfechamento}
                  {editingItem?.cliente_nome && (
                    <span className="ml-2 text-slate-500 font-normal">{editingItem.cliente_nome}</span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Valor Original</p>
                <p className="text-sm font-bold text-slate-700">{formatCurrency(editingItem?.valor || 0)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Valor Pago (R$)"
              type="number"
              value={settleData.amountPaid}
              onChange={(e) => setSettleData({ ...settleData, amountPaid: parseFloat(e.target.value) })}
            />
            <Input
              label="Data de Pagamento"
              type="date"
              value={settleData.paymentDate}
              onChange={(e) => setSettleData({ ...settleData, paymentDate: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* Cancel Baixa Confirm Modal */}
      <Modal
        isOpen={isCancelConfirmOpen}
        onClose={() => setIsCancelConfirmOpen(false)}
        title="Cancelar Baixa"
        footer={
          <div className="flex gap-3 w-full">
            {cancelError && (
              <p className="flex-1 text-xs text-red-600 flex items-center">{cancelError}</p>
            )}
            <div className="flex gap-3 ml-auto">
              <Button variant="outline" onClick={() => setIsCancelConfirmOpen(false)} disabled={canceling}>
                Não
              </Button>
              <Button onClick={handleConfirmCancelBaixa} className="bg-red-600 hover:bg-red-700" disabled={canceling}>
                {canceling ? 'Cancelando...' : 'Sim, Cancelar Baixa'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Deseja cancelar a baixa desta parcela? O valor pago será zerado e o status voltará para aberto.
          </p>
          {cancelTarget && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
              <span className="font-bold text-[#B21212]">#{cancelTarget.idfechamento}</span>
              {cancelTarget.cliente_nome && (
                <span className="ml-2 text-slate-500">{cancelTarget.cliente_nome}</span>
              )}
              {cancelTarget.parcela && <span className="ml-2 text-slate-400">{cancelTarget.parcela}</span>}
              <span className="ml-2 text-slate-700 font-bold">{formatCurrency(cancelTarget.valor ?? 0)}</span>
            </div>
          )}
        </div>
      </Modal>

      {/* Cancel Baixa Success Modal */}
      <Modal
        isOpen={cancelSuccess}
        onClose={() => setCancelSuccess(false)}
        title="Baixa Cancelada"
        footer={<Button onClick={() => setCancelSuccess(false)}>OK</Button>}
      >
        <p className="text-sm text-slate-600">Cancelamento de baixa realizado com sucesso.</p>
      </Modal>

      {/* Pay Success Modal */}
      <Modal
        isOpen={paySuccess}
        onClose={() => setPaySuccess(false)}
        title="Pagamento Registrado"
        footer={
          <Button onClick={() => setPaySuccess(false)} className="bg-emerald-600 hover:bg-emerald-700">OK</Button>
        }
      >
        <p className="text-sm text-slate-600">Pagamento registrado com sucesso.</p>
      </Modal>

      {/* Cancel Baixa Warning Modal */}
      <Modal
        isOpen={cancelWarning !== null}
        onClose={() => setCancelWarning(null)}
        title="Operação não permitida"
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
    </div>
  );
}
