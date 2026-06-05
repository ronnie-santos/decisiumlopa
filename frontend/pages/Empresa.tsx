import React, { useState, useEffect, useRef } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Plus, Eye, Edit2, Trash2, AlertTriangle, Search, Loader2, Upload, X, Image } from 'lucide-react';
import { DataGrid, GridColumn } from '../components/ui/DataGrid';
import { Company } from '../types';
import { cn } from '../utils/cn';
import { useCidadeBairro } from '../utils/useCidadeBairro';

export function EmpresaPage() {
  const [isModalOpen, setIsModalOpen]           = useState(false);
  const [isViewOnly, setIsViewOnly]             = useState(false);
  const [editingCompany, setEditingCompany]     = useState<Company | null>(null);
  const [companies, setCompanies]               = useState<Company[]>([]);
  const [estados, setEstados]                   = useState<any[]>([]);
  const [searchTerm, setSearchTerm]             = useState('');
  const [statusFilter, setStatusFilter]         = useState('Todos os Status');
  const [isDeleteModalOpen, setIsDeleteModalOpen]   = useState(false);
  const [companyToDelete, setCompanyToDelete]       = useState<Company | null>(null);
  const [deleteError, setDeleteError]               = useState<string | null>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [invalidFields, setInvalidFields]           = useState<string[]>([]);
  const [isCepLoading, setIsCepLoading]             = useState(false);

  // ── Logo states ─────────────────────────────────────────────────────────────
  const [logoFile, setLogoFile]             = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [localHasLogo, setLocalHasLogo]     = useState(false);
  const [logoKey, setLogoKey]               = useState(0);
  const [logoError, setLogoError]           = useState<string | null>(null);
  const fileInputRef                        = useRef<HTMLInputElement>(null);

  const filteredCompanies = companies
    .filter(company => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchLower ||
        (String(company.nomefantasia || '').toLowerCase().includes(searchLower)) ||
        (String(company.nome || '').toLowerCase().includes(searchLower)) ||
        (String(company.cnpj || '').includes(searchLower));

      const matchesStatus = statusFilter === 'Todos os Status' ||
        (String(company.status || 'ATIVO').toUpperCase() === statusFilter.toUpperCase());

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => Number(a.id) - Number(b.id));

  useEffect(() => {
    fetchCompanies();
    fetchAuxData();
  }, []);

  const fetchAuxData = async () => {
    try {
      const resEst = await fetch('/api/estados');
      if (resEst.ok) setEstados(await resEst.json());
    } catch (error) {
      console.error('Erro ao buscar dados auxiliares:', error);
    }
  };

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

  const fetchCompanies = async () => {
    try {
      const response = await fetch('/api/empresas');
      if (response.ok) {
        const data = await response.json();
        const mappedData = data.map((empresa: any) => ({
          ...empresa,
          id: String(empresa.idempresa),
          status: empresa.status || 'ATIVO',
          has_logo: empresa.has_logo ?? false,
        }));
        setCompanies(mappedData);
      } else {
        console.error('Falha ao carregar empresas');
      }
    } catch (error) {
      console.error('Erro na requisição:', error);
    }
  };

  const [formData, setFormData] = useState<Omit<Company, 'id'>>({
    nome: '',
    nomefantasia: '',
    cnpj: '',
    ie: '',
    cep: '',
    idcidade: 0,
    cidade: '',
    idbairro: 0,
    bairro: '',
    logradouro: '',
    tipo_logradouro: '',
    idestado: '',
    numero: 0,
    ultima_nf: 0,
    serie: '',
    pis: 0,
    cofins: 0,
    inss: 0,
    ir: 0,
    csll: 0,
    inscricao_municipal: '',
    sequencia: 0,
    atividade: '',
    aliquota_aplicada: 0,
    deducao: 0,
    imposto: 0,
    retencao: 0,
    status: 'ATIVO',
  });

  const { cidades, bairros } = useCidadeBairro(
    isModalOpen ? (formData as any).idestado || null : null,
    isModalOpen ? (formData as any).idcidade || null : null,
  );

  // ── Logo helpers ─────────────────────────────────────────────────────────────
  const logoDisplayUrl: string | null =
    logoPreviewUrl
    ?? (localHasLogo && editingCompany
        ? `/api/empresas/${editingCompany.id}/logo?k=${logoKey}`
        : null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setLogoError('Formato inválido. Use PNG, JPEG, WebP ou GIF.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Arquivo muito grande. Tamanho máximo: 2 MB.');
      return;
    }

    setLogoError(null);
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
    // Reset input so the same file can be re-selected if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveLogo = async () => {
    if (logoFile) {
      // Still just a preview — discard selection
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
      setLogoFile(null);
      setLogoPreviewUrl(null);
      return;
    }
    // Remove from DB
    if (editingCompany?.id && localHasLogo) {
      const res = await fetch(`/api/empresas/${editingCompany.id}/logo`, { method: 'DELETE' });
      if (res.ok) {
        setLocalHasLogo(false);
        setLogoKey(k => k + 1);
        setCompanies(prev =>
          prev.map(c => c.id === editingCompany.id ? { ...c, has_logo: false } : c)
        );
      }
    }
  };

  const resetLogoState = () => {
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setLogoFile(null);
    setLogoPreviewUrl(null);
    setLogoError(null);
  };

  const handleCloseModal = () => {
    resetLogoState();
    setIsModalOpen(false);
  };

  // ── Modal openers ────────────────────────────────────────────────────────────
  const emptyForm = (): Omit<Company, 'id'> => ({
    nome: '', nomefantasia: '', cnpj: '', ie: '', cep: '',
    idcidade: 0, cidade: '', idbairro: 0, bairro: '',
    logradouro: '', tipo_logradouro: '', idestado: '',
    numero: 0, ultima_nf: 0, serie: '',
    pis: 0, cofins: 0, inss: 0, ir: 0, csll: 0,
    inscricao_municipal: '', sequencia: 0, atividade: '',
    aliquota_aplicada: 0, deducao: 0, imposto: 0, retencao: 0,
    status: 'ATIVO',
  });

  const handleOpenNewModal = () => {
    setEditingCompany(null);
    setIsViewOnly(false);
    setFormData(emptyForm());
    resetLogoState();
    setLocalHasLogo(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (company: Company) => {
    setEditingCompany(company);
    setIsViewOnly(false);
    const { id, ...rest } = company;
    setFormData(rest);
    resetLogoState();
    setLocalHasLogo(company.has_logo ?? false);
    setIsModalOpen(true);
  };

  const handleOpenViewModal = (company: Company) => {
    setEditingCompany(company);
    setIsViewOnly(true);
    const { id, ...rest } = company;
    setFormData(rest);
    resetLogoState();
    setLocalHasLogo(company.has_logo ?? false);
    setIsModalOpen(true);
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const missing = [];
    if (!formData.nome.trim())        missing.push('Razão Social');
    if (!formData.nomefantasia.trim()) missing.push('Nome Fantasia');
    if (!formData.cnpj.trim())        missing.push('CNPJ');

    if (missing.length > 0) {
      setInvalidFields(missing);
      setIsValidationModalOpen(true);
      return;
    }

    try {
      const isEditing = !!editingCompany;
      const url    = isEditing ? `/api/empresas/${editingCompany.id}` : '/api/empresas';
      const method = isEditing ? 'PUT' : 'POST';

      const parseId = (val: any): number | null => {
        if (!val || val === '' || val === 0 || val === '0') return null;
        const n = Number(val);
        return isNaN(n) ? null : n;
      };

      const { id, idempresa, cidade, bairro, has_logo, ...baseData } = formData as any;

      const payload = {
        ...baseData,
        idcidade: parseId(formData.idcidade),
        idbairro: parseId(formData.idbairro),
        idestado: formData.idestado || null,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error('Falha ao salvar a Empresa');
        return;
      }

      const saved = await response.json();
      const savedId = saved.idempresa ?? editingCompany?.id;

      // Upload logo if file selected
      if (logoFile && savedId) {
        const fd = new FormData();
        fd.append('file', logoFile);
        await fetch(`/api/empresas/${savedId}/logo`, { method: 'POST', body: fd });
      }

      fetchCompanies();
      handleCloseModal();
    } catch (error) {
      console.error('Erro de requisição:', error);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDeleteRequest = (company: Company) => {
    setCompanyToDelete(company);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!companyToDelete) return;
    try {
      const response = await fetch(`/api/empresas/${companyToDelete.id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchCompanies();
        setIsDeleteModalOpen(false);
        setCompanyToDelete(null);
      } else {
        const errorData = await response.json();
        setDeleteError(errorData.detail || 'Falha ao excluir a empresa.');
      }
    } catch (error) {
      console.error('Erro ao excluir:', error);
      setDeleteError('Erro de conexão com o servidor.');
    }
  };

  const statusColors = {
    ATIVO:   'bg-emerald-50 text-emerald-600 border-emerald-100',
    INATIVO: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <Header title="Cadastro de Empresas" />

      <div className="p-5 space-y-4">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                label="Empresa / Nome Fantasia"
                placeholder="Buscar empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-44">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Status</label>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="Todos os Status">Todos os Status</option>
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
              </select>
            </div>
            <Button onClick={handleOpenNewModal} className="gap-2 h-9 px-5 font-bold uppercase tracking-wider">
              <Plus className="h-5 w-5" />
              Novo
            </Button>
          </div>
        </div>

        {/* Table */}
        {(() => {
          const cols: GridColumn<Company>[] = [
            { header: 'Código', render: c => <span className="text-xs font-bold text-[#B21212]">{c.id}</span> },
            {
              header: 'Empresa',
              render: c => (
                <div className="flex items-center gap-3">
                  {c.has_logo
                    ? (
                      <img
                        src={`/api/empresas/${c.id}/logo`}
                        alt="logo"
                        className="h-9 w-9 rounded-md object-contain border border-slate-100 bg-slate-50 flex-shrink-0"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Image className="h-4 w-4 text-slate-300" />
                      </div>
                    )
                  }
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-slate-700 truncate">{c.nomefantasia}</span>
                    <span className="text-xs text-slate-400 truncate">{c.nome}</span>
                  </div>
                </div>
              ),
            },
            { header: 'CNPJ',   render: c => <span className="text-xs text-slate-500">{c.cnpj}</span> },
            { header: 'Estado', render: c => <span className="text-xs text-slate-500">{c.idestado}</span> },
            {
              header: 'Status',
              headerClass: 'px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center',
              cellClass:   'px-4 py-2 text-center',
              render: c => (
                <span className={cn(
                  'inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                  statusColors[c.status]
                )}>
                  {c.status}
                </span>
              ),
            },
            {
              header: 'Ações',
              headerClass: 'px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right',
              cellClass:   'px-4 py-2 text-right',
              render: c => (
                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500"   onClick={() => handleDeleteRequest(c)}   title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleOpenViewModal(c)}   title="Visualizar"><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleOpenEditModal(c)}  title="Editar"><Edit2 className="h-4 w-4" /></Button>
                </div>
              ),
            },
          ];
          return <DataGrid data={filteredCompanies} columns={cols} getKey={c => c.id} emptyMessage="Nenhuma empresa encontrada." />;
        })()}
      </div>

      {/* ── Modal principal ─────────────────────────────────────────────────── */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={
          isViewOnly
            ? `Visualizar — ${editingCompany?.nomefantasia || editingCompany?.nome || ''}`
            : editingCompany
              ? `Editar — ${editingCompany?.nomefantasia || editingCompany?.nome || ''}`
              : 'Nova Empresa'
        }
        className="max-w-6xl"
        footer={
          isViewOnly ? (
            <Button onClick={handleCloseModal} className="px-8">OK</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleCloseModal}>Cancelar</Button>
              <Button onClick={handleSave}>{editingCompany ? 'Salvar Alterações' : 'Salvar Empresa'}</Button>
            </>
          )
        }
      >
        <div className="space-y-8">

          {/* ── Identificação ─────────────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>
              Identificação
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Input
                  label={<span>Razão Social <span className="text-red-500">*</span></span>}
                  placeholder="Ex: Lopa Guindastes e Transportes Ltda"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  disabled={isViewOnly}
                />
              </div>
              <Input
                label={<span>Nome Fantasia <span className="text-red-500">*</span></span>}
                placeholder="Ex: Lopa Guindastes"
                value={formData.nomefantasia}
                onChange={(e) => setFormData({ ...formData, nomefantasia: e.target.value })}
                disabled={isViewOnly}
              />
              <Input
                label={<span>CNPJ <span className="text-red-500">*</span></span>}
                placeholder="00.000.000/0000-00"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                disabled={isViewOnly}
              />
              <Input
                label="Inscrição Estadual"
                placeholder="000.000.000.000"
                value={formData.ie}
                onChange={(e) => setFormData({ ...formData, ie: e.target.value })}
                disabled={isViewOnly}
              />
              <Input
                label="Inscrição Municipal"
                placeholder="00000000"
                value={formData.inscricao_municipal}
                onChange={(e) => setFormData({ ...formData, inscricao_municipal: e.target.value })}
                disabled={isViewOnly}
              />
              <Input
                label="Código da Atividade"
                placeholder="Ex: 7739-0/99"
                value={formData.atividade}
                onChange={(e) => setFormData({ ...formData, atividade: e.target.value })}
                disabled={isViewOnly}
              />
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Status</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as Company['status'] })}
                  disabled={isViewOnly}
                >
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                </select>
              </div>
            </div>
          </section>

          {/* ── Logo da Empresa ────────────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>
              Logo da Empresa
            </h3>
            <div className="flex items-start gap-6">

              {/* Preview */}
              <div
                className={cn(
                  'relative h-32 w-32 rounded-xl border-2 overflow-hidden flex-shrink-0 flex items-center justify-center bg-slate-50',
                  logoDisplayUrl ? 'border-slate-200' : 'border-dashed border-slate-200',
                  !isViewOnly && 'cursor-pointer hover:border-[#B21212]/40 transition-colors'
                )}
                onClick={() => !isViewOnly && fileInputRef.current?.click()}
                title={!isViewOnly ? 'Clique para selecionar imagem' : undefined}
              >
                {logoDisplayUrl ? (
                  <img
                    src={logoDisplayUrl}
                    alt="Logo"
                    className="h-full w-full object-contain p-1"
                    onError={() => {
                      setLocalHasLogo(false);
                      setLogoKey(k => k + 1);
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-slate-300">
                    <Image className="h-8 w-8" />
                    {!isViewOnly && <span className="text-[10px] font-medium">Sem logo</span>}
                  </div>
                )}
                {!isViewOnly && (
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                    <Upload className="h-5 w-5 text-white drop-shadow" />
                  </div>
                )}
              </div>

              {/* Upload controls */}
              <div className="flex flex-col gap-3">
                {!isViewOnly && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 w-fit"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      {logoDisplayUrl ? 'Trocar Logo' : 'Selecionar Logo'}
                    </Button>

                    {(logoDisplayUrl) && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors w-fit"
                      >
                        <X className="h-3.5 w-3.5" />
                        {logoFile ? 'Cancelar seleção' : 'Remover logo'}
                      </button>
                    )}

                    {logoFile && (
                      <p className="text-[10px] text-emerald-600 font-medium">
                        {logoFile.name} — será salvo ao confirmar
                      </p>
                    )}

                    {logoError && (
                      <p className="text-[10px] text-red-500 font-medium">{logoError}</p>
                    )}

                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Formatos aceitos: PNG, JPEG, WebP, GIF<br />
                      Tamanho máximo: 2 MB
                    </p>
                  </>
                )}

                {isViewOnly && !logoDisplayUrl && (
                  <p className="text-sm text-slate-400">Nenhuma logo cadastrada.</p>
                )}
              </div>
            </div>
          </section>

          {/* ── Endereço ──────────────────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>
              Endereço
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Estado (UF)</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50"
                  value={formData.idestado}
                  onChange={(e) => setFormData({ ...formData, idestado: e.target.value, idcidade: 0, idbairro: 0 })}
                  disabled={isViewOnly}
                >
                  <option value="">UF</option>
                  {estados.map(est => (
                    <option key={est.idestado} value={est.idestado}>{est.idestado} - {est.nome}</option>
                  ))}
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
                <Input
                  label="Logradouro"
                  placeholder="Nome da rua/avenida"
                  value={formData.logradouro}
                  onChange={(e) => setFormData({ ...formData, logradouro: e.target.value })}
                  disabled={isViewOnly}
                />
              </div>

              <Input
                label="Número"
                type="number"
                value={formData.numero}
                onChange={(e) => setFormData({ ...formData, numero: parseInt(e.target.value) || 0 })}
                disabled={isViewOnly}
              />
              <Input
                label="Tipo Logradouro"
                placeholder="Ex: Av, Rua"
                value={formData.tipo_logradouro}
                onChange={(e) => setFormData({ ...formData, tipo_logradouro: e.target.value })}
                disabled={isViewOnly}
              />
            </div>
          </section>

          {/* ── Fiscal / Impostos ──────────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>
              Fiscal / Impostos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input label="PIS (%)"              type="number" step="0.01" value={formData.pis}               onChange={(e) => setFormData({ ...formData, pis:               parseFloat(e.target.value) || 0 })} disabled={isViewOnly} />
              <Input label="COFINS (%)"           type="number" step="0.01" value={formData.cofins}            onChange={(e) => setFormData({ ...formData, cofins:            parseFloat(e.target.value) || 0 })} disabled={isViewOnly} />
              <Input label="INSS (%)"             type="number" step="0.01" value={formData.inss}              onChange={(e) => setFormData({ ...formData, inss:              parseFloat(e.target.value) || 0 })} disabled={isViewOnly} />
              <Input label="IR (%)"               type="number" step="0.01" value={formData.ir}                onChange={(e) => setFormData({ ...formData, ir:                parseFloat(e.target.value) || 0 })} disabled={isViewOnly} />
              <Input label="CSLL (%)"             type="number" step="0.01" value={formData.csll}              onChange={(e) => setFormData({ ...formData, csll:              parseFloat(e.target.value) || 0 })} disabled={isViewOnly} />
              <Input label="Alíquota Aplicada (%)" type="number" step="0.01" value={formData.aliquota_aplicada} onChange={(e) => setFormData({ ...formData, aliquota_aplicada: parseFloat(e.target.value) || 0 })} disabled={isViewOnly} />
              <Input label="Dedução (R$)"         type="number" step="0.01" value={formData.deducao}           onChange={(e) => setFormData({ ...formData, deducao:           parseFloat(e.target.value) || 0 })} disabled={isViewOnly} />
              <Input label="Imposto (R$)"         type="number" step="0.01" value={formData.imposto}           onChange={(e) => setFormData({ ...formData, imposto:           parseFloat(e.target.value) || 0 })} disabled={isViewOnly} />
              <Input label="Retenção (R$)"        type="number" step="0.01" value={formData.retencao}          onChange={(e) => setFormData({ ...formData, retencao:          parseFloat(e.target.value) || 0 })} disabled={isViewOnly} />
            </div>
          </section>

          {/* ── Controle ──────────────────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>
              Controle
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Última NF"  type="number" value={formData.ultima_nf}  onChange={(e) => setFormData({ ...formData, ultima_nf:  parseInt(e.target.value) || 0 })} disabled={isViewOnly} />
              <Input label="Série"      placeholder="Ex: 1, A"   value={formData.serie}      onChange={(e) => setFormData({ ...formData, serie:      e.target.value })} disabled={isViewOnly} />
              <Input label="Sequência"  type="number" value={formData.sequencia}  onChange={(e) => setFormData({ ...formData, sequencia:  parseInt(e.target.value) || 0 })} disabled={isViewOnly} />
            </div>
          </section>

        </div>
      </Modal>

      {/* ── Modal de Exclusão ─────────────────────────────────────────────────── */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirmar Exclusão"
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">Confirmar Exclusão</Button>
          </>
        }
      >
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-800">Você tem certeza?</h4>
            <p className="text-sm text-slate-500 mt-1">
              Deseja realmente excluir a empresa <span className="font-bold text-slate-700">{companyToDelete?.nomefantasia || companyToDelete?.nome}</span>?
              Esta ação não pode ser desfeita.
            </p>
          </div>
          {deleteError && (
            <div className="w-full p-4 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-xs text-red-600 font-medium">{deleteError}</p>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Modal de Validação ────────────────────────────────────────────────── */}
      <Modal
        isOpen={isValidationModalOpen}
        onClose={() => setIsValidationModalOpen(false)}
        title="Campos Obrigatórios"
        className="max-w-md"
        footer={<Button onClick={() => setIsValidationModalOpen(false)} className="px-8">Entendido</Button>}
      >
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="h-16 w-16 bg-amber-50 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-800">Informações Faltando</h4>
            <p className="text-sm text-slate-500 mt-1">
              Para prosseguir com o cadastro, os seguintes campos devem ser preenchidos:
            </p>
          </div>
          <div className="w-full space-y-2">
            {invalidFields.map((field, index) => (
              <div key={index} className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                {field}
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
