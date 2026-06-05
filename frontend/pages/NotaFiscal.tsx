import React, { useEffect, useRef, useState } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ClienteAutocomplete, ClienteOption } from '../components/ui/ClienteAutocomplete';
import { FileText, Plus, Upload, Search, Trash2, Pencil, AlertTriangle } from 'lucide-react';
import { cn } from '../utils/cn';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NFServico {
  idnota: number;
  sequencial: number;
  idservico: number;
  valor_unitario: number | null;
  quantidade: number | null;
  desconto: number | null;
  valor_total: number | null;
  dps: string | null;
  idempresa: number | null;
  servico_rel?: { idservico: number; descricao: string | null };
}

interface NotaFiscal {
  id: string;
  idnota: number;
  idfechamento: number | null;
  idempresa: number | null;
  idcliente: number | null;
  valor_nota: number | null;
  data_emissao: string | null;
  serie: string | null;
  observacao: string | null;
  pis: number | null;
  cofins: number | null;
  inss: number | null;
  ir: number | null;
  csll: number | null;
  outras_retencoes: number | null;
  imposto: number | null;
  total_retencao: number | null;
  vencimento: string | null;
  sequencia: number | null;
  hora: string | null;
  local_servico: string | null;
  dentro_pais: string | null;
  resp_imposto: string | null;
  valor_servicos: number | null;
  valor_materiais: number | null;
  base_calculo: number | null;
  valor_liquido: number | null;
  iss: number | null;
  link: string | null;
  deducoes: number | null;
  numero: number | null;
  chave_nfe: string | null;
  dps: string | null;
  servicos: NFServico[];
  empresa_rel?: { idempresa: number; nome: string | null; nomefantasia: string | null };
  cliente_rel?: { idcliente: number; nome: string | null; nomefantasia: string | null };
  fechamento_rel?: {
    idfechamento: number;
    data: string | null;
    idcliente: number | null;
    cliente_rel?: { idcliente: number; nome: string | null; nomefantasia: string | null } | null;
  };
}

interface EmpresaRef { id: string; idempresa: number; nome: string; nomefantasia: string | null }
interface TipoServicoRef { id: string; idservico: number; descricao: string | null }

interface FechamentoSN {
  idfechamento: number;
  data: string | null;
  valor: number | null;
  idcliente: number | null;
  cliente_nome: string | null;
}

interface ParsedXML {
  numero: number | null;
  dps: string | null;
  data_emissao: string | null;
  hora: string | null;
  serie: string | null;
  observacao: string | null;
  valor_nota: number | null;
  valor_liquido: number | null;
  iss: number | null;
  inss: number | null;
  base_calculo: number | null;
  valor_servicos: number | null;
  total_retencao: number | null;
  pis: number | null;
  local_servico: string | null;
  dentro_pais: string | null;
  resp_imposto: string | null;
  vencimento: string | null;
  link: string | null;
  dh_proc: string | null;
  c_trib_nac: number | null;
  x_desc_serv: string | null;
  idempresa: number | null;
  empresa_nome: string | null;
  idcliente: number | null;
  cliente_nome: string | null;
  toma_nome: string | null;
}

interface SVCItem {
  _key: string;
  sequencial: number;
  idservico: number | null;
  valor_unitario: number | null;
  quantidade: number | null;
  desconto: number | null;
  valor_total: number | null;
  idempresa: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const parseId = (v: unknown): number | null =>
  v && v !== '' && v !== '0' ? Number(v) : null;

const fmtCurrency = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const emptyForm = () => ({
  idempresa: '',
  idcliente: '',
  idfechamento: '',
  numero: '',
  serie: '',
  dps: '',
  sequencia: '',
  data_emissao: '',
  hora: '',
  vencimento: '',
  local_servico: '',
  dentro_pais: 'S',
  resp_imposto: 'N',
  valor_nota: '',
  valor_servicos: '',
  valor_materiais: '',
  base_calculo: '',
  valor_liquido: '',
  iss: '',
  deducoes: '',
  pis: '',
  cofins: '',
  inss: '',
  ir: '',
  csll: '',
  outras_retencoes: '',
  imposto: '',
  total_retencao: '',
  link: '',
  chave_nfe: '',
  observacao: '',
});

type FormState = ReturnType<typeof emptyForm>;

const SEL = 'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-[#B21212]/10';

const PAGE_SIZE = 50;
const EMPTY_FILTERS = { cliente: '', empresa: '', dataIni: '', dataFim: '' };

// ── Component ─────────────────────────────────────────────────────────────────

export function NotaFiscalPage() {
  // ── Data ──────────────────────────────────────────────────────────────────
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [empresas, setEmpresas] = useState<EmpresaRef[]>([]);
  const [tiposServico, setTiposServico] = useState<TipoServicoRef[]>([]);
  const [clienteDisplayName, setClienteDisplayName] = useState('');
  const [fechamentosSN, setFechamentosSN] = useState<FechamentoSN[]>([]);
  const [refsLoaded, setRefsLoaded] = useState(false);

  // ── Main grid filters ─────────────────────────────────────────────────────
  const [fCliente, setFCliente] = useState('');
  const [fEmpresa, setFEmpresa] = useState('');
  const [fDataIni, setFDataIni] = useState('');
  const [fDataFim, setFDataFim] = useState('');
  // filters applied to server (updated on search click)
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);

