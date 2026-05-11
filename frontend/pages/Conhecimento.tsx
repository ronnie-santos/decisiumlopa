import React, { useEffect, useRef, useState } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Truck, Plus, Search, Trash2, Pencil, AlertTriangle, FileSearch, FileUp } from 'lucide-react';
import { cn } from '../utils/cn';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConhecimentoItem {
  id: string;
  idconhecimento: number;
  data: string | null;
  numero_cte: number | null;
  cfop: string | null;
  natureza_prestacao: string | null;
  codigo_natureza: number | null;
  remetente: number | null;
  destinatario: number | null;
  forma_pagamento: string | null;
  notas_fiscais: string | null;
  como_sera_pago: string | null;
  natureza_carga: string | null;
  quantidade: number | null;
  especie: string | null;
  peso: number | null;
  valor_mercadoria: number | null;
  marca: string | null;
  placa: string | null;
  local: string | null;
  estado: string | null;
  local_coleta: string | null;
  local_entrega: string | null;
  frete_valor: number | null;
  sec_cat: number | null;
  seguro: number | null;
  pedagio: number | null;
  outros: number | null;
  total_frete: number | null;
  base_calculo: number | null;
  aliquota: number | null;
  icms: number | null;
  idfuncionario: number | null;
  observacao: string | null;
  data_pagamento: string | null;
  vencimento: string | null;
  idfechamento: number | null;
  idempresa: number | null;
  previsao_entrega: string | null;
  idequipamento: number | null;
  chave: string | null;
  idcte: string | null;
  cancelado: string | null;
  protocolo_cte: string | null;
  justificativa: string | null;
  tomador: number | null;
  texto_outros: string | null;
  empresa_rel?: { idempresa: number; nome: string | null; nomefantasia: string | null };
  funcionario_rel?: { idfuncionario: number; nome: string | null };
  equipamento_rel?: { idequipamento: number; nome: string | null; placa: string | null };
  fechamento_rel?: { idfechamento: number; data: string | null; valor: number | null; idcliente: number | null; cliente_nome: string | null };
}

interface EmpresaRef { idempresa: number; nome: string; nomefantasia: string | null }
interface FuncionarioRef { idfuncionario: number; nome: string | null }
interface EquipamentoRef { idequipamento: number; nome: string | null; placa: string | null }

interface FechamentoSC {
  idfechamento: number;
  data: string | null;
  valor: number | null;
  idcliente: number | null;
  cliente_nome: string | null;
}

interface ParsedCTe {
  numero_cte: number | null;
  natureza_prestacao: string | null;
  cfop: string | null;
  data: string | null;
  local_coleta: string | null;
  local_entrega: string | null;
  observacao: string | null;
  total_frete: number | null;
  frete_valor: number | null;
  base_calculo: number | null;
  peso: number | null;
  valor_mercadoria: number | null;
  natureza_carga: string | null;
  quantidade: number | null;
  especie: string | null;
  chave: string | null;
  idcte: string | null;
  protocolo_cte: string | null;
  previsao_entrega: string | null;
  estado: string | null;
  local: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const parseId = (v: unknown): number | null =>
  v && v !== '' && v !== '0' ? Number(v) : null;

const fmtCurrency = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

const emptyForm = () => ({
  idempresa: '',
  idfuncionario: '',
  idfechamento: '',
  idequipamento: '',
  numero_cte: '',
  cfop: '',
  data: '',
  previsao_entrega: '',
  chave: '',
  idcte: '',
  protocolo_cte: '',
  natureza_prestacao: '',
  codigo_natureza: '',
  forma_pagamento: '',
  como_sera_pago: '',
  local_coleta: '',
  local_entrega: '',
  local: 'ARAÇATUBA',
  estado: 'SP',
  natureza_carga: '',
  especie: '',
  peso: '',
  quantidade: '',
  valor_mercadoria: '',
  marca: '',
  notas_fiscais: '',
  placa: '',
  remetente: '',
  destinatario: '',
  tomador: '',
  frete_valor: '',
  sec_cat: '',
  seguro: '',
  pedagio: '',
  outros: '',
  total_frete: '',
  base_calculo: '',
  aliquota: '',
  icms: '',
  vencimento: '',
  data_pagamento: '',
  cancelado: '',
  justificativa: '',
  texto_outros: '',
  observacao: '',
});

type FormState = ReturnType<typeof emptyForm>;

const SEL = 'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-[#B21212]/10';

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
  return <Input label={label} type={type} value={form[k]} onChange={e => set(k, e.target.value)} autoComplete="off" />;
}

