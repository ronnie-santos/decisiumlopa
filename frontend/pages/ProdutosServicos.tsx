import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Plus, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { DataGrid, GridColumn } from '../components/ui/DataGrid';

interface ProdutoServico {
  idproduto: number;
  descricao: string | null;
  ncmsh: string | null;
  cst: string | null;
  unidade: string | null;
  ipi: number | null;
  icms: number | null;
  marca_km: boolean | null;
}

interface FormData {
  descricao: string;
  ncmsh: string;
  cst: string;
  unidade: string;
  ipi: string;
  icms: string;
  marca_km: boolean;
}

const emptyForm: FormData = {
  descricao: '',
  ncmsh: '',
  cst: '',
  unidade: '',
  ipi: '',
  icms: '',
  marca_km: false,
};

export function ProdutosServicosPage() {
  const [items, setItems] = useState<ProdutoServico[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProdutoServico | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ProdutoServico | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);

  const filteredItems = items
    .filter(item => !searchTerm || (item.descricao ?? '').toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.idproduto - b.idproduto);

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/produtos');
      if (res.ok) setItems(await res.json());
      else console.error('Falha ao carregar produtos/serviços');
    } catch (err) { console.error('Erro na requisição:', err); }
  };

  const handleOpenNewModal = () => {
    setEditingItem(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: ProdutoServico) => {
    setEditingItem(item);
    setFormData({
      descricao: item.descricao ?? '',
      ncmsh: item.ncmsh ?? '',
      cst: item.cst ?? '',
      unidade: item.unidade ?? '',
      ipi: item.ipi != null ? String(item.ipi) : '',
      icms: item.icms != null ? String(item.icms) : '',
      marca_km: item.marca_km ?? false,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const missing: string[] = [];
    if (!formData.descricao.trim()) missing.push('Descrição');
    if (missing.length > 0) { setInvalidFields(missing); setIsValidationModalOpen(true); return; }

    const payload = {
      descricao: formData.descricao.trim() || null,
      ncmsh: formData.ncmsh.trim() || null,
      cst: formData.cst.trim() || null,
      unidade: formData.unidade.trim() || null,
      ipi: formData.ipi !== '' ? parseFloat(formData.ipi) : null,
      icms: formData.icms !== '' ? parseFloat(formData.icms) : null,
      marca_km: formData.marca_km,
    };

    try {
      const url = editingItem ? `/api/produtos/${editingItem.idproduto}` : '/api/produtos';
      const method = editingItem ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) { fetchItems(); setIsModalOpen(false); }
      else { const e = await res.json().catch(() => ({})); console.error('Erro:', e.detail || res.status); }
    } catch (err) { console.error('Erro de requisição:', err); }
  };

  const handleDeleteRequest = (item: ProdutoServico) => {
    setItemToDelete(item);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      const res = await fetch(`/api/produtos/${itemToDelete.idproduto}`, { method: 'DELETE' });
      if (res.ok) { fetchItems(); setIsDeleteModalOpen(false); setItemToDelete(null); }
      else { const e = await res.json(); setDeleteError(e.detail || 'Falha ao excluir.'); }
    } catch { setDeleteError('Erro de conexão com o servidor.'); }
  };

  const fmtPct = (v: number | null) => v != null ? `${v}%` : '—';

  return (
    <div className="flex flex-col h-full">
      <Header title="Produtos e Serviços" />
      <div className="p-5 space-y-4">

        {/* Barra de busca + botão */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex-1 min-w-[200px]">
              <input
                className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                placeholder="Buscar por descrição..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Button onClick={handleOpenNewModal} className="gap-2 h-9 px-5 font-bold uppercase tracking-wider">
              <Plus className="h-5 w-5" />Novo
            </Button>
          </div>
        </div>

        {/* Tabela */}
        {(() => {
          const cols: GridColumn<ProdutoServico>[] = [
            { header: 'Código', render: item => <span className="text-sm font-bold text-[#B21212]">{item.idproduto}</span> },
            { header: 'Descrição', render: item => <span className="text-sm font-medium text-slate-700">{item.descricao ?? '—'}</span> },
            { header: 'NCM/SH', render: item => <span className="text-sm text-slate-500">{item.ncmsh ?? '—'}</span> },
            { header: 'CST', render: item => <span className="text-sm text-slate-500">{item.cst ?? '—'}</span> },
            { header: 'Unidade', render: item => <span className="text-sm text-slate-500">{item.unidade ?? '—'}</span> },
            { header: 'IPI', render: item => <span className="text-sm text-slate-500">{fmtPct(item.ipi)}</span> },
            { header: 'ICMS', render: item => <span className="text-sm text-slate-500">{fmtPct(item.icms)}</span> },
            {
              header: 'Marca KM',
              render: item => (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${item.marca_km ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-slate-400'}`}>
                  {item.marca_km ? 'Sim' : 'Não'}
                </span>
              ),
            },
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
          return <DataGrid data={filteredItems} columns={cols} getKey={item => item.idproduto} emptyMessage="Nenhum produto/serviço encontrado." />;
        })()}
      </div>

      {/* Modal: Novo / Editar */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? `Editar: ${editingItem.descricao}` : 'Novo Produto / Serviço'}
        className="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingItem ? 'Salvar Alterações' : 'Salvar'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={<span>Descrição <span className="text-red-500">*</span></span>}
            placeholder="Ex: Óleo lubrificante 5W30"
            value={formData.descricao}
            onChange={e => setFormData(f => ({ ...f, descricao: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="NCM/SH"
              placeholder="Ex: 2710.19.32"
              value={formData.ncmsh}
              onChange={e => setFormData(f => ({ ...f, ncmsh: e.target.value }))}
            />
            <Input
              label="CST"
              placeholder="Ex: 000"
              value={formData.cst}
              onChange={e => setFormData(f => ({ ...f, cst: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Unidade"
              placeholder="Ex: UN, LT, KG"
              value={formData.unidade}
              onChange={e => setFormData(f => ({ ...f, unidade: e.target.value }))}
            />
            <Input
              label="IPI (%)"
              placeholder="Ex: 5.00"
              type="number"
              step="0.01"
              min="0"
              value={formData.ipi}
              onChange={e => setFormData(f => ({ ...f, ipi: e.target.value }))}
            />
            <Input
              label="ICMS (%)"
              placeholder="Ex: 12.00"
              type="number"
              step="0.01"
              min="0"
              value={formData.icms}
              onChange={e => setFormData(f => ({ ...f, icms: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <input
              id="marca_km"
              type="checkbox"
              checked={formData.marca_km}
              onChange={e => setFormData(f => ({ ...f, marca_km: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-200"
            />
            <label htmlFor="marca_km" className="text-sm font-medium text-slate-700 cursor-pointer">
              Marca quilometragem (Marca KM)
            </label>
          </div>
        </div>
      </Modal>

      {/* Modal: Confirmar Exclusão */}
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
              Deseja realmente excluir <span className="font-bold text-slate-700">{itemToDelete?.descricao}</span>?
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

      {/* Modal: Campos Obrigatórios */}
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
            <p className="text-sm text-slate-500 mt-1">Para prosseguir com o cadastro, os seguintes campos devem ser preenchidos:</p>
          </div>
          <div className="w-full space-y-2">
            {invalidFields.map((field, i) => (
              <div key={i} className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>{field}
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
