import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  Wrench,
  Users,
  Building2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useAuth } from '../context/AuthContext';

interface ChildItem {
  to: string;
  label: string;
  modulo?: string;
}

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  modulo?: string;
  children?: ChildItem[];
}

function NavItem({ to, icon: Icon, label, modulo, children }: NavItemProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const { temPermissao } = useAuth();

  if (modulo && !temPermissao(modulo, 'ler')) return null;

  if (children) {
    const visibleChildren = children.filter(c => !c.modulo || temPermissao(c.modulo, 'ler'));
    if (visibleChildren.length === 0) return null;

    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
            "text-slate-400 hover:bg-white/5 hover:text-white"
          )}
        >
          <div className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{label}</span>
          </div>
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        {isOpen && (
          <div className="ml-6 mt-0.5 border-l border-white/5 pl-2 space-y-0.5">
            {visibleChildren.map((child) => (
              <NavLink
                key={child.to}
                to={child.to}
                className={({ isActive }) =>
                  cn(
                    "block rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors",
                    isActive
                      ? "bg-[#B21212] text-white"
                      : "text-slate-500 hover:bg-white/5 hover:text-white"
                  )
                }
              >
                {child.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
          isActive
            ? "bg-[#B21212] text-white shadow-lg shadow-[#B21212]/20"
            : "text-slate-400 hover:bg-white/5 hover:text-white"
        )
      }
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span>{label}</span>
    </NavLink>
  );
}

export function Sidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-56 flex flex-col bg-[#111827] text-white border-r border-white/5">
      {/* Logo */}
      <div className="flex flex-col items-center justify-center pt-2 pb-1 border-b border-white/5">
        <img src="/image/logo_empresa.png" alt="Lopa Guindastes" className="h-[90px] w-auto object-contain" />
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2.5 py-2 overflow-y-auto">
        <NavItem to="/" icon={LayoutDashboard} label="Dashboard" modulo="dashboard" />
        <NavItem to="/budgets" icon={Building2} label="Orçamentos" modulo="orcamentos" />
        <NavItem to="/service-orders" icon={ClipboardList} label="Ordem de Serviço" modulo="ordens_servico" />
        <NavItem to="/finance/os-closing" icon={DollarSign} label="Faturamento" modulo="faturamento" />
        <NavItem to="/finance/receivables" icon={TrendingUp} label="Contas a Receber" modulo="contas_receber" />
        <NavItem to="/finance/purchases" icon={ShoppingCart} label="Compras" modulo="compras" />
        <NavItem to="/finance/payables" icon={TrendingDown} label="Contas a Pagar" modulo="contas_pagar" />

        <NavItem
          to="/operations"
          icon={Wrench}
          label="Operação"
          children={[
            { to: '/operations/customers',        label: 'Clientes',       modulo: 'clientes' },
            { to: '/operations/suppliers',         label: 'Fornecedores',   modulo: 'fornecedores' },
            { to: '/operations/invoices',          label: 'Nota Fiscal',    modulo: 'nota_fiscal' },
            { to: '/operations/conhecimentos',     label: 'Conhecimento',   modulo: 'conhecimento' },
            { to: '/operations/licenses',          label: 'Licenças',       modulo: 'licencas' },
            { to: '/operations/insurance',         label: 'Seguros',        modulo: 'seguros' },
          ]}
        />

        <NavItem
          to="/reports"
          icon={FileText}
          label="Relatórios"
          children={[
            { to: '/reports/clientes',           label: 'Listagem de Clientes',        modulo: 'rel_clientes' },
            { to: '/reports/ordens',             label: 'Ordens de Serviço',           modulo: 'rel_ordens' },
            { to: '/reports/payables',           label: 'Contas a Pagar',             modulo: 'rel_contas_pagar' },
            { to: '/reports/receivables',        label: 'Contas a Receber',           modulo: 'rel_contas_receber' },
            { to: '/reports/compras-produtos',   label: 'Contas a Pagar e Produtos',  modulo: 'rel_compras_produtos' },
            { to: '/reports/cash-flow',          label: 'Fluxo de Caixa',             modulo: 'rel_fluxo_caixa' },
            { to: '/reports/comissao',           label: 'Comissão',                   modulo: 'rel_comissao' },
            { to: '/reports/dre',                label: 'DRE',                        modulo: 'rel_dre' },
            { to: '/reports/analise-financeira', label: 'Análise Financeira',         modulo: 'rel_analise_financeira' },
          ]}
        />
      </nav>

      {/* Bottom */}
      <div className="px-2.5 pb-2 pt-1.5 border-t border-white/5 space-y-0.5">
        <NavItem
          to="/settings"
          icon={Settings}
          label="Configurações"
          children={[
            { to: '/operations/equipment',          label: 'Equipamentos',                 modulo: 'equipamentos' },
            { to: '/operations/employees',          label: 'Funcionários',                 modulo: 'funcionarios' },
            { to: '/operations/products-services',  label: 'Produtos e Serviços',          modulo: 'produtos_servicos' },
            { to: '/settings/offered-services',     label: 'Serviços Oferecidos',          modulo: 'servicos_oferecidos' },
            { to: '/settings/equipment-types',      label: 'Tipos de Equipamentos',        modulo: 'tipos_equipamentos' },
            { to: '/settings/contact-methods',      label: 'Formas de Contato',            modulo: 'formas_contato' },
            { to: '/settings/payment-methods',      label: 'Formas de Pagamento',          modulo: 'formas_pagamento' },
            { to: '/settings/supplier-branches',    label: 'Ramos dos Fornecedores',       modulo: 'ramos_fornecedor' },
            { to: '/settings/supplier-activities',  label: 'Atividades dos Fornecedores',  modulo: 'atividades_fornecedor' },
            { to: '/settings/employee-roles',       label: 'Cargos dos Funcionários',      modulo: 'cargos' },
            { to: '/settings/service-types',        label: 'Tipos de Serviços',            modulo: 'tipos_servicos' },
            { to: '/settings/budget-template',      label: 'Texto Padrão',                 modulo: 'texto_padrao' },
            { to: '/settings/clausulas-orcamento',  label: 'Cláusulas de Orçamento',       modulo: 'clausulas_orcamento' },
            { to: '/settings/cash-flow',            label: 'Fluxo de Caixa',               modulo: 'fluxo_financeiro' },
            { to: '/settings/localizacao',          label: 'Países/Estados/Cidades',       modulo: 'localizacao' },
          ]}
        />

        <NavItem
          to="/admin"
          icon={Users}
          label="Admin"
          children={[
            { to: '/admin/companies', label: 'Empresas',            modulo: 'empresas' },
            { to: '/admin/users',     label: 'Usuários',            modulo: 'admin_usuarios' },
            { to: '/admin/perfis',    label: 'Perfis e Permissões', modulo: 'admin_perfis' },
            { to: '/admin/modulos',   label: 'Módulos',             modulo: 'admin_modulos' },
          ]}
        />

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
