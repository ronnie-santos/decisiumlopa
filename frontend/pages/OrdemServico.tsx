import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ClienteAutocomplete, ClienteOption } from '../components/ui/ClienteAutocomplete';
import { EquipamentoAutocomplete, EquipamentoOption } from '../components/ui/EquipamentoAutocomplete';
import { Plus, Search, Eye, Edit2, Printer, Trash2, ChevronLeft, ChevronRight, TrendingUp, Clock, CheckCircle2, Link2, AlertCircle, X } from 'lucide-react';
import { cn } from '../utils/cn';

// ── Local types ───────────────────────────────────────────────────────────────
interface OrdemAPI {
  idordem: number;
  numero_os: number | null;
  idcliente: number | null;
  idempresa: number | null;
  data: string | null;
  situacao: boolean | null;
  local_servico: string | null;
  cidade_servico: string | null;
  local_entrega: string | null;
  cidade_entrega: string | null;
  km_inicio: number | null;
  km_final: number | null;
  km_total: number | null;
  valor_km: number | null;
  valor_total_km: number | null;
  pedagio: number | null;
  saida: number | null;
  escolta: number | null;
  seguro: number | null;
  desconto: number | null;
  valor_frete: number | null;
  inicio_01: string | null;
  termino_01: string | null;
  inicio_02: string | null;
  termino_02: string | null;
  total_horas: number | null;
  valor_hora: number | null;
  valor_servicos: number | null;
  servico_prestado: string | null;
  valor_os: number | null;
  idequipamento: number | null;
  idfuncionario: number | null;
  funcionario_2: number | null;
  funcionario_3: number | null;
  idfluxo: string | null;
  idservico: number | null;
  idorcamento: number | null;
  idfechamento: number | null;
  empresa_rel?: { idempresa: number; nome: string; nomefantasia: string | null } | null;
  equipamento_rel?: { idequipamento: number; nome: string; placa: string | null } | null;
  funcionario_rel?: { idfuncionario: number; nome: string } | null;
  fluxo_rel?: { idfluxo: string; descricao: string | null } | null;
  cliente_rel?: { idcliente: number; nome: string; nomefantasia: string | null } | null;
}

interface EmpresaOpt { idempresa: number; nome: string; nomefantasia: string | null }
interface ClienteOpt { idcliente: number; nome: string; nomefantasia: string | null }
interface FuncionarioOpt { idfuncionario: number; nome: string }
interface EquipamentoOpt { idequipamento: number; nome: string; placa: string | null }
interface FluxoOpt { idfluxo: string; descricao: string | null; movimento?: string | null; tipo?: string | null }
interface TipoServicoOpt { idservico: number; descricao: string }
interface OrcamentoPendente { idorcamento: number; nome: string | null; nomefantasia: string | null; total: number | null; situacao: string | null }

// ── Empty form ────────────────────────────────────────────────────────────────
const emptyForm = () => ({
  numero_os: 0,
  idempresa: 0,
  idcliente: 0,
  data: new Date().toISOString().split('T')[0],
  situacao: false as boolean,
  local_servico: '',
  cidade_servico: '',
  local_entrega: '',
  cidade_entrega: '',
  km_inicio: 0,
  km_final: 0,
  km_total: 0,
  valor_km: 0,
  valor_total_km: 0,
  pedagio: 0,
  saida: 0,
  escolta: 0,
  seguro: 0,
  desconto: 0,
  valor_frete: 0,
  inicio_01: '00:00',
  termino_01: '00:00',
  inicio_02: '00:00',
  termino_02: '00:00',
  total_horas: 0,
  valor_hora: 0,
  valor_servicos: 0,
  servico_prestado: '',
  valor_os: 0,
  idequipamento: 0,
  idfuncionario: 0,
  funcionario_2: 0,
  funcionario_3: 0,
  idfluxo: '',
  idservico: 0,
  idorcamento: 0,
  idfechamento: 0,
});

type FormData = ReturnType<typeof emptyForm>;

function ordemToForm(o: OrdemAPI): FormData {
  return {
    numero_os: o.numero_os ?? 0,
    idempresa: o.idempresa ?? 0,
    idcliente: o.idcliente ?? 0,
    data: o.data ?? new Date().toISOString().split('T')[0],
    situacao: o.situacao ?? false,
    local_servico: o.local_servico ?? '',
    cidade_servico: o.cidade_servico ?? '',
    local_entrega: o.local_entrega ?? '',
    cidade_entrega: o.cidade_entrega ?? '',
    km_inicio: o.km_inicio ?? 0,
    km_final: o.km_final ?? 0,
    km_total: o.km_total ?? 0,
    valor_km: o.valor_km ?? 0,
    valor_total_km: o.valor_total_km ?? 0,
    pedagio: o.pedagio ?? 0,
    saida: o.saida ?? 0,
    escolta: o.escolta ?? 0,
    seguro: o.seguro ?? 0,
    desconto: o.desconto ?? 0,
    valor_frete: o.valor_frete ?? 0,
    inicio_01: normalizeTime(o.inicio_01),
    termino_01: normalizeTime(o.termino_01),
    inicio_02: normalizeTime(o.inicio_02),
    termino_02: normalizeTime(o.termino_02),
    total_horas: o.total_horas ?? 0,
    valor_hora: o.valor_hora ?? 0,
    valor_servicos: o.valor_servicos ?? 0,
    servico_prestado: o.servico_prestado ?? '',
    valor_os: o.valor_os ?? 0,
    idequipamento: o.idequipamento ?? 0,
    idfuncionario: o.idfuncionario ?? 0,
    funcionario_2: o.funcionario_2 ?? 0,
    funcionario_3: o.funcionario_3 ?? 0,
    idfluxo: o.idfluxo ?? '',
    idservico: o.idservico ?? 0,
    idorcamento: o.idorcamento ?? 0,
    idfechamento: o.idfechamento ?? 0,
  };
}

