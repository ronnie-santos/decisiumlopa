import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { InputCurrency } from '../components/ui/InputCurrency';
import { Modal } from '../components/ui/Modal';
import { FornecedorAutocomplete, FornecedorOption } from '../components/ui/FornecedorAutocomplete';
import { ProdutoAutocomplete, ProdutoOption } from '../components/ui/ProdutoAutocomplete';
import {
  Plus, Search, ChevronLeft, ChevronRight, X,
  AlertCircle, CheckCircle2, Trash2, Edit, Eye,
  Package, CreditCard, FileText, AlertTriangle, ShoppingCart,
} from 'lucide-react';
import { cn } from '../utils/cn';

// ── Local interfaces ──────────────────────────────────────────────────────────

interface CompraAPI {
  idcompras: number;
  emissao: string | null;
  vencimento: string | null;
  nota: string | null;
  serie: string | null;
  valor: number | null;
  valor_produto: number | null;
  frete: number | null;
  seguro: number | null;
  desconto: number | null;
  ipi: number | null;
  icms: number | null;
  base_calculo: number | null;
  base_icms: number | null;
  ir: number | null;
  inss: number | null;
  parcelas: number | null;
  observacao: string | null;
  situacao: boolean | null;
  idfluxo: string | null;
  idfornecedor: number | null;
  idempresa: number | null;
  fornecedor_rel: { idfornecedor: number; nome: string | null; nomefantasia: string | null } | null;
  empresa_rel: { idempresa: number; nome: string | null; nomefantasia: string | null } | null;
  itens: CompraItemAPI[];
  contas_pagar: ContaPagarItemAPI[];
}

interface CompraItemAPI {
  idproduto: number | null;
  idequipamento: number | null;
  quantidade: number | null;
  valor_unitario: number | null;
  valor_total: number | null;
  km: number | null;
}

interface ContaPagarItemAPI {
  idcontaspagar: number;
  parcela: string | null;
  vencimento: string | null;
  valor: number | null;
  situacao: boolean | null;
}

interface Fornecedor  { idfornecedor: number; nome: string | null; nomefantasia: string | null }
interface Empresa     { idempresa: number; nome: string | null; nomefantasia: string | null }
interface Equipamento { idequipamento: number; nome: string | null; placa: string | null }
interface FluxoFin    { idfluxo: string; descricao: string | null }

interface ItemForm {
  idproduto: number | '';
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  idequipamento: number | '';
  km: number;
}

interface ParcelaForm {
  parcela: string;
  vencimento: string;
  valor: number;
  desconto: number;
  observacao: string;
}

interface CompraForm {
  idfornecedor: number | '';
  idempresa: number | '';
  nota: string;
  serie: string;
  emissao: string;
  vencimento: string;
  idfluxo: string;
  valor_produto: number;
  frete: number;
  seguro: number;
  desconto: number;
  ir: number;
  inss: number;
  icms: number;
  base_calculo: number;
  base_icms: number;
  ipi: number;
  observacao: string;
}

const emptyCompraForm: CompraForm = {
  idfornecedor: '', idempresa: '', nota: '', serie: '',
  emissao: new Date().toISOString().split('T')[0],
  vencimento: '',
  idfluxo: '',
  valor_produto: 0, frete: 0, seguro: 0, desconto: 0,
  ir: 0, inss: 0, icms: 0, base_calculo: 0, base_icms: 0, ipi: 0,
  observacao: '',
};

