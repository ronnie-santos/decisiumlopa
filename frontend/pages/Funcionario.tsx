import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Plus, Eye, Edit2, Trash2, X, User, Search, Loader2, Tag } from 'lucide-react';
import { DataGrid, GridColumn } from '../components/ui/DataGrid';
import { Employee, Cargo, Estado } from '../types';
import { cn } from '../utils/cn';
import { useCidadeBairro } from '../utils/useCidadeBairro';

interface Desconto {
  iddesconto: number;
  idfuncionario: number;
  valor: number | null;
  descricao: string | null;
  data: string | null;
}

export function FuncionarioPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { return () => setIsSaving(false); }, []);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Auxiliary data states
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [estados, setEstados] = useState<Estado[]>([]);
  const [isCepLoading, setIsCepLoading] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'dados' | 'descontos'>('dados');

  // Descontos states
  const [descontos, setDescontos] = useState<Desconto[]>([]);
  const [isDescontoModalOpen, setIsDescontoModalOpen] = useState(false);
  const [editingDesconto, setEditingDesconto] = useState<Desconto | null>(null);
  const [descontoForm, setDescontoForm] = useState({ data: '', descricao: '', valor: '' });
  const [isSavingDesconto, setIsSavingDesconto] = useState(false);
  const [descontoError, setDescontoError] = useState<string | null>(null);
  const [isDeleteDescontoOpen, setIsDeleteDescontoOpen] = useState(false);
  const [descontoToDelete, setDescontoToDelete] = useState<Desconto | null>(null);

  const fetchEmployees = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/funcionarios');
      if (!response.ok) throw new Error('Não foi possível carregar os funcionários.');
      const data = await response.json();
      setEmployeeList(data.map((f: any) => ({
        ...f,
        id: String(f.idfuncionario),
        idfuncionario: String(f.idfuncionario)
      })));
    } catch (err) {
      console.error('Erro ao carregar funcionários:', err);
      setError('Erro de conexão com o servidor ao carregar a lista.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAuxiliaryData = async () => {
    try {
      const [resCargos, resEstados] = await Promise.all([
        fetch('/api/cargos'),
        fetch('/api/estados'),
      ]);
      if (resCargos.ok)  setCargos(await resCargos.json());
      if (resEstados.ok) setEstados(await resEstados.json());
    } catch (err) {
      console.error('Erro ao carregar dados auxiliares:', err);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchAuxiliaryData();
  }, []);

  const fetchDescontos = async (idfuncionario: string | number) => {
    const r = await fetch(`/api/funcionarios/${idfuncionario}/descontos`);
    if (r.ok) setDescontos(await r.json());
  };

  const handleOpenDescontoModal = (d?: Desconto) => {
    setEditingDesconto(d ?? null);
    setDescontoForm(d ? {
      data: d.data ?? '',
      descricao: d.descricao ?? '',
      valor: d.valor != null ? String(d.valor) : '',
    } : { data: new Date().toISOString().split('T')[0], descricao: '', valor: '' });
    setDescontoError(null);
    setIsDescontoModalOpen(true);
  };

  const handleSaveDesconto = async () => {
    if (!editingEmployee) return;
    if (!descontoForm.data || !descontoForm.valor) {
      setDescontoError('Data e Valor são obrigatórios.');
      return;
    }
    setIsSavingDesconto(true);
    setDescontoError(null);
    try {
      const url = editingDesconto
        ? `/api/funcionarios/${editingEmployee.idfuncionario}/descontos/${editingDesconto.iddesconto}`
        : `/api/funcionarios/${editingEmployee.idfuncionario}/descontos`;
      const method = editingDesconto ? 'PUT' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idfuncionario: Number(editingEmployee.idfuncionario),
          data: descontoForm.data,
          descricao: descontoForm.descricao || null,
          valor: Number(descontoForm.valor),
        }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.detail || 'Erro ao salvar desconto.');
      }
      await fetchDescontos(editingEmployee.idfuncionario);
      setIsDescontoModalOpen(false);
    } catch (err: any) {
      setDescontoError(err.message);
    } finally {
      setIsSavingDesconto(false);
    }
  };

  const handleDeleteDesconto = async () => {
    if (!editingEmployee || !descontoToDelete) return;
    try {
      const r = await fetch(
        `/api/funcionarios/${editingEmployee.idfuncionario}/descontos/${descontoToDelete.iddesconto}`,
        { method: 'DELETE' }
      );
      if (!r.ok) throw new Error('Erro ao excluir.');
      await fetchDescontos(editingEmployee.idfuncionario);
      setIsDeleteDescontoOpen(false);
      setDescontoToDelete(null);
    } catch (err: any) {
      setDescontoError(err.message);
    }
  };

  const handleCepLookup = async (cepValue: string) => {
    const cepLimpo = cepValue.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    setIsCepLoading(true);
    try {
      const response = await fetch(`/api/cep/${cepLimpo}`);
      if (!response.ok) return;
      const data = await response.json();

      const uf = data.uf || '';
      const nomeCidade = (data.localidade || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const nomeBairro = (data.bairro || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const logradouro = data.logradouro || '';

      // Busca cidades do estado via API para fazer o match
      let idcidade = (formData as any).idcidade || 0;
      let idbairro = 0;
      if (uf) {
        try {
          const cidadesRes = await fetch(`/api/cidades?idestado=${uf}`);
          const cidadesData = cidadesRes.ok ? await cidadesRes.json() : [];
          const cidadeMatch = cidadesData.find((c: any) =>
            c.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(nomeCidade)
          );
          if (cidadeMatch) {
            idcidade = cidadeMatch.idcidade;
            if (nomeBairro) {
              const bairrosRes = await fetch(`/api/bairros?idcidade=${cidadeMatch.idcidade}`);
              const bairrosData = bairrosRes.ok ? await bairrosRes.json() : [];
              const bairroMatch = bairrosData.find((b: any) =>
                b.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(nomeBairro)
              );
              if (bairroMatch) idbairro = bairroMatch.idbairro;
            }
          }
        } catch { /* silencioso */ }
      }

      setFormData(prev => ({
        ...prev,
        idestado: uf || prev.idestado,
        idcidade: idcidade || prev.idcidade,
        idbairro,
        logradouro: logradouro || prev.logradouro,
      }));
    } catch {
      // silencioso — usuário pode preencher manualmente
    } finally {
      setIsCepLoading(false);
    }
  };

  const filteredEmployees = employeeList
    .filter(emp => {
      const searchString = searchTerm.toLowerCase();
      return (
        (emp.nome || '').toLowerCase().includes(searchString) ||
        (emp.cpf || '').includes(searchTerm) ||
        (emp.cargo || '').toLowerCase().includes(searchString)
      );
    })
    .sort((a, b) => Number(a.idfuncionario) - Number(b.idfuncionario));

  const initialFormData: Omit<Employee, 'idfuncionario'> = {
    nome: '',
    apelido: '',
    observacao: '',
    cpf: '',
    rg: '',
    ctpf: '',
    serie: '',
    pis: '',
    idcargo: 0,
    cargo: '',
    admissao: new Date().toISOString().split('T')[0],
    demissao: '',
    nascimento: '',
    cbo: '',
    cep: '',
    idcidade: 0,
    idbairro: 0,
    logradouro: '',
    tipo_logradouro: 'RUA',
    idestado: '',
    numero: 0,
    cnh: '',
    validade_cnh: '',
    categoria: '',
    complemento: '',
    pe: 0,
    validade_exame: '',
    data_toxicologico: '',
    status: 'ATIVO'
  };

  const [formData, setFormData] = useState<Omit<Employee, 'idfuncionario'>>(initialFormData);

  // Cidades e bairros carregados dinamicamente — declarados APÓS formData para evitar ReferenceError
  const { cidades, bairros } = useCidadeBairro(
    isModalOpen ? (formData as any).idestado || null : null,
    isModalOpen ? (formData as any).idcidade || null : null,
  );

  const handleOpenNewModal = () => {
    setEditingEmployee(null);
    setIsViewOnly(false);
    setFormData(initialFormData);
    setActiveTab('dados');
    setDescontos([]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (employee: Employee) => {
    setEditingEmployee(employee);
    setIsViewOnly(false);
    setFormData({ ...employee });
    setActiveTab('dados');
    setDescontos([]);
    fetchDescontos(employee.idfuncionario);
    setIsModalOpen(true);
  };

  const handleOpenViewModal = (employee: Employee) => {
    setEditingEmployee(employee);
    setIsViewOnly(true);
    setFormData({ ...employee });
    setActiveTab('dados');
    setDescontos([]);
    fetchDescontos(employee.idfuncionario);
    setIsModalOpen(true);
  };

  const handleDeleteRequest = (employee: Employee) => {
    setEmployeeToDelete(employee);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!employeeToDelete) return;

    try {
      const response = await fetch(`/api/funcionarios/${employeeToDelete.idfuncionario}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setIsDeleteModalOpen(false);
        setEmployeeToDelete(null);
        setSuccessMessage('Funcionário excluído com sucesso!');
        await fetchEmployees();
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        const errorData = await response.json();
        setDeleteError(errorData.detail || 'Não foi possível excluir o funcionário.');
      }
    } catch (err) {
      console.error('Erro ao excluir:', err);
      setDeleteError('Erro de conexão com o servidor.');
    }
  };

  const handleSave = async () => {
    if (!formData.nome || !formData.cpf) {
      setError('Por favor, preencha o Nome e o CPF.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const url = editingEmployee 
        ? `/api/funcionarios/${editingEmployee.idfuncionario}`
        : '/api/funcionarios';
      
      const method = editingEmployee ? 'PUT' : 'POST';
      
      // Clean up payload: Remove frontend-only fields and format others
      const { id, idfuncionario, cargo, ...baseForm } = formData as any;
      
      // Sanitiza FKs: converte 0, "", "0", null, undefined em null para evitar erro 422
      const parseId = (val: any): number | null => {
        if (!val || val === "" || val === 0 || val === "0") return null;
        const n = Number(val);
        return isNaN(n) ? null : n;
      };

      const payload = {
        ...baseForm,
        idcargo: parseId(formData.idcargo),
        idcidade: parseId(formData.idcidade),
        idbairro: parseId(formData.idbairro),
        idestado: formData.idestado || null,
        numero: Number(formData.numero) || 0,
        pe: Number(formData.pe) || 0,
        admissao: formData.admissao || null,
        demissao: formData.demissao || null,
        nascimento: formData.nascimento || null,
        validade_cnh: formData.validade_cnh || null,
        validade_exame: formData.validade_exame || null,
        data_toxicologico: formData.data_toxicologico || null
      };
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Falha ao salvar funcionário.';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          console.error('Resposta não-JSON do servidor:', errorText);
        }
        throw new Error(errorMessage);
      }

      await fetchEmployees();
      setSuccessMessage(editingEmployee ? 'Funcionário atualizado com sucesso!' : 'Funcionário cadastrado com sucesso!');
      setIsModalOpen(false);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      setError(err.message || 'Erro ao conectar com o servidor.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      <Header title="Cadastro de Funcionários" />
      
      {isSaving && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-[#B21212]/20 border-t-[#B21212] rounded-full animate-spin"></div>
            <span className="text-sm font-bold text-slate-600 animate-pulse uppercase tracking-widest">Salvando...</span>
          </div>
        </div>
      )}

      {(successMessage || error) && (
        <div className={cn(
          "fixed top-4 right-4 z-[100] p-4 rounded-lg shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-right-5",
          successMessage ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"
        )}>
          {successMessage ? (
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Plus className="h-4 w-4 text-emerald-600" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
              <X className="h-4 w-4 text-red-600" />
            </div>
          )}
          <div>
            <p className={cn("text-sm font-bold", successMessage ? "text-emerald-800" : "text-red-800")}>
              {successMessage ? "Sucesso!" : "Ocorreu um erro"}
            </p>
            <p className={cn("text-xs font-medium", successMessage ? "text-emerald-600/80" : "text-red-600/80")}>
              {successMessage || error}
            </p>
          </div>
          <button onClick={() => { setSuccessMessage(null); setError(null); }} className="ml-2 hover:opacity-70 transition-opacity">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      )}

      <div className="p-5 space-y-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input 
                label="Nome / CPF / Cargo" 
                placeholder="Buscar funcionário..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="secondary" className="gap-2" onClick={() => setSearchTerm('')}>
              <X className="h-4 w-4" />
              Limpar
            </Button>
            <Button onClick={handleOpenNewModal} className="gap-2 h-9 px-5 font-bold uppercase tracking-wider">
              <Plus className="h-5 w-5" />
              Novo Funcionário
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-[#B21212]/20 border-t-[#B21212] rounded-full animate-spin"></div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Carregando funcionários...</span>
            </div>
          </div>
        ) : (() => {
          const cols: GridColumn<Employee>[] = [
            { header: 'ID', render: emp => <span className="text-xs font-bold text-[#B21212]">{emp.idfuncionario}</span> },
            {
              header: 'Funcionário',
              render: emp => (
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700">{emp.nome}</span>
                  <span className="text-xs text-slate-400">{emp.cpf}</span>
                </div>
              ),
            },
            { header: 'Cargo', render: emp => <span className="text-xs text-slate-500">{emp.cargo}</span> },
            {
              header: 'Status',
              render: emp => (
                <span className={cn(
                  "inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                  emp.status === 'ATIVO' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                )}>
                  {emp.status}
                </span>
              ),
            },
            {
              header: 'Ações',
              headerClass: 'px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right',
              cellClass: 'px-4 py-2 text-right',
              render: emp => (
                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDeleteRequest(emp)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleOpenViewModal(emp)} title="Ver Detalhes"><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleOpenEditModal(emp)} title="Editar"><Edit2 className="h-4 w-4" /></Button>
                </div>
              ),
            },
          ];
          return <DataGrid data={filteredEmployees} columns={cols} getKey={emp => emp.id} emptyMessage="Nenhum funcionário encontrado." />;
        })()}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={isViewOnly ? `Visualizar Funcionário ${formData.nome}` : (editingEmployee ? `Editar Funcionário ${formData.nome}` : "Novo Funcionário")}
        className="max-w-6xl"
        footer={
          isViewOnly ? (
            <Button onClick={() => setIsModalOpen(false)} className="px-8 font-bold">OK</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsModalOpen(false)} className="px-6 font-bold uppercase text-xs tracking-widest">Cancelar</Button>
              <Button onClick={handleSave} className="px-8 font-bold uppercase text-xs tracking-widest" disabled={isSaving}>
                {isSaving ? 'Salvando...' : (editingEmployee ? 'Salvar Alterações' : 'Salvar Funcionário')}
              </Button>
            </>
          )
        }
      >
        {/* Tab navigation */}
        <div className="flex border-b border-slate-200 mb-6 -mt-2">
          <button
            type="button"
            onClick={() => setActiveTab('dados')}
            className={cn(
              'px-5 py-2.5 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors',
              activeTab === 'dados'
                ? 'border-[#B21212] text-[#B21212]'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            )}
          >
            Dados Cadastrais
          </button>
          {editingEmployee && (
            <button
              type="button"
              onClick={() => setActiveTab('descontos')}
              className={cn(
                'px-5 py-2.5 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors flex items-center gap-1.5',
                activeTab === 'descontos'
                  ? 'border-[#B21212] text-[#B21212]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              )}
            >
              <Tag className="h-3.5 w-3.5" />
              Descontos
              {descontos.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-[#B21212]/10 text-[#B21212] text-[10px] font-black">
                  {descontos.length}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="space-y-8 max-h-[65vh] overflow-y-auto pr-2 relative">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg flex gap-3 animate-in fade-in slide-in-from-top-2">
              <X className="h-5 w-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-600 font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {/* ── Descontos Tab ────────────────────────────────────── */}
          {activeTab === 'descontos' && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>Descontos do Funcionário
                </h3>
                {!isViewOnly && (
                  <Button onClick={() => handleOpenDescontoModal()} className="gap-1.5 h-8 px-4 text-xs font-bold uppercase tracking-wider">
                    <Plus className="h-3.5 w-3.5" />
                    Novo Desconto
                  </Button>
                )}
              </div>
              {descontos.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg">
                  Nenhum desconto registrado.
                </div>
              ) : (
                <div className="rounded-lg border border-slate-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrição</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor (R$)</th>
                        {!isViewOnly && <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ações</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {descontos.map(d => (
                        <tr key={d.iddesconto} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors group">
                          <td className="px-4 py-3 text-slate-600 font-medium">{d.data ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-500">{d.descricao ?? '—'}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-700">
                            {d.valor != null ? d.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                          </td>
                          {!isViewOnly && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600" onClick={() => handleOpenDescontoModal(d)} title="Editar"><Edit2 className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => { setDescontoToDelete(d); setIsDeleteDescontoOpen(true); }} title="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {activeTab === 'dados' && <><section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>Dados Pessoais
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2"><Input label="Nome Completo" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} disabled={isViewOnly} /></div>
              <Input label="Apelido" value={formData.apelido} onChange={(e) => setFormData({ ...formData, apelido: e.target.value })} disabled={isViewOnly} />
              <Input label="Data de Nascimento" type="date" value={formData.nascimento} onChange={(e) => setFormData({ ...formData, nascimento: e.target.value })} disabled={isViewOnly} />
              <Input label="CPF" value={formData.cpf} onChange={(e) => setFormData({ ...formData, cpf: e.target.value })} disabled={isViewOnly} />
              <Input label="RG" value={formData.rg} onChange={(e) => setFormData({ ...formData, rg: e.target.value })} disabled={isViewOnly} />
              <Input label="CTPF" value={formData.ctpf} onChange={(e) => setFormData({ ...formData, ctpf: e.target.value })} disabled={isViewOnly} />
              <Input label="Série" value={formData.serie} onChange={(e) => setFormData({ ...formData, serie: e.target.value })} disabled={isViewOnly} />
              <Input label="PIS" value={formData.pis} onChange={(e) => setFormData({ ...formData, pis: e.target.value })} disabled={isViewOnly} />
            </div>
          </section>

          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>Dados Profissionais
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Cargo</label>
                <select 
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50"
                  value={formData.idcargo || ''}
                  onChange={(e) => {
                    const id = parseInt(e.target.value);
                    const cargoNome = cargos.find(c => c.idcargo === id)?.nome || '';
                    setFormData({ ...formData, idcargo: id, cargo: cargoNome });
                  }}
                  disabled={isViewOnly}
                >
                  <option value="">Selecione um Cargo</option>
                  {cargos.map(c => <option key={c.idcargo} value={c.idcargo}>{c.nome}</option>)}
                </select>
              </div>
              <Input label="CBO" value={formData.cbo} onChange={(e) => setFormData({ ...formData, cbo: e.target.value })} disabled={isViewOnly} />
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Status</label>
                <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ATIVO' | 'INATIVO' })} disabled={isViewOnly}>
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                </select>
              </div>
              <Input label="Data de Admissão" type="date" value={formData.admissao} onChange={(e) => setFormData({ ...formData, admissao: e.target.value })} disabled={isViewOnly} />
              <Input label="Data de Demissão" type="date" value={formData.demissao} onChange={(e) => setFormData({ ...formData, demissao: e.target.value })} disabled={isViewOnly} />
            </div>
          </section>

          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>Endereço
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Linha 1: CEP | Estado | Cidade (col-2) */}
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">CEP</label>
                <div className="relative flex items-center">
                  <input
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50"
                    value={formData.cep}
                    onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                    onBlur={(e) => !isViewOnly && handleCepLookup(e.target.value)}
                    disabled={isViewOnly}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                  <div className="absolute right-2.5 text-slate-400 pointer-events-none">
                    {isCepLoading
                      ? <Loader2 className="h-4 w-4 animate-spin text-[#B21212]" />
                      : <Search className="h-3.5 w-3.5" />
                    }
                  </div>
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Estado</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50"
                  value={formData.idestado || ''}
                  onChange={(e) => setFormData({ ...formData, idestado: e.target.value, idcidade: 0, idbairro: 0 })}
                  disabled={isViewOnly}
                >
                  <option value="">UF</option>
                  {estados.map(st => <option key={st.idestado} value={st.idestado}>{st.idestado} - {st.nome}</option>)}
                </select>
              </div>

              <div className="md:col-span-2 flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Cidade</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50"
                  value={formData.idcidade || ''}
                  onChange={(e) => setFormData({ ...formData, idcidade: parseInt(e.target.value) || 0, idbairro: 0 })}
                  disabled={isViewOnly}
                >
                  <option value="">Selecione...</option>
                  {cidades.map(c => <option key={c.idcidade} value={c.idcidade}>{c.nome}</option>)}
                </select>
              </div>

              {/* Linha 2: Bairro (col-2) | Logradouro (col-2) */}
              <div className="md:col-span-2 flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Bairro</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50"
                  value={formData.idbairro || ''}
                  onChange={(e) => setFormData({ ...formData, idbairro: parseInt(e.target.value) || 0 })}
                  disabled={isViewOnly}
                >
                  <option value="">Selecione...</option>
                  {bairros.map(b => <option key={b.idbairro} value={b.idbairro}>{b.nome}</option>)}
                </select>
              </div>

              <div className="md:col-span-2">
                <Input label="Logradouro" value={formData.logradouro} onChange={(e) => setFormData({ ...formData, logradouro: e.target.value })} disabled={isViewOnly} />
              </div>

              {/* Linha 3: Número | Complemento (col-3) */}
              <Input label="Número" type="number" value={formData.numero} onChange={(e) => setFormData({ ...formData, numero: parseInt(e.target.value) || 0 })} disabled={isViewOnly} />
              <div className="md:col-span-3">
                <Input label="Complemento" value={formData.complemento} onChange={(e) => setFormData({ ...formData, complemento: e.target.value })} disabled={isViewOnly} />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>Documentos e Saúde
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input label="CNH" value={formData.cnh} onChange={(e) => setFormData({ ...formData, cnh: e.target.value })} disabled={isViewOnly} />
              <Input label="Categoria CNH" value={formData.categoria} onChange={(e) => setFormData({ ...formData, categoria: e.target.value })} disabled={isViewOnly} />
              <Input label="Validade CNH" type="date" value={formData.validade_cnh} onChange={(e) => setFormData({ ...formData, validade_cnh: e.target.value })} disabled={isViewOnly} />
              <Input label="Número Calçado" type="number" value={formData.pe} onChange={(e) => setFormData({ ...formData, pe: parseInt(e.target.value) || 0 })} disabled={isViewOnly} />
              <Input label="Validade Exame" type="date" value={formData.validade_exame} onChange={(e) => setFormData({ ...formData, validade_exame: e.target.value })} disabled={isViewOnly} />
              <Input label="Data Toxicológico" type="date" value={formData.data_toxicologico} onChange={(e) => setFormData({ ...formData, data_toxicologico: e.target.value })} disabled={isViewOnly} />
            </div>
          </section>

          <section>
            <h3 className="text-xs font-black text-[#B21212] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B21212]"></span>Observações
            </h3>
            <textarea className="w-full min-h-[100px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 disabled:bg-slate-50" rows={4} placeholder="Informações adicionais..." value={formData.observacao} onChange={(e) => setFormData({ ...formData, observacao: e.target.value })} disabled={isViewOnly} />
          </section></>}
        </div>
      </Modal>

      {/* ── Desconto add/edit modal ───────────────────────────── */}
      <Modal
        isOpen={isDescontoModalOpen}
        onClose={() => setIsDescontoModalOpen(false)}
        title={editingDesconto ? 'Editar Desconto' : 'Novo Desconto'}
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsDescontoModalOpen(false)} className="px-6 font-bold uppercase text-xs tracking-widest">Cancelar</Button>
            <Button onClick={handleSaveDesconto} className="px-8 font-bold uppercase text-xs tracking-widest" disabled={isSavingDesconto}>
              {isSavingDesconto ? 'Salvando...' : 'Salvar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {descontoError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex gap-2">
              <X className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 font-medium">{descontoError}</p>
            </div>
          )}
          <Input label="Data" type="date" value={descontoForm.data} onChange={e => setDescontoForm(f => ({ ...f, data: e.target.value }))} />
          <Input label="Descrição" value={descontoForm.descricao} onChange={e => setDescontoForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Adiantamento, Multa..." />
          <Input label="Valor (R$)" type="number" step="0.01" value={descontoForm.valor} onChange={e => setDescontoForm(f => ({ ...f, valor: e.target.value }))} placeholder="0.00" />
        </div>
      </Modal>

      {/* ── Desconto delete confirm modal ────────────────────── */}
      <Modal isOpen={isDeleteDescontoOpen} onClose={() => setIsDeleteDescontoOpen(false)} title="Confirmar Exclusão" className="max-w-md"
        footer={<div className="flex gap-3 justify-end w-full"><Button variant="outline" onClick={() => setIsDeleteDescontoOpen(false)} className="flex-1">Cancelar</Button><Button variant="primary" onClick={handleDeleteDesconto} className="flex-1 bg-red-600 hover:bg-red-700 border-red-600 shadow-md shadow-red-200">Confirmar Exclusão</Button></div>}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-red-600"><div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center"><Trash2 className="h-5 w-5" /></div><h4 className="font-bold">Atenção!</h4></div>
          <p className="text-sm text-slate-600 leading-relaxed">Deseja excluir o desconto de <span className="font-bold text-slate-900">R$ {descontoToDelete?.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '0,00'}</span>? Esta ação não poderá ser desfeita.</p>
        </div>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirmar Exclusão" className="max-w-md" footer={<div className="flex gap-3 justify-end w-full"><Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} className="flex-1">Cancelar</Button><Button variant="primary" onClick={handleConfirmDelete} className="flex-1 bg-red-600 hover:bg-red-700 border-red-600 shadow-md shadow-red-200">Confirmar Exclusão</Button></div>}>
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-red-600"><div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center"><Trash2 className="h-5 w-5" /></div><h4 className="font-bold">Atenção!</h4></div>
          <p className="text-sm text-slate-600 leading-relaxed">Deseja realmente excluir o funcionário <span className="font-bold text-slate-900">{employeeToDelete?.nome}</span>? Esta ação não poderá ser desfeita.</p>
          {deleteError && <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex gap-3"><X className="h-5 w-5 text-red-500 shrink-0" /><p className="text-xs text-red-600 font-medium leading-relaxed">{deleteError}</p></div>}
        </div>
      </Modal>
    </div>
  );
}
