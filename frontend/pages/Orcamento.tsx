import React, { useState, useEffect } from 'react';
import { useCidadeBairro } from '../utils/useCidadeBairro';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ClienteAutocomplete, ClienteOption } from '../components/ui/ClienteAutocomplete';
import { EquipamentoAutocomplete, EquipamentoOption } from '../components/ui/EquipamentoAutocomplete';
import { Plus, Eye, Edit2, Printer, ChevronLeft, ChevronRight, TrendingUp, Clock, AlertCircle, Trash2, Sparkles, X, Search } from 'lucide-react';
import { cn } from '../utils/cn';

// ── Tipos internos ──────────────────────────────────────────────────────────
interface ServiceRow {
  _tempId: string;
  idequipamento: number;
  equipamento_nome: string;
  idservico: number;
  nome_servico: string;
  unidade: string;
  nome_item: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

const emptyForm = () => ({
  idcliente: 0,
  idempresa: 0,
  idfuncionario: 0,
  nome: '',
  cnpj_cpf: '',
  contato: '',
  data: new Date().toISOString().split('T')[0],
  situacao: 'PENDENTE',
  endereco: '',
  cidade: '',
  cep: '',
  forma_pagamento: 'A vista',
  idcontrato: 0,
  local_servico: '',
  local_entrega: '',
  descricao: '',
  fone: '',
  email: '',
});

const situacaoColors: Record<string, string> = {
  'AGUARDANDO APROVAÇÃO': 'bg-amber-50 text-amber-600 border-amber-100',
  PENDENTE:               'bg-slate-100 text-slate-600 border-slate-200',
  APROVADO:               'bg-emerald-50 text-emerald-600 border-emerald-100',
  'NÃO APROVADO':         'bg-orange-50 text-orange-600 border-orange-100',
  REJEITADO:              'bg-red-50 text-red-600 border-red-100',
};

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

// ── Componente principal ────────────────────────────────────────────────────
export function OrcamentoPage() {
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [isViewOnly, setIsViewOnly]     = useState(false);
  const [editingId, setEditingId]       = useState<number | null>(null);
  const [isSaving, setIsSaving]         = useState(false);
  // Garante que o overlay nunca fique preso caso a página desmonte durante um save
  useEffect(() => { return () => setIsSaving(false); }, []);
  const [isLoading, setIsLoading]       = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Dados da lista
  const [orcamentos, setOrcamentos]     = useState<any[]>([]);

  // Dados auxiliares
  const [empresas, setEmpresas]         = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [estados, setEstados]           = useState<any[]>([]);
  const [contratos, setContratos]       = useState<any[]>([]);

  // Filtro estado→cidade (carregamento dinâmico)
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const { cidades: cidadesFiltradas } = useCidadeBairro(estadoFiltro || null);

  // Formulário
  const [formData, setFormData] = useState(emptyForm());
  const [services, setServices] = useState<ServiceRow[]>([]);

  // Filtro da lista
  const [searchTerm, setSearchTerm]   = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');

  // ── Paginação ─────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const PER_PAGE = 100;

  // ── Carregamento inicial ──────────────────────────────────────────────────
  const fetchOrcamentos = async (p = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('skip', String((p - 1) * PER_PAGE));
      params.set('limit', String(PER_PAGE));
      if (searchTerm.trim()) params.set('busca', searchTerm.trim());
      if (filterStatus !== 'Todos') params.set('situacao', filterStatus);
      const r = await fetch(`/api/orcamentos?${params}`);
      if (r.ok) {
        const json = await r.json();
        setOrcamentos(json.data ?? []);
        setTotalRecords(json.total ?? 0);
      }
    } catch { /* ignore */ } finally {
      setIsLoading(false);
    }
  };

  const fetchAux = async () => {
    const [rEmp, rFun, rSrv, rEst, rCtr] = await Promise.all([
      fetch('/api/empresas'),
      fetch('/api/funcionarios'),
      fetch('/api/servico'),
      fetch('/api/estados'),
      fetch('/api/contratos?ativo=true'),
    ]);
    if (rEmp.ok) setEmpresas(await rEmp.json());
    if (rFun.ok) setFuncionarios(await rFun.json());
    if (rSrv.ok) setServicos(await rSrv.json());
    if (rEst.ok) setEstados(await rEst.json());
    if (rCtr.ok) setContratos(await rCtr.json());
  };

