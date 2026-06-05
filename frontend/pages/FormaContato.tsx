import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Plus, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { FormaContato } from '../types';
import { DataGrid, GridColumn } from '../components/ui/DataGrid';

export function FormaContatoPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FormaContato | null>(null);
  const [items, setItems] = useState<FormaContato[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<FormaContato | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const [formData, setFormData] = useState<{ nome: string }>({ nome: '' });

  const filteredItems = items
    .filter(item => {
      const searchLower = searchTerm.toLowerCase();
      return !searchLower || String(item.nome || '').toLowerCase().includes(searchLower);
    })
    .sort((a, b) => Number(a.idformacontato) - Number(b.idformacontato));

  const cols: GridColumn<FormaContato>[] = [
    { header: 'Código', render: i => <span className="text-xs font-bold text-[#B21212]">{i.idformacontato}</span> },
    { header: 'Nome', render: i => <span className="text-xs font-bold text-slate-700">{i.nome}</span> },
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
      const response = await fetch('/api/formacontato');
      if (response.ok) {
        const data = await response.json();
        setItems(data.map((d: any) => ({ ...d, id: String(d.idformacontato) })));
      } else { console.error('Falha ao carregar formas de contato'); }
    } catch (error) { console.error('Erro na requisição:', error); }
  };

  const handleOpenNewModal = () => { setEditingItem(null); setFormData({ nome: '' }); setIsModalOpen(true); };

  const handleOpenEditModal = (item: FormaContato) => {
    setEditingItem(item);
    setFormData({ nome: item.nome || '' });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const missing: string[] = [];
    if (!(formData.nome || '').trim()) missing.push('Nome');
    if (missing.length > 0) { setInvalidFields(missing); setIsValidationModalOpen(true); return; }
    try {
      const isEditing = !!editingItem;
      const url = isEditing ? `/api/formacontato/${editingItem!.idformacontato}` : '/api/formacontato';
      const method = isEditing ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: formData.nome.trim() })
      });
      if (response.ok) { fetchItems(); setIsModalOpen(false); }
      else { const e = await response.json().catch(() => ({})); console.error('Erro:', e.detail || response.status); }
    } catch (error) { console.error('Erro de requisição:', error); }
  };

  const handleDeleteRequest = (item: FormaContato) => { setItemToDelete(item); setDeleteError(null); setIsDeleteModalOpen(true); };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      const response = await fetch(`/api/formacontato/${itemToDelete.idformacontato}`, { method: 'DELETE' });
      if (response.ok) { fetchItems(); setIsDeleteModalOpen(false); setItemToDelete(null); }
      else { const e = await response.json(); setDeleteError(e.detail || 'Falha ao excluir.'); }
    } catch { setDeleteError('Erro de conexão com o servidor.'); }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Formas de Contato" />
      <div className="p-5 space-y-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex-1 min-w-[200px]">
              <input className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" placeholder="Buscar forma de contato..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button onClick={handleOpenNewModal} className="gap-2 h-9 px-5 font-bold uppercase tracking-wider"><Plus className="h-5 w-5" />Novo</Button>
          </div>
        </div>
        <DataGrid data={filteredItems} columns={cols} getKey={i => i.id} emptyMessage="Nenhuma forma de contato encontrada." />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? `Editar: ${editingItem.nome}` : "Nova Forma de Contato"} className="max-w-md"
        footer={<><Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button><Button onClick={handleSave}>{editingItem ? 'Salvar Alterações' : 'Salvar'}</Button></>}>
        <div className="space-y-4">
          <Input label={<span>Nome <span className="text-red-500">*</span></span>} placeholder="Ex: WhatsApp" value={formData.nome} onChange={(e) => setFormData({ nome: e.target.value })} />
        </div>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirmar Exclusão" className="max-w-md"
        footer={<><Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancelar</Button><Button onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">Confirmar Exclusão</Button></>}>
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center"><AlertTriangle className="h-8 w-8 text-red-600" /></div>
          <div><h4 className="text-lg font-bold text-slate-800">Você tem certeza?</h4>
            <p className="text-sm text-slate-500 mt-1">Deseja realmente excluir <span className="font-bold text-slate-700">{itemToDelete?.nome}</span>? Esta ação não pode ser desfeita.</p></div>
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
