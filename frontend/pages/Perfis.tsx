import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Plus, Edit2, Trash2, X, ShieldCheck, Loader2 } from 'lucide-react';
import { Perfil, Modulo, Permissao } from '../types';
import { cn } from '../utils/cn';

const emptyForm = () => ({ nome: '', descricao: '', ativo: true });

// Colunas de permissão exibidas na matriz
const PERM_COLS: { key: keyof Permissao; label: string }[] = [
  { key: 'pode_ler',      label: 'Ler'     },
  { key: 'pode_criar',    label: 'Criar'   },
  { key: 'pode_editar',   label: 'Editar'  },
  { key: 'pode_excluir',  label: 'Excluir' },
  { key: 'pode_exportar', label: 'Export.' },
];

export function PerfisPage() {
  const [perfis, setPerfis]           = useState<Perfil[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [isSaving, setIsSaving]       = useState(false);
  const [isOpen, setIsOpen]           = useState(false);
  const [editingId, setEditingId]     = useState<number | null>(null);
  const [form, setForm]               = useState(emptyForm());
  const [formError, setFormError]     = useState<string | null>(null);
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);
  const [deleteModal, setDeleteModal] = useState<Perfil | null>(null);

  // Permissões
  const [permModal, setPermModal]     = useState<Perfil | null>(null);
  const [modulos, setModulos]         = useState<Modulo[]>([]);
  const [permMap, setPermMap]         = useState<Record<number, Permissao>>({});
  const [isSavingPerm, setIsSavingPerm] = useState(false);
  const [isLoadingPerm, setIsLoadingPerm] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchPerfis = async () => {
    setIsLoading(true);
    try {
      const r = await fetch('/api/admin/perfis');
      if (r.ok) setPerfis(await r.json());
    } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchPerfis(); }, []);

  const openNew = () => { setEditingId(null); setForm(emptyForm()); setFormError(null); setIsOpen(true); };
  const openEdit = (p: Perfil) => { setEditingId(p.idperfil); setForm({ nome: p.nome, descricao: p.descricao ?? '', ativo: p.ativo }); setFormError(null); setIsOpen(true); };

  const handleSave = async () => {
    if (!form.nome) { setFormError('Nome é obrigatório.'); return; }
    setIsSaving(true); setFormError(null);
    try {
      const url    = editingId ? `/api/admin/perfis/${editingId}` : '/api/admin/perfis';
      const method = editingId ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail || 'Erro ao salvar.'); }
      await fetchPerfis();
      setIsOpen(false);
      showToast(editingId ? 'Perfil atualizado!' : 'Perfil criado!');
    } catch (err: any) { setFormError(err.message); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    const r = await fetch(`/api/admin/perfis/${deleteModal.idperfil}`, { method: 'DELETE' });
    if (r.ok) { setDeleteModal(null); await fetchPerfis(); showToast('Perfil excluído.'); }
    else { const e = await r.json(); showToast(e.detail || 'Erro ao excluir.', false); setDeleteModal(null); }
  };

  // ── Permissões ──────────────────────────────────────────────────────────
  const openPermModal = useCallback(async (p: Perfil) => {
    setPermModal(p);
    setIsLoadingPerm(true);
    try {
      const [rMod, rPerm] = await Promise.all([
        fetch('/api/admin/modulos'),
        fetch(`/api/admin/permissoes/${p.idperfil}`),
      ]);
      const mods: Modulo[]    = rMod.ok  ? await rMod.json()  : [];
      const perms: Permissao[] = rPerm.ok ? await rPerm.json() : [];
      setModulos(mods);
      const map: Record<number, Permissao> = {};
      perms.forEach(pm => { map[pm.idmodulo] = pm; });
      // Garante entrada para módulos sem permissão ainda
      mods.forEach(m => {
        if (!map[m.idmodulo]) {
          map[m.idmodulo] = {
            id: 0, idpermissao: 0,
            idperfil: p.idperfil, idmodulo: m.idmodulo,
            pode_ler: false, pode_criar: false, pode_editar: false, pode_excluir: false, pode_exportar: false,
          };
        }
      });
      setPermMap(map);
    } finally { setIsLoadingPerm(false); }
  }, []);

  const togglePerm = (idmodulo: number, key: keyof Permissao) => {
    setPermMap(prev => ({
      ...prev,
      [idmodulo]: { ...prev[idmodulo], [key]: !prev[idmodulo][key] },
    }));
  };

  const toggleAllPerm = (idmodulo: number, value: boolean) => {
    setPermMap(prev => ({
      ...prev,
      [idmodulo]: {
        ...prev[idmodulo],
        pode_ler: value, pode_criar: value, pode_editar: value, pode_excluir: value, pode_exportar: value,
      },
    }));
  };

  const toggleColumnPerm = (key: keyof Permissao, value: boolean) => {
    setPermMap(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { next[Number(k)] = { ...next[Number(k)], [key]: value }; });
      return next;
    });
  };

  const handleSavePerms = async () => {
    if (!permModal) return;
    setIsSavingPerm(true);
    try {
      const payload = Object.values(permMap).map(p => ({
        idperfil: permModal.idperfil,
        idmodulo: p.idmodulo,
        pode_ler: p.pode_ler,
        pode_criar: p.pode_criar,
        pode_editar: p.pode_editar,
        pode_excluir: p.pode_excluir,
        pode_exportar: p.pode_exportar,
      }));
      const r = await fetch(`/api/admin/permissoes/${permModal.idperfil}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error('Erro ao salvar permissões.');
      setPermModal(null);
      showToast('Permissões salvas!');
    } catch (err: any) { showToast(err.message, false); }
    finally { setIsSavingPerm(false); }
  };

  return (
    <div className="flex flex-col h-full relative">
      <Header title="Perfis e Permissões" />

      {toast && (
        <div className={cn('fixed top-4 right-4 z-[100] p-4 rounded-lg shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-right-5',
          toast.ok ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100')}>
          <p className={cn('text-sm font-bold', toast.ok ? 'text-emerald-800' : 'text-red-800')}>{toast.msg}</p>
          <button onClick={() => setToast(null)}><X className="h-4 w-4 text-slate-400" /></button>
        </div>
      )}

      <div className="p-5 space-y-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm flex justify-end">
          <Button onClick={openNew} className="gap-2 h-9 px-5 font-bold uppercase tracking-wider">
            <Plus className="h-5 w-5" />Novo Perfil
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-[#B21212]/20 border-t-[#B21212] rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Carregando...</span>
            </div>
          ) : perfis.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">Nenhum perfil cadastrado.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['ID', 'Nome', 'Descrição', 'Status', 'Ações'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perfis.map(p => (
                  <tr key={p.idperfil} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors group">
                    <td className="px-4 py-3 text-xs font-bold text-[#B21212]">{p.idperfil}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{p.nome}</td>
                    <td className="px-4 py-3 text-slate-500">{p.descricao || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                        p.ativo ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500')}>
                        {p.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600"
                          title="Permissões" onClick={() => openPermModal(p)}>
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600"
                          title="Editar" onClick={() => openEdit(p)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600"
                          title="Excluir" onClick={() => setDeleteModal(p)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal criar/editar perfil */}
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}
        title={editingId ? 'Editar Perfil' : 'Novo Perfil'}
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsOpen(false)} className="px-6 font-bold uppercase text-xs tracking-widest">Cancelar</Button>
            <Button onClick={handleSave} className="px-8 font-bold uppercase text-xs tracking-widest" disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex gap-2">
              <X className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 font-medium">{formError}</p>
            </div>
          )}
          <Input label="Nome do Perfil" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</label>
            <textarea className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20" rows={3}
              value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>
          <div className="flex items-center gap-3">
            <input id="ativo-perf" type="checkbox" checked={form.ativo}
              onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 accent-[#B21212]" />
            <label htmlFor="ativo-perf" className="text-sm text-slate-600 font-medium">Perfil ativo</label>
          </div>
        </div>
      </Modal>

      {/* Modal permissões */}
      <Modal isOpen={!!permModal} onClose={() => setPermModal(null)}
        title={`Permissões — ${permModal?.nome ?? ''}`}
        className="max-w-4xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setPermModal(null)} className="px-6 font-bold uppercase text-xs tracking-widest">Cancelar</Button>
            <Button onClick={handleSavePerms} className="px-8 font-bold uppercase text-xs tracking-widest" disabled={isSavingPerm}>
              {isSavingPerm ? 'Salvando...' : 'Salvar Permissões'}
            </Button>
          </>
        }
      >
        {isLoadingPerm ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#B21212]" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Carregando módulos...</span>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[45%]">Módulo</th>
                  {PERM_COLS.map(col => (
                    <th key={col.key} className="px-2 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <div className="flex flex-col items-center gap-1">
                        {col.label}
                        <div className="flex gap-1 mt-0.5">
                          <button type="button" onClick={() => toggleColumnPerm(col.key, true)}
                            className="text-[8px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-bold">ALL</button>
                          <button type="button" onClick={() => toggleColumnPerm(col.key, false)}
                            className="text-[8px] px-1 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold">CLR</button>
                        </div>
                      </div>
                    </th>
                  ))}
                  <th className="px-2 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tudo</th>
                </tr>
              </thead>
              <tbody>
                {modulos.map(m => {
                  const perm = permMap[m.idmodulo];
                  const allOn = perm && PERM_COLS.every(c => perm[c.key]);
                  return (
                    <tr key={m.idmodulo} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/40 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-700">{m.nome}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{m.codigo}</span>
                        </div>
                      </td>
                      {PERM_COLS.map(col => (
                        <td key={col.key} className="px-2 py-2.5 text-center">
                          <input type="checkbox"
                            checked={!!(perm && perm[col.key])}
                            onChange={() => togglePerm(m.idmodulo, col.key)}
                            className="h-4 w-4 rounded border-slate-300 accent-[#B21212]" />
                        </td>
                      ))}
                      <td className="px-2 py-2.5 text-center">
                        <input type="checkbox"
                          checked={!!allOn}
                          onChange={e => toggleAllPerm(m.idmodulo, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 accent-[#B21212]" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Modal excluir */}
      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Confirmar Exclusão" className="max-w-md"
        footer={
          <div className="flex gap-3 justify-end w-full">
            <Button variant="outline" onClick={() => setDeleteModal(null)} className="flex-1">Cancelar</Button>
            <Button variant="primary" onClick={handleDelete} className="flex-1 bg-red-600 hover:bg-red-700 border-red-600">Confirmar Exclusão</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-red-600">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center"><Trash2 className="h-5 w-5" /></div>
            <h4 className="font-bold">Atenção!</h4>
          </div>
          <p className="text-sm text-slate-600">Deseja excluir o perfil <span className="font-bold text-slate-900">{deleteModal?.nome}</span>?
            <br /><span className="text-xs text-red-500">Todas as permissões vinculadas serão removidas.</span>
          </p>
        </div>
      </Modal>
    </div>
  );
}