  useEffect(() => { fetchAux(); }, []);
  useEffect(() => { fetchOrcamentos(page); }, [page]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const calcTotal = () => services.reduce((acc, s) => acc + (s.valor_total || 0), 0);

  const autoFillCliente = (c: ClienteOption | null) => {
    if (!c) {
      setFormData(prev => ({ ...prev, idcliente: 0, nome: '', cnpj_cpf: '', contato: '' }));
      return;
    }
    setFormData(prev => ({
      ...prev,
      idcliente: c.idcliente,
      nome:      c.nome      || '',
      cnpj_cpf:  c.cnpj_cpf  || '',
    }));
  };

  // ── Modais ────────────────────────────────────────────────────────────────
  const handleOpenNew = () => {
    setEditingId(null);
    setIsViewOnly(false);
    setFormData(emptyForm());
    setServices([]);
    setEstadoFiltro('');
    setError(null);
    setIsModalOpen(true);
  };

  const openModal = (orc: any, viewOnly: boolean) => {
    setEditingId(orc.idorcamento);
    setIsViewOnly(viewOnly);
    setError(null);
    setFormData({
      idcliente:       orc.idcliente   || 0,
      idempresa:       orc.idempresa   || 0,
      idfuncionario:   orc.idfuncionario || 0,
      nome:            orc.nome        || '',
      cnpj_cpf:        orc.cnpj_cpf    || '',
      contato:         orc.contato     || '',
      data:            orc.data        || new Date().toISOString().split('T')[0],
      situacao:        orc.situacao    || 'PENDENTE',
      endereco:        orc.endereco    || '',
      cidade:          orc.cidade      || '',
      cep:             orc.cep         || '',
      forma_pagamento: orc.forma_pagamento || 'A vista',
      idcontrato:      orc.idcontrato      || 0,
      local_servico:   orc.local_servico   || '',
      local_entrega:   orc.local_entrega   || '',
      descricao:       orc.descricao   || '',
      fone:            orc.fone        || '',
      email:           orc.email       || '',
    });
    setServices((orc.itens || []).map((it: any, idx: number) => ({
      _tempId:         Math.random().toString(36).substr(2, 9),
      idequipamento:   it.idequipamento || 0,
      equipamento_nome: it.equipamento_rel
        ? (it.equipamento_rel.placa ? `${it.equipamento_rel.nome} — ${it.equipamento_rel.placa}` : it.equipamento_rel.nome)
        : '',
      idservico:       idx + 1,
      nome_servico:    it.nome_item  || '',
      unidade:         it.unidade    || '',
      nome_item:       it.nome_item  || '',
      quantidade:      Number(it.quantidade)    || 1,
      valor_unitario:  Number(it.valor_unitario)|| 0,
      valor_total:     Number(it.valor_total)   || 0,
    })));
    setEstadoFiltro('');
    setIsModalOpen(true);
  };

  // ── Salvar ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!formData.idempresa) { setError('Selecione a empresa.'); return; }

    setIsSaving(true);
    setError(null);
    try {
      const total = calcTotal();
      const payload = {
        ...formData,
        idcliente:     formData.idcliente     || null,
        idfuncionario: formData.idfuncionario || null,
        idempresa:     formData.idempresa     || null,
        idcontrato:    formData.idcontrato    || null,
        cep:           (formData.cep || '').replace(/\D/g, ''),
        total,
        itens: services
          .filter(s => s.idequipamento > 0 && s.nome_servico)
          .map((s, idx) => ({
            idequipamento: s.idequipamento,
            idservico:     idx + 1,
            unidade:       s.unidade || 'UN',
            nome_item:     s.nome_servico || s.nome_item,
            quantidade:    s.quantidade || 1,
            valor_unitario:s.valor_unitario,
            valor_total:   s.valor_total,
          })),
      };

      const url    = editingId ? `/api/orcamentos/${editingId}` : '/api/orcamentos';
      const method = editingId ? 'PUT' : 'POST';
      const r      = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const body = await r.text().catch(() => '');
        let msg = `Erro ${r.status}`;
        try {
          const err = JSON.parse(body);
          if (typeof err.detail === 'string') msg = err.detail;
          else if (Array.isArray(err.detail)) msg = err.detail.map((e: any) => e.msg || JSON.stringify(e)).join('; ');
          else if (body) msg = body;
        } catch { if (body) msg = body; }
        throw new Error(msg);
      }

      await fetchOrcamentos(page);
      setSuccessMessage(editingId ? 'Orçamento atualizado!' : 'Orçamento criado!');
      setTimeout(() => setSuccessMessage(null), 5000);
      setIsModalOpen(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Textos Padrão ─────────────────────────────────────────────────────────
  const [isTextoModalOpen, setIsTextoModalOpen] = useState(false);
  const [textosPadrao, setTextosPadrao] = useState<{ idtexto: number; texto: string }[]>([]);

  const handleOpenTextoModal = async () => {
    if (textosPadrao.length === 0) {
      try {
        const r = await fetch('/api/textopadrao');
        if (r.ok) setTextosPadrao(await r.json());
      } catch { /* ignore */ }
    }
    setIsTextoModalOpen(true);
  };

  const handleSelectTexto = (texto: string) => {
    setFormData(p => ({ ...p, descricao: texto }));
    setIsTextoModalOpen(false);
  };

  // ── Excluir ───────────────────────────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      const r = await fetch(`/api/orcamentos/${deleteId}`, { method: 'DELETE' });
      if (r.ok) {
        await fetchOrcamentos(page);
        setDeleteId(null);
        setSuccessMessage('Orçamento excluído!');
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        const err = await r.json().catch(() => ({}));
        setDeleteError(err.detail || 'Erro ao excluir.');
      }
    } catch { setDeleteError('Erro de conexão.'); }
  };