function InpNum({ k, label, form, set }: {
  k: keyof FormState; label: string; form: FormState;
  set: (k: keyof FormState, v: string) => void;
}) {
  return <Input label={label} type="number" step="0.01" value={form[k]} onChange={e => set(k, e.target.value)} autoComplete="off" />;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ConhecimentoPage() {
  // ── Data ──────────────────────────────────────────────────────────────────
  const [conhecimentos, setConhecimentos] = useState<ConhecimentoItem[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaRef[]>([]);
  const [funcionarios, setFuncionarios] = useState<FuncionarioRef[]>([]);
  const [equipamentos, setEquipamentos] = useState<EquipamentoRef[]>([]);
  const [fechamentosSC, setFechamentosSC] = useState<FechamentoSC[]>([]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const PER_PAGE = 100;
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // ── Main grid filters ─────────────────────────────────────────────────────
  const [fCliente, setFCliente] = useState('');
  const [fEmpresa, setFEmpresa] = useState('');
  const [fDataIni, setFDataIni] = useState('');
  const [fDataFim, setFDataFim] = useState('');

  // ── Modal ─────────────────────────────────────────────────────────────────
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dados' | 'importacao'>('dados');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [canSave, setCanSave] = useState(true);

  // ── Form (tab Dados) ──────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>(emptyForm());

  // ── Import (tab Importação) ───────────────────────────────────────────────
  const [fFechCli, setFFechCli] = useState('');
  const [fFechData, setFFechData] = useState('');
  const [selectedFech, setSelectedFech] = useState<FechamentoSC | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [xmlFileName, setXmlFileName] = useState('');
  const [parsedCte, setParsedCte] = useState<ParsedCTe | null>(null);
  const [isReadingXml, setIsReadingXml] = useState(false);

  // ── Delete confirmation ───────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<ConhecimentoItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Feedback ──────────────────────────────────────────────────────────────
  const [successMsg, setSuccessMsg] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchConhecimentos = async (pg = page) => {
    const params = new URLSearchParams();
    params.set('skip', String((pg - 1) * PER_PAGE));
    params.set('limit', String(PER_PAGE));
    if (fDataIni) params.set('data_de', fDataIni);
    if (fDataFim) params.set('data_ate', fDataFim);
    const r = await fetch(`/api/conhecimentos?${params}`);
    const data = await r.json();
    setConhecimentos(data.data.map((c: ConhecimentoItem) => ({ ...c, id: String(c.idconhecimento) })));
    setTotal(data.total);
  };

  const fetchFechamentosSC = async () => {
    const r = await fetch('/api/conhecimentos/fechamentos-sem-conhecimento');
    setFechamentosSC(await r.json());
  };

  useEffect(() => {
    fetchConhecimentos(page);
  }, [page, fDataIni, fDataFim]);

  useEffect(() => {
    fetchFechamentosSC();
    fetch('/api/empresas').then(r => r.json()).then(setEmpresas);
    fetch('/api/funcionarios').then(r => r.json()).then(setFuncionarios);
    fetch('/api/equipamentos').then(r => r.json()).then(setEquipamentos);
  }, []);

  // ── Filtered lists (client-side dentro da página carregada) ──────────────
  const filtered = conhecimentos.filter(c => {
    const cli = c.fechamento_rel?.cliente_nome || '';
    const emp = c.empresa_rel?.nomefantasia || c.empresa_rel?.nome || '';
    if (fCliente && !cli.toLowerCase().includes(fCliente.toLowerCase())) return false;
    if (fEmpresa && !emp.toLowerCase().includes(fEmpresa.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.ceil(total / PER_PAGE);

  const filteredFech = fechamentosSC.filter(f => {
    const cli = f.cliente_nome || '';
    if (fFechCli && !cli.toLowerCase().includes(fFechCli.toLowerCase())) return false;
    if (fFechData && f.data && !f.data.startsWith(fFechData)) return false;
    return true;
  });

  // ── Modal handlers ────────────────────────────────────────────────────────
  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setParsedCte(null);
    setSelectedFech(null);
    setXmlFile(null);
    setXmlFileName('');
    setFFechCli('');
    setFFechData('');
    setActiveTab('dados');
    setCanSave(true);
    setIsOpen(true);
  };

  const openEdit = (c: ConhecimentoItem) => {
    setEditingId(c.idconhecimento);
    setForm({
      idempresa: String(c.idempresa ?? ''),
      idfuncionario: String(c.idfuncionario ?? ''),
      idfechamento: String(c.idfechamento ?? ''),
      idequipamento: String(c.idequipamento ?? ''),
      numero_cte: String(c.numero_cte ?? ''),
      cfop: c.cfop ?? '',
      data: c.data ?? '',
      previsao_entrega: c.previsao_entrega ?? '',
      chave: c.chave ?? '',
      idcte: c.idcte ?? '',
      protocolo_cte: c.protocolo_cte ?? '',
      natureza_prestacao: c.natureza_prestacao ?? '',
      codigo_natureza: String(c.codigo_natureza ?? ''),
      forma_pagamento: c.forma_pagamento ?? '',
      como_sera_pago: c.como_sera_pago ?? '',
      local_coleta: c.local_coleta ?? '',
      local_entrega: c.local_entrega ?? '',
      local: c.local ?? 'ARAÇATUBA',
      estado: c.estado ?? 'SP',
      natureza_carga: c.natureza_carga ?? '',
      especie: c.especie ?? '',
      peso: c.peso != null ? String(c.peso) : '',
      quantidade: c.quantidade != null ? String(c.quantidade) : '',
      valor_mercadoria: c.valor_mercadoria != null ? Number(c.valor_mercadoria).toFixed(2) : '',
      marca: c.marca ?? '',
      notas_fiscais: c.notas_fiscais ?? '',
      placa: c.placa ?? '',
      remetente: c.remetente != null ? String(c.remetente) : '',
      destinatario: c.destinatario != null ? String(c.destinatario) : '',
      tomador: c.tomador != null ? String(c.tomador) : '',
      frete_valor: c.frete_valor != null ? Number(c.frete_valor).toFixed(2) : '',
      sec_cat: c.sec_cat != null ? Number(c.sec_cat).toFixed(2) : '',
      seguro: c.seguro != null ? Number(c.seguro).toFixed(2) : '',
      pedagio: c.pedagio != null ? Number(c.pedagio).toFixed(2) : '',
      outros: c.outros != null ? Number(c.outros).toFixed(2) : '',
      total_frete: c.total_frete != null ? Number(c.total_frete).toFixed(2) : '',
      base_calculo: c.base_calculo != null ? Number(c.base_calculo).toFixed(2) : '',
      aliquota: c.aliquota != null ? Number(c.aliquota).toFixed(2) : '',
      icms: c.icms != null ? Number(c.icms).toFixed(2) : '',
      vencimento: c.vencimento ?? '',
      data_pagamento: c.data_pagamento ?? '',
      cancelado: c.cancelado ?? '',
      justificativa: c.justificativa ?? '',
      texto_outros: c.texto_outros ?? '',
      observacao: c.observacao ?? '',
    });
    setActiveTab('dados');
    setCanSave(true);
    setIsOpen(true);
  };

  const closeModal = () => setIsOpen(false);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // ── Form field change ─────────────────────────────────────────────────────
  const setField = (key: keyof FormState, value: string) =>
    setForm(f => ({ ...f, [key]: value }));

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.idempresa) return alert('Selecione a Empresa.');
    if (!form.numero_cte) return alert('Informe o número do CT-e.');
    setIsSaving(true);
    try {
      const payload = {
        idempresa: parseId(form.idempresa),
        idfuncionario: parseId(form.idfuncionario),
        idfechamento: parseId(form.idfechamento),
        idequipamento: parseId(form.idequipamento),
        numero_cte: form.numero_cte ? Number(form.numero_cte) : null,
        cfop: form.cfop || null,
        data: form.data || null,
        previsao_entrega: form.previsao_entrega || null,
        chave: form.chave || null,
        idcte: form.idcte || null,
        protocolo_cte: form.protocolo_cte || null,
        natureza_prestacao: form.natureza_prestacao || null,
        codigo_natureza: form.codigo_natureza ? Number(form.codigo_natureza) : null,
        forma_pagamento: form.forma_pagamento || null,
        como_sera_pago: form.como_sera_pago || null,
        local_coleta: form.local_coleta || null,
        local_entrega: form.local_entrega || null,
        local: form.local || null,
        estado: form.estado || null,
        natureza_carga: form.natureza_carga || null,
        especie: form.especie || null,
        peso: form.peso ? Number(form.peso) : null,
        quantidade: form.quantidade ? Number(form.quantidade) : null,
        valor_mercadoria: form.valor_mercadoria ? Number(form.valor_mercadoria) : null,
        marca: form.marca || null,
        notas_fiscais: form.notas_fiscais || null,
        placa: form.placa || null,
        remetente: form.remetente ? Number(form.remetente) : null,
        destinatario: form.destinatario ? Number(form.destinatario) : null,
        tomador: form.tomador ? Number(form.tomador) : null,
        frete_valor: form.frete_valor ? Number(form.frete_valor) : null,
        sec_cat: form.sec_cat ? Number(form.sec_cat) : null,
        seguro: form.seguro ? Number(form.seguro) : null,
        pedagio: form.pedagio ? Number(form.pedagio) : null,
        outros: form.outros ? Number(form.outros) : null,
        total_frete: form.total_frete ? Number(form.total_frete) : null,
        base_calculo: form.base_calculo ? Number(form.base_calculo) : null,
        aliquota: form.aliquota ? Number(form.aliquota) : null,
        icms: form.icms ? Number(form.icms) : null,
        vencimento: form.vencimento || null,
        data_pagamento: form.data_pagamento || null,
        cancelado: form.cancelado || null,
        justificativa: form.justificativa || null,
        texto_outros: form.texto_outros || null,
        observacao: form.observacao || null,
      };

      const url = editingId ? `/api/conhecimentos/${editingId}` : '/api/conhecimentos';
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
      await fetchConhecimentos();
      await fetchFechamentosSC();
      closeModal();
      showSuccess('Conhecimento salvo com sucesso!');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/conhecimentos/${deleteTarget.idconhecimento}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Erro ao excluir');
      }
      await fetchConhecimentos();
      await fetchFechamentosSC();
      setDeleteTarget(null);
      showSuccess('Conhecimento excluído com sucesso!');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao excluir');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── XML: select file ──────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setXmlFile(f);
      setXmlFileName(f.name);
      setParsedCte(null);
    }
  };

  // ── XML: parse (preview) ──────────────────────────────────────────────────
  const handleLerXml = async () => {
    if (!xmlFile) return;
    setIsReadingXml(true);
    try {
      const fd = new FormData();
      fd.append('file', xmlFile);
      const res = await fetch('/api/conhecimentos/parse-xml', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Erro ao ler XML');
      }
      const data: ParsedCTe = await res.json();
      setParsedCte(data);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao ler XML');
    } finally {
      setIsReadingXml(false);
    }
  };

  // ── XML: import → popula tab Dados ───────────────────────────────────────
  const handleImportar = () => {
    if (!parsedCte || !selectedFech) return;

    setForm(prev => ({
      ...prev,
      idfechamento: String(selectedFech.idfechamento),
      numero_cte: parsedCte.numero_cte != null ? String(parsedCte.numero_cte) : '',
      cfop: parsedCte.cfop ?? '',
      data: parsedCte.data ?? '',
      previsao_entrega: parsedCte.previsao_entrega ?? '',
      natureza_prestacao: parsedCte.natureza_prestacao ?? '',
      local_coleta: parsedCte.local_coleta ?? '',
      local_entrega: parsedCte.local_entrega ?? '',
      local: parsedCte.local ?? 'ARAÇATUBA',
      estado: parsedCte.estado ?? 'SP',
      natureza_carga: parsedCte.natureza_carga ?? '',
      especie: parsedCte.especie ?? '',
      peso: parsedCte.peso != null ? String(parsedCte.peso) : '',
      quantidade: parsedCte.quantidade != null ? String(parsedCte.quantidade) : '',
      valor_mercadoria: parsedCte.valor_mercadoria != null ? Number(parsedCte.valor_mercadoria).toFixed(2) : '',
      frete_valor: parsedCte.frete_valor != null ? Number(parsedCte.frete_valor).toFixed(2) : '',
      total_frete: parsedCte.total_frete != null ? Number(parsedCte.total_frete).toFixed(2) : '',
      base_calculo: parsedCte.base_calculo != null ? Number(parsedCte.base_calculo).toFixed(2) : '',
      chave: parsedCte.chave ?? '',
      idcte: parsedCte.idcte ?? '',
      protocolo_cte: parsedCte.protocolo_cte ?? '',
      observacao: parsedCte.observacao ?? '',
    }));

    setEditingId(null);
    setActiveTab('dados');
    setCanSave(true);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <Header title="Conhecimentos de Transporte (CT-e)" />

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
                className="pl-9 h-12 border-slate-100 bg-slate-50/30 focus:bg-white transition-all"
              />
            </div>
            <div className="w-44">
              <Input
                label="Data Inicial"
                type="date"
                value={fDataIni}
                onChange={e => { setFDataIni(e.target.value); setPage(1); }}
                className="h-12 border-slate-100 bg-slate-50/30 focus:bg-white transition-all"
              />
            </div>
            <div className="w-44">
              <Input
                label="Data Final"
                type="date"
                value={fDataFim}
                onChange={e => { setFDataFim(e.target.value); setPage(1); }}
                className="h-12 border-slate-100 bg-slate-50/30 focus:bg-white transition-all"
              />
            </div>
            <Button
              onClick={openNew}
              className="h-12 px-8 bg-[#B21212] hover:bg-[#8e0e0e] shadow-lg shadow-red-900/10 gap-2 font-black uppercase tracking-widest text-[10px]"
            >
              <Plus className="h-4 w-4" /> Novo Conhecimento
            </Button>
          </div>
        </div>

        {/* Grid */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  {['CT-e #', 'Cliente', 'Empresa', 'Data', 'Total Frete', ''].map(h => (
                    <th key={h} className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                          <Truck className="h-6 w-6 text-slate-300" />
                        </div>
                        <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhum conhecimento encontrado</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(c => (
                  <tr key={c.idconhecimento} className="group hover:bg-slate-50/50 transition-all">
                    <td className="px-4 py-2">
                      <span className="text-xs font-bold text-[#B21212]">{c.numero_cte ?? '—'}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs font-bold text-slate-700">
                        {c.fechamento_rel?.cliente_nome || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs text-slate-400">
                        {c.empresa_rel?.nomefantasia || c.empresa_rel?.nome || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs text-slate-500">{fmtDate(c.data)}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs font-bold text-slate-700">{fmtCurrency(c.total_frete)}</span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget(c)} title="Excluir">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-[#B21212] hover:bg-red-50" onClick={() => openEdit(c)} title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50/30 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Página {page} de {totalPages || 1} · {total} conhecimento{total !== 1 ? 's' : ''}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-7 px-2 text-[10px] font-black"
                >
                  ‹
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .reduce<(number | string)[]>((acc, p, idx, arr) => {
                    if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1)
                      acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '...' ? (
                      <span key={`e${i}`} className="px-1 text-[10px] text-slate-400">...</span>
                    ) : (
                      <Button
                        key={p}
                        variant={p === page ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setPage(p as number)}
                        className="h-7 w-7 p-0 text-[10px] font-black"
                      >
                        {p}
                      </Button>
                    )
                  )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-7 px-2 text-[10px] font-black"
                >
                  ›
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
            Deseja excluir o CT-e{' '}
            <span className="font-black text-slate-700">
              #{deleteTarget?.numero_cte ?? deleteTarget?.idconhecimento}
            </span>
            {deleteTarget?.fechamento_rel?.cliente_nome && (
              <> — {deleteTarget.fechamento_rel.cliente_nome}</>
            )}
            ? Esta ação não pode ser desfeita.
          </p>
        </div>
      </Modal>

      {/* ── Modal Principal ── */}
      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        title={editingId ? `Conhecimento #${editingId}` : 'Novo Conhecimento de Transporte'}
        className="max-w-5xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="outline" onClick={closeModal} disabled={isSaving} className="font-black uppercase tracking-widest text-[10px] h-11 px-8">
              Fechar
            </Button>
            {activeTab === 'dados' && canSave && (
              <Button onClick={handleSave} disabled={isSaving} className="bg-[#B21212] hover:bg-[#8e0e0e] font-black uppercase tracking-widest text-[10px] h-11 px-8">
                {isSaving ? 'Salvando...' : 'Salvar Conhecimento'}
              </Button>
            )}
            {activeTab === 'importacao' && (
              <Button
                onClick={handleImportar}
                disabled={!parsedCte || !selectedFech}
                className="bg-[#B21212] hover:bg-[#8e0e0e] disabled:opacity-40 font-black uppercase tracking-widest text-[10px] h-11 px-8 gap-2"
              >
                <FileUp className="h-4 w-4" /> Importar para Dados
              </Button>
            )}
          </div>
        }
      >
        {/* Tabs */}
        <div className="flex border-b border-slate-100 -mx-6 px-6 mb-6 sticky top-0 bg-white z-10">
          {([['dados', 'Dados do Conhecimento'], ['importacao', 'Importação de Conhecimento']] as const).map(([tab, label]) => (
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

        {/* ── Tab: Dados do Conhecimento ── */}
        {activeTab === 'dados' && (
          <div className="space-y-6">

            <Section title="Vínculo">
              <div className="grid grid-cols-4 gap-3">
                <Field label="Empresa *">
                  <select value={form.idempresa} onChange={e => setField('idempresa', e.target.value)} className={SEL}>
                    <option value="">Selecione...</option>
                    {empresas.map(e => (
                      <option key={e.idempresa} value={e.idempresa}>{e.nomefantasia || e.nome}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Fechamento">
                  <select value={form.idfechamento} onChange={e => setField('idfechamento', e.target.value)} className={SEL}>
                    <option value="">Nenhum</option>
                    {fechamentosSC.map(f => (
                      <option key={f.idfechamento} value={f.idfechamento}>
                        #{f.idfechamento} — {f.cliente_nome || '?'} — {f.data ?? ''}
                      </option>
                    ))}
                    {/* Se editando, garantir que o fechamento atual apareça na lista */}
                    {editingId && form.idfechamento && !fechamentosSC.find(f => String(f.idfechamento) === form.idfechamento) && (
                      <option value={form.idfechamento}>#{form.idfechamento} — (vinculado)</option>
                    )}
                  </select>
                </Field>
                <Field label="Funcionário">
                  <select value={form.idfuncionario} onChange={e => setField('idfuncionario', e.target.value)} className={SEL}>
                    <option value="">Nenhum</option>
                    {funcionarios.map(f => (
                      <option key={f.idfuncionario} value={f.idfuncionario}>{f.nome}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Equipamento / Veículo">
                  <select value={form.idequipamento} onChange={e => setField('idequipamento', e.target.value)} className={SEL}>
                    <option value="">Nenhum</option>
                    {equipamentos.map(e => (
                      <option key={e.idequipamento} value={e.idequipamento}>{e.nome}{e.placa ? ` (${e.placa})` : ''}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </Section>

            <Section title="Identificação CT-e">
              <div className="grid grid-cols-4 gap-3">
                <InpText k="numero_cte" label="Número CT-e *" form={form} set={setField} />
                <InpText k="cfop" label="CFOP" form={form} set={setField} />
                <InpText k="data" label="Data Emissão" form={form} set={setField} type="date" />
                <InpText k="previsao_entrega" label="Previsão Entrega" form={form} set={setField} type="date" />
                <div className="col-span-2">
                  <InpText k="chave" label="Chave NF-e Referenciada" form={form} set={setField} />
                </div>
                <div className="col-span-2">
                  <InpText k="idcte" label="Chave CT-e (idCTe)" form={form} set={setField} />
                </div>
                <InpText k="protocolo_cte" label="Protocolo CT-e" form={form} set={setField} />
                <InpText k="codigo_natureza" label="Código Natureza" form={form} set={setField} />
              </div>
            </Section>

            <Section title="Prestação do Serviço">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2">
                  <InpText k="natureza_prestacao" label="Natureza da Prestação" form={form} set={setField} />
                </div>
                <InpText k="forma_pagamento" label="Forma de Pagamento" form={form} set={setField} />
                <InpText k="como_sera_pago" label="Como Será Pago" form={form} set={setField} />
                <div className="col-span-2">
                  <InpText k="local_coleta" label="Local de Coleta" form={form} set={setField} />
                </div>
                <div className="col-span-2">
                  <InpText k="local_entrega" label="Local de Entrega" form={form} set={setField} />
                </div>
                <InpText k="local" label="Local (Município)" form={form} set={setField} />
                <InpText k="estado" label="Estado (UF)" form={form} set={setField} />
              </div>
            </Section>

            <Section title="Carga">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2">
                  <InpText k="natureza_carga" label="Natureza da Carga" form={form} set={setField} />
                </div>
                <InpText k="especie" label="Espécie" form={form} set={setField} />
                <InpText k="marca" label="Marca" form={form} set={setField} />
                <InpNum k="peso" label="Peso Bruto (kg)" form={form} set={setField} />
                <InpText k="quantidade" label="Quantidade (volumes)" form={form} set={setField} />
                <InpNum k="valor_mercadoria" label="Valor da Mercadoria" form={form} set={setField} />
                <div className="col-span-2">
                  <InpText k="notas_fiscais" label="Notas Fiscais Referenciadas" form={form} set={setField} />
                </div>
              </div>
            </Section>

            <Section title="Veículo / Partes">
              <div className="grid grid-cols-4 gap-3">
                <InpText k="placa" label="Placa" form={form} set={setField} />
                <InpText k="remetente" label="Remetente (ID)" form={form} set={setField} />
                <InpText k="destinatario" label="Destinatário (ID)" form={form} set={setField} />
                <InpText k="tomador" label="Tomador (ID)" form={form} set={setField} />
              </div>
            </Section>

            <Section title="Valores do Frete">
              <div className="grid grid-cols-4 gap-3">
                <InpNum k="frete_valor" label="Valor do Frete" form={form} set={setField} />
                <InpNum k="sec_cat" label="SEC/CAT" form={form} set={setField} />
                <InpNum k="seguro" label="Seguro" form={form} set={setField} />
                <InpNum k="pedagio" label="Pedágio" form={form} set={setField} />
                <InpNum k="outros" label="Outros" form={form} set={setField} />
                <InpNum k="total_frete" label="Total do Frete" form={form} set={setField} />
                <InpNum k="base_calculo" label="Base de Cálculo" form={form} set={setField} />
                <InpNum k="aliquota" label="Alíquota (%)" form={form} set={setField} />
                <InpNum k="icms" label="ICMS" form={form} set={setField} />
              </div>
            </Section>

            <Section title="Pagamento">
              <div className="grid grid-cols-4 gap-3">
                <InpText k="vencimento" label="Vencimento" form={form} set={setField} type="date" />
                <InpText k="data_pagamento" label="Data de Pagamento" form={form} set={setField} type="date" />
              </div>
            </Section>

            <Section title="Complemento">
              <div className="grid grid-cols-3 gap-3">
                <InpText k="cancelado" label="Cancelado" form={form} set={setField} />
                <div className="col-span-2">
                  <InpText k="justificativa" label="Justificativa de Cancelamento" form={form} set={setField} />
                </div>
              </div>
              <div className="mt-4">
                <InpText k="texto_outros" label="Texto Outros" form={form} set={setField} />
              </div>
              <div className="mt-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Observação</label>
                <textarea value={form.observacao} onChange={e => setField('observacao', e.target.value)}
                  rows={3}
                  className="w-full min-h-[80px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-[#B21212]/10 transition-all resize-none" />
              </div>
            </Section>

          </div>
        )}

        {/* ── Tab: Importação de Conhecimento ── */}
        {activeTab === 'importacao' && (
          <div className="space-y-6">

            {/* Grid de fechamentos sem conhecimento */}
            <Section title="Fechamentos sem Conhecimento">
              <div className="flex gap-3 mb-3">
                <div className="flex-1 relative group">
                  <Search className="absolute left-3 top-[38px] h-4 w-4 text-slate-400 z-10" />
                  <Input
                    label="Filtrar por cliente"
                    placeholder="Nome do cliente..."
                    value={fFechCli}
                    onChange={e => setFFechCli(e.target.value)}
                    className="pl-9 h-10 border-slate-100 bg-slate-50/30"
                  />
                </div>
                <div className="w-48">
                  <Input
                    label="Filtrar por data"
                    type="month"
                    value={fFechData}
                    onChange={e => setFFechData(e.target.value)}
                    className="h-10 border-slate-100 bg-slate-50/30"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto max-h-52 overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="border-b border-slate-100">
                        {['Fechamento', 'Cliente', 'Data', 'Valor', ''].map(h => (
                          <th key={h} className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredFech.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-sm font-bold text-slate-400">
                            Nenhum fechamento disponível
                          </td>
                        </tr>
                      ) : filteredFech.map(f => (
                        <tr
                          key={f.idfechamento}
                          className={cn(
                            'cursor-pointer transition-all',
                            selectedFech?.idfechamento === f.idfechamento
                              ? 'bg-red-50 hover:bg-red-50'
                              : 'hover:bg-slate-50/50'
                          )}
                          onClick={() => setSelectedFech(f)}
                        >
                          <td className="px-3 py-2">
                            <span className="text-xs font-bold text-[#B21212]">#{f.idfechamento}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-xs font-bold text-slate-700">{f.cliente_nome || '—'}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-xs text-slate-500">{fmtDate(f.data)}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-xs font-bold text-slate-700">{fmtCurrency(f.valor)}</span>
                          </td>
                          <td className="px-3 py-2">
                            {selectedFech?.idfechamento === f.idfechamento && (
                              <span className="text-[10px] font-black text-[#B21212] uppercase tracking-wider">Selecionado</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Section>

            {/* XML input */}
            <Section title="Arquivo CT-e (XML)">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Input
                    label="Arquivo XML selecionado"
                    value={xmlFileName}
                    readOnly
                    placeholder="Nenhum arquivo selecionado..."
                    className="h-10 bg-slate-50/30 border-slate-100"
                  />
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xml"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  className="h-10 gap-2 font-black uppercase tracking-widest text-[10px]"
                >
                  <FileSearch className="h-4 w-4" /> Buscar Arquivo
                </Button>
                <Button
                  variant="outline"
                  onClick={handleLerXml}
                  disabled={!xmlFile || isReadingXml}
                  className="h-10 gap-2 font-black uppercase tracking-widest text-[10px] disabled:opacity-40"
                >
                  {isReadingXml ? 'Lendo...' : 'Ler XML'}
                </Button>
              </div>
            </Section>

            {/* CT-e preview card */}
            {parsedCte && (
              <Section title="Dados do CT-e Lido">
                <div className="bg-slate-50/50 rounded-xl border border-slate-100 p-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">CT-e #</span>
                      <span className="text-xs font-bold text-[#B21212]">{parsedCte.numero_cte ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">CFOP</span>
                      <span className="text-xs font-bold text-slate-700">{parsedCte.cfop ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Data Emissão</span>
                      <span className="text-xs text-slate-600">{fmtDate(parsedCte.data)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Coleta</span>
                      <span className="text-xs text-slate-600">{parsedCte.local_coleta ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Entrega</span>
                      <span className="text-xs text-slate-600">{parsedCte.local_entrega ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Natureza da Carga</span>
                      <span className="text-xs text-slate-600">{parsedCte.natureza_carga ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Peso Bruto</span>
                      <span className="text-xs font-bold text-slate-700">{parsedCte.peso != null ? `${parsedCte.peso} kg` : '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total do Frete</span>
                      <span className="text-xs font-bold text-[#B21212]">{fmtCurrency(parsedCte.total_frete)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Previsão Entrega</span>
                      <span className="text-xs text-slate-600">{fmtDate(parsedCte.previsao_entrega)}</span>
                    </div>
                    {parsedCte.idcte && (
                      <div className="col-span-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Chave CT-e</span>
                        <span className="text-xs font-mono text-slate-500 break-all">{parsedCte.idcte}</span>
                      </div>
                    )}
                    {parsedCte.observacao && (
                      <div className="col-span-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Observação</span>
                        <span className="text-xs text-slate-600 line-clamp-3">{parsedCte.observacao}</span>
                      </div>
                    )}
                  </div>

                  {(!selectedFech) && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-xs font-bold">Selecione um fechamento na grade acima para habilitar a importação.</span>
                    </div>
                  )}
                </div>
              </Section>
            )}

          </div>
        )}
      </Modal>
    </div>
  );
}
