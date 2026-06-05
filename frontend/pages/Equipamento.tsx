import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Plus, Search, Eye, Edit2, Truck, Trash2, X } from 'lucide-react';
import { DataGrid, GridColumn } from '../components/ui/DataGrid';
import { Equipment, EquipmentComponent } from '../types';
import { cn } from '../utils/cn';


export function EquipamentoPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [tiposEquipamento, setTiposEquipamento] = useState<any[]>([]);
  const [fluxos, setFluxos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos os Status');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [equipmentToDelete, setEquipmentToDelete] = useState<Equipment | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filteredEquipment = equipmentList
    .filter(equipment => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchLower ||
        (String(equipment.nome || '').toLowerCase().includes(searchLower)) ||
        (String(equipment.modelo || '').toLowerCase().includes(searchLower)) ||
        (String(equipment.placa || '').toLowerCase().includes(searchLower));
      const matchesStatus = statusFilter === 'Todos os Status' ||
        String(equipment.status || 'DISPONÍVEL').toUpperCase() === statusFilter.toUpperCase();
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => Number(a.id) - Number(b.id));

  useEffect(() => {
    fetchEquipment();
    fetchAuxData();
  }, []);

  const fetchAuxData = async () => {
    try {
      const [resEmp, resTipo, resFluxo] = await Promise.all([
        fetch('/api/empresas'),
        fetch('/api/tipos-equipamento'),
        fetch('/api/fluxo-financeiro')
      ]);
      if (resEmp.ok) setEmpresas(await resEmp.json());
      if (resTipo.ok) setTiposEquipamento(await resTipo.json());
      if (resFluxo.ok) setFluxos(await resFluxo.json());
    } catch(err) {
      console.error('Erro ao buscar dados auxiliares:', err);
    }
  };

  const fetchEquipment = async () => {
    try {
      const response = await fetch('/api/equipamentos');
      if (response.ok) {
        const data = await response.json();
        const mappedData = data.map((eq: any) => ({
          ...eq,
          id: String(eq.idequipamento),
          status: eq.status || 'DISPONÍVEL'
        }));
        setEquipmentList(mappedData);
      }
    } catch (error) {
      console.error('Erro API:', error);
    }
  };

  const [formData, setFormData] = useState<Omit<Equipment, 'id'>>({
    nome: '',
    placa: '',
    valor: 0,
    marca: '',
    modelo: '',
    ano_fabricacao: new Date().getFullYear(),
    ano_modelo: new Date().getFullYear(),
    valor_pago: 0,
    antigo_dono: '',
    renavan: '',
    chassi: '',
    km_atual: 0,
    idtipoequipamento: 0,
    idfluxo: '',
    idempresa: 0,
    data_aquisicao: '',
    km_inicial: 0,
    gera_faturamento: false,
    observacao: '',
    tara: 0,
    kilo: 0,
    m3: 0,
    rodado: 0,
    carroceria: 0,
    uflicencimento: '',
    tacografo: '',
    comprador: '',
    status: 'DISPONÍVEL',
    componentes: []
  });

  const [newComponent, setNewComponent] = useState<Omit<EquipmentComponent, 'id'>>({ nome: '', placa: '' });
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);

  const handleOpenNewModal = () => {
    setEditingEquipment(null);
    setIsViewOnly(false);
    setFormData({
      nome: '',
      placa: '',
      valor: 0,
      marca: '',
      modelo: '',
      ano_fabricacao: new Date().getFullYear(),
      ano_modelo: new Date().getFullYear(),
      valor_pago: 0,
      antigo_dono: '',
      renavan: '',
      chassi: '',
      km_atual: 0,
      idtipoequipamento: 0,
      idfluxo: '',
      idempresa: 0,
      data_aquisicao: '',
      km_inicial: 0,
      gera_faturamento: false,
      observacao: '',
      tara: 0,
      kilo: 0,
      m3: 0,
      rodado: 0,
      carroceria: 0,
      uflicencimento: '',
      tacografo: '',
      comprador: '',
      status: 'DISPONÍVEL',
      componentes: []
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (equipment: Equipment) => {
    setEditingEquipment(equipment);
    setIsViewOnly(false);
    const { id, ...rest } = equipment;
    setFormData(rest);
    setIsModalOpen(true);
  };

  const handleOpenViewModal = (equipment: Equipment) => {
    setEditingEquipment(equipment);
    setIsViewOnly(true);
    const { id, ...rest } = equipment;
    setFormData(rest);
    setIsModalOpen(true);
  };

  const handleDeleteRequest = (equipment: Equipment) => {
    setEquipmentToDelete(equipment);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!equipmentToDelete) return;

    try {
      const response = await fetch(`/api/equipamentos/${equipmentToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setIsDeleteModalOpen(false);
        setEquipmentToDelete(null);
        fetchEquipment();
      } else {
        const errorData = await response.json();
        setDeleteError(errorData.detail || 'Não foi possível excluir o equipamento.');
      }
    } catch (err) {
      console.error('Erro ao excluir:', err);
      setDeleteError('Erro de conexão com o servidor.');
    }
  };

  const handleSave = async () => {
    try {
      const isEditing = !!editingEquipment;
      const url = isEditing ? `/api/equipamentos/${editingEquipment.id}` : '/api/equipamentos';
      const method = isEditing ? 'PUT' : 'POST';
      
      const payload: any = { ...formData };
      
      // PostgreSQL Foreign Keys / Dates não aceitam '0' ou string vazia quando opcionais
      if (payload.idempresa === 0) payload.idempresa = null;
      if (payload.idtipoequipamento === 0) payload.idtipoequipamento = null;
      if (payload.idfluxo === '') payload.idfluxo = null;
      if (payload.data_aquisicao === '') payload.data_aquisicao = null;
      if (payload.tacografo === '') payload.tacografo = null;
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        fetchEquipment();
        setIsModalOpen(false);
      } else {
        const errorData = await response.json();
        console.error('Erro ao salvar o equipamento:', errorData);
        alert(`Erro ao salvar: ${errorData.detail || 'Verifique os dados preenchidos.'}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComponent = () => {
    if (!newComponent.nome || !newComponent.placa) return;
    
    const components = formData.componentes || [];
    if (editingComponentId) {
      setFormData({
        ...formData,
        componentes: components.map(c => c.id === editingComponentId ? { ...c, ...newComponent } : c)
      });
      setEditingComponentId(null);
    } else {
      setFormData({
        ...formData,
        componentes: [...components, { id: Math.random().toString(36).substr(2, 9), ...newComponent }]
      });
    }
    setNewComponent({ nome: '', placa: '' });
  };

  const handleEditComponent = (component: EquipmentComponent) => {
    setNewComponent({ nome: component.nome, placa: component.placa });
    setEditingComponentId(component.id);
  };

  const handleDeleteComponent = (id: string) => {
    setFormData({
      ...formData,
      componentes: (formData.componentes || []).filter(c => c.id !== id)
    });
  };

  const statusColors = {
    'DISPONÍVEL': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'EM MANUTENÇÃO': 'bg-amber-50 text-amber-600 border-amber-100',
    'LOCADO': 'bg-blue-50 text-blue-600 border-blue-100',
    'INATIVO': 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Cadastro de Equipamentos" />
      
      <div className="p-5 space-y-4">
        {/* Filters Card */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input 
                label="Equipamento / Modelo / Placa" 
                placeholder="Buscar equipamento..." 
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
                <option value="DISPONÍVEL">Disponível</option>
                <option value="EM MANUTENÇÃO">Em Manutenção</option>
                <option value="LOCADO">Locado</option>
                <option value="INATIVO">Inativo</option>
              </select>
            </div>
            <Button variant="secondary" className="gap-2" onClick={() => { setSearchTerm(''); setStatusFilter('Todos os Status'); }}>
              <X className="h-4 w-4" />
              Limpar
            </Button>
            <Button onClick={handleOpenNewModal} className="gap-2 h-9 px-5 font-bold uppercase tracking-wider">
              <Plus className="h-5 w-5" />
              Novo
            </Button>
          </div>
        </div>

        {/* Table Card */}
        {(() => {
          const cols: GridColumn<Equipment>[] = [
            { header: 'Código', render: eq => <span className="text-xs font-bold text-[#B21212]">{eq.id}</span> },
            {
              header: 'Equipamento',
              render: eq => (
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700">{eq.nome}</span>
                  <span className="text-xs text-slate-400">
                    {empresas.find(e => e.idempresa === eq.idempresa)?.nomefantasia || empresas.find(e => e.idempresa === eq.idempresa)?.nome || ''}
                  </span>
                </div>
              ),
            },
            { header: 'Placa', render: eq => <span className="text-xs text-slate-500 font-mono">{eq.placa}</span> },
            { header: 'Marca/Modelo', render: eq => <span className="text-xs text-slate-500">{eq.marca} / {eq.modelo}</span> },
            {
              header: 'Status',
              headerClass: 'px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center',
              cellClass: 'px-4 py-2 text-center',
              render: eq => (
                <span className={cn(
                  "inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                  statusColors[eq.status]
                )}>
                  {eq.status}
                </span>
              ),
            },
            {
              header: 'Ações',
              headerClass: 'px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right',
              cellClass: 'px-4 py-2 text-right',
              render: eq => (
                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDeleteRequest(eq)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleOpenViewModal(eq)}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleOpenEditModal(eq)} title="Editar"><Edit2 className="h-4 w-4" /></Button>
                </div>
              ),
            },
          ];
          return <DataGrid data={filteredEquipment} columns={cols} getKey={eq => eq.id} emptyMessage="Nenhum equipamento encontrado." />;
        })()}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={isViewOnly ? `Visualizar Equipamento ${editingEquipment?.nome || ''}` : (editingEquipment ? `Editar Equipamento ${editingEquipment?.nome || ''}` : "Novo Equipamento")}
        className="max-w-6xl"
        footer={
          isViewOnly ? (
            <Button onClick={() => setIsModalOpen(false)} className="px-8">OK</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>{editingEquipment ? 'Salvar Alterações' : 'Salvar Equipamento'}</Button>
            </>
          )
        }
      >
        <div className="space-y-8">
          {/* Identificação Básica */}
          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>
              Identificação Básica
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col md:col-span-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Empresa</label>
                <select 
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50"
                  value={formData.idempresa}
                  onChange={(e) => setFormData({ ...formData, idempresa: parseInt(e.target.value) || 0 })}
                  disabled={isViewOnly}
                >
                  <option value={0}>Selecione a Empresa</option>
                  {empresas.map((emp) => (
                    <option key={emp.idempresa} value={emp.idempresa}>{emp.nomefantasia || emp.nome}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <Input 
                  label="Nome do Equipamento" 
                  placeholder="Ex: Guindaste Grove RT 765E-2"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  disabled={isViewOnly}
                />
              </div>
              <Input 
                label="Placa" 
                placeholder="ABC-1234"
                value={formData.placa}
                onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
                disabled={isViewOnly}
              />
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Status</label>
                <select 
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as Equipment['status'] })}
                  disabled={isViewOnly}
                >
                  <option value="DISPONÍVEL">Disponível</option>
                  <option value="EM MANUTENÇÃO">Em Manutenção</option>
                  <option value="LOCADO">Locado</option>
                  <option value="INATIVO">Inativo</option>
                </select>
              </div>
              <Input 
                label="Marca" 
                value={formData.marca}
                onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                disabled={isViewOnly}
              />
              <Input 
                label="Modelo" 
                value={formData.modelo}
                onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                disabled={isViewOnly}
              />
              <Input 
                label="Ano Fabricação" 
                type="number"
                value={formData.ano_fabricacao}
                onChange={(e) => setFormData({ ...formData, ano_fabricacao: parseInt(e.target.value) || 0 })}
                disabled={isViewOnly}
              />
              <Input 
                label="Ano Modelo" 
                type="number"
                value={formData.ano_modelo}
                onChange={(e) => setFormData({ ...formData, ano_modelo: parseInt(e.target.value) || 0 })}
                disabled={isViewOnly}
              />
            </div>
          </section>

          {/* Dados de Aquisição e Valor */}
          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>
              Aquisição e Valor
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input 
                label="Data de Aquisição" 
                type="date"
                value={formData.data_aquisicao}
                onChange={(e) => setFormData({ ...formData, data_aquisicao: e.target.value })}
                disabled={isViewOnly}
              />
              <Input 
                label="Valor (R$)" 
                type="number"
                step="0.01"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 })}
                disabled={isViewOnly}
              />
              <Input 
                label="Valor Pago (R$)" 
                type="number"
                step="0.01"
                value={formData.valor_pago}
                onChange={(e) => setFormData({ ...formData, valor_pago: parseFloat(e.target.value) || 0 })}
                disabled={isViewOnly}
              />
              <Input 
                label="Proprietário Anterior" 
                value={formData.antigo_dono}
                onChange={(e) => setFormData({ ...formData, antigo_dono: e.target.value })}
                disabled={isViewOnly}
              />
              <Input 
                label="Comprador" 
                value={formData.comprador}
                onChange={(e) => setFormData({ ...formData, comprador: e.target.value })}
                disabled={isViewOnly}
              />
            </div>
          </section>

          {/* Documentação e Técnica */}
          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>
              Documentação e Técnica
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input 
                label="Renavan" 
                value={formData.renavan}
                onChange={(e) => setFormData({ ...formData, renavan: e.target.value })}
                disabled={isViewOnly}
              />
              <Input 
                label="Chassi" 
                value={formData.chassi}
                onChange={(e) => setFormData({ ...formData, chassi: e.target.value })}
                disabled={isViewOnly}
              />
              <Input 
                label="UF Licenciamento" 
                maxLength={2}
                value={formData.uflicencimento}
                onChange={(e) => setFormData({ ...formData, uflicencimento: e.target.value.toUpperCase() })}
                disabled={isViewOnly}
              />
              <Input 
                label="Aferição Tacógrafo" 
                type="date"
                value={formData.tacografo}
                onChange={(e) => setFormData({ ...formData, tacografo: e.target.value })}
                disabled={isViewOnly}
              />
              <Input 
                label="KM Inicial" 
                type="number"
                value={formData.km_inicial}
                onChange={(e) => setFormData({ ...formData, km_inicial: parseInt(e.target.value) || 0 })}
                disabled={isViewOnly}
              />
              <Input 
                label="KM Atual" 
                type="number"
                value={formData.km_atual}
                onChange={(e) => setFormData({ ...formData, km_atual: parseInt(e.target.value) || 0 })}
                disabled={isViewOnly}
              />
              <Input 
                label="Tara (KG)" 
                type="number"
                value={formData.tara}
                onChange={(e) => setFormData({ ...formData, tara: parseInt(e.target.value) || 0 })}
                disabled={isViewOnly}
              />
              <Input 
                label="Capacidade (KG)" 
                type="number"
                value={formData.kilo}
                onChange={(e) => setFormData({ ...formData, kilo: parseInt(e.target.value) || 0 })}
                disabled={isViewOnly}
              />
              <Input 
                label="Capacidade (M3)" 
                type="number"
                value={formData.m3}
                onChange={(e) => setFormData({ ...formData, m3: parseInt(e.target.value) || 0 })}
                disabled={isViewOnly}
              />
              <Input 
                label="Tipo Rodado" 
                type="number"
                value={formData.rodado}
                onChange={(e) => setFormData({ ...formData, rodado: parseInt(e.target.value) || 0 })}
                disabled={isViewOnly}
              />
              <Input 
                label="Tipo Carroceria" 
                type="number"
                value={formData.carroceria}
                onChange={(e) => setFormData({ ...formData, carroceria: parseInt(e.target.value) || 0 })}
                disabled={isViewOnly}
              />
            </div>
          </section>

          {/* Configurações e Vínculos */}
          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>
              Configurações e Vínculos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Tipo Equipamento</label>
                <select 
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50"
                  value={formData.idtipoequipamento}
                  onChange={(e) => setFormData({ ...formData, idtipoequipamento: parseInt(e.target.value) || 0 })}
                  disabled={isViewOnly}
                >
                  <option value={0}>Selecione o Tipo</option>
                  {tiposEquipamento.map((t) => (
                    <option key={t.idtipoequipamento} value={t.idtipoequipamento}>{t.nome}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Fluxo Financeiro</label>
                <select 
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50"
                  value={formData.idfluxo}
                  onChange={(e) => setFormData({ ...formData, idfluxo: e.target.value })}
                  disabled={isViewOnly}
                >
                  <option value="">Selecione o Fluxo</option>
                  {fluxos.map(f => (
                    <option key={f.idfluxo} value={f.idfluxo}>{f.descricao || f.idfluxo}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input 
                  type="checkbox" 
                  id="gera_faturamento"
                  className="w-4 h-4 text-[#B21212] border-slate-300 rounded focus:ring-[#B21212]"
                  checked={formData.gera_faturamento}
                  onChange={(e) => setFormData({ ...formData, gera_faturamento: e.target.checked })}
                  disabled={isViewOnly}
                />
                <label htmlFor="gera_faturamento" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gera Faturamento</label>
              </div>
            </div>
            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Observação</label>
              <textarea 
                className="w-full min-h-[100px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50"
                value={formData.observacao}
                onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                disabled={isViewOnly}
                placeholder="Observações adicionais sobre o equipamento..."
              />
            </div>
          </section>

          {/* Composição do Conjunto */}
          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>
              Composição do Conjunto
            </h3>
            
            {!isViewOnly && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <Input 
                  label="Nome do Componente" 
                  placeholder="Ex: Cavalo, Carreta, etc."
                  value={newComponent.nome}
                  onChange={(e) => setNewComponent({ ...newComponent, nome: e.target.value })}
                />
                <Input 
                  label="Placa" 
                  placeholder="Ex: SBV-8888"
                  value={newComponent.placa}
                  onChange={(e) => setNewComponent({ ...newComponent, placa: e.target.value.toUpperCase() })}
                />
                <div className="flex items-end gap-2">
                  <Button onClick={handleAddComponent} className="flex-1 gap-2">
                    {editingComponentId ? <Edit2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {editingComponentId ? 'Atualizar' : 'Adicionar'}
                  </Button>
                  {editingComponentId && (
                    <Button variant="outline" size="icon" onClick={() => { setEditingComponentId(null); setNewComponent({ nome: '', placa: '' }); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg border border-slate-100 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Componente</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Placa</th>
                    {!isViewOnly && <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(formData.componentes || []).length === 0 ? (
                    <tr>
                      <td colSpan={isViewOnly ? 2 : 3} className="px-4 py-8 text-center text-sm text-slate-400 italic">
                        Nenhum componente adicionado ao conjunto.
                      </td>
                    </tr>
                  ) : (
                    (formData.componentes || []).map((comp) => (
                      <tr key={comp.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-slate-700">{comp.nome}</td>
                        <td className="px-4 py-3 text-sm text-slate-500 font-mono">{comp.placa}</td>
                        {!isViewOnly && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-slate-400 hover:text-slate-600"
                                onClick={() => handleEditComponent(comp)}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-slate-400 hover:text-red-600"
                                onClick={() => handleDeleteComponent(comp.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </Modal>

      {/* Modal de Confirmação de Exclusão */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirmar Exclusão"
        className="max-w-md"
        footer={
          <div className="flex gap-3 justify-end w-full">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button 
              variant="primary" 
              onClick={handleConfirmDelete} 
              className="flex-1 bg-red-600 hover:bg-red-700 border-red-600 shadow-md shadow-red-200"
            >
              Confirmar Exclusão
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-red-600">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <Trash2 className="h-5 w-5" />
            </div>
            <h4 className="font-bold">Atenção!</h4>
          </div>
          
          <p className="text-sm text-slate-600 leading-relaxed">
            Deseja realmente excluir o equipamento <span className="font-bold text-slate-900">{equipmentToDelete?.nome}</span> (Placa: {equipmentToDelete?.placa})? Esta ação não poderá ser desfeita.
          </p>

          {deleteError && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex gap-3">
              <X className="h-5 w-5 text-red-500 shrink-0" />
              <p className="text-xs text-red-600 font-medium leading-relaxed">
                {deleteError}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
