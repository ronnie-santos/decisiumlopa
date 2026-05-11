import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Plus, Edit2, Trash2, AlertTriangle, FileText } from 'lucide-react';
import { Contrato } from '../types';
import { DataGrid, GridColumn } from '../components/ui/DataGrid';
import { cn } from '../utils/cn';

type FormState = {
  descricao: string;
  clausulas: string;
  ativo: boolean;
};

const EMPTY_FORM: FormState = { descricao: '', clausulas: '', ativo: true };

export function ClausulasOrcamentoPage() {
  const [isModalOpen, setIsModalOpen]               = useState(false);
  const [editingItem, setEditingItem]               = useState<Contrato | null>(null);
  const [items, setItems]                           = useState<Contrato[]>([]);
  const [searchTerm, setSearchTerm]                 = useState('');
  const [filterAtivo, setFilterAtivo]               = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const [isDeleteModalOpen, setIsDeleteModalOpen]   = useState(false);
  const [itemToDelete, setItemToDelete]             = useState<Contrato | null>(null);
  const [deleteError, setDeleteError]               = useState<string | null>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [invalidFields, setInvalidFields]           = useState<string[]>([]);
  const [formData, setFormData]                     = useState<FormState>(EMPTY_FORM);

  const filteredItems = items
    .filter(item => {
      const term = searchTerm.toLowerCase();
      const matchSearch = !term
        || (item.descricao ?? '').toLowerCase().includes(term)
        || (item.clausulas ?? '').toLowerCase().includes(term);
      const matchAtivo =
        filterAtivo === 'todos'
        || (filterAtivo === 'ativo'   && item.ativo)
        || (filterAtivo === 'inativo' && !item.ativo);
      return matchSearch && matchAtivo;
    })
    .sort((a, b) => (a.descricao ?? '').localeCompare(b.descricao ?? ''));

  const cols: GridColumn<Contrato>[] = [
    {
      header: 'Cód.',
      headerClass: 'px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-16',
      cellClass: 'px-4 py-2',
      render: i => <span className="text-sm font-bold text-[#B21212]">{i.idcontrato}</span>,
    },
    {
      header: 'Descrição',
      render: i => (
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-red-50 flex items-center justify-center flex-shrink-0">
            <FileText className="h-3.5 w-3.5 text-[#B21212]" />
          </div>
          <span className="text-sm font-semibold text-slate-700">{i.descricao ?? '—'}</span>
        </div>
      ),
    },
    {
      header: 'Cláusulas',
      render: i => (
        <span className="text-sm text-slate-500 line-clamp-2">
          {i.clausulas ? i.clausulas.substring(0, 120) + (i.clausulas.length > 120 ? '…' : '') : '—'}
        </span>
      ),
    },
    {
      header: 'Status',
      headerClass: 'px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center',
      cellClass: 'px-4 py-2 text-center',
      render: i => (
        <span className={cn(
          'inline-flex px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border',
          i.ativo
            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
            : 'bg-slate-50 text-slate-500 border-slate-200'
        )}>
          {i.ativo ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
    {
      header: 'Ações',
      headerClass: 'px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right',
      cellClass: 'px-4 py-2 text-right',
      render: i => (
        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500"
            onClick={() => handleDeleteRequest(i)} title="Excluir">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600"
            onClick={() => handleOpenEditModal(i)} title="Editar">
            <Edit2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    try {
      const response = await fetch('/api/contratos');
      if (response.ok) {
        const data = await response.json();
        setItems(data.map((d: any) => ({ ...d, id: String(d.idcontrato) })));
      } else {
        console.error('Falha ao carregar cláusulas');
      }
    } catch (error) {
      console.error('Erro na requisição:', error);
    }
  };

  const handleOpenNewModal = () => {
    setEditingItem(null);
    setFormData(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: Contrato) => {
    setEditingItem(item);
    setFormData({
      descricao: item.descricao ?? '',
      clausulas: item.clausulas ?? '',
      ativo:     item.ativo ?? true,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const missing: string[] = [];
    if (!formData.descricao.trim()) missing.push('Descrição');
    if (missing.length > 0) {
      setInvalidFields(missing);
      setIsValidationModalOpen(true);
      return;
    }

    try {
      const isEditing = !!editingItem;
      const url    = isEditing ? `/api/contratos/${editingItem!.idcontrato}` : '/api/contratos';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descricao: formData.descricao.trim(),
          clausulas: formData.clausulas.trim() || null,
          ativo:     formData.ativo,
        }),
      });

      if (response.ok) {
        fetchItems();
        setIsModalOpen(false);
      } else {
        const e = await response.json().catch(() => ({}));
        console.error('Erro:', e.detail || response.status);
      }
    } catch (error) {
      console.error('Erro de requisição:', error);
    }
  };

  const handleDeleteRequest = (item: Contrato) => {
    setItemToDelete(item);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      const response = await fetch(`/api/contratos/${itemToDelete.idcontrato}`, { method: 'DELETE' });
      if (response.ok) {
        fetchItems();
        setIsDeleteModalOpen(false);
        setItemToDelete(null);
      } else {
        const e = await response.json();
        setDeleteError(e.detail || 'Falha ao excluir.');
      }
    } catch {
      setDeleteError('Erro de conexão com o servidor.');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Cláusulas de Orçamento" />

      <div className="p-5 space-y-4">
        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex-1 min-w-[200px]">
              <input
                className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                placeholder="Buscar por descrição ou cláusula..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-40">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Status</label>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#B21212]/20"
                value={filterAtivo}
                onChange={e => setFilterAtivo(e.target.value as any)}
              >
                <option value="todos">Todos</option>
                <option value="ativo">Ativos</option>
                <option value="inativo">Inativos</option>
              </select>
            </div>
            <Button onClick={handleOpenNewModal} className="gap-2 h-9 px-5 font-bold uppercase tracking-wider">
              <Plus className="h-5 w-5" />
              Nova Cláusula
            </Button>
          </div>
        </div>

        <DataGrid
          data={filteredItems}
          columns={cols}
          getKey={i => i.id}
          emptyMessage="Nenhuma cláusula encontrada."
        />
      </div>

      {/* ── Modal de Edição ──────────────────────────────────────────────────── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? `Editar: ${editingItem.descricao}` : 'Nova Cláusula de Orçamento'}
        className="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingItem ? 'Salvar Alterações' : 'Salvar'}</Button>
          </>
        }
      >
        <div className="space-y-5">
          <Input
            label={<span>Descrição <span className="text-red-500">*</span></span>}
            placeholder="Ex: Condições de Pagamento, Prazo de Entrega..."
            value={formData.descricao}
            onChange={e => setFormData({ ...formData, descricao: e.target.value })}
          />

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
              Cláusulas
            </label>
            <textarea
              className="w-full min-h-[180px] rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#B21212]/20 resize-y"
              placeholder="Digite o texto completo da cláusula..."
              value={formData.clausulas}
              onChange={e => setFormData({ ...formData, clausulas: e.target.value })}
            />
          </div>

          <div className="flex flex-col w-40">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
              Status
            </label>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#B21212]/20"
              value={formData.ativo ? 'ativo' : 'inativo'}
              onChange={e => setFormData({ ...formData, ativo: e.target.value === 'ativo' })}
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* ── Modal de Exclusão ────────────────────────────────────────────────── */}
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
              Deseja realmente excluir a cláusula{' '}
              <span className="font-bold text-slate-700">"{itemToDelete?.descricao}"</span>?
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

      {/* ── Modal de Validação ───────────────────────────────────────────────── */}
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
