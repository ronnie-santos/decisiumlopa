import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Plus, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { FluxoFinanceiro } from '../types';
import { DataGrid, GridColumn } from '../components/ui/DataGrid';

export function FluxoFinanceiroPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FluxoFinanceiro | null>(null);
  const [items, setItems] = useState<FluxoFinanceiro[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<FluxoFinanceiro | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  
  const [formData, setFormData] = useState<{ 
    idfluxo: string; 
    descricao: string; 
    fluxo_pai: string; 
    tipo: string; 
    movimento: string; 
    codigo_importacaoStr: string; 
    nivelStr: string;
  }>({ 
    idfluxo: '', 
    descricao: '',
    fluxo_pai: '',
    tipo: '',
    movimento: '',
    codigo_importacaoStr: '',
    nivelStr: ''
  });

  const filteredItems = items
    .filter(item => {
      const searchLower = searchTerm.toLowerCase();
      return !searchLower ||
        String(item.descricao || '').toLowerCase().includes(searchLower) ||
        String(item.idfluxo || '').toLowerCase().includes(searchLower);
    })
    .sort((a, b) => String(a.idfluxo).localeCompare(String(b.idfluxo)));

  const fluxoCols: GridColumn<FluxoFinanceiro>[] = [
    { header: 'Código', render: i => <span className="text-sm font-bold text-[#B21212]">{i.idfluxo}</span> },
    {
      header: 'Descrição',
      render: i => (
        <>
          <span className="text-sm font-medium text-slate-700">{i.descricao}</span>
          {i.fluxo_pai && <div className="text-xs text-slate-400 mt-0.5">Pai: {i.fluxo_pai}</div>}
        </>
      ),
    },
    {
      header: 'Tipo',
      render: i => (
        <>
          <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
            {i.tipo === 'A' ? 'Analítico' : i.tipo === 'S' ? 'Sintético' : typeof i.tipo === 'string' ? i.tipo : '-'}
          </span>
          {i.movimento && (
            <span className={`ml-2 text-xs font-medium px-2 py-1 rounded-md ${i.movimento === 'R' ? 'text-green-600 bg-green-50' : i.movimento === 'D' ? 'text-red-600 bg-red-50' : 'text-slate-600 bg-slate-50'}`}>
              {i.movimento === 'R' ? 'Receita' : i.movimento === 'D' ? 'Despesa' : i.movimento}
            </span>
          )}
        </>
      ),
    },
    {
      header: 'Nível', headerClass: 'px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center',
      cellClass: 'px-4 py-2 text-center',
      render: i => <span className="text-sm text-slate-500">{i.nivel || '-'}</span>,
    },
    {
      header: 'Ações', headerClass: 'px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right',
      cellClass: 'px-4 py-2 text-right',
      render: i => (
        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => handleDeleteRequest(i)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleOpenEditModal(i)} title="Editar"><Edit2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    try {
      const response = await fetch('/api/fluxo-financeiro');
      if (response.ok) {
        const data = await response.json();
        setItems(data.map((d: any) => ({ ...d, id: String(d.idfluxo) })));
      } else { console.error('Falha ao carregar fluxos financeiros'); }
    } catch (error) { console.error('Erro na requisição:', error); }
  };

  const handleOpenNewModal = () => { 
    setEditingItem(null); 
    setFormData({ 
      idfluxo: '', 
      descricao: '',
      fluxo_pai: '',
      tipo: '',
      movimento: '',
      codigo_importacaoStr: '',
      nivelStr: ''
    }); 
    setIsModalOpen(true); 
  };

  const handleOpenEditModal = (item: FluxoFinanceiro) => {
    setEditingItem(item);
    setFormData({ 
      idfluxo: item.idfluxo || '', 
      descricao: item.descricao || '',
      fluxo_pai: item.fluxo_pai || '',
      tipo: item.tipo || '',
      movimento: item.movimento || '',
      codigo_importacaoStr: item.codigo_importacao ? String(item.codigo_importacao) : '',
      nivelStr: item.nivel ? String(item.nivel) : ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const missing: string[] = [];
    if (!editingItem && !(formData.idfluxo || '').trim()) missing.push('Código');
    if (!(formData.descricao || '').trim()) missing.push('Descrição');
    if (missing.length > 0) { setInvalidFields(missing); setIsValidationModalOpen(true); return; }
    
    try {
      const isEditing = !!editingItem;
      const url = isEditing ? `/api/fluxo-financeiro/${editingItem!.idfluxo}` : '/api/fluxo-financeiro';
      const method = isEditing ? 'PUT' : 'POST';
      
      const payload: any = {
        idfluxo: formData.idfluxo.trim(),
        descricao: formData.descricao.trim(),
        fluxo_pai: formData.fluxo_pai.trim() || null,
        tipo: formData.tipo || null,
        movimento: formData.movimento || null,
        codigo_importacao: formData.codigo_importacaoStr ? parseInt(formData.codigo_importacaoStr) : null,
        nivel: formData.nivelStr ? parseInt(formData.nivelStr) : null
      };

      const response = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) { 
        fetchItems(); 
        setIsModalOpen(false); 
      }
      else { 
        const e = await response.json().catch(() => ({})); 
        console.error('Erro:', e.detail || response.status); 
      }
    } catch (error) { console.error('Erro de requisição:', error); }
  };

  const handleDeleteRequest = (item: FluxoFinanceiro) => { setItemToDelete(item); setDeleteError(null); setIsDeleteModalOpen(true); };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      const response = await fetch(`/api/fluxo-financeiro/${itemToDelete.idfluxo}`, { method: 'DELETE' });
      if (response.ok) { fetchItems(); setIsDeleteModalOpen(false); setItemToDelete(null); }
      else { const e = await response.json(); setDeleteError(e.detail || 'Falha ao excluir.'); }
    } catch { setDeleteError('Erro de conexão com o servidor.'); }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Fluxo Financeiro" />
      <div className="p-5 space-y-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex-1 min-w-[200px]">
              <input className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" placeholder="Buscar fluxo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button onClick={handleOpenNewModal} className="gap-2 h-9 px-5 font-bold uppercase tracking-wider"><Plus className="h-5 w-5" />Novo</Button>
          </div>
        </div>
        <DataGrid data={filteredItems} columns={fluxoCols} getKey={i => i.id} emptyMessage="Nenhum fluxo encontrado." />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? `Editar: ${editingItem.idfluxo}` : "Novo Fluxo Financeiro"} className="max-w-2xl"
        footer={<><Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button><Button onClick={handleSave}>{editingItem ? 'Salvar Alterações' : 'Salvar'}</Button></>}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-1">
             {!editingItem ? (
               <Input label={<span>Código <span className="text-red-500">*</span></span>} placeholder="Ex: 1.1.01" value={formData.idfluxo} onChange={(e) => setFormData({ ...formData, idfluxo: e.target.value })} />
             ) : (
               <Input label="Código" value={formData.idfluxo} disabled />
             )}
          </div>
          <div className="col-span-1">
             <Input label="Fluxo Pai" placeholder="Ex: 1.1" value={formData.fluxo_pai} onChange={(e) => setFormData({ ...formData, fluxo_pai: e.target.value })} />
          </div>

          <div className="col-span-2">
            <Input label={<span>Descrição <span className="text-red-500">*</span></span>} placeholder="Ex: Receitas de Locação" value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} />
          </div>

          <div className="col-span-1 space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Tipo</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
            >
              <option value="">Selecione...</option>
              <option value="A">Analítico</option>
              <option value="S">Sintético</option>
            </select>
          </div>

          <div className="col-span-1 space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Movimentação</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
              value={formData.movimento}
              onChange={(e) => setFormData({ ...formData, movimento: e.target.value })}
            >
              <option value="">Selecione...</option>
              <option value="R">Receita</option>
              <option value="D">Despesa</option>
            </select>
          </div>

          <div className="col-span-1">
             <Input label="Nível" type="number" placeholder="Ex: 3" value={formData.nivelStr} onChange={(e) => setFormData({ ...formData, nivelStr: e.target.value })} />
          </div>

          <div className="col-span-1">
             <Input label="Cód. Importação" type="number" placeholder="Ex: 10001" value={formData.codigo_importacaoStr} onChange={(e) => setFormData({ ...formData, codigo_importacaoStr: e.target.value })} />
          </div>
        </div>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirmar Exclusão" className="max-w-md"
        footer={<><Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancelar</Button><Button onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">Confirmar Exclusão</Button></>}>
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center"><AlertTriangle className="h-8 w-8 text-red-600" /></div>
          <div><h4 className="text-lg font-bold text-slate-800">Você tem certeza?</h4>
            <p className="text-sm text-slate-500 mt-1">Deseja realmente excluir o fluxo <span className="font-bold text-slate-700">{itemToDelete?.idfluxo} - {itemToDelete?.descricao}</span>? Esta ação não pode ser desfeita.</p></div>
          {deleteError && <div className="w-full p-4 bg-red-50 border border-red-100 rounded-lg"><p className="text-xs text-red-600 font-medium">{deleteError}</p></div>}
        </div>
      </Modal>

      <Modal isOpen={isValidationModalOpen} onClose={() => setIsValidationModalOpen(false)} title="Campos Obrigatórios" className="max-w-md"
        footer={<Button onClick={() => setIsValidationModalOpen(false)} className="px-8">Entendido</Button>}>
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="h-16 w-16 bg-amber-50 rounded-full flex items-center justify-center"><AlertTriangle className="h-8 w-8 text-amber-500" /></div>
          <div><h4 className="text-lg font-bold text-slate-800">Informações Faltando</h4>
            <p className="text-sm text-slate-500 mt-1">Para prosseguir com o cadastro, os seguintes campos devem ser preenchidos:</p></div>
          <div className="w-full space-y-2">
            {invalidFields.map((field, index) => (
              <div key={index} className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>{field}
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
