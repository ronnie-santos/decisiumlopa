import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Plus, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { Programa } from '../types';
import { DataGrid, GridColumn } from '../components/ui/DataGrid';

export function ProgramasPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrograma, setEditingPrograma] = useState<Programa | null>(null);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [programaToDelete, setProgramaToDelete] = useState<Programa | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Omit<Programa, 'id' | 'prg_codigo'>>({
    nome: '',
    descricao: '',
    grupo: 0,
  });

  const filteredProgramas = programas
    .filter(p => {
      const term = searchTerm.toLowerCase();
      return !term ||
        String(p.nome || '').toLowerCase().includes(term) ||
        String(p.descricao || '').toLowerCase().includes(term);
    })
    .sort((a, b) => Number(a.id) - Number(b.id));

  const cols: GridColumn<Programa>[] = [
    { header: 'Código', render: p => <span className="text-sm font-bold text-[#B21212]">{p.id}</span> },
    { header: 'Nome', render: p => <span className="text-sm font-bold text-slate-700">{p.nome}</span> },
    { header: 'Descrição', render: p => <span className="text-sm text-slate-500">{p.descricao}</span> },
    { header: 'Grupo', render: p => <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-2 rounded-full bg-slate-100 text-xs font-bold text-slate-600">{p.grupo}</span> },
    {
      header: 'Ações', headerClass: 'px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right',
      cellClass: 'px-4 py-2 text-right',
      render: p => (
        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => handleDeleteRequest(p)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleOpenEditModal(p)} title="Editar"><Edit2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  useEffect(() => {
    fetchProgramas();
  }, []);

  const fetchProgramas = async () => {
    try {
      const response = await fetch('/api/programas');
      if (response.ok) {
        const data = await response.json();
        setProgramas(data.map((p: any) => ({ ...p, id: String(p.prg_codigo) })));
      } else {
        console.error('Falha ao carregar programas');
      }
    } catch (error) {
      console.error('Erro na requisição:', error);
    }
  };

  const handleOpenNewModal = () => {
    setEditingPrograma(null);
    setFormData({ nome: '', descricao: '', grupo: 0 });
    setSaveError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (programa: Programa) => {
    setEditingPrograma(programa);
    setFormData({ nome: programa.nome, descricao: programa.descricao, grupo: programa.grupo });
    setSaveError(null);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const missing: string[] = [];
    if (!formData.nome.trim()) missing.push('Nome');
    if (!formData.descricao.trim()) missing.push('Descrição');
    if (!formData.grupo || formData.grupo <= 0) missing.push('Grupo');

    if (missing.length > 0) {
      setInvalidFields(missing);
      setIsValidationModalOpen(true);
      return;
    }

    setSaveError(null);
    try {
      const isEditing = !!editingPrograma;
      const url = isEditing ? `/api/programas/${editingPrograma!.prg_codigo}` : '/api/programas';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, grupo: Number(formData.grupo) }),
      });

      if (response.ok) {
        fetchProgramas();
        setIsModalOpen(false);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setSaveError(errorData.detail || 'Falha ao salvar o programa. Tente novamente.');
      }
    } catch (error) {
      setSaveError('Erro de conexão com o servidor.');
    }
  };

  const handleDeleteRequest = (programa: Programa) => {
    setProgramaToDelete(programa);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!programaToDelete) return;

    try {
      const response = await fetch(`/api/programas/${programaToDelete.prg_codigo}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchProgramas();
        setIsDeleteModalOpen(false);
        setProgramaToDelete(null);
      } else {
        const errorData = await response.json();
        setDeleteError(errorData.detail || 'Falha ao excluir o programa.');
      }
    } catch (error) {
      console.error('Erro ao excluir:', error);
      setDeleteError('Erro de conexão com o servidor.');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Cadastro de Programas" />

      <div className="p-5 space-y-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                label="Buscar"
                placeholder="Nome ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button onClick={handleOpenNewModal} className="gap-2 h-9 px-5 font-bold uppercase tracking-wider">
              <Plus className="h-5 w-5" />
              Novo
            </Button>
          </div>
        </div>

        <DataGrid data={filteredProgramas} columns={cols} getKey={p => p.id} emptyMessage="Nenhum programa encontrado." />
      </div>

      {/* Modal Formulário */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPrograma ? `Editar Programa — ${editingPrograma.nome}` : 'Novo Programa'}
        className="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingPrograma ? 'Salvar Alterações' : 'Salvar Programa'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nome *"
            placeholder="Ex: Clientes"
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
          />
          <Input
            label="Descrição *"
            placeholder="Ex: Módulo de cadastro de clientes"
            value={formData.descricao}
            onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
          />
          <Input
            label="Grupo *"
            type="number"
            placeholder="Ex: 1"
            value={formData.grupo || ''}
            onChange={(e) => setFormData({ ...formData, grupo: Number(e.target.value) })}
          />
          {saveError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-xs text-red-600 font-medium">{saveError}</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal Exclusão */}
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
              Deseja realmente excluir o programa <span className="font-bold text-slate-700">{programaToDelete?.nome}</span>?
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

      {/* Modal Validação */}
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