function formToPayload(f: FormData): Record<string, unknown> {
  return {
    numero_os: f.numero_os || null,
    idempresa: f.idempresa || null,
    idcliente: f.idcliente || null,
    data: f.data || null,
    situacao: f.situacao,
    local_servico: f.local_servico || null,
    cidade_servico: f.cidade_servico || null,
    local_entrega: f.local_entrega || null,
    cidade_entrega: f.cidade_entrega || null,
    km_inicio: f.km_inicio || null,
    km_final: f.km_final || null,
    km_total: f.km_total || null,
    valor_km: f.valor_km || null,
    valor_total_km: f.valor_total_km || null,
    pedagio: f.pedagio || null,
    saida: f.saida || null,
    escolta: f.escolta || null,
    seguro: f.seguro || null,
    desconto: f.desconto || null,
    valor_frete: f.valor_frete || null,
    inicio_01: (f.inicio_01 && f.inicio_01 !== '00:00') ? f.inicio_01 : null,
    termino_01: (f.termino_01 && f.termino_01 !== '00:00') ? f.termino_01 : null,
    inicio_02: (f.inicio_02 && f.inicio_02 !== '00:00') ? f.inicio_02 : null,
    termino_02: (f.termino_02 && f.termino_02 !== '00:00') ? f.termino_02 : null,
    total_horas: (() => { const h = calculateTime(f.inicio_01, f.termino_01) + calculateTime(f.inicio_02, f.termino_02); return h || null; })(),
    valor_hora: f.valor_hora || null,
    valor_servicos: (() => { const h = calculateTime(f.inicio_01, f.termino_01) + calculateTime(f.inicio_02, f.termino_02); return (h * f.valor_hora) || null; })(),
    servico_prestado: f.servico_prestado || null,
    valor_os: (() => { const h = calculateTime(f.inicio_01, f.termino_01) + calculateTime(f.inicio_02, f.termino_02); return (f.valor_frete + h * f.valor_hora) || null; })(),
    idequipamento: f.idequipamento || null,
    idfuncionario: f.idfuncionario || null,
    funcionario_2: f.funcionario_2 || null,
    funcionario_3: f.funcionario_3 || null,
    idfluxo: f.idfluxo || null,
    idservico: f.idservico || null,
    idorcamento: f.idorcamento || null,
    idfechamento: f.idfechamento || null,
  };
}

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function calculateTime(start: string, end: string): number {
  if (!start || !end) return 0;
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
  return Math.max(0, (h2 * 60 + m2 - (h1 * 60 + m1)) / 60);
}

