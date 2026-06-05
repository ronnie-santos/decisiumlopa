import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Plus, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { DataGrid, GridColumn } from '../components/ui/DataGrid';
import { Licenca, Equipment } from '../types';

export function LicencaPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Licenca | null>(null);
  const [items, setItems] = useState<Licenca[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Licenca | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);

  const filteredItems = items
    .filter(item => {
      const searchLower = searchTerm.toLowerCase();
      return !searchLower ||
        (String(item.autorizacao || '').toLowerCase().includes(searchLower)) ||
        (String(item.orgao || '').toLowerCase().includes(searchLower)) ||
        (String(item.despachante || '').toLowerCase().includes(searchLower));
    })
    .sort((a, b) => Number(a.idlicenca) - Number(b.idlicenca));

  useEffect(() => { 
    fetchItems();
    fetchEquipments();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await fetch('/api/licenca');
      if (response.ok) {
        const data = await response.json();
        setItems(data.map((item: any) => ({ ...item, id: String(item.idlicenca) })));
      } else { console.error('Falha ao carregar itens'); }
    } catch (error) { console.error('Erro na requisição:', error); }
  };

  const fetchEquipments = async () => {
    try {
      const response = await fetch('/api/equipamentos');
      if (response.ok) {
        const data = await response.json();
        setEquipments(data);
      } else { console.error('Falha ao carregar equipamentos'); }
    } catch (error) { console.error('Erro na requisição equipamentos:', error); }
  };

  const emptyForm = {
    data: '', vencimento: '', largura: '', comprimento: '', altura: '',
    horario: '', carretas: '', pesos: '', tara: '', peso_carga: '',
    pbt: '', autorizacao: '', orgao: '', idequipamentoStr: '', estado: '', despachante: ''
  };

  const [formData, setFormData] = useState({ ...emptyForm });

  const handleOpenNewModal = () => { 
    setEditingItem(null); 
    setFormData({ ...emptyForm }); 
    setIsModalOpen(true); 
  };

  const handleOpenEditModal = (item: Licenca) => {
    setEditingItem(item);
    setFormData({
      data: item.data || '', 
      vencimento: item.vencimento || '', 
      largura: item.largura || '',
      comprimento: item.comprimento || '', 
      altura: item.altura || '', 
      horario: item.horario || '',
      carretas: item.carretas || '', 
      pesos: item.pesos || '', 
      tara: item.tara || '', 
      peso_carga: item.peso_carga || '',
      pbt: item.pbt || '', 
      autorizacao: item.autorizacao || '', 
      orgao: item.orgao || '',
      idequipamentoStr: item.idequipamento ? String(item.idequipamento) : '', 
      estado: item.estado || '', 
      despachante: item.despachante || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const missing: string[] = [];
    if (!(formData.autorizacao || '').trim()) missing.push('Autorização');
    if (!(formData.orgao || '').trim()) missing.push('Órgão');

    if (missing.length > 0) { setInvalidFields(missing); setIsValidationModalOpen(true); return; }

    try {
      const isEditing = !!editingItem;
      const url = isEditing ? `/api/licenca/${editingItem.id}` : '/api/licenca';
      const method = isEditing ? 'PUT' : 'POST';
      
      const payload = {
        data: formData.data || null,
        vencimento: formData.vencimento || null,
        largura: formData.largura || null,
        comprimento: formData.comprimento || null,
        altura: formData.altura || null,
        horario: formData.horario || null,
        carretas: formData.carretas || null,
        pesos: formData.pesos || null,
        tara: formData.tara || null,
        peso_carga: formData.peso_carga || null,
        pbt: formData.pbt || null,
        autorizacao: formData.autorizacao,
        orgao: formData.orgao,
        idequipamento: formData.idequipamentoStr ? parseInt(formData.idequipamentoStr) : null,
        estado: formData.estado || null,
        despachante: formData.despachante || null
      };
      
      const response = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) { 
        fetchItems(); 
        setIsModalOpen(false); 
      } else { 
        const err = await response.json(); 
        setSaveError(err.detail || 'Ocorreu um erro ao salvar os dados.');
        setIsErrorModalOpen(true);
        console.error('Falha ao salvar a licença:', err); 
      }
    } catch (error) { 
      setSaveError('Erro de conexão com o servidor.');
      setIsErrorModalOpen(true);
      console.error('Erro de requisição:', error); 
    }
  };

  const handleDeleteRequest = (item: Licenca) => { setItemToDelete(item); setDeleteError(null); setIsDeleteModalOpen(true); };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      const response = await fetch(`/api/licenca/${itemToDelete.id}`, { method: 'DELETE' });
      if (response.ok) { fetchItems(); setIsDeleteModalOpen(false); setItemToDelete(null); }
      else { const errorData = await response.json(); setDeleteError(errorData.detail || 'Falha ao excluir o registro.'); }
    } catch (error) { console.error('Erro ao excluir:', error); setDeleteError('Erro de conexão com o servidor.'); }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Licenças" />
      <div className="p-5 space-y-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input label="Buscar" placeholder="Buscar por autorização, órgão ou despachante..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button onClick={handleOpenNewModal} className="gap-2 h-9 px-5 font-bold uppercase tracking-wider"><Plus className="h-5 w-5" />Novo</Button>
          </div>
        </div>

        {(() => {
          const cols: GridColumn<Licenca>[] = [
            {
              header: 'Código',
              render: item => (
                <>
                  <span className="text-xs font-bold text-[#B21212]">{item.idlicenca}</span>
                  {item.idequipamento && (() => {
                    const eq = equipments.find(e => String(e.id) === String(item.idequipamento));
                    return eq ? <span className="ml-2 text-xs text-slate-500">{eq.nome}</span> : null;
                  })()}
                </>
              ),
            },
            { header: 'Autorização', render: item => <span className="text-xs font-bold text-slate-700">{item.autorizacao}</span> },
            { header: 'Órgão', render: item => <span className="text-xs text-slate-500">{item.orgao}</span> },
            { header: 'Vencimento', render: item => <span className="text-xs text-slate-500">{item.vencimento ? new Date(item.vencimento).toLocaleDateString('pt-BR') : '-'}</span> },
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
          return <DataGrid data={filteredItems} columns={cols} getKey={item => item.id} emptyMessage="Nenhuma licença encontrada." />;
        })()}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? `Editar Licença #${editingItem.idlicenca}` : "Nova Licença"} className="max-w-4xl"
        footer={<><Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button><Button onClick={handleSave}>{editingItem ? 'Salvar Alterações' : 'Salvar Licença'}</Button></>}
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto pr-2">
          <div className="space-y-1.5 col-span-2 lg:col-span-4">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Equipamento</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white h-[42px]"
              value={formData.idequipamentoStr}
              onChange={e => setFormData({ ...formData, idequipamentoStr: e.target.value })}
            >
              <option value="">Selecione...</option>
              {equipments.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.nome} - {eq.placa}</option>
              ))}
            </select>
          </div>

          <Input label={<span>Autorização <span className="text-red-500">*</span></span>} placeholder="Ex: 12345/2026" value={formData.autorizacao} onChange={e => setFormData({ ...formData, autorizacao: e.target.value })} />
          <Input label={<span>Órgão <span className="text-red-500">*</span></span>} placeholder="Ex: ANTT" value={formData.orgao} onChange={e => setFormData({ ...formData, orgao: e.target.value })} />
          <Input type="date" label="Data Emissão" value={formData.data} onChange={e => setFormData({ ...formData, data: e.target.value })} />
          <Input type="date" label="Data Vencimento" value={formData.vencimento} onChange={e => setFormData({ ...formData, vencimento: e.target.value })} />

          <Input label="Estado" placeholder="Ex: SP" value={formData.estado} onChange={e => setFormData({ ...formData, estado: e.target.value })} />
          <Input label="Despachante" placeholder="Ex: João Silva" value={formData.despachante} onChange={e => setFormData({ ...formData, despachante: e.target.value })} />
          <Input label="Horário" placeholder="Ex: 08:00 - 18:00" value={formData.horario} onChange={e => setFormData({ ...formData, horario: e.target.value })} />

          <Input label="Largura" placeholder="Ex: 2.50m" value={formData.largura} onChange={e => setFormData({ ...formData, largura: e.target.value })} />
          <Input label="Comprimento" placeholder="Ex: 12.00m" value={formData.comprimento} onChange={e => setFormData({ ...formData, comprimento: e.target.value })} />
          <Input label="Altura" placeholder="Ex: 4.40m" value={formData.altura} onChange={e => setFormData({ ...formData, altura: e.target.value })} />
          <Input label="Tara" placeholder="Ex: 15.000 kg" value={formData.tara} onChange={e => setFormData({ ...formData, tara: e.target.value })} />

          <Input label="Carretas" placeholder="Ex: 2 Eixos" value={formData.carretas} onChange={e => setFormData({ ...formData, carretas: e.target.value })} />
          <Input label="Pesos" placeholder="Ex: 40.000 kg" value={formData.pesos} onChange={e => setFormData({ ...formData, pesos: e.target.value })} />
          <Input label="Peso Carga" placeholder="Ex: 25.000 kg" value={formData.peso_carga} onChange={e => setFormData({ ...formData, peso_carga: e.target.value })} />
          <Input label="PBT" placeholder="Ex: 45.000 kg" value={formData.pbt} onChange={e => setFormData({ ...formData, pbt: e.target.value })} />
        </div>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirmar Exclusão" className="max-w-md"
        footer={<><Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancelar</Button><Button onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">Confirmar Exclusão</Button></>}
      >
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center"><AlertTriangle className="h-8 w-8 text-red-600" /></div>
          <div><h4 className="text-lg font-bold text-slate-800">Você tem certeza?</h4>
            <p className="text-sm text-slate-500 mt-1">Deseja realmente excluir a licença <span className="font-bold text-slate-700">{itemToDelete?.autorizacao}</span>? Esta ação não pode ser desfeita.</p></div>
          {deleteError && <div className="w-full p-4 bg-red-50 border border-red-100 rounded-lg"><p className="text-xs text-red-600 font-medium">{deleteError}</p></div>}
        </div>
      </Modal>

      <Modal isOpen={isValidationModalOpen} onClose={() => setIsValidationModalOpen(false)} title="Campos Obrigatórios" className="max-w-md"
        footer={<Button onClick={() => setIsValidationModalOpen(false)} className="px-8">Entendido</Button>}
      >
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="h-16 w-16 bg-amber-50 rounded-full flex items-center justify-center"><AlertTriangle className="h-8 w-8 text-amber-500" /></div>
          <div><h4 className="text-lg font-bold text-slate-800">Informações Faltando</h4>
            <p className="text-sm text-slate-500 mt-1">Para prosseguir com o cadastro, os seguintes campos devem ser preenchidos:</p></div>
          <div className="w-full space-y-2">
            {invalidFields.map((field, index) => (
              <div key={index} className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-700 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>{field}</div>
            ))}
          </div>
        </div>
      </Modal>

      <Modal isOpen={isErrorModalOpen} onClose={() => setIsErrorModalOpen(false)} title="Erro ao Salvar" className="max-w-md"
        footer={<Button onClick={() => setIsErrorModalOpen(false)} className="px-8">Fechar</Button>}
      >
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center"><AlertTriangle className="h-8 w-8 text-red-600" /></div>
          <div><h4 className="text-lg font-bold text-slate-800">Não foi possível salvar</h4>
            <p className="text-sm text-slate-500 mt-1">{saveError}</p></div>
        </div>
      </Modal>
    </div>
  );
}
