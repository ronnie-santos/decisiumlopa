import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { OrcamentoPage } from './pages/Orcamento';
import { OrdemServicoPage } from './pages/OrdemServico';
import { ClientePage } from './pages/Cliente';
import { EmpresaPage } from './pages/Empresa';
import { EquipamentoPage } from './pages/Equipamento';
import { FornecedorPage } from './pages/Fornecedor';
import { FuncionarioPage } from './pages/Funcionario';
import { ContasReceberPage } from './pages/ContasReceber';
import { ContasPagarPage } from './pages/ContasPagar';
import { ComprasPage } from './pages/Compras';
import { CargoPage } from './pages/Cargo';
import { TextoPadraoPage } from './pages/TextoPadrao';
import { FormaPagamentoPage } from './pages/FormaPagamento';
import { FormaContatoPage } from './pages/FormaContato';
import { AtividadeFornecedorPage } from './pages/AtividadeFornecedor';
import { FornecedorRamoPage } from './pages/FornecedorRamo';
import { TipoEquipamentoPage } from './pages/TipoEquipamento';
import { FluxoFinanceiroPage } from './pages/FluxoFinanceiro';
import { LicencaPage } from './pages/Licenca';
import { SeguroPage } from './pages/Seguro';
import { TipoServicoPage } from './pages/TipoServico';
import { ServicoOferecidoPage } from './pages/ServicoOferecido';
import { UsuariosPage } from './pages/Usuarios';
import { PerfisPage } from './pages/Perfis';
import { ModulosPage } from './pages/Modulos';
import { RelatorioListagemClientesPage } from './pages/RelatorioListagemClientes';
import { FechamentoOSPage } from './pages/FechamentoOS';
import { ProdutosServicosPage } from './pages/ProdutosServicos';
import { NotaFiscalPage } from './pages/NotaFiscal';
import { ConhecimentoPage } from './pages/Conhecimento';
import { LocalizacaoPage } from './pages/Localizacao';
import { ComissaoPage } from './pages/Comissao';
import { RelatorioOrdensPage } from './pages/RelatorioOrdens';
import { RelatorioContasPagarPage } from './pages/RelatorioContasPagar';
import { RelatorioContasReceberPage } from './pages/RelatorioContasReceber';
import { RelatorioComprasProdutosPage } from './pages/RelatorioComprasProdutos';
import { RelatorioFluxoCaixaPage } from './pages/RelatorioFluxoCaixa';
import { RelatorioDREPage } from './pages/RelatorioDRE';
import { RelatorioAnaliseFinanceiraPage } from './pages/RelatorioAnaliseFinanceira';
import { RelatorioNotasFiscaisPage } from './pages/RelatorioNotasFiscais';
import { RelatorioDespesasReceitaPage } from './pages/RelatorioDespesasReceita';
import { RelatorioConciliacaoBancariaPage } from './pages/RelatorioConciliacaoBancaria';
import { ClausulasOrcamentoPage } from './pages/ClausulasOrcamento';
import { SemAcessoPage } from './pages/SemAcesso';
import { PrivateRoute } from './components/PrivateRoute';