  // ── Serviços ──────────────────────────────────────────────────────────────
  const addService = () => {
    setServices(prev => [...prev, {
      _tempId: Math.random().toString(36).substr(2, 9),
      idequipamento: 0,
      equipamento_nome: '',
      idservico: prev.length + 1,
      nome_servico: '',
      unidade: '',
      nome_item: '',
      quantidade: 1,
      valor_unitario: 0,
      valor_total: 0,
    }]);
  };

  const updateService = (tempId: string, field: string, value: any) => {
    setServices(prev => prev.map(s => {
      if (s._tempId !== tempId) return s;
      let updated = { ...s, [field]: value };
      if (field === 'nome_servico') {
        const svc = servicos.find(x => x.nome === value);
        if (svc) {
          updated.nome_item     = svc.nome;
          updated.unidade       = svc.unidade || '';
          updated.valor_unitario = Number(svc.valor) || 0;
          updated.valor_total   = updated.quantidade * (Number(svc.valor) || 0);
        }
      }
      if (field === 'quantidade' || field === 'valor_unitario') {
        updated.valor_total = updated.quantidade * updated.valor_unitario;
      }
      return updated;
    }));
  };

  const removeService = (tempId: string) => {
    setServices(prev => prev.filter(s => s._tempId !== tempId));
  };

  const filtered = orcamentos;

  const handleApplyFilters = () => { setPage(1); fetchOrcamentos(1); };

  const totalPages = Math.max(1, Math.ceil(totalRecords / PER_PAGE));

  // ── Estatísticas (baseadas na página atual) ───────────────────────────────
  const totalAprovadosValor = orcamentos.filter(o => o.situacao === 'APROVADO').reduce((a, o) => a + Number(o.total || 0), 0);
  const totalAprovados = orcamentos.filter(o => o.situacao === 'APROVADO').length;
  const totalGeral     = totalRecords;
  const pctAprovacao   = totalGeral ? Math.round((totalAprovados / totalGeral) * 100) : 0;

  // ── Select helpers ────────────────────────────────────────────────────────
  const selClass = (disabled = false) =>
    cn('h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20',
       disabled && 'disabled:bg-slate-50 text-slate-500');

  const selInlineClass = (disabled = false) =>
    cn('w-full bg-transparent outline-none border-b border-transparent focus:border-[#B21212]/30 py-1 text-sm',
       disabled && 'text-slate-500 cursor-default');

  // ── Label para situação ───────────────────────────────────────────────────
  const situacaoLabel: Record<string, string> = {
    'AGUARDANDO APROVAÇÃO': 'Aguardando Aprovação',
    PENDENTE:               'Pendente',
    APROVADO:               'Aprovado',
    'NÃO APROVADO':         'Não Aprovado',
    REJEITADO:              'Rejeitado',
  };