  // ── Modal ─────────────────────────────────────────────────────────────────
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dados' | 'importacao'>('dados');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [canSave, setCanSave] = useState(true);

  // ── Form (tab Dados) ──────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>(emptyForm());
  const [svcsForm, setSvcsForm] = useState<SVCItem[]>([]);
  const [novoSvc, setNovoSvc] = useState<Partial<SVCItem>>({});
  const [dispVUnit, setDispVUnit] = useState('');
  const [dispVTotal, setDispVTotal] = useState('');

  // ── Import (tab Importação) ───────────────────────────────────────────────
  const [fFechData, setFFechData] = useState('');
  const [selectedFech, setSelectedFech] = useState<FechamentoSN | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [xmlFileName, setXmlFileName] = useState('');
  const [parsedXml, setParsedXml] = useState<ParsedXML | null>(null);
  const [isReadingXml, setIsReadingXml] = useState(false);

  // ── Delete confirmation ───────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<NotaFiscal | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Feedback ──────────────────────────────────────────────────────────────
  const [successMsg, setSuccessMsg] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchNotas = async (
    page: number,
    filters: { cliente: string; empresa: string; dataIni: string; dataFim: string },
  ) => {
    setIsLoading(true);
    const qs = new URLSearchParams({ skip: String(page * PAGE_SIZE), limit: String(PAGE_SIZE) });
    if (filters.cliente) qs.set('cliente', filters.cliente);
    if (filters.empresa) qs.set('empresa', filters.empresa);
    if (filters.dataIni) qs.set('data_ini', filters.dataIni);
    if (filters.dataFim) qs.set('data_fim', filters.dataFim);
    try {
      const r = await fetch(`/api/notas-fiscais?${qs}`);
      if (!r.ok) return;
      const data = await r.json();
      setNotas((data.data ?? []).map((n: NotaFiscal) => ({ ...n, id: String(n.idnota) })));
      setTotalCount(data.total ?? 0);
    } catch {
      setNotas([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFechamentosSN = async (idcliente?: number) => {
    const qs = idcliente ? `?idcliente=${idcliente}` : '';
    const r = await fetch(`/api/notas-fiscais/fechamentos-sem-nota${qs}`);
    if (r.ok) setFechamentosSN(await r.json());
  };

  // Carrega dados de referência estáticos (modal) — somente uma vez
  const fetchRefs = async () => {
    if (refsLoaded) return;
    await Promise.all([
      fetch('/api/empresas').then(r => r.json()).then((d: EmpresaRef[]) =>
        setEmpresas(d.map(e => ({ ...e, id: String(e.idempresa) })))),
      fetch('/api/tipo_servico').then(r => r.json()).then((d: TipoServicoRef[]) =>
        setTiposServico(d.map(t => ({ ...t, id: String(t.idservico) })))),
    ]);
    setRefsLoaded(true);
  };

  useEffect(() => {
    fetchNotas(0, EMPTY_FILTERS);
  }, []);

  // ── Search + pagination handlers ──────────────────────────────────────────
  const handleSearch = () => {
    const filters = { cliente: fCliente, empresa: fEmpresa, dataIni: fDataIni, dataFim: fDataFim };
    setAppliedFilters(filters);
    setCurrentPage(0);
    fetchNotas(0, filters);
  };

  const handlePageChange = (p: number) => {
    setCurrentPage(p);
    fetchNotas(p, appliedFilters);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ── Fechamentos filtrados por cliente selecionado ────────────────────────
  const clienteId = Number(form.idcliente) || 0;
  const fechamentosDoCliente = clienteId > 0
    ? fechamentosSN.filter(f => f.idcliente === clienteId)
    : [];

  const filteredFech = fechamentosDoCliente.filter(f => {
    if (fFechData && f.data && !f.data.startsWith(fFechData)) return false;
    return true;
  });

  // ── Modal handlers ────────────────────────────────────────────────────────
  const openNew = async () => {
    await fetchRefs();
    setEditingId(null);
    setForm(emptyForm());
    setClienteDisplayName('');
    setFechamentosSN([]);
    setSvcsForm([]);
    setNovoSvc({});
    setParsedXml(null);
    setSelectedFech(null);
    setXmlFile(null);
    setXmlFileName('');
    setActiveTab('dados');
    setCanSave(true);
    setIsOpen(true);
  };

  const openEdit = async (n: NotaFiscal) => {
    try {
      // Caminho crítico: refs estáticos + dados da nota (rápido)
      const [, r] = await Promise.all([
        fetchRefs(),
        fetch(`/api/notas-fiscais/${n.idnota}`),
      ]);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail || `Erro ao carregar nota (HTTP ${r.status})`);
      }
      const full: NotaFiscal = await r.json();

      // Resolve cliente: nota direta > fechamento
      const resolvedIdCliente = full.idcliente ?? full.fechamento_rel?.idcliente ?? null;
      const resolvedClienteRel = full.cliente_rel ?? full.fechamento_rel?.cliente_rel ?? null;

      setClienteDisplayName(resolvedClienteRel
        ? (resolvedClienteRel.nomefantasia || resolvedClienteRel.nome || '')
        : '');

      // Injeta o fechamento atual na lista sem bloquear
      if (full.idfechamento) {
        const fechItem = {
          idfechamento: full.idfechamento,
          data: full.fechamento_rel?.data ?? null,
          valor: null,
          idcliente: resolvedIdCliente,
          cliente_nome: resolvedClienteRel
            ? (resolvedClienteRel.nomefantasia || resolvedClienteRel.nome || null)
            : null,
        };
        setFechamentosSN(prev =>
          prev.some(f => f.idfechamento === full.idfechamento) ? prev : [...prev, fechItem]
        );
        fetchFechamentosSN(resolvedIdCliente ?? undefined)
          .then(() => setFechamentosSN(prev =>
            prev.some(f => f.idfechamento === full.idfechamento) ? prev : [...prev, fechItem]
          ))
          .catch(() => {});
      }

      setEditingId(full.idnota);
      setForm({
        idempresa: String(full.idempresa ?? ''),
        idcliente: String(resolvedIdCliente ?? ''),
        idfechamento: String(full.idfechamento ?? ''),
        numero: String(full.numero ?? ''),
        serie: full.serie ?? '',
        dps: full.dps ?? '',
        sequencia: String(full.sequencia ?? ''),
        data_emissao: full.data_emissao ?? '',
        hora: full.hora ?? '',
        vencimento: full.vencimento ?? '',
        local_servico: full.local_servico ?? '',
        dentro_pais: full.dentro_pais ?? 'S',
        resp_imposto: full.resp_imposto ?? 'N',
        valor_nota: full.valor_nota != null ? full.valor_nota.toFixed(2) : '',
        valor_servicos: full.valor_servicos != null ? full.valor_servicos.toFixed(2) : '',
        valor_materiais: full.valor_materiais != null ? full.valor_materiais.toFixed(2) : '',
        base_calculo: full.base_calculo != null ? full.base_calculo.toFixed(2) : '',
        valor_liquido: full.valor_liquido != null ? full.valor_liquido.toFixed(2) : '',
        iss: full.iss != null ? full.iss.toFixed(2) : '',
        deducoes: full.deducoes != null ? full.deducoes.toFixed(2) : '',
        pis: full.pis != null ? full.pis.toFixed(2) : '',
        cofins: full.cofins != null ? full.cofins.toFixed(2) : '',
        inss: full.inss != null ? full.inss.toFixed(2) : '',
        ir: full.ir != null ? full.ir.toFixed(2) : '',
        csll: full.csll != null ? full.csll.toFixed(2) : '',
        outras_retencoes: full.outras_retencoes != null ? full.outras_retencoes.toFixed(2) : '',
        imposto: full.imposto != null ? full.imposto.toFixed(2) : '',
        total_retencao: full.total_retencao != null ? full.total_retencao.toFixed(2) : '',
        link: full.link ?? '',
        chave_nfe: full.chave_nfe ?? '',
        observacao: full.observacao ?? '',
      });
      setSvcsForm((full.servicos ?? []).map(s => ({
        _key: `${s.idnota}-${s.sequencial}-${s.idservico}`,
        sequencial: s.sequencial,
        idservico: s.idservico,
        valor_unitario: s.valor_unitario,
        quantidade: s.quantidade,
        desconto: s.desconto,
        valor_total: s.valor_total,
        idempresa: s.idempresa,
      })));
      setActiveTab('dados');
      setCanSave(true);
      setIsOpen(true);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao carregar nota');
    }
  };

  const closeModal = () => setIsOpen(false);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/notas-fiscais/${deleteTarget.idnota}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Erro ao excluir');
      }
      await fetchNotas(currentPage, appliedFilters);
      await fetchFechamentosSN();
      setDeleteTarget(null);
      showSuccess('Nota Fiscal excluída com sucesso!');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao excluir');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Autocomplete cliente ──────────────────────────────────────────────────
  const handleClienteChange = (c: ClienteOption | null) => {
    setField('idcliente', c ? String(c.idcliente) : '');
    setClienteDisplayName(c ? (c.nomefantasia || c.nome || '') : '');
    setField('idfechamento', '');
    setSelectedFech(null);
    setFechamentosSN([]);
    if (c) fetchFechamentosSN(c.idcliente);
  };

  // ── Form field change ─────────────────────────────────────────────────────
  const setField = (key: keyof FormState, value: string) =>
    setForm(f => ({ ...f, [key]: value }));

  // ── Serviços form ─────────────────────────────────────────────────────────
  const nextSeq = () =>
    svcsForm.length === 0 ? 1 : Math.max(...svcsForm.map(s => s.sequencial)) + 1;

  const addServico = () => {
    if (!novoSvc.idservico) return;
    const seq = nextSeq();
    setSvcsForm(prev => [...prev, {
      _key: `new-${Date.now()}`,
      sequencial: seq,
      idservico: novoSvc.idservico ?? null,
      valor_unitario: novoSvc.valor_unitario ?? null,
      quantidade: novoSvc.quantidade ?? 1,
      desconto: novoSvc.desconto ?? 0,
      valor_total: novoSvc.valor_total ?? null,
      idempresa: parseId(form.idempresa),
    }]);
    setNovoSvc({});
    setDispVUnit('');
    setDispVTotal('');
  };

  const removeServico = (key: string) =>
    setSvcsForm(prev => prev.filter(s => s._key !== key));

  // ── Save nota ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.idempresa) return alert('Selecione a Empresa.');
    setIsSaving(true);
    try {
      const payload = {
        idempresa: parseId(form.idempresa),
        idcliente: parseId(form.idcliente),
        idfechamento: parseId(form.idfechamento),
        numero: form.numero ? Number(form.numero) : null,
        serie: form.serie || null,
        dps: form.dps || '0',
        sequencia: form.sequencia ? Number(form.sequencia) : null,
        data_emissao: form.data_emissao || null,
        hora: form.hora || null,
        vencimento: form.vencimento || null,
        local_servico: form.local_servico || null,
        dentro_pais: form.dentro_pais || null,
        resp_imposto: form.resp_imposto || null,
        valor_nota: form.valor_nota ? Number(form.valor_nota) : null,
        valor_servicos: form.valor_servicos ? Number(form.valor_servicos) : null,
        valor_materiais: form.valor_materiais ? Number(form.valor_materiais) : null,
        base_calculo: form.base_calculo ? Number(form.base_calculo) : null,
        valor_liquido: form.valor_liquido ? Number(form.valor_liquido) : null,
        iss: form.iss ? Number(form.iss) : null,
        deducoes: form.deducoes ? Number(form.deducoes) : null,
        pis: form.pis ? Number(form.pis) : null,
        cofins: form.cofins ? Number(form.cofins) : null,
        inss: form.inss ? Number(form.inss) : null,
        ir: form.ir ? Number(form.ir) : null,
        csll: form.csll ? Number(form.csll) : null,
        outras_retencoes: form.outras_retencoes ? Number(form.outras_retencoes) : null,
        imposto: form.imposto ? Number(form.imposto) : null,
        total_retencao: form.total_retencao ? Number(form.total_retencao) : null,
        link: form.link || null,
        chave_nfe: form.chave_nfe || null,
        observacao: form.observacao || null,
        servicos: svcsForm.map(s => ({
          sequencial: s.sequencial,
          idservico: s.idservico,
          valor_unitario: s.valor_unitario,
          quantidade: s.quantidade,
          desconto: s.desconto,
          valor_total: s.valor_total,
          idempresa: s.idempresa,
        })),
      };

      const url = editingId ? `/api/notas-fiscais/${editingId}` : '/api/notas-fiscais';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Erro ao salvar');
      }
      await fetchNotas(currentPage, appliedFilters);
      closeModal();
      showSuccess('Nota Fiscal salva com sucesso!');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  // ── XML: select file ──────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setXmlFile(f);
      setXmlFileName(f.name);
      setParsedXml(null);
    }
  };

