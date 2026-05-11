import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/Button';
import { TrendingUp, TrendingDown, ClipboardList, FileText, AlertTriangle, AlertCircle, Cake, FileCheck, ScrollText, Filter } from 'lucide-react';

interface EmpresaOption {
  idempresa: number;
  nome: string;
  nomefantasia: string | null;
}

interface DashboardStats {
  orcamentos_abertos: number;
  contas_receber_aberto: number;
  contas_pagar_aberto: number;
  os_aberta: number;
}

interface AtividadesRecentes {
  licencas_vencimento: Array<{ autorizacao: string; equipamento: string | null; vencimento: string; dias_para_vencer: number; idlicenca: number }>;
  aniversariantes: Array<{ nome: string; dia: number; idfuncionario: number }>;
  cnh_vencimento: Array<{ nome: string; vencimento: string; dias_para_vencer: number; idfuncionario: number }>;
  exame_medico_vencimento: Array<{ nome: string; vencimento: string; dias_para_vencer: number; idfuncionario: number }>;
  exame_toxicologico_vencimento: Array<{ nome: string; vencimento: string; dias_para_vencer: number; idfuncionario: number }>;
}

interface ReceitaMensal {
  contas_receber: Array<{ mes: number; valor: number }>;
  contas_pagar: Array<{ mes: number; valor: number }>;
}

function fmtCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function getNomeMes(mes: number): string {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return meses[mes - 1] || '';
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function firstDayOfYearStr(): string {
  return `${new Date().getFullYear()}-01-01`;
}

export function DashboardPage() {
  const hoje = todayStr();
  const anoInicio = firstDayOfYearStr();

  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterDataInicio, setFilterDataInicio] = useState(anoInicio);
  const [filterDataFim, setFilterDataFim] = useState(hoje);

  // Estado "aplicado" — só muda ao clicar em Filtrar
  const [applied, setApplied] = useState({ empresa: '', dataInicio: anoInicio, dataFim: hoje });

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [atividades, setAtividades] = useState<AtividadesRecentes | null>(null);
  const [receitaMensal, setReceitaMensal] = useState<ReceitaMensal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carrega lista de empresas uma vez
  useEffect(() => {
    fetch('/api/empresas')
      .then(r => r.ok ? r.json() : [])
      .then(data => setEmpresas(Array.isArray(data) ? data : (data.data ?? [])))
      .catch(() => {});
  }, []);

  // Carrega dados do dashboard sempre que os filtros aplicados mudarem
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        setError(null);

        const params = new URLSearchParams();
        if (applied.empresa) params.set('idempresa', applied.empresa);
        if (applied.dataInicio) params.set('data_inicio', applied.dataInicio);
        if (applied.dataFim) params.set('data_fim', applied.dataFim);
        const qs = params.toString() ? `?${params.toString()}` : '';

        const [statsRes, atividadesRes, receitaRes] = await Promise.all([
          fetch(`/api/dashboard/stats${qs}`),
          fetch('/api/dashboard/atividades-recentes'),
          fetch(`/api/dashboard/receita-mensal${qs}`)
        ]);

        if (!statsRes.ok) throw new Error(`Erro ao carregar stats: ${statsRes.status}`);
        if (!atividadesRes.ok) throw new Error(`Erro ao carregar atividades: ${atividadesRes.status}`);
        if (!receitaRes.ok) throw new Error(`Erro ao carregar receita: ${receitaRes.status}`);

        setStats(await statsRes.json());
        setAtividades(await atividadesRes.json());
        setReceitaMensal(await receitaRes.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados do dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [applied]);

  const handleApplyFilter = () => {
    setApplied({ empresa: filterEmpresa, dataInicio: filterDataInicio, dataFim: filterDataFim });
  };

  const statCards = stats ? [
    { label: 'Orçamentos em Aprovação', value: (stats.orcamentos_abertos || 0).toString(), icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Contas a Receber em Aberto', value: fmtCurrency(stats.contas_receber_aberto || 0), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Contas a Pagar em Aberto', value: fmtCurrency(stats.contas_pagar_aberto || 0), icon: TrendingDown, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'OS sem Fechamento', value: (stats.os_aberta || 0).toString(), icon: FileText, color: 'text-red-600', bg: 'bg-red-50' },
  ] : [];

  const maxValue = receitaMensal
    ? Math.max(
        Math.max(...(receitaMensal.contas_receber || []).map(r => r.valor || 0)),
        Math.max(...(receitaMensal.contas_pagar || []).map(r => r.valor || 0))
      )
    : 0;
  const safeMaxValue = maxValue > 0 ? maxValue * 1.1 : 1000;

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Dashboard" />
        <div className="p-8 flex items-center justify-center h-full">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <p className="text-red-700 font-bold mb-2">Erro ao carregar dashboard</p>
            <p className="text-red-600 text-sm">{error}</p>
            <p className="text-red-600 text-xs mt-4">Verifique se o backend está rodando em http://localhost:8005</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" />

      <div className="p-5 space-y-5 overflow-y-auto">
        {/* ── Filtros ── */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Empresa</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                value={filterEmpresa}
                onChange={e => setFilterEmpresa(e.target.value)}
              >
                <option value="">Todas as Empresas</option>
                {empresas.map(e => (
                  <option key={e.idempresa} value={String(e.idempresa)}>
                    {e.nomefantasia || e.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[160px]">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Data Início</label>
              <input
                type="date"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                value={filterDataInicio}
                onChange={e => setFilterDataInicio(e.target.value)}
              />
            </div>
            <div className="min-w-[160px]">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Data Fim</label>
              <input
                type="date"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                value={filterDataFim}
                onChange={e => setFilterDataFim(e.target.value)}
              />
            </div>
            <Button onClick={handleApplyFilter} className="h-9 px-5 font-bold uppercase tracking-wider gap-2">
              <Filter className="h-4 w-4" />Filtrar
            </Button>
          </div>
        </div>

        {/* ── Cards de Estatísticas ── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm h-24 animate-pulse">
                <div className="bg-slate-100 rounded h-4 w-3/4 mb-3"></div>
                <div className="bg-slate-100 rounded h-7 w-1/2"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((stat) => (
              <div key={stat.label} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className={`h-12 w-12 rounded-lg ${stat.bg} flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                  <h3 className="text-2xl font-black text-slate-800">{stat.value}</h3>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Gráfico de Receita Mensal e Atividades ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Receita Mensal */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 uppercase tracking-tight">Receita Mensal</h3>
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            {loading || !receitaMensal ? (
              <div className="h-64 flex items-center justify-center text-slate-400">
                <p>Carregando dados...</p>
              </div>
            ) : (
              <>
                <div className="flex items-end justify-between h-96 gap-2 px-1">
                  {receitaMensal.contas_receber.map((item, i) => {
                    const receitaHeight = item.valor > 0 ? (item.valor / safeMaxValue) * 100 : 1;
                    const despesaItem = receitaMensal.contas_pagar[i];
                    const despesaHeight = despesaItem.valor > 0 ? (despesaItem.valor / safeMaxValue) * 100 : 1;

                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                        <div className="w-full flex gap-0.5 items-end h-80 relative">
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-800 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                            <div className="font-bold">{getNomeMes(item.mes)}</div>
                            <div className="text-emerald-300">Receber: {fmtCurrency(item.valor)}</div>
                            <div className="text-blue-300">Pagar: {fmtCurrency(despesaItem.valor)}</div>
                          </div>
                          <div className="flex-1 bg-emerald-100 rounded-t-sm relative flex-shrink-0 h-full">
                            <div
                              className="absolute bottom-0 left-0 right-0 bg-emerald-500 rounded-t-sm transition-all duration-300 hover:bg-emerald-600"
                              style={{ height: `${receitaHeight}%`, minHeight: item.valor > 0 ? '4px' : '1px' }}
                            ></div>
                          </div>
                          <div className="flex-1 bg-blue-100 rounded-t-sm relative flex-shrink-0 h-full">
                            <div
                              className="absolute bottom-0 left-0 right-0 bg-blue-900 rounded-t-sm transition-all duration-300 hover:bg-blue-800"
                              style={{ height: `${despesaHeight}%`, minHeight: despesaItem.valor > 0 ? '4px' : '1px' }}
                            ></div>
                          </div>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">{getNomeMes(item.mes)}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <div className="flex gap-4 mt-4 justify-center text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded"></div>
                <span className="text-slate-600 font-bold">Contas a Receber</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-900 rounded"></div>
                <span className="text-slate-600 font-bold">Contas a Pagar</span>
              </div>
            </div>
          </div>

          {/* Atividades Recentes */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm h-auto">
            <h3 className="text-lg font-bold text-slate-800 uppercase tracking-tight mb-4">Atividades Recentes</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {/* Licenças com vencimento em até 60 dias */}
              {atividades?.licencas_vencimento && atividades.licencas_vencimento.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Licenças a Vencer (60 dias)</p>
                  {atividades.licencas_vencimento.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-red-50 transition-colors bg-red-50/30">
                      <div className="flex-shrink-0">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${item.dias_para_vencer <= 15 ? 'bg-red-100 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
                          <ScrollText className="h-3 w-3" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-slate-700 truncate">{item.autorizacao}</p>
                        <p className="text-[10px] text-slate-400 truncate">{item.equipamento ?? 'Sem equipamento'} · Vence {item.vencimento}</p>
                      </div>
                      <p className={`text-[9px] font-bold uppercase flex-shrink-0 ${item.dias_para_vencer <= 15 ? 'text-red-600' : 'text-orange-600'}`}>
                        {item.dias_para_vencer}d
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Aniversariantes */}
              {atividades?.aniversariantes && atividades.aniversariantes.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Aniversariantes do Mês</p>
                  {atividades.aniversariantes.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-50 transition-colors">
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                          <Cake className="h-3 w-3" />
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-700">{item.nome}</p>
                        <p className="text-[10px] text-slate-400">Dia {item.dia}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* CNH com vencimento */}
              {atividades?.cnh_vencimento && atividades.cnh_vencimento.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">CNH com Vencimento Próximo</p>
                  {atividades.cnh_vencimento.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-yellow-50 transition-colors bg-yellow-50/30">
                      <div className="flex-shrink-0">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${item.dias_para_vencer <= 30 ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'}`}>
                          <FileCheck className="h-3 w-3" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] font-bold text-slate-700">{item.nome}</p>
                        <p className="text-[10px] text-slate-400">Vence {item.vencimento}</p>
                      </div>
                      <p className={`text-[9px] font-bold uppercase ${item.dias_para_vencer <= 30 ? 'text-red-600' : 'text-yellow-600'}`}>
                        {item.dias_para_vencer}d
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Exame médico com vencimento */}
              {atividades?.exame_medico_vencimento && atividades.exame_medico_vencimento.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Exame Médico com Vencimento Próximo</p>
                  {atividades.exame_medico_vencimento.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-orange-50 transition-colors bg-orange-50/30">
                      <div className="flex-shrink-0">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${item.dias_para_vencer <= 30 ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
                          <AlertCircle className="h-3 w-3" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] font-bold text-slate-700">{item.nome}</p>
                        <p className="text-[10px] text-slate-400">Vence {item.vencimento}</p>
                      </div>
                      <p className={`text-[9px] font-bold uppercase ${item.dias_para_vencer <= 30 ? 'text-red-600' : 'text-orange-600'}`}>
                        {item.dias_para_vencer}d
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Exame toxicológico com vencimento */}
              {atividades?.exame_toxicologico_vencimento && atividades.exame_toxicologico_vencimento.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Exame Toxicológico com Vencimento Próximo</p>
                  {atividades.exame_toxicologico_vencimento.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-pink-50 transition-colors bg-pink-50/30">
                      <div className="flex-shrink-0">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${item.dias_para_vencer <= 30 ? 'bg-red-50 text-red-600' : 'bg-pink-50 text-pink-600'}`}>
                          <AlertTriangle className="h-3 w-3" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] font-bold text-slate-700">{item.nome}</p>
                        <p className="text-[10px] text-slate-400">Vence {item.vencimento}</p>
                      </div>
                      <p className={`text-[9px] font-bold uppercase ${item.dias_para_vencer <= 30 ? 'text-red-600' : 'text-pink-600'}`}>
                        {item.dias_para_vencer}d
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {!atividades?.licencas_vencimento?.length && !atividades?.aniversariantes?.length && !atividades?.cnh_vencimento?.length && !atividades?.exame_medico_vencimento?.length && !atividades?.exame_toxicologico_vencimento?.length && (
                <p className="text-center text-slate-400 text-xs py-8">Nenhuma atividade recente</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