  return (
    <div className="flex flex-col h-full relative">
      <Header title="Orçamentos" />

      {/* Overlay salvar */}
      {isSaving && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-[110] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-[#B21212]/20 border-t-[#B21212] rounded-full animate-spin" />
            <span className="text-sm font-bold text-slate-600 animate-pulse uppercase tracking-widest">Salvando...</span>
          </div>
        </div>
      )}

      {/* Toast */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-[120] p-4 rounded-lg shadow-2xl flex items-center gap-3 bg-emerald-50 border border-emerald-100">
          <p className="text-sm font-bold text-emerald-800">{successMessage}</p>
          <button onClick={() => setSuccessMessage(null)}><X className="h-4 w-4 text-slate-400" /></button>
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Cards estatísticos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border-l-4 border-[#B21212] p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Aprovados</p>
              <h3 className="text-xl font-black text-slate-800">{fmt(totalAprovadosValor)}</h3>
              <p className="text-[10px] text-slate-400 font-normal mt-0.5">{totalAprovados} orçamentos</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center text-[#B21212] flex-shrink-0 ml-3">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="bg-white rounded-xl border-l-4 border-emerald-500 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Taxa de Aprovação</p>
              <h3 className="text-xl font-black text-slate-800">{pctAprovacao}%</h3>
              <p className="text-[10px] text-slate-400 font-normal mt-0.5">{totalAprovados} de {totalGeral} aprovados</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500 flex-shrink-0 ml-3">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="bg-white rounded-xl border-l-4 border-slate-800 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total de Orçamentos</p>
              <h3 className="text-xl font-black text-slate-800">{totalGeral}</h3>
              <p className="text-[10px] text-slate-400 font-normal mt-0.5">registros no sistema</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-800 flex-shrink-0 ml-3">
              <Clock className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                label="Buscar"
                placeholder="Nº, cliente ou nome..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleApplyFilters()}
              />
            </div>
            <div className="w-44">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Status</label>
              <select className={selClass()} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="Todos">Todos os Status</option>
                <option value="AGUARDANDO APROVAÇÃO">Aguardando Aprovação</option>
                <option value="PENDENTE">Pendente</option>
                <option value="APROVADO">Aprovado</option>
                <option value="NÃO APROVADO">Não Aprovado</option>
                <option value="REJEITADO">Rejeitado</option>
              </select>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" onClick={() => { setSearchTerm(''); setFilterStatus('Todos'); setPage(1); fetchOrcamentos(1); }}>
                Limpar
              </Button>
              <Button className="gap-2" onClick={handleApplyFilters}>
                <Search className="h-4 w-4" />
                Buscar
              </Button>
              <Button onClick={handleOpenNew} className="gap-2 font-bold uppercase tracking-wider">
                <Plus className="h-5 w-5" />Novo
              </Button>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nº</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empresa</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Situação</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-2 text-center text-slate-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-2 text-center text-slate-400">Nenhum orçamento encontrado.</td></tr>
              ) : filtered.map(orc => (
                <tr key={orc.idorcamento} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-4 py-2">
                    <span className="text-xs font-bold text-[#B21212]">#{orc.idorcamento}</span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">{orc.cliente_rel?.nome || orc.nome || '—'}</span>
                      {orc.cliente_rel?.nomefantasia && <span className="text-xs text-slate-300">{orc.cliente_rel.nomefantasia}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-xs text-slate-400">{orc.empresa_rel?.nomefantasia || orc.empresa_rel?.nome || '—'}</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">{orc.data || '—'}</td>
                  <td className="px-4 py-2">
                    <span className="text-xs font-bold text-slate-700">{fmt(Number(orc.total || 0))}</span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={cn('inline-flex px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border', situacaoColors[orc.situacao] || situacaoColors['PENDENTE'])}>
                      {situacaoLabel[orc.situacao] || orc.situacao}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => { setDeleteId(orc.idorcamento); setDeleteError(null); }} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => openModal(orc, true)} title="Visualizar"><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => window.open(`/api/orcamentos/${orc.idorcamento}/print`, '_blank')} title="Imprimir"><Printer className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => openModal(orc, false)} title="Editar"><Edit2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {totalRecords === 0 ? 'Nenhum orçamento encontrado' : `Exibindo ${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, totalRecords)} de ${totalRecords} orçamentos`}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="h-4 w-4" /></Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | '...')[]>((acc, p, idx, arr) => { if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...'); acc.push(p); return acc; }, [])
                  .map((p, idx) => p === '...'
                    ? <span key={`e${idx}`} className="px-1 text-xs text-slate-400">...</span>
                    : <Button key={p} variant={p === page ? 'primary' : 'outline'} className="h-8 w-8 p-0 text-xs font-bold" onClick={() => setPage(p as number)}>{p}</Button>
                  )}
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal Principal ─────────────────────────────────────────────────── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isViewOnly ? `Visualizar Orçamento #${editingId}` : (editingId ? `Editar Orçamento #${editingId}` : 'Novo Orçamento')}
        className="max-w-5xl"
        footer={
          isViewOnly ? (
            <Button onClick={() => setIsModalOpen(false)} className="px-8">OK</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Salvar Orçamento')}</Button>
            </>
          )
        }
      >
        <div className="space-y-5">

          {/* Informações Gerais */}
          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]" />Informações Gerais
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-[1.8fr_0.6fr_0.6fr] gap-3">
              {/* Empresa */}
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Empresa *</label>
                <select
                  className={selClass(isViewOnly)}
                  value={formData.idempresa}
                  onChange={e => setFormData(p => ({ ...p, idempresa: Number(e.target.value) }))}
                  disabled={isViewOnly}
                >
                  <option value={0}>Selecione...</option>
                  {empresas.map(emp => (
                    <option key={emp.idempresa} value={emp.idempresa}>{emp.nomefantasia || emp.nome}</option>
                  ))}
                </select>
              </div>