  // ── XML: parse (preview) ──────────────────────────────────────────────────
  const handleLerXml = async () => {
    if (!xmlFile) return;
    setIsReadingXml(true);
    try {
      const fd = new FormData();
      fd.append('file', xmlFile);
      const res = await fetch('/api/notas-fiscais/parse-xml', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Erro ao ler XML');
      }
      const data: ParsedXML = await res.json();
      setParsedXml(data);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao ler XML');
    } finally {
      setIsReadingXml(false);
    }
  };

  // ── XML: import → popula aba Dados para revisão antes de salvar ──────────
  const handleImportar = () => {
    if (!parsedXml || !selectedFech) return;

    setForm(prev => ({
      ...prev,
      idfechamento: String(selectedFech.idfechamento),
      numero: parsedXml.numero != null ? String(parsedXml.numero) : '',
      dps: parsedXml.dps ?? '',
      serie: parsedXml.serie ?? '',
      data_emissao: parsedXml.data_emissao ?? '',
      hora: parsedXml.hora ?? '',
      vencimento: parsedXml.vencimento ?? '',
      local_servico: parsedXml.local_servico ?? '',
      dentro_pais: parsedXml.dentro_pais ?? 'S',
      resp_imposto: parsedXml.resp_imposto ?? 'N',
      valor_nota: parsedXml.valor_nota != null ? parsedXml.valor_nota.toFixed(2) : '',
      valor_servicos: parsedXml.valor_servicos != null ? parsedXml.valor_servicos.toFixed(2) : '',
      base_calculo: parsedXml.base_calculo != null ? parsedXml.base_calculo.toFixed(2) : '',
      valor_liquido: parsedXml.valor_liquido != null ? parsedXml.valor_liquido.toFixed(2) : '',
      iss: parsedXml.iss != null ? parsedXml.iss.toFixed(2) : '',
      inss: parsedXml.inss != null ? parsedXml.inss.toFixed(2) : '',
      total_retencao: parsedXml.total_retencao != null ? parsedXml.total_retencao.toFixed(2) : '',
      pis: parsedXml.pis != null ? parsedXml.pis.toFixed(2) : '',
      link: parsedXml.link ?? '',
      observacao: parsedXml.observacao ?? '',
      idempresa: parsedXml.idempresa ? String(parsedXml.idempresa) : prev.idempresa,
      idcliente: parsedXml.idcliente ? String(parsedXml.idcliente) : prev.idcliente,
    }));

    if (parsedXml.idcliente) {
      setClienteDisplayName(parsedXml.toma_nome || parsedXml.cliente_nome || String(parsedXml.idcliente));
    }

    if (parsedXml.c_trib_nac) {
      setSvcsForm([{
        _key: `xml-${Date.now()}`,
        sequencial: 1,
        idservico: parsedXml.c_trib_nac,
        valor_unitario: parsedXml.valor_servicos,
        quantidade: 1,
        desconto: 0,
        valor_total: parsedXml.valor_servicos,
        idempresa: parsedXml.idempresa,
      }]);
    }

    setEditingId(null);
    setActiveTab('dados');
    setCanSave(true);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <Header title="Notas Fiscais" />

      <div className="p-5 space-y-4">
        {/* Success toast */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 px-4 py-3 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-bold uppercase tracking-wider">{successMsg}</span>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px] relative group">
              <Search className="absolute left-3 top-[38px] h-4 w-4 text-slate-400 group-focus-within:text-[#B21212] transition-colors z-10" />
              <Input
                label="Cliente"
                placeholder="Filtrar por cliente..."
                value={fCliente}
                onChange={e => setFCliente(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="pl-9 h-12 border-slate-100 bg-slate-50/30 focus:bg-white transition-all"
              />
            </div>
            <div className="flex-1 min-w-[200px] relative group">
              <Search className="absolute left-3 top-[38px] h-4 w-4 text-slate-400 group-focus-within:text-[#B21212] transition-colors z-10" />
              <Input
                label="Empresa"
                placeholder="Filtrar por empresa..."
                value={fEmpresa}
                onChange={e => setFEmpresa(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="pl-9 h-12 border-slate-100 bg-slate-50/30 focus:bg-white transition-all"
              />
            </div>
            <div className="w-44">
              <Input
                label="Data Inicial"
                type="date"
                value={fDataIni}
                onChange={e => setFDataIni(e.target.value)}
                className="h-12 border-slate-100 bg-slate-50/30 focus:bg-white transition-all"
              />
            </div>
            <div className="w-44">
              <Input
                label="Data Final"
                type="date"
                value={fDataFim}
                onChange={e => setFDataFim(e.target.value)}
                className="h-12 border-slate-100 bg-slate-50/30 focus:bg-white transition-all"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleSearch}
              className="h-12 px-6 font-black uppercase tracking-widest text-[10px] border-slate-200 hover:bg-slate-50"
            >
              <Search className="h-4 w-4 mr-2" /> Filtrar
            </Button>
            <Button
              onClick={openNew}
              className="h-12 px-8 bg-[#B21212] hover:bg-[#8e0e0e] shadow-lg shadow-red-900/10 gap-2 font-black uppercase tracking-widest text-[10px]"
            >
              <Plus className="h-4 w-4" /> Entrada de Nota
            </Button>
          </div>
        </div>

        {/* Grid */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  {['Nota', 'Série', 'Data Emissão', 'Cliente', 'Empresa', 'Valor', ''].map(h => (
                    <th key={h} className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[#B21212] animate-spin" />
                        <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Carregando...</span>
                      </div>
                    </td>
                  </tr>
                ) : notas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                          <FileText className="h-6 w-6 text-slate-300" />
                        </div>
                        <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhuma nota fiscal encontrada</span>
                      </div>
                    </td>
                  </tr>
                ) : notas.map(n => (
                  <tr key={n.idnota} className="group hover:bg-slate-50/50 transition-all">
                    <td className="px-4 py-2">
                      <span className="text-xs font-bold text-[#B21212]">{n.numero ?? '—'}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs text-slate-500">{n.serie ?? '—'}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs text-slate-500">
                        {n.data_emissao ? new Date(n.data_emissao + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs font-bold text-slate-700">
                        {n.cliente_rel?.nomefantasia || n.cliente_rel?.nome || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs text-slate-400">
                        {n.empresa_rel?.nomefantasia || n.empresa_rel?.nome || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs font-bold text-slate-700">{fmtCurrency(n.valor_nota)}</span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget(n)} title="Excluir">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-[#B21212] hover:bg-red-50" onClick={() => openEdit(n)} title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="px-4 py-3 bg-slate-50/30 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {isLoading
                ? '—'
                : `Total: ${totalCount} nota${totalCount !== 1 ? 's' : ''} fiscal${totalCount !== 1 ? 'is' : ''}${totalPages > 1 ? ` — Página ${currentPage + 1} de ${totalPages}` : ''}`
              }
            </span>
            {!isLoading && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 0}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="h-7 px-3 text-[10px] font-black uppercase tracking-widest border-slate-200 disabled:opacity-40"
                >
                  ‹ Anterior
                </Button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = totalPages <= 7
                    ? i
                    : currentPage < 4
                      ? i
                      : currentPage > totalPages - 5
                        ? totalPages - 7 + i
                        : currentPage - 3 + i;
                  return (
                    <Button
                      key={p}
                      variant={p === currentPage ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => handlePageChange(p)}
                      className={cn(
                        'h-7 w-7 p-0 text-[10px] font-black',
                        p === currentPage
                          ? 'bg-[#B21212] hover:bg-[#8e0e0e] text-white border-0'
                          : 'border-slate-200 text-slate-500'
                      )}
                    >
                      {p + 1}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => handlePageChange(currentPage + 1)}
                  className="h-7 px-3 text-[10px] font-black uppercase tracking-widest border-slate-200 disabled:opacity-40"
                >
                  Próximo ›
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal Confirmação Exclusão ── */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        title="Confirmar Exclusão"
        className="max-w-sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="flex-1 font-black uppercase tracking-widest text-[10px]">
              Cancelar
            </Button>
            <Button onClick={handleDelete} disabled={isDeleting} className="flex-1 bg-red-600 hover:bg-red-700 font-black uppercase tracking-widest text-[10px]">
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col items-center text-center gap-4 py-2">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <p className="text-sm text-slate-500">
            Deseja excluir a Nota Fiscal{' '}
            <span className="font-black text-slate-700">
              #{deleteTarget?.numero ?? deleteTarget?.idnota}
            </span>
            {deleteTarget?.cliente_rel && (
              <> — {deleteTarget.cliente_rel.nomefantasia || deleteTarget.cliente_rel.nome}</>
            )}
            ? Esta ação não pode ser desfeita.
          </p>
        </div>
      </Modal>

      {/* ── Modal Principal ── */}
      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        title={editingId ? `Nota Fiscal #${editingId}` : 'Entrada de Nota Fiscal'}
        className="max-w-5xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="outline" onClick={closeModal} disabled={isSaving} className="font-black uppercase tracking-widest text-[10px] h-11 px-8">
              Fechar
            </Button>
            {activeTab === 'dados' && canSave && (
              <Button onClick={handleSave} disabled={isSaving} className="bg-[#B21212] hover:bg-[#8e0e0e] font-black uppercase tracking-widest text-[10px] h-11 px-8">
                {isSaving ? 'Salvando...' : 'Salvar Nota Fiscal'}
              </Button>
            )}
          </div>
        }
      >
        {/* Tabs */}
        <div className="flex border-b border-slate-100 -mx-6 px-6 mb-6 sticky top-0 bg-white z-10">
          {([['dados', 'Dados da Nota'], ['importacao', 'Importação de Nota Fiscal']] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn(
                'px-6 py-3 text-xs font-black uppercase tracking-widest transition-all relative',
                activeTab === tab
                  ? 'text-[#B21212] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#B21212]'
                  : 'text-slate-400 hover:text-slate-600'
              )}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab: Dados da Nota ── */}
        {activeTab === 'dados' && (
          <div className="space-y-6">

            <Section title="Vínculos">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Empresa *">
                  <select value={form.idempresa} onChange={e => setField('idempresa', e.target.value)} className={SEL}>
                    <option value="">Selecione...</option>
                    {empresas.map(e => (
                      <option key={e.idempresa} value={String(e.idempresa)}>{e.nomefantasia || e.nome}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Cliente">
                  <ClienteAutocomplete
                    value={Number(form.idcliente) || 0}
                    displayName={clienteDisplayName}
                    onChange={handleClienteChange}
                    placeholder="Digite 2+ caracteres para buscar..."
                  />
                </Field>
                <Field label="Fechamento">
                  {!form.idcliente ? (
                    <div className={cn(SEL, 'text-slate-400 cursor-not-allowed bg-slate-50 flex items-center')}>
                      Selecione um cliente primeiro...
                    </div>
                  ) : (
                    <select value={form.idfechamento} onChange={e => setField('idfechamento', e.target.value)} className={SEL}>
                      <option value="">Nenhum</option>
                      {fechamentosDoCliente.map(f => (
                        <option key={f.idfechamento} value={String(f.idfechamento)}>
                          #{f.idfechamento} — {f.data ?? ''}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>
            </Section>

            <Section title="Identificação">
              <div className="grid grid-cols-4 gap-3">
                <InpText k="numero" label="Número" form={form} set={setField} />
                <InpText k="serie" label="Série" form={form} set={setField} />
                <InpText k="dps" label="DPS" form={form} set={setField} />
                <InpText k="sequencia" label="Sequência" form={form} set={setField} />
                <InpText k="data_emissao" label="Data Emissão" form={form} set={setField} type="date" />
                <InpText k="hora" label="Hora" form={form} set={setField} />
                <InpText k="vencimento" label="Vencimento" form={form} set={setField} type="date" />
                <Field label="Local Serviço">
                  <select value={form.local_servico} onChange={e => setField('local_servico', e.target.value)} className={SEL}>
                    <option value="">—</option>
                    <option value="D">D — Dentro do Município</option>
                    <option value="F">F — Fora do Município</option>
                  </select>
                </Field>
                <Field label="Dentro do País">
                  <select value={form.dentro_pais} onChange={e => setField('dentro_pais', e.target.value)} className={SEL}>
                    <option value="S">Sim</option>
                    <option value="N">Não</option>
                  </select>
                </Field>
                <Field label="Resp. Imposto">
                  <select value={form.resp_imposto} onChange={e => setField('resp_imposto', e.target.value)} className={SEL}>
                    <option value="N">N — Não</option>
                    <option value="S">S — Sim</option>
                  </select>
                </Field>
              </div>
            </Section>

            <Section title="Valores">
              <div className="grid grid-cols-4 gap-3">
                <InpNum k="valor_nota" label="Valor Nota" form={form} set={setField} />
                <InpNum k="valor_servicos" label="Valor Serviços" form={form} set={setField} />
                <InpNum k="valor_materiais" label="Valor Materiais" form={form} set={setField} />
                <InpNum k="base_calculo" label="Base Cálculo" form={form} set={setField} />
                <InpNum k="iss" label="ISS" form={form} set={setField} />
                <InpNum k="deducoes" label="Deduções" form={form} set={setField} />
                <InpNum k="total_retencao" label="Total Retenção" form={form} set={setField} />
                <InpNum k="valor_liquido" label="Valor Líquido" form={form} set={setField} />
              </div>
            </Section>

            <Section title="Tributos">
              <div className="grid grid-cols-4 gap-3">
                <InpNum k="pis" label="PIS" form={form} set={setField} />
                <InpNum k="cofins" label="COFINS" form={form} set={setField} />
                <InpNum k="inss" label="INSS" form={form} set={setField} />
                <InpNum k="ir" label="IR" form={form} set={setField} />
                <InpNum k="csll" label="CSLL" form={form} set={setField} />
                <InpNum k="outras_retencoes" label="Outras Retenções" form={form} set={setField} />
                <InpNum k="imposto" label="Imposto" form={form} set={setField} />
              </div>
            </Section>

            <Section title="Complemento">
              <div className="grid grid-cols-2 gap-3">
                <InpText k="link" label="Link / ID NFSe" form={form} set={setField} />
                <InpText k="chave_nfe" label="Chave NFe" form={form} set={setField} />
              </div>
              <div className="mt-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Observação</label>
                <textarea value={form.observacao} onChange={e => setField('observacao', e.target.value)}
                  rows={3}
                  className="w-full min-h-[80px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-[#B21212]/10 transition-all resize-none" />
              </div>
            </Section>

            <Section title="Itens da Nota Fiscal (Serviços)">
              <div className="grid grid-cols-6 gap-3 mb-3 items-end">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Tipo Serviço</label>
                  <select
                    value={novoSvc.idservico != null ? String(novoSvc.idservico) : ''}
                    onChange={e => setNovoSvc(s => ({ ...s, idservico: Number(e.target.value) || undefined }))}
                    className={SEL}>
                    <option value="">Selecione...</option>
                    {tiposServico.map(t => (
                      <option key={t.idservico} value={String(t.idservico)}>{t.descricao}</option>
                    ))}
                  </select>
                </div>
                <Input label="Qtd" type="number" autoComplete="off"
                  value={novoSvc.quantidade ?? ''}
                  onChange={e => {
                    const qtd = Number(e.target.value);
                    const newTotal = qtd && novoSvc.valor_unitario
                      ? parseFloat((qtd * novoSvc.valor_unitario).toFixed(2))
                      : novoSvc.valor_total ?? null;
                    setNovoSvc(s => ({ ...s, quantidade: qtd, valor_total: newTotal }));
                    if (newTotal != null) setDispVTotal(newTotal.toFixed(2));
                  }} />
                <Input label="Vl. Unit." type="number" step="0.01" autoComplete="off"
                  value={dispVUnit}
                  onChange={e => {
                    setDispVUnit(e.target.value);
                    const unit = Number(e.target.value);
                    const newTotal = unit && novoSvc.quantidade
                      ? parseFloat((unit * novoSvc.quantidade).toFixed(2))
                      : novoSvc.valor_total ?? null;
                    setNovoSvc(s => ({ ...s, valor_unitario: unit || null, valor_total: newTotal }));
                    if (newTotal != null) setDispVTotal(newTotal.toFixed(2));
                  }}
                  onBlur={() => {
                    if (novoSvc.valor_unitario != null) setDispVUnit(novoSvc.valor_unitario.toFixed(2));
                  }} />
                <Input label="Desconto" type="number" step="0.01" autoComplete="off"
                  value={novoSvc.desconto ?? ''}
                  onChange={e => setNovoSvc(s => ({ ...s, desconto: Number(e.target.value) }))} />
                <Input label="Vl. Total" type="number" step="0.01" autoComplete="off"
                  value={dispVTotal}
                  onChange={e => {
                    setDispVTotal(e.target.value);
                    setNovoSvc(s => ({ ...s, valor_total: Number(e.target.value) || null }));
                  }}
                  onBlur={() => {
                    if (novoSvc.valor_total != null) setDispVTotal(novoSvc.valor_total.toFixed(2));
                  }} />
              </div>
              <Button variant="outline" size="sm" onClick={addServico}
                className="mb-4 gap-1.5 font-black text-[9px] uppercase tracking-widest border-slate-200 hover:bg-slate-50">
                <Plus className="h-3 w-3" /> Adicionar Item
              </Button>

              {svcsForm.length > 0 && (
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        {['Seq', 'Serviço', 'Qtd', 'Vl. Unit.', 'Desconto', 'Vl. Total', ''].map(h => (
                          <th key={h} className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {svcsForm.map(s => {
                        const tipo = tiposServico.find(t => t.idservico === s.idservico);
                        return (
                          <tr key={s._key} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 py-2"><span className="text-xs font-bold text-[#B21212]">{s.sequencial}</span></td>
                            <td className="px-3 py-2"><span className="text-xs font-bold text-slate-700">{tipo?.descricao ?? s.idservico}</span></td>
                            <td className="px-3 py-2"><span className="text-xs text-slate-500">{s.quantidade ?? '—'}</span></td>
                            <td className="px-3 py-2"><span className="text-xs text-slate-500">{fmtCurrency(s.valor_unitario)}</span></td>
                            <td className="px-3 py-2"><span className="text-xs text-slate-500">{fmtCurrency(s.desconto)}</span></td>
                            <td className="px-3 py-2"><span className="text-xs font-bold text-slate-700">{fmtCurrency(s.valor_total)}</span></td>
                            <td className="px-3 py-2">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeServico(s._key)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>
        )}

        {/* ── Tab: Importação ── */}
        {activeTab === 'importacao' && (
          <div className="space-y-6">

            <Section title="Fechamentos Disponíveis (sem Nota Fiscal)">
              {!form.idcliente ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-8 text-center">
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">
                    Selecione um cliente na aba <span className="text-[#B21212]">Dados da Nota</span> para ver os fechamentos disponíveis.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-end gap-4 mb-3">
                    <div className="flex-1 text-sm font-black text-slate-600 self-center">
                      {clienteDisplayName}
                    </div>
                    <div className="w-44">
                      <Input
                        label="Mês/Ano"
                        type="month"
                        value={fFechData}
                        onChange={e => setFFechData(e.target.value)}
                        className="h-12 border-slate-100 bg-slate-50/30 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-100 overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50/50 sticky top-0">
                        <tr>
                          {['', 'Data', 'Valor'].map(h => (
                            <th key={h} className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredFech.length === 0 ? (
                          <tr><td colSpan={3} className="px-3 py-6 text-center text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhum fechamento disponível para este cliente.</td></tr>
                        ) : filteredFech.map(f => (
                          <tr key={f.idfechamento}
                            onClick={() => setSelectedFech(sel => sel?.idfechamento === f.idfechamento ? null : f)}
                            className={cn(
                              'cursor-pointer transition-colors',
                              selectedFech?.idfechamento === f.idfechamento
                                ? 'bg-[#B21212]/5 text-[#B21212]'
                                : 'hover:bg-slate-50/50'
                            )}>
                            <td className="px-3 py-2">
                              <div className={cn('h-3.5 w-3.5 rounded-full border-2 transition-colors',
                                selectedFech?.idfechamento === f.idfechamento
                                  ? 'border-[#B21212] bg-[#B21212]'
                                  : 'border-slate-300'
                              )} />
                            </td>
                            <td className="px-3 py-2"><span className="text-xs text-slate-500">
                              {f.data ? new Date(f.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                            </span></td>
                            <td className="px-3 py-2"><span className="text-xs font-bold text-slate-700">{fmtCurrency(f.valor)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Section>

            <Section title="Arquivo XML da NFSe">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Input
                    label="Arquivo selecionado"
                    value={xmlFileName}
                    readOnly
                    placeholder="Nenhum arquivo selecionado..."
                    className="h-12 border-slate-100 bg-slate-50/30 cursor-default"
                  />
                </div>
                <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={handleFileChange} />
                <Button variant="outline" onClick={() => fileRef.current?.click()}
                  className="h-12 gap-2 font-black uppercase tracking-widest text-[10px] border-slate-200 hover:bg-slate-50">
                  <Search className="h-4 w-4" />
                  Buscar Arquivo
                </Button>
                <Button
                  onClick={handleLerXml}
                  disabled={!xmlFile || isReadingXml}
                  className="h-12 gap-2 bg-slate-700 hover:bg-slate-800 font-black uppercase tracking-widest text-[10px]">
                  <FileText className="h-4 w-4" />
                  {isReadingXml ? 'Lendo...' : 'Ler XML'}
                </Button>
              </div>
            </Section>

            {parsedXml && (
              <Section title="Dados Lidos do XML">
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <PreviewField label="Número da Nota" value={String(parsedXml.numero ?? '—')} />
                    <PreviewField label="Série" value={parsedXml.serie ?? '—'} />
                    <PreviewField label="Data Emissão" value={parsedXml.data_emissao
                      ? new Date(parsedXml.data_emissao + 'T12:00:00').toLocaleDateString('pt-BR')
                      : '—'} />
                    <PreviewField label="Cliente (Tomador)" value={parsedXml.toma_nome ?? parsedXml.cliente_nome ?? '—'} highlight />
                    <PreviewField label="Valor" value={fmtCurrency(parsedXml.valor_nota)} highlight />
                    <PreviewField label="Valor Líquido" value={fmtCurrency(parsedXml.valor_liquido)} />
                    <PreviewField label="ISS" value={fmtCurrency(parsedXml.iss)} />
                    <PreviewField label="Local Serviço" value={parsedXml.local_servico === 'D' ? 'Dentro do Município' : 'Fora do Município'} />
                    <PreviewField label="Serviço (CTribNac)" value={String(parsedXml.c_trib_nac ?? '—')} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Observação</span>
                    <p className="mt-1 text-sm font-medium text-slate-700 whitespace-pre-wrap line-clamp-3">{parsedXml.observacao || '—'}</p>
                  </div>
                  {parsedXml.idempresa && (
                    <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest pt-1 border-t border-slate-200">
                      ✓ Empresa e cliente identificados pelo CNPJ — serão pré-preenchidos na aba Dados da Nota.
                    </p>
                  )}
                </div>
              </Section>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleImportar}
                disabled={!parsedXml || !selectedFech}
                className="h-12 px-8 bg-[#B21212] hover:bg-[#8e0e0e] gap-2 font-black uppercase tracking-widest text-[10px]">
                <Upload className="h-4 w-4" />
                Importar Nota Fiscal
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 pb-1.5 border-b border-slate-100">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function InpText({ k, label, form, set, type = 'text' }: {
  k: keyof FormState; label: string; form: FormState;
  set: (k: keyof FormState, v: string) => void; type?: string;
}) {
  return (
    <Input
      label={label}
      type={type}
      value={form[k] as string}
      onChange={e => set(k, e.target.value)}
      autoComplete="off"
    />
  );
}

function InpNum({ k, label, form, set }: {
  k: keyof FormState; label: string; form: FormState;
  set: (k: keyof FormState, v: string) => void;
}) {
  return (
    <Input
      label={label}
      type="number"
      step="0.01"
      value={form[k] as string}
      onChange={e => set(k, e.target.value)}
      autoComplete="off"
    />
  );
}

function PreviewField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <span className={cn('text-sm font-black tracking-tight', highlight ? 'text-[#B21212]' : 'text-slate-700')}>{value}</span>
    </div>
  );
}
