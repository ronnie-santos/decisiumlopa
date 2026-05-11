import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Plus, Search, Eye, Edit2, Trash2, X, MapPin, Phone, Globe, User, List, Loader2, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import { DataGrid, GridColumn } from '../components/ui/DataGrid';
import { Client, ClientAddress, ClientContact, Estado, FormaContato } from '../types';
import { cn } from '../utils/cn';
import { useCidadeBairro } from '../utils/useCidadeBairro';

export function ClientePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientList, setClientList] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const PER_PAGE = 100;
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'geral' | 'enderecos' | 'contatos' | 'ordens'>('geral');

  // OS Tab
  interface OrdemOS {
    idordem: number;
    numero_os: number | null;
    data: string | null;
    valor_os: number | null;
    situacao: boolean;
    empresa_rel?: { nome: string | null; nomefantasia: string | null } | null;
  }
  const OS_PER_PAGE = 50;
  const [ordensCliente, setOrdensCliente] = useState<OrdemOS[]>([]);
  const [loadingOrdens, setLoadingOrdens] = useState(false);
  const [ordensPage, setOrdensPage] = useState(1);
  const [ordensTotalRecords, setOrdensTotalRecords] = useState(0);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Auxiliary data
  const [estados, setEstados] = useState<Estado[]>([]);
  const [formasContato, setFormasContato] = useState<FormaContato[]>([]);
  const [isCepLoading, setIsCepLoading] = useState(false);

  const fetchClients = useCallback(async (p: number) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('skip', String((p - 1) * PER_PAGE));
      params.set('limit', String(PER_PAGE));
      if (searchTerm)             params.set('nome', searchTerm);
      const response = await fetch(`/api/clientes?${params}`);
      if (!response.ok) throw new Error('Não foi possível carregar os clientes.');
      const json = await response.json();
      const data = Array.isArray(json) ? json : (json.data ?? []);
      setClientList(data.map((c: any) => ({
        ...c,
        id: String(c.idcliente),
        idcliente: String(c.idcliente)
      })));
      setTotalRecords(json.total ?? data.length);
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
      setError('Erro ao carregar a lista de clientes.');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm]);

  const fetchAuxiliaryData = async () => {
    try {
      const [resEstados, resFormas] = await Promise.all([
        fetch('/api/estados'),
        fetch('/api/formacontato'),
      ]);
      if (resEstados.ok) setEstados(await resEstados.json());
      if (resFormas.ok)  setFormasContato(await resFormas.json());
    } catch (err) {
      console.error('Erro ao carregar dados auxiliares:', err);
    }
  };

  useEffect(() => { fetchClients(page); }, [page, fetchClients]);

  useEffect(() => {
    if (activeTab === 'ordens' && editingClient) {
      setLoadingOrdens(true);
      const skip = (ordensPage - 1) * OS_PER_PAGE;
      fetch(`/api/ordens?idcliente=${editingClient.idcliente}&skip=${skip}&limit=${OS_PER_PAGE}`)
        .then(r => r.json())
        .then(json => {
          const data = Array.isArray(json.data) ? json.data : [];
          setOrdensCliente(data);
          setOrdensTotalRecords(json.total ?? data.length);
        })
        .catch(() => { setOrdensCliente([]); setOrdensTotalRecords(0); })
        .finally(() => setLoadingOrdens(false));
    }
  }, [activeTab, editingClient, ordensPage]);

  useEffect(() => {
    fetchAuxiliaryData();
  }, []);

  const handleFilter = () => {
    if (page === 1) fetchClients(1);
    else setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalRecords / PER_PAGE));

  const initialFormData: Omit<Client, 'idcliente'> = {
    nome: '',
    nomefantasia: '',
    data_cadastro: new Date().toISOString().split('T')[0],
    cnpj_cpf: '',
    ie_rg: '',
    tipo: 'PJ',
    observacao: '',
    site: '',
    contato: '',
    status: 'ATIVO',
    enderecos: [],
    contatos: []
  };

  const [formData, setFormData] = useState<Omit<Client, 'idcliente'>>(initialFormData);

  // Address Form State
  const initialAddress: Omit<ClientAddress, 'idcliend' | 'idcliente'> = {
    tipo_endereco: 'PRINCIPAL',
    tipo_logradouro: 'RUA',
    logradouro: '',
    numero: '',
    complemento: '',
    idbairro: null as any,
    idcidade: null as any,
    idestado: '',
    cep: ''
  };
  const [newAddress, setNewAddress] = useState<Omit<ClientAddress, 'idcliend' | 'idcliente'>>(initialAddress);
  const [editingAddressId, setEditingAddressId] = useState<string | number | null>(null);

  const { cidades, bairros } = useCidadeBairro(
    isAddressModalOpen ? newAddress.idestado : null,
    isAddressModalOpen ? newAddress.idcidade : null,
  );

  // Contact Form State
  const initialContact: Omit<ClientContact, 'idclienteforma' | 'idcliente'> = {
    idformacontato: 1,
    valor: '',
    observacao: '',
    zap: 'NÃO',
    aniversario: undefined as any
  };
  const [newContact, setNewContact] = useState<Omit<ClientContact, 'idclienteforma' | 'idcliente'>>(initialContact);
  const [editingContactId, setEditingContactId] = useState<string | number | null>(null);

  const handleOpenNewModal = () => {
    setEditingClient(null);
    setIsViewOnly(false);
    setFormData(initialFormData);
    setError(null);
    setActiveTab('geral');
    setOrdensCliente([]);
    setOrdensPage(1);
    setOrdensTotalRecords(0);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (client: Client) => {
    setEditingClient(client);
    setIsViewOnly(false);
    setFormData({ ...client });
    setError(null);
    setActiveTab('geral');
    setOrdensCliente([]);
    setOrdensPage(1);
    setOrdensTotalRecords(0);
    setIsModalOpen(true);
  };

  const handleOpenViewModal = (client: Client) => {
    setEditingClient(client);
    setIsViewOnly(true);
    setFormData({ ...client });
    setError(null);
    setActiveTab('geral');
    setOrdensCliente([]);
    setOrdensPage(1);
    setOrdensTotalRecords(0);
    setIsModalOpen(true);
  };

  const handleDeleteRequest = (client: Client) => {
    setClientToDelete(client);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!clientToDelete) return;

    try {
      const response = await fetch(`/api/clientes/${clientToDelete.idcliente}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setIsDeleteModalOpen(false);
        setClientToDelete(null);
        setSuccessMessage('Cliente excluído com sucesso!');
        fetchClients(page);
      } else {
        const errorData = await response.json();
        setDeleteError(errorData.detail || 'Não foi possível excluir o cliente.');
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

    // Limpeza de payload (Converter strings vazias em campos opcionais numéricos/datas para null)
    const cleanPayload = {
      ...formData,
      enderecos: (formData.enderecos || []).map(addr => {
        // Garantir que 0, "" ou null/undefined virem null para não quebrar FK no banco
        const parseId = (val: any) => (!val || val === "" || val === 0 || val === "0") ? null : Number(val);
        
        return {
          ...addr,
          idcidade: parseId(addr.idcidade),
          idbairro: parseId(addr.idbairro),
          idcliend: (typeof addr.idcliend === 'string' && addr.idcliend.startsWith('temp_')) ? undefined : addr.idcliend
        };
      }),
      contatos: (formData.contatos || []).map(cont => ({
        ...cont,
        idformacontato: Number(cont.idformacontato),
        aniversario: !cont.aniversario || cont.aniversario === "" ? null : cont.aniversario,
        idclienteforma: (typeof cont.idclienteforma === 'string' && cont.idclienteforma.startsWith('temp_')) ? undefined : cont.idclienteforma
      }))
    };

    try {
      const url = editingClient 
        ? `/api/clientes/${editingClient.idcliente}`
        : '/api/clientes';
      
      const response = await fetch(url, {
        method: editingClient ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanPayload),
      });

      if (response.ok) {
        const savedClient = await response.json();
        setSuccessMessage(editingClient ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!');
        setIsModalOpen(false);
        fetchClients(page);
      } else {
        const errorData = await response.json();
        // Tratar erro 422 que vem como array de detalhes
        if (Array.isArray(errorData.detail)) {
          const detailMsg = errorData.detail.map((d: any) => `${d.loc[d.loc.length - 1]}: ${d.msg}`).join(', ');
          setError(`Erro de Validação: ${detailMsg}`);
        } else {
          setError(errorData.detail || 'Erro ao salvar cliente.');
        }
      }
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setError('Erro de conexão com o servidor.');
    } finally {
      setIsSaving(false);
    }
  };

  // Address Handlers
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

      let cidadeId: number | null = null;
      let bairroId: number | null = null;

      if (uf) {
        const resCidades = await fetch(`/api/cidades?idestado=${encodeURIComponent(uf)}`);
        if (resCidades.ok) {
          const listaCidades = await resCidades.json();
          const cidadeMatch = (Array.isArray(listaCidades) ? listaCidades : []).find((c: any) =>
            c.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(nomeCidade)
          );
          if (cidadeMatch) {
            cidadeId = cidadeMatch.idcidade;
            if (nomeBairro) {
              const resBairros = await fetch(`/api/bairros?idcidade=${cidadeMatch.idcidade}`);
              if (resBairros.ok) {
                const listaBairros = await resBairros.json();
                const bairroMatch = (Array.isArray(listaBairros) ? listaBairros : []).find((b: any) =>
                  b.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(nomeBairro)
                );
                if (bairroMatch) bairroId = bairroMatch.idbairro;
              }
            }
          }
        }
      }

      setNewAddress(prev => ({
        ...prev,
        idestado: uf || prev.idestado,
        idcidade: cidadeId ?? prev.idcidade,
        idbairro: bairroId as any,
        logradouro: logradouro || prev.logradouro,
      }));
    } catch {
      // silencioso — usuário pode preencher manualmente
    } finally {
      setIsCepLoading(false);
    }
  };

  const handleAddAddress = () => {
    if (!newAddress.logradouro || !newAddress.numero) return;
    const addresses = formData.enderecos || [];
    if (editingAddressId) {
      setFormData({
        ...formData,
        enderecos: addresses.map(a => a.idcliend === editingAddressId ? { ...a, ...newAddress } : a)
      });
      setEditingAddressId(null);
    } else {
      const tempId = 'temp_' + Math.random().toString(36).substr(2, 9);
      setFormData({
        ...formData,
        enderecos: [...addresses, { idcliend: tempId as any, idcliente: editingClient?.idcliente as any, ...newAddress }]
      });
    }
    setNewAddress(initialAddress);
    setIsAddressModalOpen(false);
  };

  const handleOpenAddressModal = () => {
    setNewAddress(initialAddress);
    setEditingAddressId(null);
    setIsAddressModalOpen(true);
  };

  const handleEditAddress = (address: ClientAddress) => {
    const { idcliend, idcliente, ...rest } = address;
    setNewAddress(rest as any);
    setEditingAddressId(idcliend);
    setIsAddressModalOpen(true);
  };

  const handleDeleteAddress = (id: string | number) => {
    setFormData({
      ...formData,
      enderecos: (formData.enderecos || []).filter(a => a.idcliend !== id)
    });
  };

  // Contact Handlers
  const handleAddContact = () => {
    if (!newContact.valor) return;
    const contacts = formData.contatos || [];
    if (editingContactId) {
      setFormData({
        ...formData,
        contatos: contacts.map(c => c.idclienteforma === editingContactId ? { ...c, ...newContact } : c)
      });
      setEditingContactId(null);
    } else {
      const tempId = 'temp_' + Math.random().toString(36).substr(2, 9);
      setFormData({
        ...formData,
        contatos: [...contacts, { idclienteforma: tempId as any, idcliente: editingClient?.idcliente as any, ...newContact }]
      });
    }
    setNewContact(initialContact);
    setIsContactModalOpen(false);
  };

  const handleOpenContactModal = () => {
    setNewContact(initialContact);
    setEditingContactId(null);
    setIsContactModalOpen(true);
  };

  const handleEditContact = (contact: ClientContact) => {
    const { idclienteforma, idcliente, ...rest } = contact;
    setNewContact(rest as any);
    setEditingContactId(idclienteforma);
    setIsContactModalOpen(true);
  };

  const handleDeleteContact = (id: string | number) => {
    setFormData({
      ...formData,
      contatos: (formData.contatos || []).filter(c => c.idclienteforma !== id)
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <Header title="Gerenciamento de Clientes" />
      
      <div className="p-5 space-y-4">
        {/* Alerts and Success Messages */}
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 px-4 py-3 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-sm font-bold uppercase tracking-wider">{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)}><X className="h-4 w-4" /></button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 text-[#B21212] px-4 py-3 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-4">
            <span className="text-sm font-bold uppercase tracking-wider">{error}</span>
            <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-6">
            <div className="flex-1 min-w-[300px] relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-[#B21212] transition-colors" />
              <Input 
                className="pl-10 h-12 border-slate-100 bg-slate-50/30 focus:bg-white transition-all"
                label="Busca Estratégica"
                placeholder="Nome, Fantasia ou CNPJ..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleFilter()}
              />
            </div>

            <Button variant="outline" onClick={handleFilter} className="h-12 px-6 gap-2 font-black uppercase tracking-widest text-[10px]">
              <Search className="h-4 w-4" /> Filtrar
            </Button>
            <Button onClick={handleOpenNewModal} className="h-12 px-6 gap-2 font-bold uppercase tracking-wider">
              <Plus className="h-5 w-5" />Novo
            </Button>
          </div>
        </div>

        {/* Data Grid */}
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-8 py-12">
            <div className="space-y-4 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-4 bg-slate-100 rounded-full w-full"></div>
              ))}
            </div>
          </div>
        ) : (() => {
          const cols: GridColumn<Client>[] = [
            { header: 'ID', render: c => <span className="text-sm font-black text-[#B21212] drop-shadow-sm">{c.idcliente}</span> },
            {
              header: 'Cliente / Fantasia',
              render: c => (
                <div className="flex flex-col">
                  <span className="text-sm font-black text-slate-700 tracking-tight">{c.nome}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{c.nomefantasia}</span>
                </div>
              ),
            },
            { header: 'CNPJ / CPF', render: c => <span className="text-sm font-bold text-slate-500 font-mono tracking-tighter">{c.cnpj_cpf}</span> },
            {
              header: 'Tipo',
              render: c => (
                <span className={cn(
                  "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                  c.tipo === 'PJ' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-purple-50 text-purple-600 border-purple-100"
                )}>
                  {c.tipo}
                </span>
              ),
            },
            { header: 'Cadastro', render: c => <span className="text-sm font-bold text-slate-500 italic lowercase tracking-tight">{c.data_cadastro}</span> },
            {
              header: 'Gestão',
              headerClass: 'px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right',
              cellClass: 'px-4 py-2 text-right',
              render: c => (
                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteRequest(c)}><Trash2 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100" onClick={() => handleOpenViewModal(c)}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100" onClick={() => handleOpenEditModal(c)}><Edit2 className="h-4 w-4" /></Button>
                </div>
              ),
            },
          ];
          return (
            <>
              <DataGrid data={clientList} columns={cols} getKey={c => c.id} emptyMessage="Nenhum cliente mapeado." />
              {/* Pagination Footer */}
              {totalPages > 1 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-center justify-between mt-2">
                  <span className="text-xs font-medium text-slate-500">
                    {totalRecords === 0
                      ? 'Nenhum registro'
                      : `Exibindo ${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, totalRecords)} de ${totalRecords} clientes`}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                      .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                        if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                        acc.push(p); return acc;
                      }, [])
                      .map((p, idx) => p === '...'
                        ? <span key={`e${idx}`} className="px-1 text-xs text-slate-400">...</span>
                        : <Button key={p} variant={p === page ? 'default' : 'outline'} className="h-8 w-8 p-0 text-xs font-bold" onClick={() => setPage(p as number)}>{p}</Button>
                      )}
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Main Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => !isSaving && setIsModalOpen(false)} 
        title={isViewOnly ? `Dossiê: ${formData.nome}` : (editingClient ? `Editor: ${formData.nome}` : "Iniciação de Cliente")}
        className="max-w-6xl"
        footer={
          <div className="flex gap-3">
            {!isViewOnly && <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving} className="uppercase font-black text-[10px] tracking-widest h-11 px-8">Cancelar</Button>}
            <Button onClick={isViewOnly ? () => setIsModalOpen(false) : handleSave} disabled={isSaving} className="uppercase font-black text-[10px] tracking-widest h-11 px-8 bg-[#B21212]">
              {isSaving ? 'Processando...' : (isViewOnly ? 'Fechar' : 'Finalizar Registro')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col h-[70vh]">
          {/* Tabs Menu */}
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
              1. Identificação
            </button>
            <button
              onClick={() => setActiveTab('enderecos')}
              className={cn(
                "px-6 py-3 text-xs font-black uppercase tracking-widest transition-all relative",
                activeTab === 'enderecos' 
                  ? "text-[#B21212] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#B21212]" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              2. Localidades
            </button>
            <button
              onClick={() => setActiveTab('contatos')}
              className={cn(
                "px-6 py-3 text-xs font-black uppercase tracking-widest transition-all relative",
                activeTab === 'contatos'
                  ? "text-[#B21212] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#B21212]"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              3. Canais de Contato
            </button>
            {editingClient && (
              <button
                onClick={() => setActiveTab('ordens')}
                className={cn(
                  "px-6 py-3 text-xs font-black uppercase tracking-widest transition-all relative flex items-center gap-1.5",
                  activeTab === 'ordens'
                    ? "text-[#B21212] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#B21212]"
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                <ClipboardList className="h-3.5 w-3.5" /> 4. Ordens de Serviço
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-8 pb-6">
            {activeTab === 'geral' ? (
              <section className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="md:col-span-2">
                    <Input label="Razão Social / Nome Completo" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} disabled={isViewOnly} />
                  </div>
                  <div>
                    <Input label="Nome Fantasia / Apelido" value={formData.nomefantasia} onChange={(e) => setFormData({ ...formData, nomefantasia: e.target.value })} disabled={isViewOnly} />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Status</label>
                    <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-[#B21212]/10 disabled:bg-slate-50" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} disabled={isViewOnly}>
                      <option value="ATIVO">ATIVO</option>
                      <option value="INATIVO">INATIVO</option>
                    </select>
                  </div>
                  <Input label="CNPJ / CPF" value={formData.cnpj_cpf} onChange={(e) => setFormData({ ...formData, cnpj_cpf: e.target.value })} disabled={isViewOnly} />
                  <Input label="I.E. / RG" value={formData.ie_rg} onChange={(e) => setFormData({ ...formData, ie_rg: e.target.value })} disabled={isViewOnly} />
                  <div className="flex flex-col">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Tipo Jurídico</label>
                    <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-[#B21212]/10 disabled:bg-slate-50" value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })} disabled={isViewOnly}>
                      <option value="PJ">Pessoa Jurídica</option>
                      <option value="PF">Pessoa Física</option>
                    </select>
                  </div>
                  <Input label="Data de Registro" type="date" value={formData.data_cadastro} onChange={(e) => setFormData({ ...formData, data_cadastro: e.target.value })} disabled={isViewOnly} />
                  <div className="md:col-span-2">
                    <Input label="Site (URL)" placeholder="https://..." value={formData.site} onChange={(e) => setFormData({ ...formData, site: e.target.value })} disabled={isViewOnly} />
                  </div>
                  <div className="md:col-span-2">
                    <Input label="Interlocutor Principal" value={formData.contato} onChange={(e) => setFormData({ ...formData, contato: e.target.value })} disabled={isViewOnly} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Sumário / Observações Estratégicas</label>
                  <textarea className="w-full min-h-[120px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-[#B21212]/10 disabled:bg-slate-50 transition-all" value={formData.observacao} onChange={(e) => setFormData({ ...formData, observacao: e.target.value })} disabled={isViewOnly} />
                </div>
              </section>
            ) : activeTab === 'enderecos' ? (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Malha Logística</h4>
                  {!isViewOnly && (
                    <Button variant="outline" size="sm" onClick={handleOpenAddressModal} className="h-8 gap-2 font-black text-[9px] uppercase tracking-widest border-slate-200 hover:bg-slate-50">
                      <Plus className="h-3 w-3" /> Adicionar Localidade
                    </Button>
                  )}
                </div>
                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Endereço</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Nº</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Cidade/UF</th>
                        {!isViewOnly && <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(formData.enderecos || []).length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-12 text-center text-xs font-bold text-slate-300 uppercase italic">Nenhuma localidade mapeada</td></tr>
                      ) : (
                        (formData.enderecos || []).map((addr) => (
                          <tr key={addr.idcliend} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3"><span className="text-[9px] font-black text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded-full">{addr.tipo_endereco}</span></td>
                            <td className="px-4 py-3 text-sm font-bold text-slate-700">{addr.tipo_logradouro} {addr.logradouro} {addr.complemento && <span>({addr.complemento})</span>}</td>
                            <td className="px-4 py-3 text-sm text-slate-500">{addr.numero}</td>
                            <td className="px-4 py-3 text-sm text-slate-500 font-bold uppercase">{cidades.find(c => c.idcidade === Number(addr.idcidade))?.nome || ''} / {addr.idestado}</td>
                            {!isViewOnly && (
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100" onClick={() => handleEditAddress(addr)}><Edit2 className="h-3.5 w-3.5" /></Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteAddress(addr.idcliend)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : activeTab === 'ordens' ? (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Histórico de Ordens de Serviço</h4>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">OS Nº</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Empresa</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {loadingOrdens ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center">
                            <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400">
                              <Loader2 className="h-4 w-4 animate-spin" /> Carregando ordens...
                            </div>
                          </td>
                        </tr>
                      ) : ordensCliente.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-12 text-center text-xs font-bold text-slate-300 uppercase italic">Nenhuma ordem de serviço encontrada</td></tr>
                      ) : (
                        ordensCliente.map((os) => (
                          <tr key={os.idordem} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <span className="text-sm font-black text-[#B21212]">{os.numero_os ?? os.idordem}</span>
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-slate-700">
                              {os.empresa_rel?.nomefantasia || os.empresa_rel?.nome || '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-500">
                              {os.data ? new Date(os.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-slate-700 text-right">
                              {os.valor_os != null
                                ? os.valor_os.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                : '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-black uppercase border",
                                os.situacao
                                  ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                  : "bg-amber-50 text-amber-600 border-amber-100"
                              )}>
                                {os.situacao ? 'Fechada' : 'Aberta'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  {!loadingOrdens && ordensTotalRecords > 0 && (() => {
                    const totalPages = Math.max(1, Math.ceil(ordensTotalRecords / OS_PER_PAGE));
                    return (
                      <div className="px-4 py-2 border-t border-slate-50 bg-slate-50/30 flex items-center justify-between gap-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {ordensTotalRecords === 0
                            ? 'Nenhuma ordem'
                            : `${(ordensPage - 1) * OS_PER_PAGE + 1}–${Math.min(ordensPage * OS_PER_PAGE, ordensTotalRecords)} de ${ordensTotalRecords} ordens`}
                        </span>
                        {totalPages > 1 && (
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setOrdensPage(p => Math.max(1, p - 1))} disabled={ordensPage === 1}>
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                              .filter(p => p === 1 || p === totalPages || Math.abs(p - ordensPage) <= 1)
                              .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                                if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                                acc.push(p); return acc;
                              }, [])
                              .map((p, idx) => p === '...'
                                ? <span key={`e${idx}`} className="px-1 text-xs text-slate-400">...</span>
                                : <Button key={p} variant={p === ordensPage ? 'default' : 'outline'} className="h-7 w-7 p-0 text-xs font-bold" onClick={() => setOrdensPage(p as number)}>{p}</Button>
                              )}
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setOrdensPage(p => Math.min(totalPages, p + 1))} disabled={ordensPage === totalPages}>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </section>
            ) : (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Canais de Relacionamento</h4>
                  {!isViewOnly && (
                    <Button variant="outline" size="sm" onClick={handleOpenContactModal} className="h-8 gap-2 font-black text-[9px] uppercase tracking-widest border-slate-200 hover:bg-slate-50">
                      <Plus className="h-3 w-3" /> Adicionar Canal
                    </Button>
                  )}
                </div>
                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Forma</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Contato (Valor)</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Observação</th>
                        <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Zap?</th>
                        {!isViewOnly && <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(formData.contatos || []).length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-12 text-center text-xs font-bold text-slate-300 uppercase italic">Nenhum canal ativo</td></tr>
                      ) : (
                        (formData.contatos || []).map((cont) => (
                          <tr key={cont.idclienteforma} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3"><span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">{formasContato.find(f => f.idformacontato === cont.idformacontato)?.nome || 'Canal ' + cont.idformacontato}</span></td>
                            <td className="px-4 py-3 text-sm font-black text-slate-700">{cont.valor}</td>
                            <td className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-tight">{cont.observacao}</td>
                            <td className="px-4 py-3">
                              <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full border", cont.zap === 'SIM' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100")}>
                                {cont.zap}
                              </span>
                            </td>
                            {!isViewOnly && (
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100" onClick={() => handleEditContact(cont)}><Edit2 className="h-3.5 w-3.5" /></Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteContact(cont.idclienteforma)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </div>
      </Modal>

      {/* Address Sub-Modal */}
      <Modal isOpen={isAddressModalOpen} onClose={() => setIsAddressModalOpen(false)} title={editingAddressId ? "Reajuste Geográfico" : "Mapeamento Local"} className="max-w-2xl" footer={<div className="flex gap-2"><Button variant="outline" onClick={() => setIsAddressModalOpen(false)}>Recuar</Button><Button onClick={handleAddAddress}>{editingAddressId ? 'Atualizar' : 'Vincular'}</Button></div>}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Linha 0: Natureza do Local (col-2) */}
          <div className="md:col-span-2 flex flex-col">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Natureza do Local</label>
            <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-[#B21212]/10" value={newAddress.tipo_endereco} onChange={(e) => setNewAddress({ ...newAddress, tipo_endereco: e.target.value })}>
              <option value="PRINCIPAL">Principal</option>
              <option value="COBRANÇA">Cobrança</option>
              <option value="ENTREGA">Entrega</option>
              <option value="OBRA">Obra / Local de Operação</option>
              <option value="OUTRO">Outro</option>
            </select>
          </div>

          {/* Linha 1: CEP | Estado | Município (col-2) */}
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">CEP Corporativo</label>
            <div className="relative flex items-center">
              <input
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20"
                value={newAddress.cep}
                onChange={(e) => setNewAddress({ ...newAddress, cep: e.target.value })}
                onBlur={(e) => handleCepLookup(e.target.value)}
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
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">UF (Estado)</label>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-[#B21212]/10"
              value={newAddress.idestado}
              onChange={(e) => setNewAddress({ ...newAddress, idestado: e.target.value, idcidade: null as any, idbairro: null as any })}
            >
              <option value="">UF</option>
              {estados.map(est => <option key={est.idestado} value={est.idestado}>{est.idestado} - {est.nome}</option>)}
            </select>
          </div>

          <div className="md:col-span-2 flex flex-col">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Município</label>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-[#B21212]/10"
              value={newAddress.idcidade || ''}
              onChange={(e) => setNewAddress({ ...newAddress, idcidade: Number(e.target.value) || null as any, idbairro: null as any })}
            >
              <option value="">Selecione...</option>
              {cidades.map(cid => (
                <option key={cid.idcidade} value={cid.idcidade}>{cid.nome}</option>
              ))}
            </select>
          </div>

          {/* Linha 2: Distrito/Bairro (col-2) | Logradouro (col-2) */}
          <div className="md:col-span-2 flex flex-col">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Distrito / Bairro</label>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-[#B21212]/10"
              value={newAddress.idbairro || ''}
              onChange={(e) => setNewAddress({ ...newAddress, idbairro: Number(e.target.value) || null as any })}
            >
              <option value="">Selecione...</option>
              {bairros.map(bai => (
                <option key={bai.idbairro} value={bai.idbairro}>{bai.nome}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <Input label="Logradouro / Rodovia" placeholder="Av. das Nações, Km 40..." value={newAddress.logradouro} onChange={(e) => setNewAddress({ ...newAddress, logradouro: e.target.value })} />
          </div>

          {/* Linha 3: Número | Complemento (col-3) */}
          <Input label="Número / Ponto" value={newAddress.numero} onChange={(e) => setNewAddress({ ...newAddress, numero: e.target.value })} />
          <div className="md:col-span-3">
            <Input label="Complemento / Edifício" value={newAddress.complemento} onChange={(e) => setNewAddress({ ...newAddress, complemento: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* Contact Sub-Modal */}
      <Modal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} title={editingContactId ? "Reajuste de Frequência" : "Novo Ponto de Contato"} className="max-w-2xl" footer={<div className="flex gap-2"><Button variant="outline" onClick={() => setIsContactModalOpen(false)}>Cancelar</Button><Button onClick={handleAddContact}>{editingContactId ? 'Atualizar' : 'Ativar'}</Button></div>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Protocolo de Comunicação</label>
            <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-[#B21212]/10" value={newContact.idformacontato} onChange={(e) => setNewContact({ ...newContact, idformacontato: parseInt(e.target.value) || 1 })}>
              {formasContato.map(f => <option key={f.idformacontato} value={f.idformacontato}>{f.nome}</option>)}
            </select>
          </div>
          <Input label="Valor do Contato (Fone/Email/ID)" placeholder="Ex: (00) 00000-0000" value={newContact.valor} onChange={(e) => setNewContact({ ...newContact, valor: e.target.value })} />
          <div className="md:col-span-2">
            <Input label="Descrição Interna" placeholder="Ex: RAMAL EXECUTIVO / EMAIL DE FATURAMENTO" value={newContact.observacao} onChange={(e) => setNewContact({ ...newContact, observacao: e.target.value })} />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Habilitar WhatsApp?</label>
            <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-[#B21212]/10" value={newContact.zap} onChange={(e) => setNewContact({ ...newContact, zap: e.target.value })}>
              <option value="SIM">SIM</option>
              <option value="NÃO">NÃO</option>
            </select>
          </div>
          <Input label="Data Especial (Nasc)" type="date" value={newContact.aniversario} onChange={(e) => setNewContact({ ...newContact, aniversario: e.target.value })} />
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirmação de Exclusão Ética" className="max-w-md" footer={<div className="flex gap-2"><Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Abortar</Button><Button onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">Confirmar Remoção</Button></div>}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600 font-bold leading-relaxed">Deseja realmente remover o dossiê de <span className="text-[#B21212] font-black">{clientToDelete?.nome}</span>?</p>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest bg-slate-50 p-3 rounded-lg border border-slate-100 italic">Nota: Esta operação verificará integridade com ordens de serviço pendentes.</p>
          {deleteError && <div className="text-[10px] font-black text-red-600 uppercase tracking-widest mt-2">{deleteError}</div>}
        </div>
      </Modal>
    </div>
  );
}
