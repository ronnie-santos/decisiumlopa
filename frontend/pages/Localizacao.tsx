import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Plus, Edit2, Trash2, AlertTriangle, Globe, Map, MapPin, Home, Navigation, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../utils/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pais {
  idpais: string;
  nome: string | null;
  sigla: string | null;
  nacionalidade: string | null;
}

interface Estado {
  idestado: string;
  nome: string | null;
  idpais: string | null;
}

interface Cidade {
  idcidade: number;
  nome: string | null;
  idestado: string | null;
  idpais: string | null;
  ddd: number | null;
  codigo_ibge: string | null;
}

interface Bairro {
  idbairro: number;
  nome: string | null;
  idcidade: number | null;
}

interface Logradouro {
  idlogradouro: number;
  logradouro: string | null;
  tipo: string | null;
  cep: number | null;
  idbairro: number | null;
}

type Tab = 'pais' | 'estado' | 'cidade' | 'bairro' | 'logradouro';

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'pais',       label: 'Países',      icon: Globe },
  { key: 'estado',     label: 'Estados',     icon: Map },
  { key: 'cidade',     label: 'Cidades',     icon: MapPin },
  { key: 'bairro',     label: 'Bairros',     icon: Home },
  { key: 'logradouro', label: 'Logradouros', icon: Navigation },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseId = (v: any): number | null => {
  if (!v || v === '' || v === 0 || v === '0') return null;
  return Number(v);
};