// Garante formato HH:MM para input type="time" (browser exige 2 dígitos)
function normalizeTime(t: string | null | undefined): string {
  if (!t) return '00:00';
  const parts = t.trim().split(':');
  if (parts.length < 2) return '00:00';
  const h = parts[0].padStart(2, '0');
  const m = parts[1].padStart(2, '0');
  return `${h}:${m}`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function OrdemServicoPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [orders, setOrders] = useState<OrdemAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);
  const [deleteOrder, setDeleteOrder] = useState<OrdemAPI | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Select list options
  const [empresas, setEmpresas] = useState<EmpresaOpt[]>([]);
  const [funcionarios, setFuncionarios] = useState<FuncionarioOpt[]>([]);
  const [fluxos, setFluxos] = useState<FluxoOpt[]>([]);
  const [tiposServico, setTiposServico] = useState<TipoServicoOpt[]>([]);

  const [formData, setFormData] = useState<FormData>(emptyForm());
  const [clienteDisplayName, setClienteDisplayName] = useState('');
  const [equipamentoDisplayName, setEquipamentoDisplayName] = useState('');

  // ── Modal vinculação orçamento ───────────────────────────────────────────────
  const [isOrcModalOpen, setIsOrcModalOpen] = useState(false);
  const [orcamentos, setOrcamentos] = useState<OrcamentoPendente[]>([]);
  const [orcamentoSel, setOrcamentoSel] = useState<OrcamentoPendente | null>(null);
  const [loadingOrc, setLoadingOrc] = useState(false);
  const [conectando, setConectando] = useState(false);

  // ── Autocomplete cliente ──────────────────────────────────────────────────────
  const handleClienteChange = (c: ClienteOption | null) => {
    setFormData(prev => ({ ...prev, idcliente: c?.idcliente ?? 0 }));
    setClienteDisplayName(c ? (c.nomefantasia || c.nome) : '');
  };

  // ── Autocomplete equipamento ──────────────────────────────────────────────────
  const handleEquipamentoChange = (eq: EquipamentoOption | null) => {
    setFormData(prev => ({ ...prev, idequipamento: eq?.idequipamento ?? 0 }));
    setEquipamentoDisplayName(eq ? (eq.placa ? `${eq.nome} — ${eq.placa}` : eq.nome) : '');
  };

  // ── Decimal formatting ───────────────────────────────────────────────────────
  const [editingField, setEditingField] = useState<string | null>(null);

  /** Returns formatted value when idle, raw number while user is typing */
  const fmtVal = (key: keyof FormData, fieldId: string): string | number =>
    editingField === fieldId
      ? ((formData[key] as number) || '')
      : (formData[key] as number).toFixed(2);

  const fmtProps = (fieldId: string) => ({
    onFocus: () => setEditingField(fieldId),
    onBlur: () => setEditingField(null),
  });

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [filterNumeroOS, setFilterNumeroOS] = useState('');
  const [filterCliente, setFilterCliente] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');

  // ── Paginação ─────────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalAbertas, setTotalAbertas] = useState(0);
  const [totalFechadas, setTotalFechadas] = useState(0);
  const PER_PAGE = 50;

  // ── Fetch ordens (paginado, reage a page e filtros) ─────────────────────────
  const fetchOrdens = async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('skip', String((p - 1) * PER_PAGE));
      params.set('limit', String(PER_PAGE));
      if (filterStatus === 'aberta') params.set('situacao', 'false');
      if (filterStatus === 'fechada') params.set('situacao', 'true');
      if (filterNumeroOS.trim()) {
        params.set('idordem', filterNumeroOS.trim());
        params.set('numero_os', filterNumeroOS.trim());
      }
      if (filterCliente.trim()) params.set('nome_cliente', filterCliente.trim());
      if (filterDateFrom) params.set('data_de', filterDateFrom);
      if (filterDateTo) params.set('data_ate', filterDateTo);

      const res = await fetch(`/api/ordens?${params}`);
      if (res.ok) {
        const json = await res.json();
        setOrders(json.data ?? []);
        setTotalRecords(json.total ?? 0);
        setTotalAbertas(json.total_abertas ?? 0);
        setTotalFechadas(json.total_fechadas ?? 0);
      }
    } catch {
      setError('Erro ao carregar ordens.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch dados auxiliares (listas de seleção — uma só vez)
  useEffect(() => {
    const fetchAux = async () => {
      try {
        const [empresasRes, funcRes, fluxoRes, tipoRes] =
          await Promise.all([
            fetch('/api/empresas'),
            fetch('/api/funcionarios?situacao=ATIVO'),
            fetch('/api/fluxo-financeiro'),
            fetch('/api/tipo_servico'),
          ]);
        if (empresasRes.ok) setEmpresas(await empresasRes.json());
        if (funcRes.ok) setFuncionarios(await funcRes.json());
        if (fluxoRes.ok) setFluxos(await fluxoRes.json());
        if (tipoRes.ok) setTiposServico(await tipoRes.json());
      } catch { /* ignore */ }
    };
    fetchAux();
  }, []);

  // Re-fetch ordens quando page muda
  useEffect(() => { fetchOrdens(page); }, [page]);

  const reloadOrdens = () => fetchOrdens(page);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const clienteName = (order: OrdemAPI) => {
    if (order.cliente_rel) return order.cliente_rel.nomefantasia || order.cliente_rel.nome || String(order.idcliente);
    return order.idcliente ? String(order.idcliente) : '—';
  };

  const statusBadge = (situacao: boolean | null) =>
    situacao === true
      ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
      : 'bg-blue-50 text-blue-600 border-blue-100';

  const statusLabel = (situacao: boolean | null) =>
    situacao === true ? 'Fechada' : 'Aberta';

  // ── Freight recalculation ────────────────────────────────────────────────────
  const updateFreight = (field: keyof FormData, value: number) => {
    setFormData(prev => {
      const upd = { ...prev, [field]: value };
      const km_total = Math.max(0, upd.km_final - upd.km_inicio);
      const valor_total_km = km_total * upd.valor_km;
      const valor_frete = valor_total_km + upd.pedagio + upd.saida + upd.escolta + upd.seguro - upd.desconto;
      const valor_os = valor_frete + upd.valor_servicos;
      return { ...upd, km_total, valor_total_km, valor_frete, valor_os };
    });
  };

  // ── Service data recalculation ───────────────────────────────────────────────
  const updateService = (field: keyof FormData, value: string | number) => {
    setFormData(prev => {
      const upd = { ...prev, [field]: value };
      const h1 = calculateTime(upd.inicio_01, upd.termino_01);
      const h2 = calculateTime(upd.inicio_02, upd.termino_02);
      const total_horas = h1 + h2;
      const valor_servicos = total_horas * upd.valor_hora;
      const valor_os = upd.valor_frete + valor_servicos;
      return { ...upd, total_horas, valor_servicos, valor_os };
    });
  };

  // ── Modal open handlers ──────────────────────────────────────────────────────
  const handleOpenNew = () => {
    setEditingId(null);
    setIsViewOnly(false);
    setFormData(emptyForm());
    setClienteDisplayName('');
    setEquipamentoDisplayName('');
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (order: OrdemAPI) => {
    setEditingId(order.idordem);
    setIsViewOnly(false);
    setFormData(ordemToForm(order));
    setClienteDisplayName(order.cliente_rel ? (order.cliente_rel.nomefantasia || order.cliente_rel.nome || '') : '');
    setEquipamentoDisplayName(order.equipamento_rel ? (order.equipamento_rel.placa ? `${order.equipamento_rel.nome} — ${order.equipamento_rel.placa}` : order.equipamento_rel.nome) : '');
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenView = (order: OrdemAPI) => {
    setEditingId(order.idordem);
    setIsViewOnly(true);
    setFormData(ordemToForm(order));
    setClienteDisplayName(order.cliente_rel ? (order.cliente_rel.nomefantasia || order.cliente_rel.nome || '') : '');
    setEquipamentoDisplayName(order.equipamento_rel ? (order.equipamento_rel.placa ? `${order.equipamento_rel.nome} — ${order.equipamento_rel.placa}` : order.equipamento_rel.nome) : '');
    setError(null);
    setIsModalOpen(true);
  };

  // ── Vincular orçamento ───────────────────────────────────────────────────────
  const handleOpenOrcModal = async () => {
    setOrcamentoSel(null);
    setIsOrcModalOpen(true);
    setLoadingOrc(true);
    try {
      const res = await fetch('/api/orcamentos?situacao=APROVADO&sem_os=true&limit=200');
      if (res.ok) {
        const json = await res.json();
        const data: OrcamentoPendente[] = Array.isArray(json) ? json : (json.data ?? []);
        setOrcamentos(data);
      }
    } finally {
      setLoadingOrc(false);
    }
  };

  const handleConectar = async () => {
    if (!orcamentoSel) return;
    setConectando(true);
    try {
      await fetch(`/api/orcamentos/${orcamentoSel.idorcamento}/situacao`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ situacao: 'APROVADO' }),
      });
      setFormData(prev => ({ ...prev, idorcamento: orcamentoSel.idorcamento }));
      setIsOrcModalOpen(false);
    } finally {
      setConectando(false);
    }
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!formData.idempresa)    { setError('Selecione a empresa.'); return; }
    if (!formData.idcliente)    { setError('Selecione o cliente.'); return; }
    if (!formData.idequipamento){ setError('Selecione o equipamento.'); return; }
    if (!formData.idfuncionario){ setError('Selecione o Funcionário 1 responsável.'); return; }
    if (!formData.idfluxo)      { setError('Selecione o fluxo financeiro.'); return; }
    if (!formData.idservico)    { setError('Selecione o tipo de serviço.'); return; }
    if (!formData.valor_os)     { setError('O valor total da OS não pode ser zero.'); return; }
    setSaving(true);
    setError(null);
    try {
      const url = editingId ? `/api/ordens/${editingId}` : '/api/ordens';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToPayload(formData)),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = body.detail;
        throw new Error(
          Array.isArray(detail)
            ? detail.map((d: { msg?: string }) => d.msg).join(', ')
            : detail || `Erro ${res.status}`
        );
      }
      setIsModalOpen(false);
      await reloadOrdens();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar ordem.');
    } finally {
      setSaving(false);
    }
  };

  // ── Print ────────────────────────────────────────────────────────────────────
  const handlePrint = (order: OrdemAPI) => {
    window.open(`/api/ordens/${order.idordem}/pdf`, '_blank');
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = (order: OrdemAPI) => {
    setDeleteOrder(order);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteOrder) return;
    try {
      const res = await fetch(`/api/ordens/${deleteOrder.idordem}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteOrder(null);
        await reloadOrdens();
      } else {
        const body = await res.json().catch(() => ({}));
        setDeleteError(body.detail || 'Erro ao excluir.');
      }
    } catch {
      setDeleteError('Erro de conexão.');
    }
  };

  const filteredOrders = orders;

  const totalPages = Math.max(1, Math.ceil(totalRecords / PER_PAGE));

  // ── Valores derivados de horas (sempre computados a partir dos campos atuais) ─
  const derivedH1 = calculateTime(formData.inicio_01, formData.termino_01);
  const derivedH2 = calculateTime(formData.inicio_02, formData.termino_02);
  const derivedTotalHoras = derivedH1 + derivedH2;
  const derivedValorServicos = derivedTotalHoras * formData.valor_hora;
  const derivedValorOS = formData.valor_frete + derivedValorServicos;

  // Aplica filtros server-side ao apertar Enter ou ao mudar os filtros principais
  const handleApplyFilters = () => { setPage(1); fetchOrdens(1); };

  return (
    <div className="flex flex-col h-full">
      {error && (
        <div className="fixed top-4 right-4 z-[120] max-w-sm p-4 rounded-lg shadow-2xl flex items-start gap-3 bg-red-50 border border-red-200">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4 text-red-400 hover:text-red-600" />
          </button>
        </div>
      )}
      <Header title="Ordens de Serviço" />

      <div className="p-5 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border-l-4 border-blue-500 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Em Andamento</p>
              <h3 className="text-xl font-black text-slate-800">{totalAbertas}</h3>
              <p className="text-[10px] text-blue-500 font-bold mt-0.5">Ativas <span className="text-slate-400 font-normal">no momento</span></p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 flex-shrink-0 ml-3">
              <Clock className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border-l-4 border-emerald-500 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Concluídas</p>
              <h3 className="text-xl font-black text-slate-800">{totalFechadas}</h3>
              <p className="text-[10px] text-emerald-500 font-bold mt-0.5">Fechadas <span className="text-slate-400 font-normal">no total</span></p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500 flex-shrink-0 ml-3">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border-l-4 border-slate-800 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total de OS</p>
              <h3 className="text-xl font-black text-slate-800">{totalRecords}</h3>
              <p className="text-[10px] text-emerald-500 font-bold mt-0.5">Registradas <span className="text-slate-400 font-normal">no sistema</span></p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-800 flex-shrink-0 ml-3">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Filters Card */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="w-36">
              <Input
                label="ID / Nº OS"
                placeholder="ID ou nº OS..."
                type="number"
                min={1}
                value={filterNumeroOS}
                onChange={e => setFilterNumeroOS(e.target.value)}
              />
            </div>
            <div className="w-48">
              <Input
                label="Cliente"
                placeholder="Nome do cliente..."
                value={filterCliente}
                onChange={e => setFilterCliente(e.target.value)}
              />
            </div>
            <div className="w-40">
              <Input
                label="Período"
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
              />
            </div>
            <div className="w-40">
              <Input
                label="Até"
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
              />
            </div>
            <div className="w-44">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Status</label>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
              >
                <option value="todos">Todos os Status</option>
                <option value="aberta">Aberta</option>
                <option value="fechada">Fechada</option>
              </select>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" onClick={() => { setFilterNumeroOS(''); setFilterCliente(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterStatus('todos'); setPage(1); fetchOrdens(1); }}>
                Limpar
              </Button>
              <Button className="gap-2" onClick={handleApplyFilters}>
                <Search className="h-4 w-4" />
                Buscar
              </Button>
              <Button onClick={handleOpenNew} className="gap-2 font-bold uppercase tracking-wider">
                <Plus className="h-5 w-5" />
                Novo
              </Button>
            </div>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Carregando...</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">OS Nº</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data de Abertura</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Valor OS</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredOrders.map((order) => (
                  <tr key={order.idordem} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-4 py-2">
                      <span className="text-xs font-bold text-[#B21212]">
                        {order.numero_os ? `#OS-${String(order.numero_os).padStart(4, '0')}` : `#${order.idordem}`}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs font-bold text-slate-700">{clienteName(order)}</span>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">{order.data ?? '—'}</td>
                    <td className="px-4 py-2 text-xs font-bold text-slate-700 text-right">
                      {order.valor_os != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.valor_os) : '—'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={cn(
                        "inline-flex px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border",
                        statusBadge(order.situacao)
                      )}>
                        {statusLabel(order.situacao)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400 hover:text-red-600"
                          onClick={() => handleDelete(order)}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-slate-600"
                          onClick={() => handleOpenView(order)}
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-slate-600"
                          onClick={() => handlePrint(order)}
                          title="Imprimir"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-slate-600"
                          onClick={() => handleOpenEdit(order)}
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredOrders.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-2 text-center text-sm text-slate-400">
                      Nenhuma ordem de serviço encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* Paginação */}
          <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {totalRecords === 0
                ? 'Nenhuma ordem encontrada'
                : `Exibindo ${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, totalRecords)} de ${totalRecords} ordem${totalRecords !== 1 ? 's' : ''}`}
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
                  .map((p, idx) =>
                    p === '...' ? (
                      <span key={`e${idx}`} className="px-1 text-xs text-slate-400">...</span>
                    ) : (
                      <Button key={p} variant={p === page ? 'primary' : 'outline'} className="h-8 w-8 p-0 text-xs font-bold" onClick={() => setPage(p as number)}>
                        {p}
                      </Button>
                    )
                  )}
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal ── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          isViewOnly
            ? `Visualizar OS ${formData.numero_os ? `#OS-${String(formData.numero_os).padStart(4, '0')}` : ''}`
            : editingId
            ? `Editar OS ${formData.numero_os ? `#OS-${String(formData.numero_os).padStart(4, '0')}` : ''}`
            : 'Nova Ordem de Serviço'
        }
        className="max-w-5xl"
        footer={
          isViewOnly ? (
            <Button onClick={() => setIsModalOpen(false)} className="px-8">OK</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Salvar OS'}
              </Button>
            </>
          )
        }
      >
        <div className="space-y-8">
          {/* ── Informações Gerais ── */}
          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>
              Informações Gerais
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-[0.7fr_3fr_1fr_auto] gap-4">
              <Input
                label="Nº da OS"
                type="number"
                value={formData.numero_os || ''}
                onChange={e => setFormData({ ...formData, numero_os: parseInt(e.target.value) || 0 })}
                disabled={isViewOnly}
              />
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Empresa</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50 disabled:opacity-50"
                  value={formData.idempresa}
                  onChange={e => setFormData({ ...formData, idempresa: Number(e.target.value) })}
                  disabled={isViewOnly}
                >
                  <option value={0}>Selecione...</option>
                  {empresas.map(emp => (
                    <option key={emp.idempresa} value={emp.idempresa}>
                      {emp.nomefantasia || emp.nome}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Data"
                type="date"
                value={formData.data}
                onChange={e => setFormData({ ...formData, data: e.target.value })}
                disabled={isViewOnly}
              />
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Situação</label>
                <div className="h-10 flex items-center gap-3">
                  <span className={cn(
                    "px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border",
                    statusBadge(formData.situacao)
                  )}>
                    {statusLabel(formData.situacao)}
                  </span>
                </div>
              </div>
              <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-[2.2fr_0.85fr_0.5fr] gap-4 items-end">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
                    Cliente{formData.idcliente ? <span className="ml-2 text-emerald-600 font-normal normal-case tracking-normal">#{formData.idcliente}</span> : null}
                  </label>
                  <ClienteAutocomplete
                    value={formData.idcliente}
                    displayName={clienteDisplayName}
                    onChange={handleClienteChange}
                    disabled={isViewOnly}
                    placeholder="Digite 2+ caracteres para buscar..."
                  />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Nº Orçamento Origem
                    </label>
                    {!isViewOnly && (
                      <button
                        type="button"
                        onClick={handleOpenOrcModal}
                        title="Vincular orçamento aprovado"
                        className="flex items-center gap-1 h-6 px-2 rounded border border-slate-200 bg-white text-slate-500 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300 transition-colors text-[10px] font-semibold"
                      >
                        <Link2 className="h-3 w-3" />
                        Vincular
                      </button>
                    )}
                  </div>
                  <input
                    className="w-full h-10 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 outline-none cursor-default"
                    value={formData.idorcamento || ''}
                    readOnly
                  />
                </div>
                <Input
                  label="Nº Fechamento"
                  value={formData.idfechamento || ''}
                  readOnly
                  disabled
                />
              </div>
            </div>
          </section>

          {/* ── Descrição do Serviço ── */}
          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>
              Descrição do Serviço
            </h3>
            <div className="space-y-4">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Tipo de Serviço</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50 disabled:opacity-50"
                  value={formData.idservico}
                  onChange={e => setFormData({ ...formData, idservico: Number(e.target.value) })}
                  disabled={isViewOnly}
                >
                  <option value={0}>Selecione o tipo de serviço...</option>
                  {tiposServico.map(t => (
                    <option key={t.idservico} value={t.idservico}>{t.descricao}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Detalhes da Execução</label>
                <textarea
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 min-h-[100px] disabled:bg-slate-50"
                  value={formData.servico_prestado}
                  onChange={e => setFormData({ ...formData, servico_prestado: e.target.value })}
                  disabled={isViewOnly}
                  placeholder="Descreva detalhadamente o serviço executado..."
                />
              </div>
            </div>
          </section>

          {/* ── Localização ── */}
          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>
              Localização do Serviço
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Local do Serviço"
                value={formData.local_servico}
                onChange={e => setFormData({ ...formData, local_servico: e.target.value })}
                disabled={isViewOnly}
              />
              <Input
                label="Cidade do Serviço"
                value={formData.cidade_servico}
                onChange={e => setFormData({ ...formData, cidade_servico: e.target.value })}
                disabled={isViewOnly}
              />
              <Input
                label="Local de Entrega"
                value={formData.local_entrega}
                onChange={e => setFormData({ ...formData, local_entrega: e.target.value })}
                disabled={isViewOnly}
              />
              <Input
                label="Cidade de Entrega"
                value={formData.cidade_entrega}
                onChange={e => setFormData({ ...formData, cidade_entrega: e.target.value })}
                disabled={isViewOnly}
              />
            </div>
          </section>

          {/* ── Frete ── */}
          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>
              Informações do Frete
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
              <Input
                label="KM Inicial"
                type="number"
                value={formData.km_inicio}
                onChange={e => updateFreight('km_inicio', parseFloat(e.target.value) || 0)}
                disabled={isViewOnly}
              />
              <Input
                label="KM Final"
                type="number"
                value={formData.km_final}
                onChange={e => updateFreight('km_final', parseFloat(e.target.value) || 0)}
                disabled={isViewOnly}
              />
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">KM Total</label>
                <div className="h-10 w-full rounded-md border border-slate-200 bg-white/50 px-3 flex items-center text-sm font-bold text-slate-700">
                  {formData.km_total}
                </div>
              </div>
              <Input
                label="Valor KM"
                type="number"
                step="0.01"
                value={fmtVal('valor_km', 'valor_km')}
                onChange={e => updateFreight('valor_km', parseFloat(e.target.value) || 0)}
                {...fmtProps('valor_km')}
                disabled={isViewOnly}
              />
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Total KM</label>
                <div className="h-10 w-full rounded-md border border-slate-200 bg-white/50 px-3 flex items-center text-sm font-bold text-slate-700">
                  {brl(formData.valor_total_km)}
                </div>
              </div>

              <Input
                label="Pedágio"
                type="number"
                step="0.01"
                value={fmtVal('pedagio', 'pedagio')}
                onChange={e => updateFreight('pedagio', parseFloat(e.target.value) || 0)}
                disabled={isViewOnly}
                {...fmtProps('pedagio')}
              />
              <Input
                label="Saída"
                type="number"
                step="0.01"
                value={fmtVal('saida', 'saida')}
                onChange={e => updateFreight('saida', parseFloat(e.target.value) || 0)}
                disabled={isViewOnly}
                {...fmtProps('saida')}
              />
              <Input
                label="Escolta"
                type="number"
                step="0.01"
                value={fmtVal('escolta', 'escolta')}
                onChange={e => updateFreight('escolta', parseFloat(e.target.value) || 0)}
                disabled={isViewOnly}
                {...fmtProps('escolta')}
              />
              <Input
                label="Seguro"
                type="number"
                step="0.01"
                value={fmtVal('seguro', 'seguro')}
                onChange={e => updateFreight('seguro', parseFloat(e.target.value) || 0)}
                disabled={isViewOnly}
                {...fmtProps('seguro')}
              />
              <Input
                label="Desconto"
                type="number"
                step="0.01"
                value={fmtVal('desconto', 'desconto')}
                onChange={e => updateFreight('desconto', parseFloat(e.target.value) || 0)}
                {...fmtProps('desconto')}
                disabled={isViewOnly}
              />

              <div className="md:col-span-5 flex justify-end pt-2 border-t border-slate-200">
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Valor Total do Frete</p>
                  <input
                    type="number"
                    step="0.01"
                    className="text-xl font-black text-[#B21212] text-right w-48 rounded-md border border-slate-200 bg-white px-3 py-1 outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50 disabled:opacity-50"
                    value={fmtVal('valor_frete', 'valor_frete')}
                    onChange={e => setFormData(prev => {
                      const valor_frete = parseFloat(e.target.value) || 0;
                      const vServ = (calculateTime(prev.inicio_01, prev.termino_01) + calculateTime(prev.inicio_02, prev.termino_02)) * prev.valor_hora;
                      return { ...prev, valor_frete, valor_os: valor_frete + vServ };
                    })}
                    onFocus={() => setEditingField('valor_frete')}
                    onBlur={() => setEditingField(null)}
                    disabled={isViewOnly}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ── Dados do Serviço ── */}
          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>
              Dados do Serviço
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
              <Input
                label="Hora Inicial 1"
                type="time"
                value={formData.inicio_01}
                onChange={e => updateService('inicio_01', e.target.value)}
                disabled={isViewOnly}
              />
              <Input
                label="Hora Final 1"
                type="time"
                value={formData.termino_01}
                onChange={e => updateService('termino_01', e.target.value)}
                disabled={isViewOnly}
              />
              <Input
                label="Hora Inicial 2"
                type="time"
                value={formData.inicio_02}
                onChange={e => updateService('inicio_02', e.target.value)}
                disabled={isViewOnly}
              />
              <Input
                label="Hora Final 2"
                type="time"
                value={formData.termino_02}
                onChange={e => updateService('termino_02', e.target.value)}
                disabled={isViewOnly}
              />

              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Horas Trabalhadas</label>
                <div className="h-10 w-full rounded-md border border-slate-200 bg-white/50 px-3 flex items-center text-sm font-bold text-slate-700">
                  {derivedTotalHoras.toFixed(2)}h
                </div>
              </div>
              <Input
                label="Valor por Hora"
                type="number"
                step="0.01"
                value={fmtVal('valor_hora', 'valor_hora')}
                onChange={e => updateService('valor_hora', parseFloat(e.target.value) || 0)}
                {...fmtProps('valor_hora')}
                disabled={isViewOnly}
              />
              <div className="md:col-span-2 flex justify-end">
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor Total do Serviço</p>
                  <p className="text-xl font-black text-[#B21212]">{brl(derivedValorServicos)}</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── Equipamento e Equipe ── */}
          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>
              Equipamento e Equipe
            </h3>
            <div className="space-y-4">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
                  Equipamento{formData.idequipamento ? <span className="ml-2 text-emerald-600 font-normal normal-case tracking-normal">#{formData.idequipamento}</span> : null}
                </label>
                <EquipamentoAutocomplete
                  value={formData.idequipamento}
                  displayName={equipamentoDisplayName}
                  onChange={handleEquipamentoChange}
                  disabled={isViewOnly}
                  placeholder="Digite 2+ caracteres para buscar..."
                  statusFilter="DISPONÍVEL"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Funcionário 1</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50 disabled:opacity-50"
                  value={formData.idfuncionario}
                  onChange={e => setFormData({ ...formData, idfuncionario: Number(e.target.value) })}
                  disabled={isViewOnly}
                >
                  <option value={0}>Selecione...</option>
                  {funcionarios.map(f => (
                    <option key={f.idfuncionario} value={f.idfuncionario}>{f.nome}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Funcionário 2</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50 disabled:opacity-50"
                  value={formData.funcionario_2}
                  onChange={e => setFormData({ ...formData, funcionario_2: Number(e.target.value) })}
                  disabled={isViewOnly}
                >
                  <option value={0}>Selecione...</option>
                  {funcionarios.map(f => (
                    <option key={f.idfuncionario} value={f.idfuncionario}>{f.nome}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Funcionário 3</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50 disabled:opacity-50"
                  value={formData.funcionario_3}
                  onChange={e => setFormData({ ...formData, funcionario_3: Number(e.target.value) })}
                  disabled={isViewOnly}
                >
                  <option value={0}>Selecione...</option>
                  {funcionarios.map(f => (
                    <option key={f.idfuncionario} value={f.idfuncionario}>{f.nome}</option>
                  ))}
                </select>
              </div>
              </div>
            </div>
          </section>

          {/* ── Fluxo de Caixa ── */}
          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>
              Fluxo de Caixa
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Item de Pesquisa (Fluxo)</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50 disabled:opacity-50"
                  value={formData.idfluxo}
                  onChange={e => setFormData({ ...formData, idfluxo: e.target.value })}
                  disabled={isViewOnly}
                >
                  <option value="">Selecione um item...</option>
                  {fluxos.filter(f => String(f.idfluxo).startsWith('1') && f.status !== 'INATIVO').map(f => (
                    <option key={f.idfluxo} value={f.idfluxo}>
                      {f.idfluxo}{f.descricao ? ` — ${f.descricao}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* ── Total Geral ── */}
          <section className="bg-slate-900 -mx-6 -mb-6 p-8 flex items-center justify-between text-white">
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resumo da Ordem de Serviço</h4>
              <p className="text-xs text-slate-300 mt-1">Soma de Frete + Serviços</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Geral</p>
              <p className="text-4xl font-black text-emerald-400">{brl(derivedValorOS)}</p>
            </div>
          </section>
        </div>
      </Modal>

      {/* ── Modal Vincular Orçamento ── */}
      <Modal
        isOpen={isOrcModalOpen}
        onClose={() => setIsOrcModalOpen(false)}
        title="Vincular Orçamento"
        size="lg"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setIsOrcModalOpen(false)} disabled={conectando}>
              Sair
            </Button>
            <Button
              onClick={handleConectar}
              disabled={!orcamentoSel || conectando}
              className="gap-2"
            >
              <Link2 className="h-4 w-4" />
              {conectando ? 'Conectando...' : 'Conectar'}
            </Button>
          </div>
        }
      >
        {loadingOrc ? (
          <div className="py-8 text-center text-sm text-slate-400">Carregando orçamentos...</div>
        ) : orcamentos.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">Nenhum orçamento com status Pendente encontrado.</div>
        ) : (
          <div className="overflow-auto max-h-[420px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 w-8"></th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nº Orçamento</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {orcamentos.map(o => {
                  const sel = orcamentoSel?.idorcamento === o.idorcamento;
                  return (
                    <tr
                      key={o.idorcamento}
                      onClick={() => setOrcamentoSel(o)}
                      className={cn(
                        'cursor-pointer transition-colors',
                        sel ? 'bg-amber-50' : 'hover:bg-slate-50'
                      )}
                    >
                      <td className="px-4 py-3">
                        <input type="radio" className="accent-[#B21212]" checked={sel} onChange={() => setOrcamentoSel(o)} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold text-[#B21212]">#{String(o.idorcamento).padStart(4, '0')}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{o.nomefantasia || o.nome || '—'}</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-800 text-right">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(o.total ?? 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* ── Modal Exclusão ── */}
      <Modal
        isOpen={!!deleteOrder}
        onClose={() => setDeleteOrder(null)}
        title={deleteOrder?.situacao === true ? 'Ordem Fechada' : 'Confirmar Exclusão'}
        className="max-w-md"
        footer={
          deleteOrder?.situacao === true ? (
            <Button onClick={() => setDeleteOrder(null)} className="px-8">Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setDeleteOrder(null)}>Cancelar</Button>
              <Button onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">Confirmar Exclusão</Button>
            </>
          )
        }
      >
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className={cn('h-16 w-16 rounded-full flex items-center justify-center', deleteOrder?.situacao === true ? 'bg-amber-50' : 'bg-red-50')}>
            <AlertCircle className={cn('h-8 w-8', deleteOrder?.situacao === true ? 'text-amber-500' : 'text-red-600')} />
          </div>
          {deleteOrder?.situacao === true ? (
            <div>
              <h4 className="text-lg font-bold text-slate-800">Não é possível excluir</h4>
              <p className="text-sm text-slate-500 mt-1">
                A Ordem de Serviço{' '}
                <span className="font-bold text-slate-700">
                  {deleteOrder.numero_os ? `#OS-${String(deleteOrder.numero_os).padStart(4, '0')}` : `#${deleteOrder.idordem}`}
                </span>{' '}
                está <span className="font-semibold text-emerald-600">Fechada</span> e não pode ser excluída.
              </p>
            </div>
          ) : (
            <div>
              <h4 className="text-lg font-bold text-slate-800">Você tem certeza?</h4>
              <p className="text-sm text-slate-500 mt-1">
                Deseja realmente excluir a Ordem de Serviço{' '}
                <span className="font-bold text-slate-700">
                  {deleteOrder?.numero_os ? `#OS-${String(deleteOrder.numero_os).padStart(4, '0')}` : `#${deleteOrder?.idordem}`}
                </span>
                ? Esta ação não pode ser desfeita.
              </p>
            </div>
          )}
          {deleteError && (
            <div className="w-full p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-xs text-red-600 font-medium">{deleteError}</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
