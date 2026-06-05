import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Plus, Search, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { Cargo } from '../types';
import { cn } from '../utils/cn';
import { DataGrid, GridColumn } from '../components/ui/DataGrid';

export function CargoPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCargo, setEditingCargo] = useState<Cargo | null>(null);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [cargoToDelete, setCargoToDelete] = useState<Cargo | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);

  const filteredCargos = cargos
    .filter(cargo => {
      const searchLower = searchTerm.toLowerCase();
      return !searchLower || String(cargo.nome || '').toLowerCase().includes(searchLower);
    })
    .sort((a, b) => Number(a.id) - Number(b.id));

  const cargoCols: GridColumn<Cargo>[] = [
    { header: 'Código', render: c => <span className="text-xs font-bold text-[#B21212]">{c.id}</span> },
    { header: 'Nome do Cargo', render: c => <span className="text-xs font-bold text-slate-700">{c.nome}</span> },
    {
      header: 'Ações', headerClass: 'px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right',
      cellClass: 'px-4 py-2 text-right',
      render: c => (
        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => handleDeleteRequest(c)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleOpenEditModal(c)} title="Editar"><Edit2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  useEffect(() => {
    fetchCargos();
  }, []);

  const fetchCargos = async () => {
    try {
      const response = await fetch('/api/cargos');
      if (response.ok) {
        const data = await response.json();
        const mappedData = data.map((cargo: any) => ({
          ...cargo,
          id: String(cargo.idcargo)
        }));
        setCargos(mappedData);
      } else {
        console.error('Falha ao carregar cargos');
      }
    } catch (error) {
      console.error('Erro na requisição:', error);
    }
  };

  const [formData, setFormData] = useState<Omit<Cargo, 'id' | 'idcargo'>>({
    nome: ''
  });

  const handleOpenNewModal = () => {
    setEditingCargo(null);
    setFormData({ nome: '' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cargo: Cargo) => {
    setEditingCargo(cargo);
    setFormData({ nome: cargo.nome });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const missing = [];
    if (!formData.nome.trim()) missing.push('Nome do Cargo');

    if (missing.length > 0) {
      setInvalidFields(missing);
      setIsValidationModalOpen(true);
      return;
    }

    try {
      const isEditing = !!editingCargo;
      const url = isEditing ? `/api/cargos/${editingCargo.id}` : '/api/cargos';
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        fetchCargos();
        setIsModalOpen(false);
      } else {
        console.error('Falha ao salvar o Cargo');
      }
    } catch (error) {
      console.error('Erro de requisição:', error);
    }
  };

  const handleDeleteRequest = (cargo: Cargo) => {
    setCargoToDelete(cargo);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!cargoToDelete) return;

    try {
      const response = await fetch(`/api/cargos/${cargoToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchCargos();
        setIsDeleteModalOpen(false);
        setCargoToDelete(null);
      } else {
        const errorData = await response.json();
        setDeleteError(errorData.detail || 'Falha ao excluir o cargo.');
      }
    } catch (error) {
      console.error('Erro ao excluir:', error);
      setDeleteError('Erro de conexão com o servidor.');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Cadastro de Cargos" />
      
      <div className="p-5 space-y-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input 
                label="Nome do Cargo" 
                placeholder="Buscar cargo..." 
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

        <DataGrid
          data={filteredCargos}
          columns={cargoCols}
          getKey={c => c.id}
          emptyMessage="Nenhum cargo encontrado."
        />
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingCargo ? `Editar Cargo ${editingCargo.nome}` : "Novo Cargo"}
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingCargo ? 'Salvar Alterações' : 'Salvar Cargo'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input 
            label={<span>Nome do Cargo <span className="text-red-500">*</span></span>} 
            placeholder="Ex: Motorista"
            value={formData.nome || ''}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
          />
        </div>
      </Modal>

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
              Deseja realmente excluir o cargo <span className="font-bold text-slate-700">{cargoToDelete?.nome}</span>? 
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