// Placeholder components for other pages
const Placeholder = ({ title }: { title: string }) => (
  <div className="flex flex-col h-full">
    <div className="sticky top-0 z-30 flex h-16 w-full items-center justify-between bg-white px-8 border-b border-slate-100">
      <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">{title}</h1>
    </div>
    <div className="p-8">
      <div className="bg-white rounded-xl border border-slate-100 p-12 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
          <span className="text-2xl font-bold">?</span>
        </div>
        <h2 className="text-lg font-bold text-slate-700 uppercase tracking-tight">Tela em Desenvolvimento</h2>
        <p className="text-sm text-slate-400 mt-2 max-w-md">Esta funcionalidade está sendo implementada para o sistema Lopa ERP.</p>
      </div>
    </div>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/" element={<Layout />}>
            <Route index element={<PrivateRoute modulo="dashboard"><DashboardPage /></PrivateRoute>} />
            <Route path="budgets" element={<PrivateRoute modulo="orcamentos"><OrcamentoPage /></PrivateRoute>} />
            <Route path="service-orders" element={<PrivateRoute modulo="ordens_servico"><OrdemServicoPage /></PrivateRoute>} />

            <Route path="operations/customers" element={<PrivateRoute modulo="clientes"><ClientePage /></PrivateRoute>} />
            <Route path="operations/employees" element={<PrivateRoute modulo="funcionarios"><FuncionarioPage /></PrivateRoute>} />
            <Route path="operations/suppliers" element={<PrivateRoute modulo="fornecedores"><FornecedorPage /></PrivateRoute>} />
            <Route path="operations/equipment" element={<PrivateRoute modulo="equipamentos"><EquipamentoPage /></PrivateRoute>} />
            <Route path="operations/licenses" element={<PrivateRoute modulo="licencas"><LicencaPage /></PrivateRoute>} />
            <Route path="operations/insurance" element={<PrivateRoute modulo="seguros"><SeguroPage /></PrivateRoute>} />
            <Route path="operations/products-services" element={<PrivateRoute modulo="produtos_servicos"><ProdutosServicosPage /></PrivateRoute>} />
            <Route path="operations/invoices" element={<PrivateRoute modulo="nota_fiscal"><NotaFiscalPage /></PrivateRoute>} />
            <Route path="operations/conhecimentos" element={<PrivateRoute modulo="conhecimento"><ConhecimentoPage /></PrivateRoute>} />
            <Route path="reports/comissao" element={<PrivateRoute modulo="rel_comissao"><ComissaoPage /></PrivateRoute>} />
            <Route path="reports/ordens" element={<PrivateRoute modulo="rel_ordens"><RelatorioOrdensPage /></PrivateRoute>} />

            <Route path="finance/receivables" element={<PrivateRoute modulo="contas_receber"><ContasReceberPage /></PrivateRoute>} />
            <Route path="finance/payables" element={<PrivateRoute modulo="contas_pagar"><ContasPagarPage /></PrivateRoute>} />
            <Route path="finance/purchases" element={<PrivateRoute modulo="compras"><ComprasPage /></PrivateRoute>} />
            <Route path="finance/os-closing" element={<PrivateRoute modulo="faturamento"><FechamentoOSPage /></PrivateRoute>} />
            <Route path="finance/insurance" element={<PrivateRoute modulo="seguros"><Placeholder title="Apólices de Seguro" /></PrivateRoute>} />

            <Route path="reports/payables" element={<PrivateRoute modulo="rel_contas_pagar"><RelatorioContasPagarPage /></PrivateRoute>} />
            <Route path="reports/receivables" element={<PrivateRoute modulo="rel_contas_receber"><RelatorioContasReceberPage /></PrivateRoute>} />
            <Route path="reports/compras-produtos" element={<PrivateRoute modulo="rel_compras_produtos"><RelatorioComprasProdutosPage /></PrivateRoute>} />
            <Route path="reports/cash-flow" element={<PrivateRoute modulo="rel_fluxo_caixa"><RelatorioFluxoCaixaPage /></PrivateRoute>} />
            <Route path="reports/dre" element={<PrivateRoute modulo="rel_dre"><RelatorioDREPage /></PrivateRoute>} />
            <Route path="reports/analise-financeira" element={<PrivateRoute modulo="rel_analise_financeira"><RelatorioAnaliseFinanceiraPage /></PrivateRoute>} />
            <Route path="reports/notas-fiscais" element={<PrivateRoute modulo="nota_fiscal"><RelatorioNotasFiscaisPage /></PrivateRoute>} />
            <Route path="reports/despesas-receita" element={<PrivateRoute modulo="rel_fluxo_caixa"><RelatorioDespesasReceitaPage /></PrivateRoute>} />
            <Route path="reports/clientes" element={<PrivateRoute modulo="rel_clientes"><RelatorioListagemClientesPage /></PrivateRoute>} />
            <Route path="reports/conciliacao-bancaria" element={<PrivateRoute modulo="rel_contas_pagar"><RelatorioConciliacaoBancariaPage /></PrivateRoute>} />

            <Route path="settings" element={<Placeholder title="Configurações Gerais" />} />
            <Route path="settings/offered-services" element={<PrivateRoute modulo="servicos_oferecidos"><ServicoOferecidoPage /></PrivateRoute>} />
            <Route path="settings/equipment-types" element={<PrivateRoute modulo="tipos_equipamentos"><TipoEquipamentoPage /></PrivateRoute>} />
            <Route path="settings/contact-methods" element={<PrivateRoute modulo="formas_contato"><FormaContatoPage /></PrivateRoute>} />
            <Route path="settings/payment-methods" element={<PrivateRoute modulo="formas_pagamento"><FormaPagamentoPage /></PrivateRoute>} />
            <Route path="settings/supplier-branches" element={<PrivateRoute modulo="ramos_fornecedor"><FornecedorRamoPage /></PrivateRoute>} />
            <Route path="settings/supplier-activities" element={<PrivateRoute modulo="atividades_fornecedor"><AtividadeFornecedorPage /></PrivateRoute>} />
            <Route path="settings/employee-roles" element={<PrivateRoute modulo="cargos"><CargoPage /></PrivateRoute>} />
            <Route path="settings/service-types" element={<PrivateRoute modulo="tipos_servicos"><TipoServicoPage /></PrivateRoute>} />
            <Route path="settings/budget-template" element={<PrivateRoute modulo="texto_padrao"><TextoPadraoPage /></PrivateRoute>} />
            <Route path="settings/clausulas-orcamento" element={<PrivateRoute modulo="clausulas_orcamento"><ClausulasOrcamentoPage /></PrivateRoute>} />
            <Route path="settings/cash-flow" element={<PrivateRoute modulo="fluxo_financeiro"><FluxoFinanceiroPage /></PrivateRoute>} />
            <Route path="settings/localizacao" element={<PrivateRoute modulo="localizacao"><LocalizacaoPage /></PrivateRoute>} />

            <Route path="admin/companies" element={<PrivateRoute modulo="empresas"><EmpresaPage /></PrivateRoute>} />
            <Route path="admin/users" element={<PrivateRoute modulo="admin_usuarios"><UsuariosPage /></PrivateRoute>} />
            <Route path="admin/perfis" element={<PrivateRoute modulo="admin_perfis"><PerfisPage /></PrivateRoute>} />
            <Route path="admin/modulos" element={<PrivateRoute modulo="admin_modulos"><ModulosPage /></PrivateRoute>} />
          </Route>

          <Route path="/sem-acesso" element={<SemAcessoPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
