import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Plus, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '../utils/cn';
import { DataGrid, GridColumn } from '../components/ui/DataGrid';

interface Servico {
  nome: string;
  unidade?: string | null;
  valor?: number | null;
}

export function ServicoOferecidoPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<Servico | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [servicoToDelete, setServicoToDelete] = useState<Servico | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);

  const filteredServicos = servicos
    .filter(servico => {
      const searchLower = searchTerm.toLowerCase();
      return !searchLower || String(servico.nome || '').toLowerCase().includes(searchLower);
    })
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));

  const servicoCols: GridColumn<Servico>[] = [
    { header: 'Serviço', render: s => <span className="text-xs font-bold text-slate-700">{s.nome}</span> },
    { header: 'Unidade', render: s => <span className="text-xs text-slate-500">{s.unidade || '-'}</span> },
    { header: 'Valor Base', render: s => <span className="text-xs text-slate-500">{s.valor ? `R$ ${Number(s.valor).toFixed(2).replace('.', ',')}` : '-'}</span> },
    {
      header: 'Ações', headerClass: 'px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right',
      cellClass: 'px-4 py-2 text-right',
      render: s => (
        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => handleDeleteRequest(s)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleOpenEditModal(s)} title="Editar"><Edit2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  useEffect(() => {
    fetchServicos();
  }, []);

  const fetchServicos = async () => {
    try {
      const response = await fetch('/api/servico');
      if (response.ok) {
        const data = await response.json();
        setServicos(data);
      } else {
        console.error('Falha ao carregar serviços');
      }
    } catch (error) {
      console.error('Erro na requisição:', error);
    }
  };

  const [formData, setFormData] = useState<Servico & { valorStr?: string }>({
    nome: '',
    unidade: '',
    valor: 0,
    valorStr: ''
  });

  const handleOpenNewModal = () => {
    setEditingServico(null);
    setFormData({ nome: '', unidade: '', valor: null, valorStr: '' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (servico: Servico) => {
    setEditingServico(servico);
    setFormData({ 
      nome: servico.nome, 
      unidade: servico.unidade || '', 
      valor: servico.valor,
      valorStr: servico.valor !== null && servico.valor !== undefined ? String(servico.valor) : ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const missing = [];
    if (!formData.nome.trim()) missing.push('Nome do Serviço');

    if (missing.length > 0) {
      setInvalidFields(missing);
      setIsValidationModalOpen(true);
      return;
    }

    const payload = {
      nome: formData.nome,
      unidade: formData.unidade || null,
      valor: formData.valorStr ? parseFloat(formData.valorStr.replace(',', '.')) : null
    };

    try {
      const isEditing = !!editingServico;
      // Note que update em backend aponta pro nome do serviço pra identificar, pois é primary_key lá
      const url = isEditing ? `/api/servico/${encodeURIComponent(editingServico.nome)}` : '/api/servico';
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        fetchServicos();
        setIsModalOpen(false);
      } else {
        const err = await response.json();
        console.error('Falha ao salvar o Serviço', err);
      }
    } catch (error) {
      console.error('Erro de requisição:', error);
    }
  };

  const handleDeleteRequest = (servico: Servico) => {
    setServicoToDelete(servico);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!servicoToDelete) return;

    try {
      const response = await fetch(`/api/servico/${encodeURIComponent(servicoToDelete.nome)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchServicos();
        setIsDeleteModalOpen(false);
        setServicoToDelete(null);
      } else {
        const errorData = await response.json();
        setDeleteError(errorData.detail || 'Falha ao excluir o serviço.');
      }
    } catch (error) {
      console.error('Erro ao excluir:', error);
      setDeleteError('Erro de conexão com o servidor.');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Cadastro de Serviços Oferecidos" />
      
      <div className="p-5 space-y-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input 
                label="Buscar Serviço" 
                placeholder="Pesquisar por nome..." 
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

        <DataGrid data={filteredServicos} columns={servicoCols} getKey={s => s.nome} emptyMessage="Nenhum serviço encontrado." />
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingServico ? `Editar Serviço` : "Novo Serviço Oferecido"}
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingServico ? 'Salvar Alterações' : 'Salvar Serviço'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input 
            label={<span>Nome do Serviço <span className="text-red-500">*</span></span>} 
            placeholder="Ex: Instalação de Equipamento"
            value={formData.nome || ''}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            disabled={!!editingServico}
          />
          <Input 
            label="Unidade" 
            placeholder="Ex: HORA, UNID, KM"
            value={formData.unidade || ''}
            onChange={(e) => setFormData({ ...formData, unidade: e.target.value })}
          />
          <Input 
             label="Valor (R$)" 
             placeholder="Ex: 150.00"
             type="text"
             value={formData.valorStr || ''}
             onChange={(e) => setFormData({ ...formData, valorStr: e.target.value })}
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
              Deseja realmente excluir o serviço <span className="font-bold text-slate-700">{servicoToDelete?.nome}</span>? 
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