              <Input
                label="Data"
                type="date"
                value={formData.data}
                onChange={e => setFormData(p => ({ ...p, data: e.target.value }))}
                disabled={isViewOnly}
              />

              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Situação</label>
                <select
                  className={selClass(isViewOnly)}
                  value={formData.situacao}
                  onChange={e => setFormData(p => ({ ...p, situacao: e.target.value }))}
                  disabled={isViewOnly}
                >
                  <option value="AGUARDANDO APROVAÇÃO">Aguardando Aprovação</option>
                  <option value="PENDENTE">Pendente</option>
                  <option value="APROVADO">Aprovado</option>
                  <option value="NÃO APROVADO">Não Aprovado</option>
                  <option value="REJEITADO">Rejeitado</option>
                </select>
              </div>
            </div>
          </section>

          {/* Dados do Cliente */}
          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]" />Dados do Cliente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-3 flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Cliente</label>
                <ClienteAutocomplete
                  value={formData.idcliente}
                  displayName={formData.nome}
                  onChange={autoFillCliente}
                  disabled={isViewOnly}
                  placeholder="Digite 2+ caracteres para buscar..."
                />
              </div>
              <div className="md:col-span-2">
                <Input label="Nome / Razão Social" placeholder="Nome completo ou razão social" value={formData.nome} onChange={e => setFormData(p => ({ ...p, nome: e.target.value }))} disabled={isViewOnly} />
              </div>
              <Input label="CNPJ / CPF" placeholder="00.000.000/0000-00" value={formData.cnpj_cpf} onChange={e => setFormData(p => ({ ...p, cnpj_cpf: e.target.value }))} disabled={isViewOnly} />
              <Input label="Telefone" placeholder="(00) 00000-0000" value={formData.fone} onChange={e => setFormData(p => ({ ...p, fone: e.target.value }))} disabled={isViewOnly} />
              <Input label="E-mail" type="email" placeholder="cliente@email.com" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} disabled={isViewOnly} />
              <Input label="Contato" placeholder="Nome da pessoa de contato" value={formData.contato} onChange={e => setFormData(p => ({ ...p, contato: e.target.value }))} disabled={isViewOnly} />
            </div>
          </section>

          {/* Endereço */}
          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]" />Endereço de Faturamento
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input label="CEP" value={formData.cep} onChange={e => setFormData(p => ({ ...p, cep: e.target.value.replace(/\D/g, '') }))} disabled={isViewOnly} />
              <div className="md:col-span-3">
                <Input label="Logradouro" placeholder="Rua, Av., etc." value={formData.endereco} onChange={e => setFormData(p => ({ ...p, endereco: e.target.value }))} disabled={isViewOnly} />
              </div>
              {/* Estado */}
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Estado</label>
                <select
                  className={selClass(isViewOnly)}
                  value={estadoFiltro}
                  onChange={e => { setEstadoFiltro(e.target.value); setFormData(p => ({ ...p, cidade: '' })); }}
                  disabled={isViewOnly}
                >
                  <option value="">Selecione...</option>
                  {estados.map(e => <option key={e.idestado} value={e.idestado}>{e.idestado} — {e.nome}</option>)}
                </select>
              </div>
              {/* Cidade */}
              <div className="md:col-span-2 flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Cidade</label>
                <select
                  className={selClass(isViewOnly)}
                  value={formData.cidade}
                  onChange={e => setFormData(p => ({ ...p, cidade: e.target.value }))}
                  disabled={isViewOnly || !estadoFiltro}
                >
                  <option value="">{estadoFiltro ? 'Selecione...' : 'Selecione o estado primeiro'}</option>
                  {cidadesFiltradas.map(c => <option key={c.idcidade} value={c.nome}>{c.nome}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Localização e Detalhes */}
          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]" />Localização e Detalhes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Local do Serviço" value={formData.local_servico} onChange={e => setFormData(p => ({ ...p, local_servico: e.target.value }))} disabled={isViewOnly} />
              <Input label="Local de Entrega" value={formData.local_entrega} onChange={e => setFormData(p => ({ ...p, local_entrega: e.target.value }))} disabled={isViewOnly} />
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Descrição</label>
                  {!isViewOnly && (
                    <button
                      type="button"
                      onClick={handleOpenTextoModal}
                      className="text-[#B21212] hover:text-[#8e0e0e] flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                    >
                      <Sparkles className="h-3 w-3" />Padrão
                    </button>
                  )}
                </div>
                <textarea
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 min-h-[60px] disabled:bg-slate-50"
                  value={formData.descricao}
                  onChange={e => setFormData(p => ({ ...p, descricao: e.target.value }))}
                  disabled={isViewOnly}
                />
              </div>
            </div>
          </section>

          {/* Serviços */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]" />Serviços do Orçamento
              </h3>
              {!isViewOnly && (
                <Button variant="outline" size="sm" onClick={addService} className="h-8 gap-1 text-[10px] font-bold uppercase tracking-wider">
                  <Plus className="h-3 w-3" />Adicionar Serviço
                </Button>
              )}
            </div>
            <div className="border border-slate-100 rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-44">Equipamento</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-36">Serviço</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-20">Unid.</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-16">Qtd</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-28">Vlr Unit</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-28">Vlr Total</th>
                    {!isViewOnly && <th className="px-3 py-2 w-10" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {services.map(s => (
                    <tr key={s._tempId}>
                      {/* Equipamento */}
                      <td className="px-3 py-2">
                        <EquipamentoAutocomplete
                          value={s.idequipamento}
                          displayName={s.equipamento_nome}
                          onChange={(eq: EquipamentoOption | null) => {
                            setServices(prev => prev.map(r => r._tempId !== s._tempId ? r : {
                              ...r,
                              idequipamento: eq?.idequipamento ?? 0,
                              equipamento_nome: eq ? (eq.placa ? `${eq.nome} — ${eq.placa}` : eq.nome) : '',
                            }));
                          }}
                          disabled={isViewOnly}
                          placeholder="Buscar equipamento..."
                        />
                      </td>
                      {/* Serviço oferecido */}
                      <td className="px-3 py-2">
                        <select
                          className={selInlineClass(isViewOnly)}
                          value={s.nome_servico}
                          onChange={e => updateService(s._tempId, 'nome_servico', e.target.value)}
                          disabled={isViewOnly}
                        >
                          <option value="">— Selecione —</option>
                          {servicos.map(sv => (
                            <option key={sv.nome} value={sv.nome}>{sv.nome}</option>
                          ))}
                        </select>
                      </td>
                      {/* Unidade */}
                      <td className="px-3 py-2">
                        <input
                          className="w-full bg-transparent outline-none border-b border-transparent focus:border-[#B21212]/30 py-1 text-sm"
                          placeholder="UN"
                          value={s.unidade}
                          onChange={e => updateService(s._tempId, 'unidade', e.target.value)}
                          disabled={isViewOnly}
                        />
                      </td>
                      {/* Quantidade */}
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          className="w-full bg-transparent outline-none border-b border-transparent focus:border-[#B21212]/30 py-1 text-sm"
                          value={s.quantidade}
                          onChange={e => updateService(s._tempId, 'quantidade', parseFloat(e.target.value) || 0)}
                          disabled={isViewOnly}
                        />
                      </td>
                      {/* Valor Unitário */}
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          className="w-full bg-transparent outline-none border-b border-transparent focus:border-[#B21212]/30 py-1 text-sm"
                          value={s.valor_unitario}
                          onChange={e => updateService(s._tempId, 'valor_unitario', parseFloat(e.target.value) || 0)}
                          disabled={isViewOnly}
                        />
                      </td>
                      {/* Valor Total */}
                      <td className="px-3 py-2 font-bold text-slate-700 text-sm">
                        {fmt(s.valor_total)}
                      </td>
                      {!isViewOnly && (
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => removeService(s._tempId)} className="text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {services.length === 0 && (
                    <tr>
                      <td colSpan={isViewOnly ? 6 : 7} className="px-4 py-8 text-center text-slate-400 italic">
                        Nenhum serviço adicionado.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-50/50 font-bold border-t border-slate-100">
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-right text-[10px] uppercase tracking-widest text-slate-500">Total do Orçamento</td>
                    <td className="px-3 py-3 text-[#B21212] text-lg">{fmt(calcTotal())}</td>
                    {!isViewOnly && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* Condições */}
          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]" />Condições e Responsável
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Forma de Pagamento</label>
                <select
                  className={selClass(isViewOnly)}
                  value={formData.forma_pagamento}
                  onChange={e => setFormData(p => ({ ...p, forma_pagamento: e.target.value }))}
                  disabled={isViewOnly}
                >
                  <option value="A VISTA">A Vista</option>
                  <option value="A COMBINAR">A Combinar</option>
                  <option value="ANTECIPADO">Antecipado</option>
                  <option value="15 DIAS">15 Dias</option>
                  <option value="21 DIAS">21 Dias</option>
                  <option value="30 DIAS">30 Dias</option>
                  <option value="30/45 DIAS">30/45 Dias</option>
                  <option value="30/45/60/90 DIAS">30/45/60/90 Dias</option>
                  <option value="90 DIAS">90 Dias</option>
                  <option value="120 DIAS">120 Dias</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Responsável pelo Atendimento</label>
                <select
                  className={selClass(isViewOnly)}
                  value={formData.idfuncionario}
                  onChange={e => setFormData(p => ({ ...p, idfuncionario: Number(e.target.value) }))}
                  disabled={isViewOnly}
                >
                  <option value={0}>Selecione o responsável...</option>
                  {funcionarios.map(f => (
                    <option key={f.idfuncionario} value={f.idfuncionario}>{f.nome}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Cláusula de Orçamento</label>
                <select
                  className={selClass(isViewOnly)}
                  value={formData.idcontrato}
                  onChange={e => setFormData(p => ({ ...p, idcontrato: Number(e.target.value) }))}
                  disabled={isViewOnly}
                >
                  <option value={0}>Nenhuma cláusula</option>
                  {contratos.map(c => (
                    <option key={c.idcontrato} value={c.idcontrato}>{c.descricao}</option>
                  ))}
                </select>
              </div>
            </div>
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-xs text-red-600 font-medium">{error}</p>
              </div>
            )}
          </section>

        </div>
      </Modal>

      {/* Modal Textos Padrão */}
      <Modal
        isOpen={isTextoModalOpen}
        onClose={() => setIsTextoModalOpen(false)}
        title="Selecionar Texto Padrão"
        className="max-w-2xl"
        footer={<Button variant="outline" onClick={() => setIsTextoModalOpen(false)}>Cancelar</Button>}
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {textosPadrao.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Nenhum texto padrão cadastrado.</p>
          ) : textosPadrao.map(t => (
            <button
              key={t.idtexto}
              onClick={() => handleSelectTexto(t.texto)}
              className="w-full text-left p-4 rounded-lg border border-slate-100 hover:border-[#B21212]/30 hover:bg-red-50/30 transition-all group"
            >
              <p className="text-sm text-slate-600 group-hover:text-slate-800 leading-relaxed">{t.texto}</p>
            </button>
          ))}
        </div>
      </Modal>

      {/* Modal Exclusão */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Confirmar Exclusão"
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">Confirmar Exclusão</Button>
          </>
        }
      >
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-800">Você tem certeza?</h4>
            <p className="text-sm text-slate-500 mt-1">
              Deseja realmente excluir o orçamento <span className="font-bold text-slate-700">#{deleteId}</span>? Esta ação não pode ser desfeita.
            </p>
          </div>
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
