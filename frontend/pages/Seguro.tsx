import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Plus, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { DataGrid, GridColumn } from '../components/ui/DataGrid';
import { Seguro } from '../types';

export function SeguroPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Seguro | null>(null);
  const [items, setItems] = useState<Seguro[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Seguro | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  
  const emptyForm = (): Partial<Seguro> => ({
    titular: '', seguradora: '', corretora: '', apolice: '',
    tipo: '', veiculo: '', placa: '', inicio: '', termino: '',
    valor_segurado: 0, valor_seguro: 0, parcelas: 1, valor_parcela: 0,
    primeiro_vencimento: '', ultimo_vencimento: '', tipo_pagamento: '',
    ativo: true
  });

  const [formData, setFormData] = useState<Partial<Seguro>>(emptyForm());

  const filteredItems = items
    .filter(item => {
      const searchLower = searchTerm.toLowerCase();
      return !searchLower ||
        (String(item.titular || '').toLowerCase().includes(searchLower)) ||
        (String(item.seguradora || '').toLowerCase().includes(searchLower)) ||
        (String(item.apolice || '').toLowerCase().includes(searchLower));
    })
    .sort((a, b) => Number(a.idseguro) - Number(b.idseguro));

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    try {
      const response = await fetch('/api/seguro');
      if (response.ok) {
        const data = await response.json();
        setItems(data.map((d: any) => ({ ...d, id: String(d.idseguro) })));
      } else { console.error('Falha ao carregar seguros'); }
    } catch (error) { console.error('Erro na requisição:', error); }
  };

  const handleOpenNewModal = () => { setEditingItem(null); setFormData(emptyForm()); setIsModalOpen(true); };

  const handleOpenEditModal = (item: Seguro) => {
    setEditingItem(item);
    setFormData({ ...item });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const missing: string[] = [];
    if (!(formData.titular || '').trim()) missing.push('Titular');
    if (!(formData.seguradora || '').trim()) missing.push('Seguradora');

    if (missing.length > 0) { setInvalidFields(missing); setIsValidationModalOpen(true); return; }

    try {
      const isEditing = !!editingItem;
      const url = isEditing ? `/api/seguro/${editingItem!.idseguro}` : '/api/seguro';
      const method = isEditing ? 'PUT' : 'POST';
      
      const payload = {
        ...formData,
        inicio: formData.inicio || null,
        termino: formData.termino || null,
        primeiro_vencimento: formData.primeiro_vencimento || null,
        ultimo_vencimento: formData.ultimo_vencimento || null,
        valor_segurado: Number(formData.valor_segurado) || 0,
        valor_seguro: Number(formData.valor_seguro) || 0,
        valor_parcela: Number(formData.valor_parcela) || 0,
        parcelas: Number(formData.parcelas) || 1
      };

      const response = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) { fetchItems(); setIsModalOpen(false); }
      else { const e = await response.json().catch(() => ({})); console.error('Erro:', e.detail || response.status); }
    } catch (error) { console.error('Erro de requisição:', error); }
  };

  const handleDeleteRequest = (item: Seguro) => { setItemToDelete(item); setDeleteError(null); setIsDeleteModalOpen(true); };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      const response = await fetch(`/api/seguro/${itemToDelete.idseguro}`, { method: 'DELETE' });
      if (response.ok) { fetchItems(); setIsDeleteModalOpen(false); setItemToDelete(null); }
      else { const e = await response.json(); setDeleteError(e.detail || 'Falha ao excluir.'); }
    } catch { setDeleteError('Erro de conexão com o servidor.'); }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Seguros" />
      <div className="p-5 space-y-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex-1 min-w-[200px]">
              <input className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" placeholder="Buscar por titular, seguradora ou apólice..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button onClick={handleOpenNewModal} className="gap-2 h-9 px-5 font-bold uppercase tracking-wider"><Plus className="h-5 w-5" />Novo</Button>
          </div>
        </div>
        
        {(() => {
          const cols: GridColumn<Seguro>[] = [
            { header: 'Código', render: item => <span className="text-xs font-bold text-[#B21212]">{item.idseguro}</span> },
            { header: 'Titular', render: item => <span className="text-xs font-bold text-slate-700">{item.titular}</span> },
            { header: 'Seguradora', render: item => <span className="text-xs text-slate-500">{item.seguradora}</span> },
            { header: 'Apólice', render: item => <span className="text-xs text-slate-500">{item.apolice}</span> },
            {
              header: 'Ações',
              headerClass: 'px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right',
              cellClass: 'px-4 py-2 text-right',
              render: item => (
                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => handleDeleteRequest(item)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleOpenEditModal(item)} title="Editar"><Edit2 className="h-4 w-4" /></Button>
                </div>
              ),
            },
          ];
          return <DataGrid data={filteredItems} columns={cols} getKey={item => item.id} emptyMessage="Nenhum seguro encontrado." />;
        })()}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? `Editar Seguro #${editingItem.idseguro}` : "Novo Seguro"} className="max-w-4xl"
        footer={<><Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button><Button onClick={handleSave}>{editingItem ? 'Salvar Alterações' : 'Salvar'}</Button></>}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto pr-2">
          <Input label={<span>Titular <span className="text-red-500">*</span></span>} placeholder="Ex: Lopa Guindadas" value={formData.titular} onChange={(e) => setFormData({ ...formData, titular: e.target.value })} />
          <Input label={<span>Seguradora <span className="text-red-500">*</span></span>} placeholder="Ex: Porto Seguro" value={formData.seguradora} onChange={(e) => setFormData({ ...formData, seguradora: e.target.value })} />
          <Input label="Corretora" placeholder="Ex: Lopa Corretora" value={formData.corretora} onChange={(e) => setFormData({ ...formData, corretora: e.target.value })} />
          
          <Input label="Apólice" placeholder="Ex: 0001234567" value={formData.apolice} onChange={(e) => setFormData({ ...formData, apolice: e.target.value })} />
          <Input label="Tipo" placeholder="Ex: Frota" value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })} />
          <Input label="Veículo" placeholder="Ex: Caminhão Mercedes" value={formData.veiculo} onChange={(e) => setFormData({ ...formData, veiculo: e.target.value })} />
          <Input label="Placa" placeholder="Ex: ABC-1234" value={formData.placa} onChange={(e) => setFormData({ ...formData, placa: e.target.value })} />
          
          <Input type="date" label="Início Vigência" value={formData.inicio || ''} onChange={(e) => setFormData({ ...formData, inicio: e.target.value })} />
          <Input type="date" label="Término Vigência" value={formData.termino || ''} onChange={(e) => setFormData({ ...formData, termino: e.target.value })} />
          
          <Input type="number" label="Valor Segurado (R$)" value={formData.valor_segurado} onChange={(e) => setFormData({ ...formData, valor_segurado: Number(e.target.value) })} />
          <Input type="number" label="Valor Seguro (R$)" value={formData.valor_seguro} onChange={(e) => setFormData({ ...formData, valor_seguro: Number(e.target.value) })} />
          
          <Input type="number" label="Parcelas" value={formData.parcelas} onChange={(e) => setFormData({ ...formData, parcelas: Number(e.target.value) })} />
          <Input type="number" label="Valor Parcela (R$)" value={formData.valor_parcela} onChange={(e) => setFormData({ ...formData, valor_parcela: Number(e.target.value) })} />
          
          <Input type="date" label="1º Vencimento" value={formData.primeiro_vencimento || ''} onChange={(e) => setFormData({ ...formData, primeiro_vencimento: e.target.value })} />
          <Input type="date" label="Último Vencimento" value={formData.ultimo_vencimento || ''} onChange={(e) => setFormData({ ...formData, ultimo_vencimento: e.target.value })} />
          
          <Input label="Tipo Pagamento" placeholder="Ex: Boleto" value={formData.tipo_pagamento} onChange={(e) => setFormData({ ...formData, tipo_pagamento: e.target.value })} />
          
          <div className="flex items-center gap-2 pt-8">
            <input type="checkbox" id="ativo" checked={formData.ativo} onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })} />
            <label htmlFor="ativo" className="text-sm font-medium text-slate-700">Seguro Ativo</label>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirmar Exclusão" className="max-w-md"
        footer={<><Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancelar</Button><Button onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">Confirmar Exclusão</Button></>}>
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center"><AlertTriangle className="h-8 w-8 text-red-600" /></div>
          <div><h4 className="text-lg font-bold text-slate-800">Você tem certeza?</h4>
            <p className="text-sm text-slate-500 mt-1">Deseja realmente excluir o seguro de <span className="font-bold text-slate-700">{itemToDelete?.titular}</span>? Esta ação não pode ser desfeita.</p></div>
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
