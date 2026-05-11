import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Plus, Eye, Edit2, Trash2, X, Briefcase, List, Search, Loader2 } from 'lucide-react';
import { DataGrid, GridColumn } from '../components/ui/DataGrid';
import { Supplier, Estado, FornecedorRamo, FornecedorAtividade, ForRamo, ForAtividade } from '../types';
import { cn } from '../utils/cn';
import { useCidadeBairro } from '../utils/useCidadeBairro';

export function FornecedorPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierList, setSupplierList] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [ramoFilter, setRamoFilter] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const PER_PAGE = 500;
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { return () => setIsSaving(false); }, []);
  const [activeTab, setActiveTab] = useState<'geral' | 'atuacao'>('geral');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [supplierPurchasesCount, setSupplierPurchasesCount] = useState(0);
  const [isCheckingPurchases, setIsCheckingPurchases] = useState(false);

  // Auxiliary data
  const [estados, setEstados] = useState<Estado[]>([]);
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [allRamos, setAllRamos] = useState<FornecedorRamo[]>([]);
  const [allAtividades, setAllAtividades] = useState<FornecedorAtividade[]>([]);

  // Relationship data for current supplier
  const [ramosFornecedor, setRamosFornecedor] = useState<ForRamo[]>([]);
  const [atividadesFornecedor, setAtividadesFornecedor] = useState<ForAtividade[]>([]);
  
  // Relationship Modals
  const [isRamoModalOpen, setIsRamoModalOpen] = useState(false);
  const [isAtividadeModalOpen, setIsAtividadeModalOpen] = useState(false);
  const [newRamoId, setNewRamoId] = useState<number>(0);
  const [newAtividadeId, setNewAtividadeId] = useState<number>(0);

  const fetchSuppliers = useCallback(async (p: number) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('skip', String((p - 1) * PER_PAGE));
      params.set('limit', String(PER_PAGE));
      if (searchTerm) params.set('nome', searchTerm);
      if (ramoFilter) params.set('idramo', String(ramoFilter));
      const response = await fetch(`/api/fornecedores?${params}`);
      if (!response.ok) throw new Error('Não foi possível carregar os fornecedores.');
      const json = await response.json();
      const data = Array.isArray(json) ? json : (json.data ?? []);
      setSupplierList(data.map((f: any) => ({
        ...f,
        id: String(f.idfornecedor),
        idfornecedor: String(f.idfornecedor)
      })));
      setTotalRecords(json.total ?? data.length);
    } catch (err) {
      console.error('Erro ao carregar fornecedores:', err);
      setError('Erro ao carregar a lista de fornecedores.');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, ramoFilter]);

  const fetchAuxiliaryData = async () => {
    try {
      const [resEstados, resRamos, resAtividades] = await Promise.all([
        fetch('/api/estados'),
        fetch('/api/fornecedor-ramo'),
        fetch('/api/atividade-fornecedor'),
      ]);
      if (resEstados.ok)     setEstados(await resEstados.json());
      if (resRamos.ok)       setAllRamos(await resRamos.json());
      if (resAtividades.ok)  setAllAtividades(await resAtividades.json());
    } catch (err) {
      console.error('Erro ao carregar dados auxiliares:', err);
    }
  };

  const fetchSupplierRelations = async (id: string | number) => {
    try {
      const [resRamos, resAtividades] = await Promise.all([
        fetch(`/api/fornecedores/${id}/ramos`),
        fetch(`/api/fornecedores/${id}/atividades`)
      ]);
      if (resRamos.ok) setRamosFornecedor(await resRamos.json());
      if (resAtividades.ok) setAtividadesFornecedor(await resAtividades.json());
    } catch (err) {
      console.error('Erro ao carregar relações do fornecedor:', err);
    }
  };

  useEffect(() => { fetchSuppliers(page); }, [page, fetchSuppliers]);

  useEffect(() => {
    fetchAuxiliaryData();
  }, []);

  const handleFilter = () => {
    if (page === 1) fetchSuppliers(1);
    else setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalRecords / PER_PAGE));


  const initialFormData: Omit<Supplier, 'idfornecedor'> = {
    nome: '',
    nomefantasia: '',
    data_cadastro: new Date().toISOString().split('T')[0],
    cnpj_cpf: '',
    ie_rg: '',
    tipo: 'PJ',
    observacao: '',
    site: '',
    contato: '',
    categoria: '',
    cep: '',
    idcidade: 0,
    idbairro: 0,
    logradouro: '',
    tipo_logradouro: 'RUA',
    idestado: '',
    numero: '',
    complemento: '',
    status: 'ATIVO'
  };

  const [formData, setFormData] = useState<Omit<Supplier, 'idfornecedor'>>(initialFormData);

  // Cidades e bairros carregados dinamicamente
  const { cidades, bairros } = useCidadeBairro(
    isModalOpen ? (formData as any).idestado || null : null,
    isModalOpen ? (formData as any).idcidade || null : null,
  );

  const handleCepLookup = async (cepValue: string) => {
    const cepLimpo = cepValue.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    setIsCepLoading(true);
    try {
      const response = await fetch(`/api/cep/${cepLimpo}`);
      if (!response.ok) return;
      const data = await response.json();

      const uf = data.uf || '';
      const nomeCidade = (data.localidade || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const nomeBairro = (data.bairro || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const logradouro = data.logradouro || '';

      let idcidade = (formData as any).idcidade || 0;
      let idbairro = 0;
      if (uf) {
        try {
          const cidadesRes = await fetch(`/api/cidades?idestado=${uf}`);
          const cidadesData = cidadesRes.ok ? await cidadesRes.json() : [];
          const cidadeMatch = cidadesData.find((c: any) =>
            c.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(nomeCidade)
          );
          if (cidadeMatch) {
            idcidade = cidadeMatch.idcidade;
            if (nomeBairro) {
              const bairrosRes = await fetch(`/api/bairros?idcidade=${cidadeMatch.idcidade}`);
              const bairrosData = bairrosRes.ok ? await bairrosRes.json() : [];
              const bairroMatch = bairrosData.find((b: any) =>
                b.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(nomeBairro)
              );
              if (bairroMatch) idbairro = bairroMatch.idbairro;
            }
          }
        } catch { /* silencioso */ }
      }

      setFormData(prev => ({
        ...prev,
        idestado: uf || prev.idestado,
        idcidade: idcidade || prev.idcidade,
        idbairro,
        logradouro: logradouro || prev.logradouro,
      }));
    } catch {
      // silencioso — usuário pode preencher manualmente
    } finally {
      setIsCepLoading(false);
    }
  };

  const handleOpenNewModal = () => {
    setEditingSupplier(null);
    setIsViewOnly(false);
    setFormData(initialFormData);
    setRamosFornecedor([]);
    setAtividadesFornecedor([]);
    setError(null);
    setActiveTab('geral');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsViewOnly(false);
    setFormData({ ...supplier });
    fetchSupplierRelations(supplier.idfornecedor);
    setError(null);
    setActiveTab('geral');
    setIsModalOpen(true);
  };

  const handleOpenViewModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsViewOnly(true);
    setFormData({ ...supplier });
    fetchSupplierRelations(supplier.idfornecedor);
    setError(null);
    setActiveTab('geral');
    setIsModalOpen(true);
  };

  const handleDeleteRequest = async (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setDeleteError(null);
    setSupplierPurchasesCount(0);
    setIsCheckingPurchases(true);
    setIsDeleteModalOpen(true);
    try {
      const res = await fetch(`/api/fornecedores/${supplier.idfornecedor}/compras-count`);
      if (res.ok) {
        const data = await res.json();
        setSupplierPurchasesCount(data.count ?? 0);
      }
    } catch {
      // ignora — o backend ainda bloqueia a exclusão se necessário
    } finally {
      setIsCheckingPurchases(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!supplierToDelete) return;

    try {
      const response = await fetch(`/api/fornecedores/${supplierToDelete.idfornecedor}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setIsDeleteModalOpen(false);
        setSupplierToDelete(null);
        setSuccessMessage('Fornecedor excluído com sucesso!');
        await fetchSuppliers(page);
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        const errorData = await response.json();
        setDeleteError(errorData.detail || 'Não foi possível excluir o fornecedor.');
      }
    } catch (err) {
      console.error('Erro ao excluir:', err);
      setDeleteError('Erro de conexão com o servidor.');
    }
  };

  const handleSave = async () => {
    if (!formData.nome) {
      setError('Por favor, preencha a Razão Social / Nome.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const url = editingSupplier
        ? `/api/fornecedores/${parseInt(editingSupplier.idfornecedor)}`
        : '/api/fornecedores';
      
      const method = editingSupplier ? 'PUT' : 'POST';
      
      const { id, idfornecedor, ...baseData } = formData as any;
      
      // Sanitiza FKs: converte 0, "", "0", null, undefined em null para evitar erro 422
      const parseId = (val: any): number | null => {
        if (!val || val === "" || val === 0 || val === "0") return null;
        const n = Number(val);
        return isNaN(n) ? null : n;
      };

      const payload = {
        ...baseData,
        idcidade: parseId(formData.idcidade),
        idbairro: parseId(formData.idbairro),
        idestado: formData.idestado || null,
        data_cadastro: formData.data_cadastro || null
      };
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let message = 'Falha ao salvar fornecedor.';
        try {
          const json = JSON.parse(errorText);
          message = json.detail || message;
        } catch(e) {}
        throw new Error(message);
      }

      const savedSupplier = await response.json();
      await fetchSuppliers(page);
      setSuccessMessage(editingSupplier ? 'Fornecedor atualizado com sucesso!' : 'Fornecedor cadastrado com sucesso!');
      
      if (!editingSupplier) {
        const normalized = {
          ...savedSupplier,
          id: String(savedSupplier.idfornecedor),
          idfornecedor: String(savedSupplier.idfornecedor),
        };
        setEditingSupplier(normalized);
        setFormData({ ...normalized });
      } else {
        setEditingSupplier(null);
        setIsModalOpen(false);
      }
      
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      setError(err.message || 'Erro ao conectar com o servidor.');
    } finally {
      setIsSaving(false);
    }
  };

  // Relation Management
  const handleAddRamo = async () => {
    if (!editingSupplier || !newRamoId) return;
    try {
      const response = await fetch(`/api/fornecedores/${editingSupplier.idfornecedor}/ramos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idfornecedor: parseInt(editingSupplier.idfornecedor), idramo: newRamoId })
      });
      if (response.ok) {
        await fetchSupplierRelations(editingSupplier.idfornecedor);
        setIsRamoModalOpen(false);
        setNewRamoId(0);
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteRamo = async (idforramo: number) => {
    try {
      const response = await fetch(`/api/fornecedores/ramos/${idforramo}`, { method: 'DELETE' });
      if (response.ok && editingSupplier) await fetchSupplierRelations(editingSupplier.idfornecedor);
    } catch (err) { console.error(err); }
  };

  const handleAddAtividade = async () => {
    if (!editingSupplier || !newAtividadeId) return;
    try {
      const response = await fetch(`/api/fornecedores/${editingSupplier.idfornecedor}/atividades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idfornecedor: parseInt(editingSupplier.idfornecedor), idatividade: newAtividadeId })
      });
      if (response.ok) {
        await fetchSupplierRelations(editingSupplier.idfornecedor);
        setIsAtividadeModalOpen(false);
        setNewAtividadeId(0);
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteAtividade = async (idforatividade: number) => {
    try {
      const response = await fetch(`/api/fornecedores/atividades/${idforatividade}`, { method: 'DELETE' });
      if (response.ok && editingSupplier) await fetchSupplierRelations(editingSupplier.idfornecedor);
    } catch (err) { console.error(err); }
  };


  return (
    <div className="flex flex-col h-full relative">
      <Header title="Cadastro de Fornecedores" />
      
      {isSaving && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-[110] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-[#B21212]/20 border-t-[#B21212] rounded-full animate-spin"></div>
            <span className="text-sm font-bold text-slate-600 animate-pulse uppercase tracking-widest">Salvando...</span>
          </div>
        </div>
      )}

      {(successMessage || error) && (
        <div className={cn(
          "fixed top-4 right-4 z-[120] p-4 rounded-lg shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-right-5",
          successMessage ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"
        )}>
          {successMessage ? (
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Plus className="h-4 w-4 text-emerald-600" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
              <X className="h-4 w-4 text-red-600" />
            </div>
          )}
          <div>
            <p className={cn("text-sm font-bold", successMessage ? "text-emerald-800" : "text-red-800")}>
              {successMessage ? "Sucesso!" : "Ocorreu um erro"}
            </p>
            <p className={cn("text-xs font-medium", successMessage ? "text-emerald-600/80" : "text-red-600/80")}>
              {successMessage || error}
            </p>
          </div>
          <button onClick={() => { setSuccessMessage(null); setError(null); }} className="ml-2 hover:opacity-70 transition-opacity">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      )}

      <div className="p-5 space-y-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input label="Nome / Fantasia / CNPJ" placeholder="Buscar fornecedor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleFilter()} />
            </div>
            <div className="w-52">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Ramo de Atividade</label>
              <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20" value={ramoFilter} onChange={(e) => setRamoFilter(Number(e.target.value))}>
                <option value={0}>Todos</option>
                {allRamos.map(r => (
                  <option key={r.idramo} value={r.idramo}>{r.descricao}</option>
                ))}
              </select>
            </div>
            <Button variant="outline" className="gap-2" onClick={handleFilter}>
              <Search className="h-4 w-4" />Filtrar
            </Button>
            <Button variant="secondary" className="gap-2" onClick={() => { setSearchTerm(''); setRamoFilter(0); if (page === 1) fetchSuppliers(1); else setPage(1); }}>
              <X className="h-4 w-4" />Limpar
            </Button>
            <Button onClick={handleOpenNewModal} className="gap-2 font-bold uppercase tracking-wider">
              <Plus className="h-5 w-5" />Novo
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-6 text-center text-slate-400 text-sm">
            Carregando...
          </div>
        ) : (() => {
          const cols: GridColumn<Supplier>[] = [
            { header: 'ID', render: s => <span className="text-xs font-bold text-[#B21212]">{s.idfornecedor}</span> },
            {
              header: 'Fornecedor',
              render: s => (
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700">{s.nome}</span>
                  <span className="text-xs text-slate-400">{s.nomefantasia}</span>
                </div>
              ),
            },
            { header: 'CNPJ/CPF', render: s => <span className="text-xs text-slate-500 font-mono">{s.cnpj_cpf}</span> },
            {
              header: 'Categoria',
              render: s => (
                <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                  {s.categoria}
                </span>
              ),
            },
            {
              header: 'Ações',
              headerClass: 'px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right',
              cellClass: 'px-4 py-2 text-right',
              render: s => (
                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDeleteRequest(s)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleOpenViewModal(s)}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleOpenEditModal(s)} title="Editar"><Edit2 className="h-4 w-4" /></Button>
                </div>
              ),
            },
          ];
          return (
            <DataGrid data={supplierList} columns={cols} getKey={s => s.id} emptyMessage="Nenhum fornecedor encontrado." />
          );
        })()}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={isViewOnly ? `Visualizar Fornecedor ${formData.nome}` : (editingSupplier ? `Editar Fornecedor ${formData.nome}` : "Novo Fornecedor")}
        className="max-w-6xl"
        footer={
          isViewOnly ? (
            <Button onClick={() => setIsModalOpen(false)} className="px-8">OK</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar Fornecedor'}</Button>
            </>
          )
        }
      >
        <div className="flex flex-col h-[70vh]">
          {/* Custom Tab Header */}
          <div className="flex border-b border-slate-100 mb-6 bg-slate-50/30">
            <button
              onClick={() => setActiveTab('geral')}
              className={cn(
                "px-6 py-3 text-xs font-black uppercase tracking-widest transition-all relative",
                activeTab === 'geral' 
                  ? "text-[#B21212] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#B21212]" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              1. Dados Gerais
            </button>
            <button
              onClick={() => {
                setActiveTab('atuacao');
                if (editingSupplier) fetchSupplierRelations(editingSupplier.idfornecedor);
              }}
              className={cn(
                "px-6 py-3 text-xs font-black uppercase tracking-widest transition-all relative",
                activeTab === 'atuacao' 
                  ? "text-[#B21212] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#B21212]" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              2. Ramos e Atividades
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-5 pb-6">
            {activeTab === 'geral' ? (
              <>
                {/* Identificação Básica */}
                <section>
                  <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>Identificação Básica
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2"><Input label="Razão Social / Nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} disabled={isViewOnly} /></div>
                    <div className="md:col-span-2"><Input label="Nome Fantasia" value={formData.nomefantasia} onChange={(e) => setFormData({ ...formData, nomefantasia: e.target.value })} disabled={isViewOnly} /></div>
                    <Input label="CNPJ / CPF" value={formData.cnpj_cpf} onChange={(e) => setFormData({ ...formData, cnpj_cpf: e.target.value })} disabled={isViewOnly} />
                    <Input label="I.E. / RG" value={formData.ie_rg} onChange={(e) => setFormData({ ...formData, ie_rg: e.target.value })} disabled={isViewOnly} />
                    <div className="flex flex-col">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Tipo</label>
                      <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50" value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })} disabled={isViewOnly}>
                        <option value="PJ">Pessoa Jurídica</option>
                        <option value="PF">Pessoa Física</option>
                      </select>
                    </div>
                    <Input label="Data de Cadastro" type="date" value={formData.data_cadastro} onChange={(e) => setFormData({ ...formData, data_cadastro: e.target.value })} disabled={isViewOnly} />
                    <div className="md:col-span-2"><Input label="Site" placeholder="www.exemplo.com.br" value={formData.site} onChange={(e) => setFormData({ ...formData, site: e.target.value })} disabled={isViewOnly} /></div>
                    <Input label="Contato Principal" value={formData.contato} onChange={(e) => setFormData({ ...formData, contato: e.target.value })} disabled={isViewOnly} />
                    <Input label="Categoria" value={formData.categoria} onChange={(e) => setFormData({ ...formData, categoria: e.target.value })} disabled={isViewOnly} />
                  </div>
                </section>

                {/* Endereço e Contato */}
                <section>
                  <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>Endereço e Contato
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {/* Linha 1: CEP | Estado | Cidade (col-2) */}
                    <div className="flex flex-col">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">CEP</label>
                      <div className="relative flex items-center">
                        <input
                          className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50"
                          value={formData.cep}
                          onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                          onBlur={(e) => !isViewOnly && handleCepLookup(e.target.value)}
                          disabled={isViewOnly}
                          placeholder="00000-000"
                          maxLength={9}
                        />
                        <div className="absolute right-2.5 text-slate-400 pointer-events-none">
                          {isCepLoading
                            ? <Loader2 className="h-4 w-4 animate-spin text-[#B21212]" />
                            : <Search className="h-3.5 w-3.5" />
                          }
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Estado</label>
                      <select
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50"
                        value={formData.idestado || ''}
                        onChange={(e) => setFormData({ ...formData, idestado: e.target.value, idcidade: 0, idbairro: 0 })}
                        disabled={isViewOnly}
                      >
                        <option value="">UF</option>
                        {estados.map(st => <option key={st.idestado} value={st.idestado}>{st.idestado} - {st.nome}</option>)}
                      </select>
                    </div>

                    <div className="md:col-span-2 flex flex-col">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Cidade</label>
                      <select
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50"
                        value={formData.idcidade || ''}
                        onChange={(e) => setFormData({ ...formData, idcidade: parseInt(e.target.value) || 0, idbairro: 0 })}
                        disabled={isViewOnly}
                      >
                        <option value="">Selecione...</option>
                        {cidades.map(c => <option key={c.idcidade} value={c.idcidade}>{c.nome}</option>)}
                      </select>
                    </div>

                    {/* Linha 2: Bairro (col-2) | Logradouro (col-2) */}
                    <div className="md:col-span-2 flex flex-col">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Bairro</label>
                      <select
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50"
                        value={formData.idbairro || ''}
                        onChange={(e) => setFormData({ ...formData, idbairro: parseInt(e.target.value) || 0 })}
                        disabled={isViewOnly}
                      >
                        <option value="">Selecione...</option>
                        {bairros.map(b => <option key={b.idbairro} value={b.idbairro}>{b.nome}</option>)}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <Input label="Logradouro" value={formData.logradouro} onChange={(e) => setFormData({ ...formData, logradouro: e.target.value })} disabled={isViewOnly} />
                    </div>

                    {/* Linha 3: Número | Complemento (col-2) | Tipo Logradouro */}
                    <Input label="Número" value={formData.numero} onChange={(e) => setFormData({ ...formData, numero: e.target.value })} disabled={isViewOnly} />
                    <div className="md:col-span-2">
                      <Input label="Complemento" value={formData.complemento} onChange={(e) => setFormData({ ...formData, complemento: e.target.value })} disabled={isViewOnly} />
                    </div>
                    <Input label="Tipo Logradouro" value={formData.tipo_logradouro} onChange={(e) => setFormData({ ...formData, tipo_logradouro: e.target.value })} disabled={isViewOnly} />
                  </div>
                </section>
              </>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Grid de Ramos */}
                <section className="bg-slate-50/50 rounded-xl border border-slate-200 p-6 relative min-h-[300px]">
                  {!editingSupplier && (
                    <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-3 py-2 rounded-full border border-slate-100 shadow-sm text-center max-w-[200px]">
                        Salve os dados básicos na aba anterior para habilitar o vínculo
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-[#B21212]" />
                      Ramos de Atuação
                    </h3>
                    {!isViewOnly && (
                      <Button size="sm" className="h-8 gap-2" onClick={() => setIsRamoModalOpen(true)} disabled={!editingSupplier}>
                        <Plus className="h-4 w-4" /> Incluir Ramo
                      </Button>
                    )}
                  </div>
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 font-bold">
                          <th className="px-4 py-3 uppercase tracking-wider">Descrição</th>
                          {!isViewOnly && <th className="px-4 py-3 text-right">Ações</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ramosFornecedor.length === 0 ? (
                          <tr><td colSpan={2} className="px-4 py-6 text-center text-slate-400 italic">Nenhum ramo vinculado.</td></tr>
                        ) : (
                          ramosFornecedor.map((item) => (
                            <tr key={item.idforramo} className="hover:bg-slate-50 transition-colors group">
                              <td className="px-4 py-3 font-medium text-slate-600">{item.ramo?.descricao}</td>
                              {!isViewOnly && (
                                <td className="px-4 py-3 text-right">
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-600" onClick={() => handleDeleteRamo(item.idforramo)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Grid de Atividades */}
                <section className="bg-slate-50/50 rounded-xl border border-slate-200 p-6 relative min-h-[300px]">
                  {!editingSupplier && (
                    <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-3 py-2 rounded-full border border-slate-100 shadow-sm text-center max-w-[200px]">
                        Salve os dados básicos na aba anterior para habilitar o vínculo
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <List className="h-4 w-4 text-[#B21212]" />
                      Atividades
                    </h3>
                    {!isViewOnly && (
                      <Button size="sm" className="h-8 gap-2" onClick={() => setIsAtividadeModalOpen(true)} disabled={!editingSupplier}>
                        <Plus className="h-4 w-4" /> Incluir Atividade
                      </Button>
                    )}
                  </div>
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 font-bold">
                          <th className="px-4 py-3 uppercase tracking-wider">Descrição</th>
                          {!isViewOnly && <th className="px-4 py-3 text-right">Ações</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {atividadesFornecedor.length === 0 ? (
                          <tr><td colSpan={2} className="px-4 py-6 text-center text-slate-400 italic">Nenhuma atividade vinculada.</td></tr>
                        ) : (
                          atividadesFornecedor.map((item) => (
                            <tr key={item.idforatividade} className="hover:bg-slate-50 transition-colors group">
                              <td className="px-4 py-3 font-medium text-slate-600">{item.atividade?.descricao}</td>
                              {!isViewOnly && (
                                <td className="px-4 py-3 text-right">
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-600" onClick={() => handleDeleteAtividade(item.idforatividade)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Relation Entry Modals */}
      <Modal isOpen={isRamoModalOpen} onClose={() => setIsRamoModalOpen(false)} title="Vincular Ramo" className="max-w-md" footer={<div className="flex gap-2"><Button variant="outline" onClick={() => setIsRamoModalOpen(false)}>Cancelar</Button><Button onClick={handleAddRamo}>Confirmar</Button></div>}>
        <div className="p-2">
          <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Selecione o Ramo</label>
          <select className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:ring-2 focus:ring-[#B21212]/20 outline-none" value={newRamoId} onChange={(e) => setNewRamoId(parseInt(e.target.value))}>
            <option value={0}>Selecione...</option>
            {allRamos.map(r => <option key={r.idramo} value={r.idramo}>{r.descricao}</option>)}
          </select>
        </div>
      </Modal>

      <Modal isOpen={isAtividadeModalOpen} onClose={() => setIsAtividadeModalOpen(false)} title="Vincular Atividade" className="max-w-md" footer={<div className="flex gap-2"><Button variant="outline" onClick={() => setIsAtividadeModalOpen(false)}>Cancelar</Button><Button onClick={handleAddAtividade}>Confirmar</Button></div>}>
        <div className="p-2">
          <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Selecione a Atividade</label>
          <select className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:ring-2 focus:ring-[#B21212]/20 outline-none" value={newAtividadeId} onChange={(e) => setNewAtividadeId(parseInt(e.target.value))}>
            <option value={0}>Selecione...</option>
            {allAtividades.map(a => <option key={a.idatividade} value={a.idatividade}>{a.descricao}</option>)}
          </select>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirmar Exclusão"
        className="max-w-md"
        footer={
          <div className="flex gap-3 justify-end w-full">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} className="flex-1">Cancelar</Button>
            <Button
              variant="primary"
              onClick={handleConfirmDelete}
              disabled={isCheckingPurchases || supplierPurchasesCount > 0}
              className="flex-1 bg-red-600 hover:bg-red-700 border-red-600 shadow-md shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirmar Exclusão
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-red-600">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center"><Trash2 className="h-5 w-5" /></div>
            <h4 className="font-bold">Atenção!</h4>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Deseja realmente excluir o fornecedor <span className="font-bold text-slate-900">{supplierToDelete?.nome}</span>?
          </p>
          {isCheckingPurchases && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando compras vinculadas...
            </div>
          )}
          {!isCheckingPurchases && supplierPurchasesCount > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <span className="text-amber-600 text-xs font-bold uppercase tracking-wider">Exclusão bloqueada</span>
              <p className="text-xs text-amber-700">
                Este fornecedor possui <span className="font-bold">{supplierPurchasesCount} compra(s)</span> vinculada(s) e não pode ser excluído.
              </p>
            </div>
          )}
          {!isCheckingPurchases && supplierPurchasesCount === 0 && (
            <p className="text-xs text-slate-400">Esta ação não poderá ser desfeita.</p>
          )}
          {deleteError && <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-red-600 text-xs">{deleteError}</div>}
        </div>
      </Modal>
    </div>
  );
}
