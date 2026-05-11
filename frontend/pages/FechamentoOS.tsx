import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import {
  ClipboardCheck, DollarSign, Search, ListChecks, AlertCircle,
  CheckCircle2, Trash2, ChevronDown, ChevronRight, ChevronLeft,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { cn } from '../utils/cn';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface OrdemAberta {
  idordem: number;
  numero_os: number | null;
  data: string | null;
  idcliente: number | null;
  idempresa: number | null;
  valor_os: number | null;
  valor_frete: number | null;
  servico_prestado: string | null;
  situacao: boolean | null;
  cliente_rel: { idcliente: number; nome: string | null; nomefantasia: string | null; cnpj_cpf: string | null } | null;
}

interface ClienteOpt {
  idcliente: number;
  nome: string | null;
  nomefantasia: string | null;
  cnpj_cpf: string | null;
}

interface EmpresaOpt {
  idempresa: number;
  nome: string;
  nomefantasia: string | null;
}

interface Parcela {
  numero: number;
  vencimento: string;
  valor: number;
}

interface ContaReceber {
  idcontasreceber: number;
  parcela: string | null;
  vencimento: string | null;
  valor: number | null;
  valor_pago: number | null;
  situacao: boolean | null;
}

interface FechamentoItem {
  idfechamento: number;
  data: string | null;
  valor: number | null;
  total_itens: number | null;
  parcelas: number | null;
  gerar_nf: boolean | null;
  situacao: boolean | null;
  idempresa: number | null;
  idcliente: number | null;
  empresa_rel: { idempresa: number; nome: string | null; nomefantasia: string | null } | null;
  cliente_rel: { idcliente: number; nome: string | null; nomefantasia: string | null } | null;
  contas: ContaReceber[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

function gerarParcelas(total: number, numParcelas: number, primeiroVenc: string): Parcela[] {
  const valorBase = Math.floor((total / numParcelas) * 100) / 100;
  const diff = Math.round((total - valorBase * numParcelas) * 100) / 100;
  return Array.from({ length: numParcelas }, (_, i) => ({
    numero: i + 1,
    vencimento: addMonths(primeiroVenc, i),
    valor: i === numParcelas - 1 ? Math.round((valorBase + diff) * 100) / 100 : valorBase,
  }));
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// ── Componente ────────────────────────────────────────────────────────────────
export function FechamentoOSPage() {
  // ── Aba ativa ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'novo' | 'realizados'>('novo');

  // ── Dados externos ──────────────────────────────────────────────────────────
  const [ordens, setOrdens] = useState<OrdemAberta[]>([]);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaOpt[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Seleção (aba Novo Fechamento) ────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // ── Filtro (aba Novo Fechamento) ─────────────────────────────────────────────
  const [filterCliente, setFilterCliente] = useState('');

  // ── Parcelamento ─────────────────────────────────────────────────────────────
  const [numParcelas, setNumParcelas] = useState<number>(1);
  const [primeiroVenc, setPrimeiroVenc] = useState(new Date().toISOString().split('T')[0]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);

  // ── Opções ────────────────────────────────────────────────────────────────────
  const [semNF, setSemNF] = useState(false);
  const [outraEmpresa, setOutraEmpresa] = useState(false);
  const [idEmpresaFat, setIdEmpresaFat] = useState(0);

  // ── Feedback (aba Novo Fechamento) ───────────────────────────────────────────
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Wizard (aba Novo Fechamento) ─────────────────────────────────────────────
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  // ── Paginação (aba Novo Fechamento) ──────────────────────────────────────────
  const [pageOrdens, setPageOrdens] = useState(1);
  const PER_PAGE_ORDENS = 15;

  // ── Fechamentos Realizados ────────────────────────────────────────────────────
  const [fechamentos, setFechamentos] = useState<FechamentoItem[]>([]);
  const [loadingFec, setLoadingFec] = useState(false);
  const [filterFecCliente, setFilterFecCliente] = useState('');
  const [filterFecDataIni, setFilterFecDataIni] = useState('');
  const [filterFecDataFim, setFilterFecDataFim] = useState('');
  const [fechamentoSel, setFechamentoSel] = useState<FechamentoItem | null>(null);
  const [pageFec, setPageFec] = useState(1);
  const [totalFec, setTotalFec] = useState(0);
  const PER_PAGE_FEC = 50;
  const [ordensDoFec, setOrdensDoFec] = useState<OrdemAberta[]>([]);
  const [loadingOrdensDoc, setLoadingOrdensDoc] = useState(false);

  // ── Delete flow ──────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<FechamentoItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Fetch inicial ────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [ordRes, cliRes, empRes] = await Promise.all([
          fetch('/api/ordens?situacao=false&limit=500'),
          fetch('/api/clientes/options'),
          fetch('/api/empresas'),
        ]);
        if (ordRes.ok) {
          const ordJson = await ordRes.json();
          setOrdens(Array.isArray(ordJson.data) ? ordJson.data : (Array.isArray(ordJson) ? ordJson : []));
        }
        if (cliRes.ok) setClientes(await cliRes.json());
        if (empRes.ok) setEmpresas(await empRes.json());
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // ── Carregar fechamentos ao entrar na aba ────────────────────────────────────
  const loadFechamentos = useCallback(async (p: number) => {
    setLoadingFec(true);
    try {
      const params = new URLSearchParams();
      params.set('skip', String((p - 1) * PER_PAGE_FEC));
      params.set('limit', String(PER_PAGE_FEC));
      const res = await fetch(`/api/fechamento?${params}`);
      if (res.ok) {
        const json = await res.json();
        setFechamentos(Array.isArray(json.data) ? json.data : []);
        setTotalFec(json.total ?? 0);
      }
    } finally {
      setLoadingFec(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'realizados') loadFechamentos(pageFec);
  }, [activeTab, pageFec]);

  // ── Carregar ordens do fechamento selecionado ────────────────────────────────
  useEffect(() => {
    if (!fechamentoSel) { setOrdensDoFec([]); return; }
    setLoadingOrdensDoc(true);
    fetch(`/api/ordens?idfechamento=${fechamentoSel.idfechamento}&limit=500`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(data => setOrdensDoFec(Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : [])))
      .finally(() => setLoadingOrdensDoc(false));
  }, [fechamentoSel]);

  // ── Computed (aba Novo Fechamento) ───────────────────────────────────────────
  const clienteMap = useMemo(() => {
    const m = new Map<number, ClienteOpt>();
    clientes.forEach(c => m.set(c.idcliente, c));
    return m;
  }, [clientes]);

  const ordensFiltradas = useMemo(() => {
    const q = filterCliente.trim().toLowerCase();
    const base = !q ? ordens : ordens.filter(o => {
      // Usa cliente_rel (já vem na resposta da API via joinedload)
      const c = o.cliente_rel ?? clienteMap.get(o.idcliente ?? -1);
      if (!c) return false;
      return (
        (c.nome ?? '').toLowerCase().includes(q) ||
        (c.nomefantasia ?? '').toLowerCase().includes(q)
      );
    });
    return [...base].sort((a, b) => {
      if (!a.data && !b.data) return 0;
      if (!a.data) return 1;
      if (!b.data) return -1;
      return b.data.localeCompare(a.data); // decrescente: mais recente primeiro
    });
  }, [ordens, filterCliente, clienteMap]);

  const ordensPagina = useMemo(
    () => ordensFiltradas.slice((pageOrdens - 1) * PER_PAGE_ORDENS, pageOrdens * PER_PAGE_ORDENS),
    [ordensFiltradas, pageOrdens, PER_PAGE_ORDENS]
  );

  const ordensSelecionadas = useMemo(
    () => ordens.filter(o => selectedIds.has(o.idordem)),
    [ordens, selectedIds]
  );

  const totalSelecionado = useMemo(
    () => ordensSelecionadas.reduce((s, o) => s + (o.valor_os ?? 0), 0),
    [ordensSelecionadas]
  );

  const temSelecao = selectedIds.size > 0;

  // ── Computed (aba Realizados) ────────────────────────────────────────────────
  const fechamentosFiltrados = useMemo(() => {
    return fechamentos.filter(f => {
      if (filterFecCliente.trim()) {
        const q = filterFecCliente.trim().toLowerCase();
        const cli = f.cliente_rel;
        const match =
          (cli?.nome ?? '').toLowerCase().includes(q) ||
          (cli?.nomefantasia ?? '').toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filterFecDataIni && f.data && f.data < filterFecDataIni) return false;
      if (filterFecDataFim && f.data && f.data > filterFecDataFim) return false;
      return true;
    });
  }, [fechamentos, filterFecCliente, filterFecDataIni, filterFecDataFim]);

  // ── Seleção handlers ─────────────────────────────────────────────────────────
  const toggleOrdem = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setParcelas([]);
    setValidationMsg(null);
    setSuccessMsg(null);
  };

  const toggleAll = () => {
    // Opera em TODOS os registros filtrados (não apenas a página atual)
    const allIds = ordensFiltradas.map(o => o.idordem);
    const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        allIds.forEach(id => next.delete(id));
      } else {
        allIds.forEach(id => next.add(id));
      }
      return next;
    });
    setParcelas([]);
    setValidationMsg(null);
    setSuccessMsg(null);
  };

  // ── Gerar parcelamento ───────────────────────────────────────────────────────
  const handleGerarParcelamento = () => {
    if (!temSelecao || !primeiroVenc) return;
    const n = Math.max(1, Math.min(120, numParcelas));
    setParcelas(gerarParcelas(totalSelecionado, n, primeiroVenc));
    setValidationMsg(null);
    setSuccessMsg(null);
  };

  // ── Editar parcela ───────────────────────────────────────────────────────────
  const updateParcela = (idx: number, field: 'vencimento' | 'valor', value: string | number) => {
    setParcelas(prev =>
      prev.map((p, i) => i === idx ? { ...p, [field]: value } : p)
    );
    setValidationMsg(null);
    setSuccessMsg(null);
  };

  // ── Recarregar ordens em aberto ──────────────────────────────────────────────
  const reloadOrdens = async () => {
    const res = await fetch('/api/ordens?situacao=false&limit=500');
    if (res.ok) {
      const json = await res.json();
      setOrdens(Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []));
    }
  };

  // ── Confirmar fechamento ─────────────────────────────────────────────────────
  const handleConfirmar = async () => {
    setValidationMsg(null);
    setSuccessMsg(null);

    if (!temSelecao) {
      setValidationMsg('Selecione ao menos uma Ordem de Serviço.');
      return;
    }
    if (parcelas.length === 0) {
      setValidationMsg('Gere o parcelamento antes de confirmar.');
      return;
    }
    if (outraEmpresa && !idEmpresaFat) {
      setValidationMsg('Selecione a empresa para faturamento.');
      return;
    }

    const somaParcelas = Math.round(parcelas.reduce((s, p) => s + Number(p.valor), 0) * 100) / 100;
    const totalRef = Math.round(totalSelecionado * 100) / 100;

    if (somaParcelas !== totalRef) {
      setValidationMsg(
        `A soma das parcelas (${brl(somaParcelas)}) é diferente do valor total das OS selecionadas (${brl(totalRef)}). Ajuste os valores antes de confirmar.`
      );
      return;
    }

    const primeiraOS = ordensSelecionadas[0];
    const idempresa = outraEmpresa ? idEmpresaFat : (primeiraOS?.idempresa ?? 0);
    const idcliente = primeiraOS?.idcliente ?? 0;

    const payload = {
      ids_ordens: Array.from(selectedIds),
      idcliente,
      idempresa,
      gerar_nf: !semNF,
      parcelas: parcelas.map(p => ({
        vencimento: p.vencimento,
        valor: p.valor,
        parcela: `${p.numero}/${parcelas.length}`,
      })),
    };

    setSaving(true);
    try {
      const res = await fetch('/api/fechamento/fechar-os', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setValidationMsg(`Erro ao confirmar fechamento: ${body.detail || `Erro ${res.status}`}`);
        return;
      }

      const qtdOS = selectedIds.size;
      const qtdParcelas = parcelas.length;
      const total = totalSelecionado;

      setSelectedIds(new Set());
      setParcelas([]);
      setNumParcelas(1);
      setPrimeiroVenc(new Date().toISOString().split('T')[0]);
      setSemNF(false);
      setOutraEmpresa(false);
      setIdEmpresaFat(0);
      setFilterCliente('');
      setWizardStep(1);

      await reloadOrdens();

      setSuccessMsg(
        `Fechamento realizado com sucesso! ${qtdOS} OS fechada(s) — ${qtdParcelas} parcela(s) — Total: ${brl(total)}`
      );
    } catch {
      setValidationMsg('Erro ao conectar com o servidor. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  // ── Excluir fechamento ───────────────────────────────────────────────────────
  const handleSolicitarExclusao = (f: FechamentoItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteError(null);
    const parcPagas = f.contas.filter(c => c.situacao === true);
    if (parcPagas.length > 0) {
      setDeleteError(
        `O fechamento #${f.idfechamento} possui ${parcPagas.length} parcela(s) já paga(s) e não pode ser excluído.`
      );
      return;
    }
    setDeleteTarget(f);
  };

  const handleConfirmarExclusao = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/fechamento/desfazer/${deleteTarget.idfechamento}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDeleteError(body.detail || `Erro ${res.status}`);
        setDeleteTarget(null);
        return;
      }
      const idFec = deleteTarget.idfechamento;
      setDeleteTarget(null);
      if (fechamentoSel?.idfechamento === idFec) setFechamentoSel(null);
      await loadFechamentos(pageFec);
      await reloadOrdens();
      setDeleteSuccess(`Fechamento #${idFec} excluído com sucesso. As ordens de serviço foram reabertas.`);
    } catch {
      setDeleteError('Erro ao conectar com o servidor. Tente novamente.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Modal: Fechamento realizado */}
      <Modal
        isOpen={successMsg !== null}
        onClose={() => setSuccessMsg(null)}
        title="Fechamento Realizado"
        size="sm"
        footer={
          <Button onClick={() => setSuccessMsg(null)} className="px-8">
            OK
          </Button>
        }
      >
        <div className="flex flex-col items-center text-center gap-4 py-2">
          <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{successMsg}</p>
        </div>
      </Modal>

      {/* Modal: Confirmar exclusão */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Confirmar Exclusão"
        size="sm"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarExclusao}
              disabled={deleting}
              className="gap-2 bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Excluindo...' : 'Excluir Fechamento'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 py-2">
          <p className="text-sm text-slate-600">
            Tem certeza que deseja excluir o{' '}
            <strong>Fechamento #{deleteTarget?.idfechamento}</strong>?
          </p>
          <p className="text-sm text-slate-500">
            As ordens de serviço serão reabertas, as parcelas e o fechamento serão excluídos.
            Esta ação não pode ser desfeita.
          </p>
        </div>
      </Modal>

      {/* Modal: Erro de exclusão */}
      <Modal
        isOpen={deleteError !== null}
        onClose={() => setDeleteError(null)}
        title="Não é possível excluir"
        size="sm"
        footer={
          <Button onClick={() => setDeleteError(null)} className="px-8">
            OK
          </Button>
        }
      >
        <div className="flex items-start gap-3 py-2">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-slate-600">{deleteError}</p>
        </div>
      </Modal>

      {/* Modal: Exclusão realizada */}
      <Modal
        isOpen={deleteSuccess !== null}
        onClose={() => setDeleteSuccess(null)}
        title="Fechamento Excluído"
        size="sm"
        footer={
          <Button onClick={() => setDeleteSuccess(null)} className="px-8">
            OK
          </Button>
        }
      >
        <div className="flex flex-col items-center text-center gap-4 py-2">
          <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{deleteSuccess}</p>
        </div>
      </Modal>

      <div className="flex flex-col h-full">
        <Header title="Fechamento de Ordem de Serviço" />

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="border-b border-slate-200 bg-white px-8">
          <div className="flex gap-0">
            {(['novo', 'realizados'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-5 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors',
                  activeTab === tab
                    ? 'border-[#B21212] text-[#B21212]'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                )}
              >
                {tab === 'novo' ? 'Novo Fechamento' : 'Fechamentos Realizados'}
              </button>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            ABA: NOVO FECHAMENTO — WIZARD
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'novo' && (
          <div className="flex flex-col flex-1 min-h-0">

            {/* ── Stepper ──────────────────────────────────────────────────── */}
            <div className="bg-white border-b border-slate-100 px-8 py-5">
              <div className="flex items-center max-w-lg mx-auto">
                {([
                  { step: 1 as const, label: 'Seleção de OS' },
                  { step: 2 as const, label: 'Pagamento' },
                  { step: 3 as const, label: 'Finalização' },
                ]).map((s, idx) => (
                  <React.Fragment key={s.step}>
                    <div className="flex flex-col items-center gap-1.5 shrink-0">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-colors',
                        wizardStep === s.step
                          ? 'bg-[#B21212] border-[#B21212] text-white'
                          : wizardStep > s.step
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'bg-white border-slate-200 text-slate-400'
                      )}>
                        {wizardStep > s.step
                          ? <CheckCircle2 className="h-4 w-4" />
                          : s.step}
                      </div>
                      <span className={cn(
                        'text-[10px] font-bold uppercase tracking-wider whitespace-nowrap',
                        wizardStep === s.step ? 'text-[#B21212]'
                          : wizardStep > s.step ? 'text-emerald-500'
                          : 'text-slate-300'
                      )}>
                        {s.label}
                      </span>
                    </div>
                    {idx < 2 && (
                      <div className={cn(
                        'flex-1 h-0.5 mx-3 mb-5 transition-colors',
                        wizardStep > s.step ? 'bg-emerald-400' : 'bg-slate-200'
                      )} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* ── Conteúdo do passo ────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">

              {/* ══ PASSO 1: Seleção de OS ═══════════════════════════════════ */}
              {wizardStep === 1 && (
                <>
                  {/* Filtro */}
                  <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="flex-1 min-w-[260px]">
                        <Input
                          label="Nome / Apelido do Cliente"
                          placeholder="Filtrar cliente..."
                          value={filterCliente}
                          onChange={e => { setFilterCliente(e.target.value); setPageOrdens(1); }}
                        />
                      </div>
                      <Button
                        variant="secondary"
                        className="gap-2"
                        onClick={() => { setFilterCliente(''); setPageOrdens(1); }}
                      >
                        <Search className="h-4 w-4" />
                        Limpar
                      </Button>
                    </div>
                  </div>

                  {/* Grid de Ordens em Aberto */}
                  <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">
                        Ordens de Serviço em Aberto
                      </h3>
                      <span className="text-xs text-slate-400">{ordensFiltradas.length} registro(s)</span>
                    </div>
                    <div className="px-4 py-1.5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-400">
                      <span>
                        Página {pageOrdens} de {Math.max(1, Math.ceil(ordensFiltradas.length / PER_PAGE_ORDENS))} &nbsp;·&nbsp; {ordensFiltradas.length} OS
                      </span>
                      <span>{selectedIds.size} selecionada(s)</span>
                    </div>

                    {loading ? (
                      <div className="p-8 text-center text-sm text-slate-400">Carregando...</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                              <th className="px-4 py-2 w-10">
                                <input
                                  type="checkbox"
                                  className="accent-[#B21212] w-4 h-4 cursor-pointer"
                                  checked={ordensFiltradas.length > 0 && ordensFiltradas.every(o => selectedIds.has(o.idordem))}
                                  onChange={toggleAll}
                                />
                              </th>
                              <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nº OS</th>
                              <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data</th>
                              <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente</th>
                              <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">CNPJ / CPF</th>
                              <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Valor OS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {ordensPagina.map(o => {
                              const cli = o.cliente_rel ?? clienteMap.get(o.idcliente ?? -1);
                              const sel = selectedIds.has(o.idordem);
                              return (
                                <tr
                                  key={o.idordem}
                                  onClick={() => toggleOrdem(o.idordem)}
                                  className={cn(
                                    'cursor-pointer transition-colors',
                                    sel ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-slate-50/60'
                                  )}
                                >
                                  <td className="px-4 py-2">
                                    <input
                                      type="checkbox"
                                      className="accent-[#B21212] w-4 h-4 cursor-pointer"
                                      checked={sel}
                                      onChange={() => toggleOrdem(o.idordem)}
                                      onClick={e => e.stopPropagation()}
                                    />
                                  </td>
                                  <td className="px-4 py-2">
                                    <span className="text-xs font-bold text-[#B21212]">
                                      {o.numero_os ? `#OS-${String(o.numero_os).padStart(4, '0')}` : `#${o.idordem}`}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-xs text-slate-500">{fmtDate(o.data)}</td>
                                  <td className="px-4 py-2">
                                    <span className="text-xs font-bold text-slate-700">
                                      {cli?.nomefantasia || cli?.nome || '—'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-xs text-slate-500">{cli?.cnpj_cpf || '—'}</td>
                                  <td className="px-4 py-2 text-xs font-bold text-slate-700 text-right">
                                    {brl(o.valor_os ?? 0)}
                                  </td>
                                </tr>
                              );
                            })}
                            {ordensPagina.length === 0 && !loading && (
                              <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                                  Nenhuma ordem de serviço em aberto encontrada.
                                </td>
                              </tr>
                            )}
                          </tbody>
                          {temSelecao && (
                            <tfoot>
                              <tr className="bg-slate-800 text-white">
                                <td colSpan={5} className="px-4 py-2 text-xs font-bold uppercase tracking-widest">
                                  Total selecionado ({selectedIds.size} OS)
                                </td>
                                <td className="px-4 py-2 text-xs font-bold text-emerald-400 text-right">
                                  {brl(totalSelecionado)}
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    )}

                    {/* Paginação */}
                    {(() => {
                      const totalPagesOrdens = Math.max(1, Math.ceil(ordensFiltradas.length / PER_PAGE_ORDENS));
                      if (totalPagesOrdens <= 1) return null;
                      return (
                        <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-500">
                            Página {pageOrdens} de {totalPagesOrdens}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPageOrdens(p => Math.max(1, p - 1))} disabled={pageOrdens === 1}><ChevronLeft className="h-4 w-4" /></Button>
                            {Array.from({ length: totalPagesOrdens }, (_, i) => i + 1)
                              .filter(p => p === 1 || p === totalPagesOrdens || Math.abs(p - pageOrdens) <= 1)
                              .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                                acc.push(p);
                                return acc;
                              }, [])
                              .map((p, idx) =>
                                p === '...'
                                  ? <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 text-xs">…</span>
                                  : <Button key={p} variant={pageOrdens === p ? 'primary' : 'outline'} className="h-8 w-8 p-0 text-xs font-bold" onClick={() => setPageOrdens(p as number)}>{p}</Button>
                              )}
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPageOrdens(p => Math.min(totalPagesOrdens, p + 1))} disabled={pageOrdens === totalPagesOrdens}><ChevronRight className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Navegação passo 1 */}
                  <div className="flex justify-end pb-4">
                    <Button
                      onClick={() => setWizardStep(2)}
                      disabled={!temSelecao}
                      className="gap-2 h-11 px-8 font-bold uppercase tracking-wider text-sm"
                    >
                      Próximo
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                </>
              )}

              {/* ══ PASSO 2: Configuração do Pagamento ═══════════════════════ */}
              {wizardStep === 2 && (
                <>
                  {/* Resumo da seleção */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl border-l-4 border-[#B21212] p-4 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">OS Selecionadas</p>
                        <h3 className="text-xl font-black text-slate-800">{selectedIds.size}</h3>
                        <p className="text-[10px] text-[#B21212] font-bold mt-0.5">
                          ordens <span className="text-slate-400 font-normal">marcadas para faturamento</span>
                        </p>
                      </div>
                      <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center text-[#B21212] flex-shrink-0 ml-3">
                        <ListChecks className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border-l-4 border-emerald-500 p-4 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Valor Total Selecionado</p>
                        <h3 className="text-xl font-black text-slate-800">{brl(totalSelecionado)}</h3>
                        <p className="text-[10px] text-emerald-500 font-bold mt-0.5">
                          soma <span className="text-slate-400 font-normal">das OS selecionadas</span>
                        </p>
                      </div>
                      <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500 flex-shrink-0 ml-3">
                        <DollarSign className="h-5 w-5" />
                      </div>
                    </div>
                  </div>

                  {/* Configuração do parcelamento */}
                  <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">
                        Configuração do Faturamento
                      </h3>
                    </div>
                    <div className="p-6">
                      <div className="flex flex-wrap items-end gap-4">
                        <div className="w-36">
                          <Input
                            label="Nº de Parcelas"
                            type="number"
                            min={1}
                            max={120}
                            value={numParcelas}
                            onChange={e => setNumParcelas(Math.max(1, Math.min(120, parseInt(e.target.value) || 1)))}
                          />
                        </div>
                        <div className="w-44">
                          <Input
                            label="Primeiro Vencimento"
                            type="date"
                            value={primeiroVenc}
                            onChange={e => setPrimeiroVenc(e.target.value)}
                          />
                        </div>
                        <Button
                          onClick={handleGerarParcelamento}
                          disabled={!primeiroVenc}
                          className="gap-2 h-10"
                        >
                          <ClipboardCheck className="h-4 w-4" />
                          Gerar Parcelamento
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Grid de Parcelas */}
                  {parcelas.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">Parcelamento</h3>
                        <span className="text-xs text-slate-400">{parcelas.length} parcela(s)</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                              <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-24">Parcela</th>
                              <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vencimento</th>
                              <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {parcelas.map((p, idx) => (
                              <tr key={p.numero} className="hover:bg-slate-50/40">
                                <td className="px-4 py-2">
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                                    {p.numero}
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="date"
                                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 w-44"
                                    value={p.vencimento}
                                    onChange={e => updateParcela(idx, 'vencimento', e.target.value)}
                                  />
                                </td>
                                <td className="px-4 py-2 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 text-right outline-none focus:ring-2 focus:ring-[#B21212]/20 w-36"
                                    value={Number(p.valor).toFixed(2)}
                                    onChange={e => updateParcela(idx, 'valor', parseFloat(e.target.value) || 0)}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-50 border-t border-slate-200">
                              <td colSpan={2} className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                Total das Parcelas
                              </td>
                              <td className="px-4 py-2 text-right">
                                <span className={cn(
                                  'text-xs font-bold',
                                  Math.abs(parcelas.reduce((s, p) => s + Number(p.valor), 0) - totalSelecionado) < 0.01
                                    ? 'text-emerald-600'
                                    : 'text-red-500'
                                )}>
                                  {brl(parcelas.reduce((s, p) => s + Number(p.valor), 0))}
                                </span>
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Navegação passo 2 */}
                  <div className="flex justify-between pb-4">
                    <Button
                      variant="secondary"
                      onClick={() => setWizardStep(1)}
                      className="gap-2 h-11 px-6 font-bold uppercase tracking-wider text-sm"
                    >
                      <ChevronLeft className="h-5 w-5" />
                      Voltar
                    </Button>
                    <Button
                      onClick={() => setWizardStep(3)}
                      disabled={parcelas.length === 0}
                      className="gap-2 h-11 px-8 font-bold uppercase tracking-wider text-sm"
                    >
                      Próximo
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                </>
              )}

              {/* ══ PASSO 3: Finalização ═════════════════════════════════════ */}
              {wizardStep === 3 && (
                <>
                  {/* Resumo geral */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl border-l-4 border-[#B21212] p-4 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">OS Selecionadas</p>
                        <h3 className="text-xl font-black text-slate-800">{selectedIds.size}</h3>
                      </div>
                      <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center text-[#B21212] flex-shrink-0 ml-3">
                        <ListChecks className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border-l-4 border-emerald-500 p-4 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Valor Total</p>
                        <h3 className="text-xl font-black text-slate-800">{brl(totalSelecionado)}</h3>
                      </div>
                      <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500 flex-shrink-0 ml-3">
                        <DollarSign className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border-l-4 border-slate-400 p-4 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Parcelas</p>
                        <h3 className="text-xl font-black text-slate-800">{parcelas.length}</h3>
                      </div>
                      <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0 ml-3">
                        <ClipboardCheck className="h-5 w-5" />
                      </div>
                    </div>
                  </div>

                  {/* Opções do Fechamento */}
                  <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-4">
                    <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2">
                      Opções do Fechamento
                    </h3>

                    <label className="flex items-center gap-3 cursor-pointer group w-fit">
                      <input
                        type="checkbox"
                        className="accent-slate-400 w-4 h-4 cursor-pointer"
                        checked={semNF}
                        onChange={e => setSemNF(e.target.checked)}
                      />
                      <span className="text-sm text-slate-400 group-hover:text-slate-500 select-none">
                        Fechamento não gera nota fiscal
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group w-fit">
                      <input
                        type="checkbox"
                        className="accent-[#B21212] w-4 h-4 cursor-pointer"
                        checked={outraEmpresa}
                        onChange={e => {
                          setOutraEmpresa(e.target.checked);
                          if (!e.target.checked) setIdEmpresaFat(0);
                        }}
                      />
                      <span className="text-sm text-slate-700 font-medium group-hover:text-slate-900 select-none">
                        Faturar Ordem de Serviço para outra Empresa
                      </span>
                    </label>

                    <div className={cn(
                      'ml-7 transition-opacity',
                      outraEmpresa ? 'opacity-100' : 'opacity-30 pointer-events-none select-none'
                    )}>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
                        Empresa para Faturamento
                      </label>
                      <select
                        className="h-10 w-full max-w-sm rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20"
                        value={idEmpresaFat}
                        onChange={e => setIdEmpresaFat(Number(e.target.value))}
                        disabled={!outraEmpresa}
                      >
                        <option value={0}>Selecione a empresa...</option>
                        {empresas.map(emp => (
                          <option key={emp.idempresa} value={emp.idempresa}>
                            {emp.nomefantasia || emp.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Feedback */}
                  {validationMsg && (
                    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
                      <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <span>{validationMsg}</span>
                    </div>
                  )}

                  {/* Navegação passo 3 */}
                  <div className="flex justify-between pb-4">
                    <Button
                      variant="secondary"
                      onClick={() => { setWizardStep(2); setValidationMsg(null); }}
                      className="gap-2 h-11 px-6 font-bold uppercase tracking-wider text-sm"
                      disabled={saving}
                    >
                      <ChevronLeft className="h-5 w-5" />
                      Voltar
                    </Button>
                    <Button
                      onClick={handleConfirmar}
                      disabled={saving}
                      className="gap-2 h-11 px-8 font-bold uppercase tracking-wider text-sm"
                    >
                      <ClipboardCheck className="h-5 w-5" />
                      {saving ? 'Processando...' : 'Confirmar Fechamento'}
                    </Button>
                  </div>
                </>
              )}

            </div>{/* fim scroll area */}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            ABA: FECHAMENTOS REALIZADOS
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'realizados' && (
          <div className="p-5 space-y-4">

            {/* ── Filtros ──────────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[220px]">
                  <Input
                    label="Nome / Apelido do Cliente"
                    placeholder="Filtrar por cliente..."
                    value={filterFecCliente}
                    onChange={e => { setFilterFecCliente(e.target.value); setFechamentoSel(null); }}
                  />
                </div>
                <div className="w-44">
                  <Input
                    label="Data Inicial"
                    type="date"
                    value={filterFecDataIni}
                    onChange={e => { setFilterFecDataIni(e.target.value); setFechamentoSel(null); }}
                  />
                </div>
                <div className="w-44">
                  <Input
                    label="Data Final"
                    type="date"
                    value={filterFecDataFim}
                    onChange={e => { setFilterFecDataFim(e.target.value); setFechamentoSel(null); }}
                  />
                </div>
                <Button
                  variant="secondary"
                  className="gap-2"
                  onClick={() => {
                    setFilterFecCliente('');
                    setFilterFecDataIni('');
                    setFilterFecDataFim('');
                    setFechamentoSel(null);
                  }}
                >
                  <Search className="h-4 w-4" />
                  Limpar
                </Button>
              </div>
            </div>

            {/* ── Grid de Fechamentos ──────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">
                  Fechamentos
                </h3>
                <span className="text-xs text-slate-400">
                  {fechamentosFiltrados.length} de {totalFec} registro(s)
                </span>
              </div>

              {loadingFec ? (
                <div className="p-8 text-center text-sm text-slate-400">Carregando...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-4 py-2 w-8"></th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nº Fec.</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empresa</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Parcelas</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Valor</th>
                        <th className="px-4 py-2 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {fechamentosFiltrados.map(f => (
                          <tr
                            key={f.idfechamento}
                            onClick={() => setFechamentoSel(f)}
                            className="cursor-pointer transition-colors hover:bg-slate-50/60"
                          >
                            <td className="px-4 py-2 text-slate-400">
                              <ChevronRight className="h-4 w-4" />
                            </td>
                            <td className="px-4 py-2">
                              <span className="text-xs font-bold text-[#B21212]">
                                #{String(f.idfechamento).padStart(4, '0')}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs text-slate-500">{fmtDate(f.data)}</td>
                            <td className="px-4 py-2 text-xs font-bold text-slate-700">
                              {f.cliente_rel?.nomefantasia || f.cliente_rel?.nome || '—'}
                            </td>
                            <td className="px-4 py-2 text-xs text-slate-400">
                              {f.empresa_rel?.nomefantasia || f.empresa_rel?.nome || '—'}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className="text-xs font-bold text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">
                                {f.parcelas ?? 0}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs font-bold text-slate-700 text-right">
                              {brl(f.valor ?? 0)}
                            </td>
                            <td className="px-4 py-2">
                              <button
                                onClick={e => handleSolicitarExclusao(f, e)}
                                className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Excluir fechamento"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                      ))}
                      {fechamentosFiltrados.length === 0 && !loadingFec && (
                        <tr>
                          <td colSpan={8} className="px-4 py-2 text-center text-sm text-slate-400">
                            Nenhum fechamento encontrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {(() => {
                const totalPagesFec = Math.max(1, Math.ceil(totalFec / PER_PAGE_FEC));
                if (totalPagesFec <= 1) return null;
                return (
                  <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">
                      Página {pageFec} de {totalPagesFec}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPageFec(p => Math.max(1, p - 1))} disabled={pageFec === 1}><ChevronLeft className="h-4 w-4" /></Button>
                      {Array.from({ length: totalPagesFec }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPagesFec || Math.abs(p - pageFec) <= 1)
                        .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                          if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, idx) =>
                          p === '...'
                            ? <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 text-xs">…</span>
                            : <Button key={p} variant={pageFec === p ? 'primary' : 'outline'} className="h-8 w-8 p-0 text-xs font-bold" onClick={() => setPageFec(p as number)}>{p}</Button>
                        )}
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPageFec(p => Math.min(totalPagesFec, p + 1))} disabled={pageFec === totalPagesFec}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                );
              })()}
            </div>

          </div>
        )}

        {/* ── Modal: Detalhes do Fechamento ────────────────────────────────── */}
        <Modal
          isOpen={fechamentoSel !== null}
          onClose={() => setFechamentoSel(null)}
          title={fechamentoSel ? `Fechamento #${String(fechamentoSel.idfechamento).padStart(4, '0')} — ${fechamentoSel.cliente_rel?.nomefantasia || fechamentoSel.cliente_rel?.nome || 'Cliente'}` : ''}
          size="xl"
          footer={
            <Button onClick={() => setFechamentoSel(null)} className="px-8">
              Fechar
            </Button>
          }
        >
          {fechamentoSel && (
            <div className="space-y-5">

              {/* Resumo do fechamento */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Data</p>
                  <p className="text-xs font-bold text-slate-700">{fmtDate(fechamentoSel.data)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Empresa</p>
                  <p className="text-xs font-bold text-slate-700">{fechamentoSel.empresa_rel?.nomefantasia || fechamentoSel.empresa_rel?.nome || '—'}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Valor Total</p>
                  <p className="text-xs font-bold text-emerald-700">{brl(fechamentoSel.valor ?? 0)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Parcelas</p>
                  <p className="text-xs font-bold text-slate-700">{fechamentoSel.parcelas ?? 0}</p>
                </div>
              </div>

              {/* Grid de OS */}
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">Ordens de Serviço</h3>
                  <span className="text-xs text-slate-400">{ordensDoFec.length} OS</span>
                </div>
                {loadingOrdensDoc ? (
                  <div className="p-6 text-center text-sm text-slate-400">Carregando ordens...</div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nº OS</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Serviço Realizado</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Valor OS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {ordensDoFec.map(o => (
                        <tr key={o.idordem} className="hover:bg-slate-50/40">
                          <td className="px-4 py-2">
                            <span className="text-xs font-bold text-[#B21212]">
                              {o.numero_os ? `#OS-${String(o.numero_os).padStart(4, '0')}` : `#${o.idordem}`}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs text-slate-500">{fmtDate(o.data)}</td>
                          <td className="px-4 py-2 text-xs text-slate-600 max-w-xs truncate">{o.servico_prestado || '—'}</td>
                          <td className="px-4 py-2 text-xs font-bold text-slate-700 text-right">{brl(o.valor_os ?? 0)}</td>
                        </tr>
                      ))}
                      {ordensDoFec.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-400">
                            Nenhuma OS encontrada para este fechamento.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Grid de Parcelas */}
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">Contas a Receber</h3>
                  <span className="text-xs text-slate-400">{fechamentoSel.contas.length} parcela(s)</span>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Parcela</th>
                      <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vencimento</th>
                      <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Valor</th>
                      <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {fechamentoSel.contas.map(c => (
                      <tr key={c.idcontasreceber} className="hover:bg-slate-50/40">
                        <td className="px-4 py-3 text-sm font-bold text-slate-700">{c.parcela || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{fmtDate(c.vencimento)}</td>
                        <td className="px-4 py-3 text-sm font-bold text-slate-800 text-right">{brl(c.valor ?? 0)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                            c.situacao === true ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          )}>
                            {c.situacao === true ? 'Pago' : 'Pendente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {fechamentoSel.contas.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-400">
                          Nenhuma parcela encontrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}
        </Modal>

      </div>
    </>
  );
}