const emptyItemForm: ItemForm = {
  idproduto: '', descricao: '', quantidade: 1, valor_unitario: 0, idequipamento: '', km: 0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split('T')[0];

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function fmtCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ComprasPage() {
  // ── Data ────────────────────────────────────────────────────────────────────
  const [compras, setCompras]     = useState<CompraAPI[]>([]);
  const [loading, setLoading]     = useState(true);
  const [totalCompras, setTotalCompras]   = useState(0);
  const [totalValor, setTotalValor]       = useState(0);
  const [totalFornecedores, setTotalFornecedores] = useState(0);

  // ── Paginação server-side ────────────────────────────────────────────────────
  const PER_PAGE = 50;
  const [page, setPage]           = useState(1);
  const totalPages                = Math.max(1, Math.ceil(totalCompras / PER_PAGE));

  // ── Filtros (inputs do usuário) ───────────────────────────────────────────────
  const [filterFornecedor, setFilterFornecedor] = useState('');
  const [filterEmissaoDe, setFilterEmissaoDe]   = useState('');
  const [filterEmissaoAte, setFilterEmissaoAte] = useState('');

  // ── Filtros aplicados (disparam fetch) ───────────────────────────────────────
  const [activeFilters, setActiveFilters] = useState({ fornecedor: '', emissaoDe: '', emissaoAte: '' });

  // ── Auxiliares para selects ───────────────────────────────────────────────────
  const [empresas, setEmpresas]         = useState<Empresa[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [fluxos, setFluxos]             = useState<FluxoFin[]>([]);

  // ── Autocomplete fornecedor ───────────────────────────────────────────────────
  const [fornecedorDisplayName, setFornecedorDisplayName] = useState('');

  const handleFornecedorChange = (f: FornecedorOption | null) => {
    setCompraForm(prev => ({ ...prev, idfornecedor: f?.idfornecedor ?? '' }));
    setFornecedorDisplayName(f ? (f.nomefantasia || f.nome || '') : '');
  };

  // ── Entrada de Nota Modal ────────────────────────────────────────────────────
  const [isEntradaOpen, setIsEntradaOpen]         = useState(false);
  const [activeTab, setActiveTab]                 = useState<'invoice' | 'items' | 'installments'>('invoice');
  const [compraForm, setCompraForm]               = useState<CompraForm>(emptyCompraForm);
  const [itens, setItens]                         = useState<ItemForm[]>([]);
  const [parcelas, setParcelas]                   = useState<ParcelaForm[]>([]);
  const [parcCount, setParcCount]                 = useState(1);
  const [parcFirstDate, setParcFirstDate]         = useState(today);
  const [isItemModalOpen, setIsItemModalOpen]     = useState(false);
  const [itemForm, setItemForm]                   = useState<ItemForm>(emptyItemForm);
  const [editingItemIdx, setEditingItemIdx]       = useState<number | null>(null);
  const [savingNota, setSavingNota]               = useState(false);
  const [notaError, setNotaError]                 = useState<string | null>(null);
  const [notaSuccess, setNotaSuccess]             = useState(false);
  const [validationFields, setValidationFields]   = useState<string[]>([]);
  const [isValidationOpen, setIsValidationOpen]   = useState(false);

  // ── Visualizar Compra ─────────────────────────────────────────────────────────
  const [isViewOpen, setIsViewOpen]       = useState(false);
  const [viewData, setViewData]           = useState<CompraAPI | null>(null);
  const [loadingView, setLoadingView]     = useState(false);

  // ── Excluir Compra ────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget]   = useState<CompraAPI | null>(null);
  const [isDeleteOpen, setIsDeleteOpen]   = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [deleteError, setDeleteError]     = useState<string | null>(null);

  // ── Load compras (server-side pagination + filtering) ────────────────────────
  const loadCompras = useCallback(async () => {
    setLoading(true);
    try {
      const skip = (page - 1) * PER_PAGE;
      const params = new URLSearchParams({ skip: String(skip), limit: String(PER_PAGE) });
      if (activeFilters.fornecedor)  params.set('fornecedor_nome', activeFilters.fornecedor);
      if (activeFilters.emissaoDe)   params.set('emissao_de',      activeFilters.emissaoDe);
      if (activeFilters.emissaoAte)  params.set('emissao_ate',     activeFilters.emissaoAte);

      const res  = await fetch(`/api/compras?${params}`);
      const data = await res.json();
      setCompras(Array.isArray(data) ? data : []);
      setTotalCompras(Number(res.headers.get('X-Total-Count')        ?? 0));
      setTotalValor(Number(res.headers.get('X-Total-Valor')          ?? 0));
      setTotalFornecedores(Number(res.headers.get('X-Total-Fornecedores') ?? 0));
    } finally {
      setLoading(false);
    }
  }, [page, activeFilters]);

  useEffect(() => { loadCompras(); }, [loadCompras]);

  // ── Load auxiliares ───────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch('/api/empresas').then(r => r.json()),
      fetch(`/api/equipamentos?${new URLSearchParams({ status: 'DISPONÍVEL' })}`).then(r => r.json()),
      fetch('/api/fluxo-financeiro').then(r => r.json()),
    ]).then(([emp, equip, flx]) => {
      setEmpresas(Array.isArray(emp) ? emp : []);
      setEquipamentos(Array.isArray(equip) ? equip : []);
      setFluxos(Array.isArray(flx) ? flx : []);
    }).catch(console.error);
  }, []);

  // ── Aplica filtros (reseta para página 1 e atualiza activeFilters) ────────────
  const handleFilter = () => {
    setPage(1);
    setActiveFilters({ fornecedor: filterFornecedor, emissaoDe: filterEmissaoDe, emissaoAte: filterEmissaoAte });
  };

  const handleClearFilters = () => {
    setFilterFornecedor('');
    setFilterEmissaoDe('');
    setFilterEmissaoAte('');
    setPage(1);
    setActiveFilters({ fornecedor: '', emissaoDe: '', emissaoAte: '' });
  };

  // ── Computed total da compra ──────────────────────────────────────────────────
  const totalCompra = compraForm.valor_produto + compraForm.frete + compraForm.seguro
    - compraForm.desconto + compraForm.ipi + compraForm.icms + compraForm.ir;

  const somaItens = itens.reduce((sum, it) => sum + (it.quantidade * it.valor_unitario), 0);

  // ── Handlers: Entrada de Nota ─────────────────────────────────────────────────
  const handleOpenEntrada = () => {
    setCompraForm(emptyCompraForm);
    setFornecedorDisplayName('');
    setItens([]);
    setParcelas([]);
    setParcCount(1);
    setParcFirstDate(today());
    setActiveTab('invoice');
    setNotaError(null);
    setIsEntradaOpen(true);
  };

  const handleAddItem = () => {
    if (!itemForm.idproduto) return;
    const vTotal = itemForm.quantidade * itemForm.valor_unitario;
    const newItens = [...itens, { ...itemForm, valor_total: vTotal }];
    setItens(newItens);
    setItemForm(emptyItemForm);
    setEditingItemIdx(null);
    setIsItemModalOpen(false);
  };

  const handleRemoveItem = (idx: number) => {
    setItens(itens.filter((_, i) => i !== idx));
  };

  const handleEditItem = (idx: number) => {
    setItemForm(itens[idx]);
    setEditingItemIdx(idx);
    setIsItemModalOpen(true);
  };

  const handleSaveEditItem = () => {
    if (!itemForm.idproduto || editingItemIdx === null) return;
    const newItens = [...itens];
    newItens[editingItemIdx] = itemForm;
    setItens(newItens);
    setItemForm(emptyItemForm);
    setEditingItemIdx(null);
    setIsItemModalOpen(false);
  };

  const handleGenerateParcelas = () => {
    const total = totalCompra;
    const valorParc = total / parcCount;
    const first = new Date(parcFirstDate + 'T12:00:00');
    const generated: ParcelaForm[] = [];
    for (let i = 0; i < parcCount; i++) {
      const d = new Date(first);
      d.setMonth(d.getMonth() + i);
      generated.push({
        parcela: `${i + 1}/${parcCount}`,
        vencimento: d.toISOString().split('T')[0],
        valor: valorParc,
        desconto: 0,
        observacao: '',
      });
    }
    setParcelas(generated);
  };

  const handleSaveNota = async () => {
    const missing: string[] = [];
    if (!compraForm.idfornecedor) missing.push('Fornecedor (obrigatório)');
    if (!compraForm.idempresa)    missing.push('Empresa (obrigatória)');
    if (!compraForm.idfluxo)      missing.push('Fluxo Financeiro (obrigatório)');
    if (!compraForm.emissao)      missing.push('Data de Emissão');
    if (itens.length === 0)       missing.push('Pelo menos um item');
    if (parcelas.length === 0)    missing.push('Pelo menos uma parcela');

    const difSomaItens = Math.abs(compraForm.valor_produto - somaItens);
    if (difSomaItens > 0.01) {
      missing.push(`Valor Produtos (${fmtCurrency(compraForm.valor_produto)}) diferente da soma dos itens (${fmtCurrency(somaItens)})`);
    }

    const totalParcelas = parcelas.reduce((sum, p) => sum + p.valor, 0);
    const diferenca = Math.abs(totalParcelas - totalCompra);
    if (diferenca > 0.01) {
      missing.push(`Soma das parcelas (${fmtCurrency(totalParcelas)}) diferente do total (${fmtCurrency(totalCompra)})`);
    }

    if (missing.length > 0) { setValidationFields(missing); setIsValidationOpen(true); return; }

    setSavingNota(true);
    setNotaError(null);
    try {
      const payload = {
        idfornecedor: compraForm.idfornecedor || null,
        idempresa:    compraForm.idempresa    || null,
        nota:         compraForm.nota         || null,
        serie:        compraForm.serie        || null,
        emissao:      compraForm.emissao      || null,
        vencimento:   compraForm.vencimento   || null,
        idfluxo:      compraForm.idfluxo      || null,
        valor_produto: compraForm.valor_produto,
        frete:        compraForm.frete,
        seguro:       compraForm.seguro,
        desconto:     compraForm.desconto,
        ir:           compraForm.ir,
        inss:         compraForm.inss,
        icms:         compraForm.icms,
        base_calculo: compraForm.base_calculo,
        base_icms:    compraForm.base_icms,
        ipi:          compraForm.ipi,
        valor:        totalCompra,
        parcelas:     parcelas.length,
        observacao:   compraForm.observacao || null,
        situacao:     false,
        itens: itens.map(it => ({
          idproduto:      it.idproduto,
          idequipamento:  it.idequipamento,
          quantidade:     it.quantidade,
          valor_unitario: it.valor_unitario,
          valor_total:    it.quantidade * it.valor_unitario,
          km:             it.km || null,
        })),
        contas_pagar: parcelas.map(p => ({
          vencimento:    p.vencimento,
          valor:         p.valor,
          valor_original: p.valor,
          desconto:      p.desconto,
          observacao:    p.observacao || null,
          parcela:       p.parcela,
          situacao:      false,
        })),
      };

      const res = await fetch('/api/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setNotaError(err.detail ?? 'Erro ao salvar a nota fiscal.');
        return;
      }

      setIsEntradaOpen(false);
      setNotaSuccess(true);
      await loadCompras();
    } finally {
      setSavingNota(false);
    }
  };

  // ── Handler: Visualizar Compra ────────────────────────────────────────────────
  const handleOpenView = async (c: CompraAPI) => {
    setViewData(null);
    setIsViewOpen(true);
    setLoadingView(true);
    try {
      const res  = await fetch(`/api/compras/${c.idcompras}`);
      const data = await res.json();
      setViewData(data);
    } finally {
      setLoadingView(false);
    }
  };

  // ── Handler: Excluir Compra ───────────────────────────────────────────────────
  const handleOpenDelete = (c: CompraAPI) => {
    setDeleteTarget(c);
    setDeleteError(null);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/compras/${deleteTarget.idcompras}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setDeleteError(err.detail ?? 'Erro ao excluir compra.');
        return;
      }
      setIsDeleteOpen(false);
      await loadCompras();
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      <Header title="Compras" />

      <div className="flex-1 overflow-auto p-6 space-y-5">

        {/* ── Stats cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border-l-4 border-[#B21212] p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total de Compras</p>
              <h3 className="text-xl font-black text-slate-800">{totalCompras.toLocaleString('pt-BR')}</h3>
              <p className="text-[10px] text-[#B21212] font-bold mt-0.5">
                {totalCompras === 1 ? 'nota fiscal' : 'notas fiscais'}{' '}
                <span className="text-slate-400 font-normal">no período</span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-[#B21212]/10 flex items-center justify-center text-[#B21212] flex-shrink-0 ml-3">
              <ShoppingCart className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border-l-4 border-emerald-500 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Valor Total</p>
              <h3 className="text-xl font-black text-slate-800">{fmtCurrency(totalValor ?? 0)}</h3>
              <p className="text-[10px] text-emerald-500 font-bold mt-0.5">
                <span className="text-slate-400 font-normal">valor total das compras</span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500 flex-shrink-0 ml-3">
              <FileText className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border-l-4 border-blue-500 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Fornecedores</p>
              <h3 className="text-xl font-black text-slate-800">{totalFornecedores.toLocaleString('pt-BR')}</h3>
              <p className="text-[10px] text-blue-500 font-bold mt-0.5">
                {totalFornecedores === 1 ? 'fornecedor' : 'fornecedores'}{' '}
                <span className="text-slate-400 font-normal">distintos</span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 flex-shrink-0 ml-3">
              <Package className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* ── Filtros + botão ── */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Fornecedor</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20"
                  placeholder="Buscar por fornecedor..."
                  value={filterFornecedor}
                  onChange={e => setFilterFornecedor(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleFilter()}
                />
              </div>
            </div>
            <div className="w-40">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Emissão De</label>
              <input
                type="date"
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20"
                value={filterEmissaoDe}
                onChange={e => setFilterEmissaoDe(e.target.value)}
              />
            </div>
            <div className="w-40">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Emissão Até</label>
              <input
                type="date"
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20"
                value={filterEmissaoAte}
                onChange={e => setFilterEmissaoAte(e.target.value)}
              />
            </div>
            <Button variant="default" className="gap-2" onClick={handleFilter}>
              <Search className="h-4 w-4" />
              Filtrar
            </Button>
            <Button variant="secondary" className="gap-2" onClick={handleClearFilters}>
              <X className="h-4 w-4" />
              Limpar
            </Button>
            <Button onClick={handleOpenEntrada} className="gap-2 font-bold uppercase tracking-wider">
              <Plus className="h-5 w-5" />Novo
            </Button>
          </div>
        </div>

        {/* ── Tabela ── */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Compra</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fornecedor</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nota / Série</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Emissão</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empresa</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor Total</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Parcelas</th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-400">Carregando...</td></tr>
              )}
              {!loading && compras.map(c => (
                <tr key={c.idcompras} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-4 py-2">
                    <span className="text-xs font-bold text-[#B21212]">#{c.idcompras}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-xs font-bold text-slate-700">
                      {c.fornecedor_rel?.nomefantasia ?? c.fornecedor_rel?.nome ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-xs text-slate-600">{c.nota ?? '—'}</span>
                    {c.serie && <span className="text-xs text-slate-400 ml-1">/ {c.serie}</span>}
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-xs text-slate-500">{fmtDate(c.emissao)}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-xs text-slate-500">
                      {c.empresa_rel?.nomefantasia ?? c.empresa_rel?.nome ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-xs font-bold text-slate-700">{fmtCurrency(c.valor ?? 0)}</span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className="inline-flex px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border bg-blue-50 text-blue-600 border-blue-100">
                      {c.parcelas ?? 1}x
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-600"
                        onClick={() => handleOpenDelete(c)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-blue-600"
                        onClick={() => handleOpenView(c)}
                        title="Visualizar"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && compras.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">Nenhuma compra encontrada.</td></tr>
              )}
            </tbody>
          </table>

          <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Mostrando {compras.length} de {totalCompras.toLocaleString('pt-BR')} compras
              {totalPages > 1 && ` — página ${page} de ${totalPages}`}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === '...'
                      ? <span key={`e-${idx}`} className="px-1 text-slate-400 text-xs">…</span>
                      : <Button key={p} variant={page === p ? 'default' : 'outline'} className="h-8 w-8 p-0 text-xs font-bold" onClick={() => setPage(p as number)}>{p}</Button>
                  )}
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ Modal: Entrada de Nota (3 abas) ══════════════════════════════════════ */}
      <Modal
        isOpen={isEntradaOpen}
        onClose={() => setIsEntradaOpen(false)}
        title="Nova Entrada de Nota Fiscal"
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsEntradaOpen(false)}>Cancelar</Button>
            {notaError && <span className="text-xs text-red-600 font-medium flex-1">{notaError}</span>}
            <Button onClick={handleSaveNota} disabled={savingNota}>
              {savingNota ? 'Salvando...' : 'Salvar Entrada'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            {([
              { key: 'invoice',      label: 'Dados da Nota',   icon: <FileText className="h-4 w-4" /> },
              { key: 'items',        label: 'Itens da Compra', icon: <Package className="h-4 w-4" /> },
              { key: 'installments', label: 'Parcelas',        icon: <CreditCard className="h-4 w-4" /> },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-6 py-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2',
                  activeTab === tab.key
                    ? 'border-[#B21212] text-[#B21212]'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                )}
              >
                <div className="flex items-center gap-2">{tab.icon}{tab.label}</div>
              </button>
            ))}
          </div>

          <div className="min-h-[400px]">

            {/* ── Aba 1: Dados da Nota ── */}
            {activeTab === 'invoice' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
                      Fornecedor <span className="text-red-500">*</span>
                    </label>
                    <FornecedorAutocomplete
                      value={compraForm.idfornecedor}
                      displayName={fornecedorDisplayName}
                      onChange={handleFornecedorChange}
                      placeholder="Digite 2+ caracteres para buscar..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
                      Empresa <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20"
                      value={compraForm.idempresa}
                      onChange={e => setCompraForm(f => ({ ...f, idempresa: e.target.value ? +e.target.value : '' }))}
                    >
                      <option value="">Selecione...</option>
                      {empresas.map(em => (
                        <option key={em.idempresa} value={em.idempresa}>
                          {em.nomefantasia || em.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-3">
                  <Input
                    label="Número da Nota"
                    placeholder="Ex: 000123"
                    value={compraForm.nota}
                    onChange={e => setCompraForm(f => ({ ...f, nota: e.target.value }))}
                  />
                  <Input
                    label="Série"
                    placeholder="Ex: 1"
                    value={compraForm.serie}
                    onChange={e => setCompraForm(f => ({ ...f, serie: e.target.value }))}
                  />
                  <Input
                    label="Data Emissão"
                    type="date"
                    value={compraForm.emissao}
                    onChange={e => setCompraForm(f => ({ ...f, emissao: e.target.value }))}
                  />
                  <Input
                    label="Vencimento"
                    type="date"
                    value={compraForm.vencimento}
                    onChange={e => setCompraForm(f => ({ ...f, vencimento: e.target.value }))}
                  />
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Fluxo Financeiro</label>
                    <select
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20"
                      value={compraForm.idfluxo}
                      onChange={e => setCompraForm(f => ({ ...f, idfluxo: e.target.value }))}
                    >
                      <option value="">Selecione...</option>
                      {fluxos.filter(fl => fl.idfluxo.startsWith('2')).map(fl => (
                        <option key={fl.idfluxo} value={fl.idfluxo}>{fl.idfluxo} — {fl.descricao}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 p-4 bg-slate-50 rounded-lg">
                  <InputCurrency label="Valor Produtos" value={compraForm.valor_produto}
                    onChange={v => setCompraForm(f => ({ ...f, valor_produto: v }))} />
                  <InputCurrency label="Frete" value={compraForm.frete}
                    onChange={v => setCompraForm(f => ({ ...f, frete: v }))} />
                  <InputCurrency label="Seguro" value={compraForm.seguro}
                    onChange={v => setCompraForm(f => ({ ...f, seguro: v }))} />
                  <InputCurrency label="Desconto" value={compraForm.desconto}
                    onChange={v => setCompraForm(f => ({ ...f, desconto: v }))} />
                  <InputCurrency label="IPI" value={compraForm.ipi}
                    onChange={v => setCompraForm(f => ({ ...f, ipi: v }))} />
                  <InputCurrency label="ICMS" value={compraForm.icms}
                    onChange={v => setCompraForm(f => ({ ...f, icms: v }))} />
                  <InputCurrency label="Base ICMS" value={compraForm.base_icms}
                    onChange={v => setCompraForm(f => ({ ...f, base_icms: v }))} />
                  <InputCurrency label="Base Cálculo" value={compraForm.base_calculo}
                    onChange={v => setCompraForm(f => ({ ...f, base_calculo: v }))} />
                  <InputCurrency label="IR" value={compraForm.ir}
                    onChange={v => setCompraForm(f => ({ ...f, ir: v }))} />
                  <InputCurrency label="INSS" value={compraForm.inss}
                    onChange={v => setCompraForm(f => ({ ...f, inss: v }))} />
                  <div className="col-span-2 flex flex-col justify-end">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Valor Total</p>
                    <p className="text-xl font-black text-[#B21212]">{fmtCurrency(totalCompra)}</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Observações</label>
                  <textarea
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20 min-h-[72px]"
                    value={compraForm.observacao}
                    onChange={e => setCompraForm(f => ({ ...f, observacao: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {/* ── Aba 2: Itens da Compra ── */}
            {activeTab === 'items' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Itens da Nota</h4>
                  <Button size="sm" onClick={() => { setItemForm(emptyItemForm); setIsItemModalOpen(true); }} className="gap-2">
                    <Plus className="h-4 w-4" />Adicionar Item
                  </Button>
                </div>
                <div className="border border-slate-100 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Produto</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Qtd</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vl Unit</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vl Total</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equipamento</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">KM</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {itens.map((it, idx) => {
                        const equip = equipamentos.find(e => e.idequipamento === it.idequipamento);
                        return (
                          <tr key={idx} className="text-sm">
                            <td className="px-4 py-2 text-xs font-bold text-slate-700">{it.descricao || String(it.idproduto)}</td>
                            <td className="px-4 py-2 text-xs text-slate-500">{it.quantidade}</td>
                            <td className="px-4 py-2 text-xs text-slate-500">{fmtCurrency(it.valor_unitario)}</td>
                            <td className="px-4 py-2 text-xs font-bold text-slate-700">{fmtCurrency(it.quantidade * it.valor_unitario)}</td>
                            <td className="px-4 py-2 text-xs text-slate-500">{equip ? `${equip.placa ?? ''} ${equip.nome ?? ''}`.trim() : it.idequipamento}</td>
                            <td className="px-4 py-2 text-xs text-slate-500">{it.km || '—'}</td>
                            <td className="px-4 py-2 text-right flex gap-2 justify-end">
                              <button onClick={() => handleEditItem(idx)} className="text-slate-300 hover:text-blue-500 transition-colors">
                                <Edit className="h-4 w-4" />
                              </button>
                              <button onClick={() => handleRemoveItem(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {itens.length === 0 && (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">Nenhum item adicionado</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {itens.length > 0 && (
                  <div className="flex justify-between items-center border-t border-slate-200 pt-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Soma dos Itens</p>
                      <p className="text-xs font-bold text-slate-700">{fmtCurrency(somaItens)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Valor Produtos Configurado</p>
                      <p className="text-xs font-bold text-slate-700">{fmtCurrency(compraForm.valor_produto)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Aba 3: Parcelas ── */}
            {activeTab === 'installments' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    label="Número de Parcelas"
                    type="number" min="1"
                    value={parcCount}
                    onChange={e => setParcCount(Math.max(1, +e.target.value))}
                  />
                  <Input
                    label="Primeiro Vencimento"
                    type="date"
                    value={parcFirstDate}
                    onChange={e => setParcFirstDate(e.target.value)}
                  />
                  <div className="flex flex-col justify-end">
                    <Button onClick={handleGenerateParcelas} className="gap-2 w-full">
                      <CreditCard className="h-4 w-4" />Gerar Parcelas
                    </Button>
                  </div>
                </div>

                <div className="border border-slate-100 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Parcela</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vencimento</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {parcelas.map((p, idx) => (
                        <tr key={idx} className="text-sm">
                          <td className="px-4 py-2 text-xs font-bold text-slate-700">{p.parcela}</td>
                          <td className="px-4 py-2 text-xs text-slate-500">{fmtDate(p.vencimento)}</td>
                          <td className="px-4 py-2 text-xs font-bold text-slate-700">{fmtCurrency(p.valor)}</td>
                          <td className="px-4 py-2">
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-widest">
                              PENDENTE
                            </span>
                          </td>
                        </tr>
                      ))}
                      {parcelas.length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">Nenhuma parcela gerada</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {parcelas.length > 0 && (
                  <div className="flex justify-end p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs font-bold text-slate-700">
                      Total parcelas: <span className="text-[#B21212]">
                        {fmtCurrency(parcelas.reduce((s, p) => s + p.valor, 0))}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* ══ Modal: Adicionar / Editar Item ════════════════════════════════════════ */}
      <Modal
        isOpen={isItemModalOpen}
        onClose={() => { setIsItemModalOpen(false); setEditingItemIdx(null); setItemForm(emptyItemForm); }}
        title={editingItemIdx !== null ? "Editar Item" : "Adicionar Item"}
        className="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={() => { setIsItemModalOpen(false); setEditingItemIdx(null); setItemForm(emptyItemForm); }}>Cancelar</Button>
            <Button onClick={editingItemIdx !== null ? handleSaveEditItem : handleAddItem} disabled={!itemForm.idproduto}>
              {editingItemIdx !== null ? "Salvar" : "Adicionar"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Produto <span className="text-red-500">*</span>
            </label>
            <ProdutoAutocomplete
              value={itemForm.idproduto}
              displayName={itemForm.descricao}
              onChange={p => setItemForm(f => ({
                ...f,
                idproduto: p?.idproduto ?? '',
                descricao: p?.descricao ?? '',
              }))}
              placeholder="Digite 3+ caracteres para buscar..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantidade"
              type="number" step="0.01" min="0" inputMode="decimal"
              value={itemForm.quantidade}
              onChange={e => setItemForm(f => ({ ...f, quantidade: parseFloat(e.target.value) || 0 }))}
            />
            <InputCurrency
              label="Valor Unitário (R$)"
              value={itemForm.valor_unitario}
              onChange={v => setItemForm(f => ({ ...f, valor_unitario: v }))}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Equipamento
            </label>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20"
              value={itemForm.idequipamento}
              onChange={e => setItemForm(f => ({ ...f, idequipamento: e.target.value ? +e.target.value : '' }))}
            >
              <option value="">Selecione...</option>
              {equipamentos.map(eq => (
                <option key={eq.idequipamento} value={eq.idequipamento}>
                  {eq.placa ? `${eq.placa} — ` : ''}{eq.nome}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="KM"
            type="number" min="0"
            value={itemForm.km}
            onChange={e => setItemForm(f => ({ ...f, km: +e.target.value }))}
          />

          <div className="p-3 bg-slate-50 rounded-lg flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total do Item</span>
            <span className="text-lg font-black text-slate-700">
              {fmtCurrency(itemForm.quantidade * itemForm.valor_unitario)}
            </span>
          </div>
        </div>
      </Modal>

      {/* ══ Modal: Campos Obrigatórios ════════════════════════════════════════════ */}
      <Modal
        isOpen={isValidationOpen}
        onClose={() => setIsValidationOpen(false)}
        title="Campos Obrigatórios"
        className="max-w-md"
        footer={<Button onClick={() => setIsValidationOpen(false)} className="px-8">Entendido</Button>}
      >
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="h-16 w-16 bg-amber-50 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-800">Informações Faltando</h4>
            <p className="text-sm text-slate-500 mt-1">Para salvar a entrada, preencha os seguintes campos:</p>
          </div>
          <div className="w-full space-y-2">
            {validationFields.map((f, i) => (
              <div key={i} className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>{f}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* ══ Modal: Entrada salva com sucesso ════════════════════════════════════ */}
      <Modal
        isOpen={notaSuccess}
        onClose={() => setNotaSuccess(false)}
        title="Entrada Registrada"
        className="max-w-md"
        footer={<Button onClick={() => setNotaSuccess(false)} className="px-8">OK</Button>}
      >
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-800">Nota registrada com sucesso!</h4>
            <p className="text-sm text-slate-500 mt-1">A entrada foi salva e as parcelas foram geradas em Contas a Pagar.</p>
          </div>
        </div>
      </Modal>

      {/* ══ Modal: Visualizar Compra ════════════════════════════════════════════ */}
      <Modal
        isOpen={isViewOpen}
        onClose={() => setIsViewOpen(false)}
        title={viewData ? `Compra #${viewData.idcompras}` : 'Carregando...'}
        size="xl"
        footer={<Button variant="outline" onClick={() => setIsViewOpen(false)}>Fechar</Button>}
      >
        {loadingView && (
          <div className="flex items-center justify-center py-12 text-sm text-slate-400">Carregando...</div>
        )}
        {!loadingView && viewData && (
          <div className="space-y-5">

            {/* Cabeçalho */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Fornecedor</p>
                <p className="text-xs font-bold text-slate-700">
                  {viewData.fornecedor_rel?.nomefantasia ?? viewData.fornecedor_rel?.nome ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Empresa</p>
                <p className="text-xs font-bold text-slate-700">
                  {viewData.empresa_rel?.nomefantasia ?? viewData.empresa_rel?.nome ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Situação</p>
                <span className={cn(
                  'inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border',
                  viewData.situacao
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : 'bg-amber-50 text-amber-700 border-amber-100'
                )}>
                  {viewData.situacao ? 'QUITADO' : 'PENDENTE'}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Nota / Série</p>
                <p className="text-xs text-slate-600">{viewData.nota ?? '—'}{viewData.serie ? ` / ${viewData.serie}` : ''}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Emissão</p>
                <p className="text-xs text-slate-600">{fmtDate(viewData.emissao)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Vencimento</p>
                <p className="text-xs text-slate-600">{fmtDate(viewData.vencimento)}</p>
              </div>
            </div>

            {/* Valores */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Valores</p>
              <div className="grid grid-cols-5 gap-3">
                {[
                  { label: 'Produtos',     value: viewData.valor_produto },
                  { label: 'Frete',        value: viewData.frete },
                  { label: 'Seguro',       value: viewData.seguro },
                  { label: 'Desconto',     value: viewData.desconto },
                  { label: 'IPI',          value: viewData.ipi },
                  { label: 'ICMS',         value: viewData.icms },
                  { label: 'Base ICMS',    value: viewData.base_icms },
                  { label: 'Base Cálc.',   value: viewData.base_calculo },
                  { label: 'IR',           value: viewData.ir },
                  { label: 'INSS',         value: viewData.inss },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
                    <p className="text-xs font-bold text-slate-700">{fmtCurrency(value ?? 0)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-end">
                <div className="bg-[#B21212]/5 border border-[#B21212]/20 rounded-lg px-5 py-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Valor Total</p>
                  <p className="text-xl font-black text-[#B21212]">{fmtCurrency(viewData.valor ?? 0)}</p>
                </div>
              </div>
            </div>

            {/* Itens */}
            {viewData.itens && viewData.itens.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Itens da Compra</p>
                <div className="border border-slate-100 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Produto</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Qtd</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vl Unit</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vl Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {viewData.itens.map((it, idx) => (
                        <tr key={idx} className="text-sm">
                          <td className="px-4 py-2 text-xs font-bold text-slate-700">{it.idproduto}</td>
                          <td className="px-4 py-2 text-xs text-slate-500">{it.quantidade}</td>
                          <td className="px-4 py-2 text-xs text-slate-500">{fmtCurrency(it.valor_unitario ?? 0)}</td>
                          <td className="px-4 py-2 text-xs font-bold text-slate-700">{fmtCurrency(it.valor_total ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Parcelas */}
            {viewData.contas_pagar && viewData.contas_pagar.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Parcelas ({viewData.contas_pagar.length}x)
                </p>
                <div className="border border-slate-100 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Parcela</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vencimento</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {viewData.contas_pagar.map(p => (
                        <tr key={p.idcontaspagar} className="text-sm">
                          <td className="px-4 py-2 text-xs font-bold text-slate-700">{p.parcela ?? '—'}</td>
                          <td className="px-4 py-2 text-xs text-slate-500">{fmtDate(p.vencimento)}</td>
                          <td className="px-4 py-2 text-xs font-bold text-slate-700">{fmtCurrency(p.valor ?? 0)}</td>
                          <td className="px-4 py-2">
                            <span className={cn(
                              'inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border',
                              p.situacao
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-amber-50 text-amber-700 border-amber-100'
                            )}>
                              {p.situacao ? 'PAGO' : 'PENDENTE'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Observação */}
            {viewData.observacao && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Observações</p>
                <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{viewData.observacao}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ══ Modal: Confirmar Exclusão ════════════════════════════════════════════ */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Excluir Compra"
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Excluindo...' : 'Confirmar Exclusão'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Deseja excluir a compra <span className="font-bold">#{deleteTarget?.idcompras}</span>?
            Esta ação também excluirá os itens e as parcelas de Contas a Pagar vinculadas.
          </p>
          {deleteError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-100 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {deleteError}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