const fmt = (v: any) => (v !== null && v !== undefined && v !== '') ? String(v) : '—';

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LocalizacaoPage() {
  const [activeTab, setActiveTab] = useState<Tab>('pais');
  const [searchTerm, setSearchTerm] = useState('');

  // Entity lists
  const [paises,      setPaises]      = useState<Pais[]>([]);
  const [estados,     setEstados]     = useState<Estado[]>([]);
  const [cidades,     setCidades]     = useState<Cidade[]>([]);
  const [bairros,     setBairros]     = useState<Bairro[]>([]);
  const [logradouros, setLogradouros] = useState<Logradouro[]>([]);

  // Filters for cascading
  const [filterPaisEstado,     setFilterPaisEstado]     = useState('');
  const [filterEstadoCidade,   setFilterEstadoCidade]   = useState('');
  const [filterCidadeBairro,   setFilterCidadeBairro]   = useState('');
  const [filterBairroLogradouro, setFilterBairroLogradouro] = useState('');

  // Modal state
  const [isFormOpen,    setIsFormOpen]    = useState(false);
  const [isDeleteOpen,  setIsDeleteOpen]  = useState(false);
  const [editingItem,   setEditingItem]   = useState<any>(null);
  const [deletingItem,  setDeletingItem]  = useState<any>(null);
  const [deleteError,   setDeleteError]   = useState<string | null>(null);
  const [currentPage,   setCurrentPage]   = useState(1);

  const PAGE_SIZE = 50;

  // Forms
  const [paisForm,       setPaisForm]       = useState({ idpais: '', nome: '', sigla: '', nacionalidade: '' });
  const [estadoForm,     setEstadoForm]     = useState({ idestado: '', nome: '', idpais: '' });
  const [cidadeForm,     setCidadeForm]     = useState({ nome: '', idestado: '', idpais: '', ddd: '', codigo_ibge: '' });
  const [bairroForm,     setBairroForm]     = useState({ nome: '', idcidade: '' });
  const [logradouroForm, setLogradouroForm] = useState({ logradouro: '', tipo: '', cep: '', idbairro: '' });

  // ─── Fetch functions ────────────────────────────────────────────────────────

  const fetchPaises = useCallback(async () => {
    const res = await fetch('/api/paises');
    if (res.ok) setPaises(await res.json());
  }, []);

  const fetchEstados = useCallback(async (idpais?: string) => {
    const qs = idpais ? `?idpais=${idpais}` : '';
    const res = await fetch(`/api/estados${qs}`);
    if (res.ok) setEstados(await res.json());
  }, []);

  const fetchCidades = useCallback(async (idestado?: string) => {
    const qs = idestado ? `?idestado=${idestado}` : '';
    const res = await fetch(`/api/cidades${qs}`);
    if (res.ok) setCidades(await res.json());
  }, []);

  const fetchBairros = useCallback(async (idcidade?: number) => {
    const qs = idcidade ? `?idcidade=${idcidade}` : '';
    const res = await fetch(`/api/bairros${qs}`);
    if (res.ok) setBairros(await res.json());
  }, []);

  const fetchLogradouros = useCallback(async (idbairro?: number) => {
    const qs = idbairro ? `?idbairro=${idbairro}` : '';
    const res = await fetch(`/api/logradouros${qs}`);
    if (res.ok) setLogradouros(await res.json());
  }, []);

  // Initial load
  useEffect(() => { fetchPaises(); }, [fetchPaises]);

  // Load data when switching tabs
  useEffect(() => {
    setSearchTerm('');
    if (activeTab === 'estado')     fetchEstados();
    if (activeTab === 'cidade')     fetchCidades();
    if (activeTab === 'bairro')     fetchBairros();
    if (activeTab === 'logradouro') fetchLogradouros();
  }, [activeTab]);

  // Reload estados when filter changes
  useEffect(() => {
    if (activeTab === 'estado') fetchEstados(filterPaisEstado || undefined);
  }, [filterPaisEstado]);

  useEffect(() => {
    if (activeTab === 'cidade') fetchCidades(filterEstadoCidade || undefined);
  }, [filterEstadoCidade]);

  useEffect(() => {
    if (activeTab === 'bairro') fetchBairros(parseId(filterCidadeBairro) || undefined);
  }, [filterCidadeBairro]);

  useEffect(() => {
    if (activeTab === 'logradouro') fetchLogradouros(parseId(filterBairroLogradouro) || undefined);
  }, [filterBairroLogradouro]);

  // ─── Open / close helpers ───────────────────────────────────────────────────

  const openNew = () => {
    setEditingItem(null);
    if (activeTab === 'pais')       setPaisForm({ idpais: '', nome: '', sigla: '', nacionalidade: '' });
    if (activeTab === 'estado')     setEstadoForm({ idestado: '', nome: '', idpais: '' });
    if (activeTab === 'cidade')     setCidadeForm({ nome: '', idestado: filterEstadoCidade, idpais: '', ddd: '', codigo_ibge: '' });
    if (activeTab === 'bairro')     setBairroForm({ nome: '', idcidade: filterCidadeBairro });
    if (activeTab === 'logradouro') setLogradouroForm({ logradouro: '', tipo: '', cep: '', idbairro: filterBairroLogradouro });
    setIsFormOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    if (activeTab === 'pais')
      setPaisForm({ idpais: item.idpais, nome: item.nome ?? '', sigla: item.sigla ?? '', nacionalidade: item.nacionalidade ?? '' });
    if (activeTab === 'estado')
      setEstadoForm({ idestado: item.idestado, nome: item.nome ?? '', idpais: item.idpais ?? '' });
    if (activeTab === 'cidade')
      setCidadeForm({ nome: item.nome ?? '', idestado: item.idestado ?? '', idpais: item.idpais ?? '', ddd: String(item.ddd ?? ''), codigo_ibge: item.codigo_ibge ?? '' });
    if (activeTab === 'bairro')
      setBairroForm({ nome: item.nome ?? '', idcidade: String(item.idcidade ?? '') });
    if (activeTab === 'logradouro')
      setLogradouroForm({ logradouro: item.logradouro ?? '', tipo: item.tipo ?? '', cep: String(item.cep ?? ''), idbairro: String(item.idbairro ?? '') });
    setIsFormOpen(true);
  };

  const openDelete = (item: any) => {
    setDeletingItem(item);
    setDeleteError(null);
    setIsDeleteOpen(true);
  };

  // ─── Save / Delete ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    let url = '';
    let body: any = {};
    const isEditing = !!editingItem;

    if (activeTab === 'pais') {
      url = isEditing ? `/api/paises/${editingItem.idpais}` : '/api/paises';
      body = { ...paisForm };
    } else if (activeTab === 'estado') {
      url = isEditing ? `/api/estados/${editingItem.idestado}` : '/api/estados';
      body = { ...estadoForm, idpais: estadoForm.idpais || null };
    } else if (activeTab === 'cidade') {
      url = isEditing ? `/api/cidades/${editingItem.idcidade}` : '/api/cidades';
      body = {
        nome: cidadeForm.nome || null,
        idestado: cidadeForm.idestado || null,
        idpais: cidadeForm.idpais || null,
        ddd: parseId(cidadeForm.ddd),
        codigo_ibge: cidadeForm.codigo_ibge || null,
      };
    } else if (activeTab === 'bairro') {
      url = isEditing ? `/api/bairros/${editingItem.idbairro}` : '/api/bairros';
      body = { nome: bairroForm.nome || null, idcidade: parseId(bairroForm.idcidade) };
    } else if (activeTab === 'logradouro') {
      url = isEditing ? `/api/logradouros/${editingItem.idlogradouro}` : '/api/logradouros';
      body = {
        logradouro: logradouroForm.logradouro || null,
        tipo: logradouroForm.tipo || null,
        cep: parseId(logradouroForm.cep),
        idbairro: parseId(logradouroForm.idbairro),
      };
    }

    const res = await fetch(url, {
      method: isEditing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setIsFormOpen(false);
      refreshCurrent();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || 'Erro ao salvar');
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    let url = '';
    if (activeTab === 'pais')       url = `/api/paises/${deletingItem.idpais}`;
    if (activeTab === 'estado')     url = `/api/estados/${deletingItem.idestado}`;
    if (activeTab === 'cidade')     url = `/api/cidades/${deletingItem.idcidade}`;
    if (activeTab === 'bairro')     url = `/api/bairros/${deletingItem.idbairro}`;
    if (activeTab === 'logradouro') url = `/api/logradouros/${deletingItem.idlogradouro}`;

    const res = await fetch(url, { method: 'DELETE' });
    if (res.ok) {
      setIsDeleteOpen(false);
      setDeletingItem(null);
      refreshCurrent();
    } else {
      const err = await res.json().catch(() => ({}));
      setDeleteError(err.detail || 'Erro ao excluir');
    }
  };

  const refreshCurrent = () => {
    if (activeTab === 'pais')       fetchPaises();
    if (activeTab === 'estado')     fetchEstados(filterPaisEstado || undefined);
    if (activeTab === 'cidade')     fetchCidades(filterEstadoCidade || undefined);
    if (activeTab === 'bairro')     fetchBairros(parseId(filterCidadeBairro) || undefined);
    if (activeTab === 'logradouro') fetchLogradouros(parseId(filterBairroLogradouro) || undefined);
  };

  // ─── Filtered lists ──────────────────────────────────────────────────────────

  const sl = searchTerm.toLowerCase();

  const filteredPaises = paises.filter(p =>
    !sl || (p.nome ?? '').toLowerCase().includes(sl) || (p.sigla ?? '').toLowerCase().includes(sl)
  );
  const filteredEstados = estados.filter(e =>
    !sl || (e.nome ?? '').toLowerCase().includes(sl) || e.idestado.toLowerCase().includes(sl)
  );
  const filteredCidades = cidades.filter(c =>
    !sl || (c.nome ?? '').toLowerCase().includes(sl)
  );
  const filteredBairros = bairros.filter(b =>
    !sl || (b.nome ?? '').toLowerCase().includes(sl)
  );
  const filteredLogradouros = logradouros.filter(l =>
    !sl || (l.logradouro ?? '').toLowerCase().includes(sl) || (l.tipo ?? '').toLowerCase().includes(sl)
  );

  // ─── Pagination ──────────────────────────────────────────────────────────────

  const start = (currentPage - 1) * PAGE_SIZE;
  const end   = start + PAGE_SIZE;

  const pagedPaises      = filteredPaises.slice(start, end);
  const pagedEstados     = filteredEstados.slice(start, end);
  const pagedCidades     = filteredCidades.slice(start, end);
  const pagedBairros     = filteredBairros.slice(start, end);
  const pagedLogradouros = filteredLogradouros.slice(start, end);

  const filteredCount = {
    pais:       filteredPaises.length,
    estado:     filteredEstados.length,
    cidade:     filteredCidades.length,
    bairro:     filteredBairros.length,
    logradouro: filteredLogradouros.length,
  }[activeTab];

  const totalPagesCount = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));

  // ─── Helper lookups ──────────────────────────────────────────────────────────

  const paisNome = (id: string | null) => paises.find(p => p.idpais === id)?.nome ?? id ?? '—';
  const estadoNome = (id: string | null) => estados.find(e => e.idestado === id)?.nome ?? id ?? '—';
  const cidadeNome = (id: number | null) => cidades.find(c => c.idcidade === id)?.nome ?? (id ? String(id) : '—');
  const bairroNome = (id: number | null) => bairros.find(b => b.idbairro === id)?.nome ?? (id ? String(id) : '—');

  // ─── Delete label ────────────────────────────────────────────────────────────

  const deleteLabel = () => {
    if (!deletingItem) return '';
    if (activeTab === 'pais')       return deletingItem.nome ?? deletingItem.idpais;
    if (activeTab === 'estado')     return deletingItem.nome ?? deletingItem.idestado;
    if (activeTab === 'cidade')     return deletingItem.nome;
    if (activeTab === 'bairro')     return deletingItem.nome;
    if (activeTab === 'logradouro') return deletingItem.logradouro;
    return '';
  };

  // ─── Table rendering ─────────────────────────────────────────────────────────

  const renderTable = () => {
    if (activeTab === 'pais') return (
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50 border-b border-slate-100">
            <Th>Código</Th><Th>Nome</Th><Th>Sigla</Th><Th>Nacionalidade</Th><Th right>Ações</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {pagedPaises.map(p => (
            <tr key={p.idpais} className="hover:bg-slate-50/50 transition-colors group">
              <Td><span className="font-bold text-[#B21212]">{p.idpais}</span></Td>
              <Td bold>{fmt(p.nome)}</Td>
              <Td>{fmt(p.sigla)}</Td>
              <Td>{fmt(p.nacionalidade)}</Td>
              <Td right><Actions onEdit={() => openEdit(p)} onDelete={() => openDelete(p)} /></Td>
            </tr>
          ))}
          {pagedPaises.length === 0 && <EmptyRow cols={5} />}
        </tbody>
      </table>
    );

    if (activeTab === 'estado') return (
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50 border-b border-slate-100">
            <Th>UF</Th><Th>Nome</Th><Th>País</Th><Th right>Ações</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {pagedEstados.map(e => (
            <tr key={e.idestado} className="hover:bg-slate-50/50 transition-colors group">
              <Td><span className="font-bold text-[#B21212]">{e.idestado}</span></Td>
              <Td bold>{fmt(e.nome)}</Td>
              <Td>{paisNome(e.idpais)}</Td>
              <Td right><Actions onEdit={() => openEdit(e)} onDelete={() => openDelete(e)} /></Td>
            </tr>
          ))}
          {pagedEstados.length === 0 && <EmptyRow cols={4} />}
        </tbody>
      </table>
    );

    if (activeTab === 'cidade') return (
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50 border-b border-slate-100">
            <Th>Código</Th><Th>Nome</Th><Th>Estado</Th><Th>DDD</Th><Th>IBGE</Th><Th right>Ações</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {pagedCidades.map(c => (
            <tr key={c.idcidade} className="hover:bg-slate-50/50 transition-colors group">
              <Td><span className="font-bold text-[#B21212]">{c.idcidade}</span></Td>
              <Td bold>{fmt(c.nome)}</Td>
              <Td>{estadoNome(c.idestado)}</Td>
              <Td>{fmt(c.ddd)}</Td>
              <Td>{fmt(c.codigo_ibge)}</Td>
              <Td right><Actions onEdit={() => openEdit(c)} onDelete={() => openDelete(c)} /></Td>
            </tr>
          ))}
          {pagedCidades.length === 0 && <EmptyRow cols={6} />}
        </tbody>
      </table>
    );

    if (activeTab === 'bairro') return (
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50 border-b border-slate-100">
            <Th>Código</Th><Th>Nome</Th><Th>Cidade</Th><Th right>Ações</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {pagedBairros.map(b => (
            <tr key={b.idbairro} className="hover:bg-slate-50/50 transition-colors group">
              <Td><span className="font-bold text-[#B21212]">{b.idbairro}</span></Td>
              <Td bold>{fmt(b.nome)}</Td>
              <Td>{cidadeNome(b.idcidade)}</Td>
              <Td right><Actions onEdit={() => openEdit(b)} onDelete={() => openDelete(b)} /></Td>
            </tr>
          ))}
          {pagedBairros.length === 0 && <EmptyRow cols={4} />}
        </tbody>
      </table>
    );

    if (activeTab === 'logradouro') return (
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50 border-b border-slate-100">
            <Th>Código</Th><Th>Logradouro</Th><Th>Tipo</Th><Th>CEP</Th><Th>Bairro</Th><Th right>Ações</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {pagedLogradouros.map(l => (
            <tr key={l.idlogradouro} className="hover:bg-slate-50/50 transition-colors group">
              <Td><span className="font-bold text-[#B21212]">{l.idlogradouro}</span></Td>
              <Td bold>{fmt(l.logradouro)}</Td>
              <Td>{fmt(l.tipo)}</Td>
              <Td>{l.cep ? String(l.cep).padStart(8, '0').replace(/(\d{5})(\d{3})/, '$1-$2') : '—'}</Td>
              <Td>{bairroNome(l.idbairro)}</Td>
              <Td right><Actions onEdit={() => openEdit(l)} onDelete={() => openDelete(l)} /></Td>
            </tr>
          ))}
          {pagedLogradouros.length === 0 && <EmptyRow cols={6} />}
        </tbody>
      </table>
    );
  };

  const tabLabel = TABS.find(t => t.key === activeTab)?.label ?? '';

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <Header title="Países / Estados / Cidades" />

      <div className="p-5 space-y-4">
        {/* Tab bar */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-100">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => { setActiveTab(key); setCurrentPage(1); }}
                className={cn(
                  'flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2',
                  activeTab === key
                    ? 'border-[#B21212] text-[#B21212] bg-red-50/40'
                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters + Search + New */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            {/* Cascade filters */}
            {activeTab === 'estado' && (
              <div className="flex flex-col min-w-[180px]">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Filtrar por País</label>
                <select
                  value={filterPaisEstado}
                  onChange={e => { setFilterPaisEstado(e.target.value); setCurrentPage(1); }}
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-[#B21212]/10"
                >
                  <option value="">Todos os países</option>
                  {paises.map(p => <option key={p.idpais} value={p.idpais}>{p.nome} ({p.idpais})</option>)}
                </select>
              </div>
            )}
            {activeTab === 'cidade' && (
              <div className="flex flex-col min-w-[180px]">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Filtrar por Estado</label>
                <select
                  value={filterEstadoCidade}
                  onChange={e => { setFilterEstadoCidade(e.target.value); setCurrentPage(1); }}
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-[#B21212]/10"
                >
                  <option value="">Todos os estados</option>
                  {estados.map(e => <option key={e.idestado} value={e.idestado}>{e.nome} ({e.idestado})</option>)}
                </select>
              </div>
            )}
            {activeTab === 'bairro' && (
              <div className="flex flex-col min-w-[200px]">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Filtrar por Cidade</label>
                <select
                  value={filterCidadeBairro}
                  onChange={e => { setFilterCidadeBairro(e.target.value); setCurrentPage(1); }}
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-[#B21212]/10"
                >
                  <option value="">Todas as cidades</option>
                  {cidades.map(c => <option key={c.idcidade} value={c.idcidade}>{c.nome}</option>)}
                </select>
              </div>
            )}
            {activeTab === 'logradouro' && (
              <div className="flex flex-col min-w-[200px]">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Filtrar por Bairro</label>
                <select
                  value={filterBairroLogradouro}
                  onChange={e => { setFilterBairroLogradouro(e.target.value); setCurrentPage(1); }}
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-[#B21212]/10"
                >
                  <option value="">Todos os bairros</option>
                  {bairros.map(b => <option key={b.idbairro} value={b.idbairro}>{b.nome}</option>)}
                </select>
              </div>
            )}

            <div className="flex-1 min-w-[200px]">
              <Input
                label="Buscar"
                placeholder={`Buscar ${tabLabel.toLowerCase()}...`}
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>

            <Button onClick={openNew} className="gap-2 h-9 px-5 font-bold uppercase tracking-wider">
              <Plus className="h-5 w-5" />
              Novo
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {renderTable()}
          </div>
          <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {filteredCount > 0
                ? `Exibindo ${start + 1}–${Math.min(end, filteredCount)} de ${filteredCount} ${tabLabel.toLowerCase()}`
                : `Nenhum registro encontrado`}
            </span>
            {totalPagesCount > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-7 w-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {Array.from({ length: totalPagesCount }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPagesCount || Math.abs(p - currentPage) <= 1)
                  .reduce<(number | '...')[]>((acc, p, i, arr) => {
                    if (i > 0 && (arr[i - 1] as number) < p - 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '...'
                      ? <span key={`ellipsis-${i}`} className="px-1 text-xs text-slate-400">…</span>
                      : <button
                          key={p}
                          onClick={() => setCurrentPage(p as number)}
                          className={cn(
                            'h-7 min-w-[28px] px-1.5 text-xs font-medium rounded border transition-colors',
                            currentPage === p
                              ? 'bg-[#B21212] border-[#B21212] text-white'
                              : 'border-slate-200 text-slate-600 hover:bg-white hover:text-slate-800'
                          )}
                        >{p}</button>
                  )}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPagesCount, p + 1))}
                  disabled={currentPage === totalPagesCount}
                  className="h-7 w-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Form Modal ─────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingItem ? `Editar ${tabLabel.slice(0, -1)}` : `Novo ${tabLabel.slice(0, -1)}`}
        className="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingItem ? 'Salvar Alterações' : 'Salvar'}</Button>
          </>
        }
      >
        {activeTab === 'pais' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={<span>Código (ID) <span className="text-red-500">*</span></span>}
                placeholder="Ex: BRA"
                value={paisForm.idpais}
                onChange={e => setPaisForm({ ...paisForm, idpais: e.target.value.toUpperCase() })}
                disabled={!!editingItem}
              />
              <Input
                label="Sigla"
                placeholder="Ex: BR"
                value={paisForm.sigla}
                onChange={e => setPaisForm({ ...paisForm, sigla: e.target.value.toUpperCase() })}
              />
            </div>
            <Input
              label={<span>Nome <span className="text-red-500">*</span></span>}
              placeholder="Ex: Brasil"
              value={paisForm.nome}
              onChange={e => setPaisForm({ ...paisForm, nome: e.target.value })}
            />
            <Input
              label="Nacionalidade"
              placeholder="Ex: Brasileiro(a)"
              value={paisForm.nacionalidade}
              onChange={e => setPaisForm({ ...paisForm, nacionalidade: e.target.value })}
            />
          </div>
        )}

        {activeTab === 'estado' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={<span>UF (Código) <span className="text-red-500">*</span></span>}
                placeholder="Ex: SP"
                value={estadoForm.idestado}
                onChange={e => setEstadoForm({ ...estadoForm, idestado: e.target.value.toUpperCase() })}
                disabled={!!editingItem}
              />
              <div className="flex flex-col">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                  País <span className="text-red-500">*</span>
                </label>
                <select
                  value={estadoForm.idpais}
                  onChange={e => setEstadoForm({ ...estadoForm, idpais: e.target.value })}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-[#B21212]/10"
                >
                  <option value="">Selecione...</option>
                  {paises.map(p => <option key={p.idpais} value={p.idpais}>{p.nome} ({p.idpais})</option>)}
                </select>
              </div>
            </div>
            <Input
              label={<span>Nome <span className="text-red-500">*</span></span>}
              placeholder="Ex: São Paulo"
              value={estadoForm.nome}
              onChange={e => setEstadoForm({ ...estadoForm, nome: e.target.value })}
            />
          </div>
        )}

        {activeTab === 'cidade' && (
          <div className="space-y-4">
            <Input
              label={<span>Nome <span className="text-red-500">*</span></span>}
              placeholder="Ex: São Paulo"
              value={cidadeForm.nome}
              onChange={e => setCidadeForm({ ...cidadeForm, nome: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Estado</label>
                <select
                  value={cidadeForm.idestado}
                  onChange={e => {
                    const est = estados.find(x => x.idestado === e.target.value);
                    setCidadeForm({ ...cidadeForm, idestado: e.target.value, idpais: est?.idpais ?? '' });
                  }}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-[#B21212]/10"
                >
                  <option value="">Selecione...</option>
                  {estados.map(e => <option key={e.idestado} value={e.idestado}>{e.nome} ({e.idestado})</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">País</label>
                <select
                  value={cidadeForm.idpais}
                  onChange={e => setCidadeForm({ ...cidadeForm, idpais: e.target.value })}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-[#B21212]/10"
                >
                  <option value="">Selecione...</option>
                  {paises.map(p => <option key={p.idpais} value={p.idpais}>{p.nome}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="DDD"
                placeholder="Ex: 11"
                value={cidadeForm.ddd}
                onChange={e => setCidadeForm({ ...cidadeForm, ddd: e.target.value })}
              />
              <Input
                label="Código IBGE"
                placeholder="Ex: 3550308"
                value={cidadeForm.codigo_ibge}
                onChange={e => setCidadeForm({ ...cidadeForm, codigo_ibge: e.target.value })}
              />
            </div>
          </div>
        )}

        {activeTab === 'bairro' && (
          <div className="space-y-4">
            <Input
              label={<span>Nome <span className="text-red-500">*</span></span>}
              placeholder="Ex: Centro"
              value={bairroForm.nome}
              onChange={e => setBairroForm({ ...bairroForm, nome: e.target.value })}
            />
            <div className="flex flex-col">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Cidade</label>
              <select
                value={bairroForm.idcidade}
                onChange={e => setBairroForm({ ...bairroForm, idcidade: e.target.value })}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-[#B21212]/10"
              >
                <option value="">Selecione...</option>
                {cidades.map(c => <option key={c.idcidade} value={c.idcidade}>{c.nome}</option>)}
              </select>
            </div>
          </div>
        )}

        {activeTab === 'logradouro' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Input
                  label={<span>Logradouro <span className="text-red-500">*</span></span>}
                  placeholder="Ex: Av. Paulista"
                  value={logradouroForm.logradouro}
                  onChange={e => setLogradouroForm({ ...logradouroForm, logradouro: e.target.value })}
                />
              </div>
              <Input
                label="Tipo"
                placeholder="Ex: Avenida"
                value={logradouroForm.tipo}
                onChange={e => setLogradouroForm({ ...logradouroForm, tipo: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="CEP"
                placeholder="Ex: 01310100"
                value={logradouroForm.cep}
                onChange={e => setLogradouroForm({ ...logradouroForm, cep: e.target.value.replace(/\D/g, '') })}
              />
              <div className="flex flex-col">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Bairro</label>
                <select
                  value={logradouroForm.idbairro}
                  onChange={e => setLogradouroForm({ ...logradouroForm, idbairro: e.target.value })}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-[#B21212]/10"
                >
                  <option value="">Selecione...</option>
                  {bairros.map(b => <option key={b.idbairro} value={b.idbairro}>{b.nome}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete Modal ───────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Confirmar Exclusão"
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancelar</Button>
            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Confirmar Exclusão</Button>
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
              Deseja excluir <span className="font-bold text-slate-700">{deleteLabel()}</span>?
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
    </div>
  );
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={cn('px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest', right && 'text-right')}>
      {children}
    </th>
  );
}

function Td({ children, right, bold }: { children: React.ReactNode; right?: boolean; bold?: boolean }) {
  return (
    <td className={cn('px-4 py-2', right && 'text-right')}>
      <span className={cn('text-sm text-slate-700', bold && 'font-bold')}>{children}</span>
    </td>
  );
}

function Actions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={onDelete} title="Excluir">
        <Trash2 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={onEdit} title="Editar">
        <Edit2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-8 text-center text-sm text-slate-400">
        Nenhum registro encontrado
      </td>
    </tr>
  );
}
