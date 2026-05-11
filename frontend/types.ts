export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

export interface Budget {
  id: string;
  quoteId: string;
  client: string;
  clientSubtitle?: string;
  date: string;
  value: number;
  status: 'APROVADO' | 'PENDENTE' | 'REJEITADO';
  cnpj?: string;
  address?: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  phone?: string;
  email?: string;
  contact?: string;
  serviceLocation?: string;
  deliveryLocation?: string;
  description?: string;
  responsible?: string;
  company?: string;
  paymentMethod?: 'A vista' | 'Parcelado' | '90 dias' | '120 dias';
  services?: BudgetService[];
}

export interface BudgetService {
  id: string;
  equipmentId?: string;
  item: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ServiceOrder {
  id: string;
  orderId: string;
  company: string;
  date: string;
  client: string;
  status: 'EM ANDAMENTO' | 'CONCLUÍDO' | 'CANCELADO';
  serviceLocation: string;
  serviceCity: string;
  deliveryLocation: string;
  deliveryCity: string;
  freightInfo: {
    kmInitial: number;
    kmFinal: number;
    kmTotal: number;
    kmRate: number;
    kmTotalValue: number;
    toll: number;
    departure: number;
    escort: number;
    insurance: number;
    discount: number;
    freightTotalValue: number;
  };
  serviceData: {
    startTime1: string;
    endTime1: string;
    startTime2: string;
    endTime2: string;
    totalHours: number;
    hourlyRate: number;
    serviceTotalValue: number;
  };
  description: string;
  grandTotal: number;
  equipmentId: string;
  cashFlowStatus: string;
  employees: string[]; // up to 3
  closingNumber: string;
  originBudgetNumber: string;
}

export interface SupplierAddress {
  idforned: string;
  idfornecedor: string;
  idcidade: string;
  logradouro: string;
  numero: string;
  tipo_logradouro: string;
  idestado: string;
  idbairro: string;
  complemento: string;
  cep: string;
  tipo_endereco: string;
}

export interface SupplierContact {
  idfornecedorforma: string;
  idfornecedor: string;
  idformacontato?: number;
  valor: string;
  observacao: string;
  idfuncionario?: number;
  whatsapp: string;
  aniversario?: string;
}

export interface Supplier {
  idfornecedor: string;
  id?: string;
  nome: string;
  nomefantasia: string;
  data_cadastro?: string;
  cnpj_cpf: string;
  ie_rg: string;
  tipo: string;
  observacao: string;
  site: string;
  contato: string;
  categoria: string;
  
  // Endereço (Flattened)
  cep: string;
  idcidade?: number;
  idbairro?: number;
  logradouro: string;
  tipo_logradouro: string;
  idestado: string;
  numero: string;
  complemento: string;
  
  // Status
  status?: 'ATIVO' | 'INATIVO';
}

export interface EquipmentComponent {
  id: string;
  nome: string;
  placa: string;
}

export interface Equipment {
  id: string; // idequipamento
  nome: string;
  placa: string;
  valor: number;
  marca: string;
  modelo: string;
  ano_fabricacao: number;
  ano_modelo: number;
  valor_pago: number;
  antigo_dono: string;
  renavan: string;
  chassi: string;
  km_atual: number;
  idtipoequipamento: number;
  idfluxo: string;
  idempresa: number;
  data_aquisicao: string;
  km_inicial: number;
  gera_faturamento: boolean;
  observacao: string;
  tara: number;
  kilo: number;
  m3: number;
  rodado: number;
  carroceria: number;
  uflicencimento: string;
  tacografo: string;
  comprador: string;
  status: 'DISPONÍVEL' | 'EM MANUTENÇÃO' | 'LOCADO' | 'INATIVO';
  componentes?: EquipmentComponent[];
}

export interface ClientAddress {
  idcliend: string;
  idcliente: string;
  idcidade: string;
  logradouro: string;
  numero: string;
  tipo_logradouro: string;
  idestado: string;
  idbairro: string;
  complemento: string;
  cep: string;
  tipo_endereco: string;
}

export interface ClientContact {
  idclienteforma: string;
  idcliente: string;
  idformacontato: number;
  valor: string;
  observacao: string;
  idfuncionario?: number;
  idfornecedor?: number;
  zap: string;
  aniversario: string;
}

export interface Client {
  idcliente: string;
  nome: string;
  nomefantasia: string;
  data_cadastro: string;
  cnpj_cpf: string;
  ie_rg: string;
  tipo: string;
  observacao: string;
  site: string;
  contato: string;
  status: string;
  enderecos?: ClientAddress[];
  contatos?: ClientContact[];
}

export interface Company {
  id: string; // idempresa
  nome: string;
  cnpj: string;
  ie: string;
  cep: string;
  idcidade?: number;
  cidade?: string;
  idbairro?: number;
  bairro?: string;
  logradouro: string;
  tipo_logradouro: string;
  idestado: string;
  numero: number;
  ultima_nf: number;
  serie: string;
  pis: number;
  cofins: number;
  inss: number;
  ir: number;
  csll: number;
  inscricao_municipal: string;
  sequencia: number;
  atividade: string;
  aliquota_aplicada: number;
  deducao: number;
  imposto: number;
  retencao: number;
  nomefantasia: string;
  status: 'ATIVO' | 'INATIVO';
  has_logo?: boolean;
}

export interface OSClosing {
  idfechamento: string;
  data: string;
  valor: number;
  total_itens: number;
  parcelas: number;
  gerar_nf: boolean;
  idempresa: string;
  valor_pago: number;
  data_geracao_nf?: string;
  idcliente: string;
  desconto: number;
  juros: number;
  situacao: boolean;
  idconhecimento?: string;
  receivables?: ReceivableDetailed[];
}

export interface ReceivableDetailed {
  idcontasreceber: string;
  vencimento: string;
  valor: number;
  valor_pago: number;
  situacao: boolean;
  idfechamento: string;
  codigo_banco?: string;
  linha_digitavel?: string;
  codigo_de_barra?: string;
  ban_codigo?: number;
  parcela: string;
  ultimo_pagamento?: string;
}

export interface Receivable {
  id: string;
  invoiceId: string;
  client: string;
  dueDate: string;
  value: number;
  status: 'PAGO' | 'PENDENTE' | 'ATRASADO';
}

export interface Purchase {
  idcompras: string;
  idfornecedor: string;
  valor: number;
  parcelas: number;
  emissao: string;
  frete: number;
  serie: string;
  ir: number;
  observacao: string;
  idfluxo: string;
  inss: number;
  vencimento: string;
  idempresa: string;
  situacao: boolean;
  data_quitacao?: string;
  base_calculo: number;
  icms: number;
  base_icms: number;
  seguro: number;
  desconto: number;
  ipi: number;
  valor_produto: number;
  forma_pagamento: string;
  codigo_importado?: number;
  nota: string;
  itens: PurchaseItem[];
  contas_pagar: PayableDetailed[];
}

export interface PurchaseItem {
  idcompras: string;
  idproduto: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  idequipamento: string;
  km: number;
}

export interface PayableDetailed {
  idcontaspagar: string;
  vencimento: string;
  valor: number;
  valor_pago: number;
  situacao: boolean;
  parcela: string;
  idcompras: string;
  ultimo_pagamento?: string;
  desconto: number;
  observacao: string;
  valor_original: number;
}

export interface Payable {
  id: string;
  invoiceId: string;
  supplier: string;
  dueDate: string;
  value: number;
  status: 'PAGO' | 'PENDENTE' | 'ATRASADO';
}

export interface Employee {
  idfuncionario: string;
  nome: string;
  apelido?: string;
  observacao?: string;
  cpf: string;
  rg?: string;
  ctpf?: string;
  serie?: string;
  pis?: string;
  idcargo?: number;
  cargo?: string; // Adding cargo name for display
  admissao: string;
  demissao?: string;
  nascimento?: string;
  cbo?: string;
  cep?: string;
  idcidade?: number;
  idbairro?: number;
  logradouro?: string;
  tipo_logradouro?: string;
  idestado?: string;
  numero?: number;
  cnh?: string;
  validade_cnh?: string;
  categoria?: string;
  complemento?: string;
  pe?: number;
  validade_exame?: string;
  data_toxicologico?: string;
  status: 'ATIVO' | 'INATIVO';
}

export interface Cargo {
  id: string; // idcargo em string
  idcargo: number;
  nome: string;
}

export interface Estado {
  idestado: string; // Sigla (UF)
  nome: string;
}

export interface Cidade {
  idcidade: number;
  nome: string;
  idestado: string;
}

export interface Bairro {
  idbairro: number;
  nome: string;
  idcidade: number;
}


export interface TextoPadrao { id: string; idtexto: number; texto: string; }
export interface FormaPagamento { id: string; idformapgto: number; nome: string; cor_fundo?: number; cor_fonte?: number; }
export interface FormaContato { id: string; idformacontato: number; nome: string; }
export interface Contrato { id: string; idcontrato: number; descricao: string | null; clausulas: string | null; ativo: boolean; }
export interface FornecedorAtividade { id: string; idatividade: number; descricao: string; }
export interface FornecedorRamo { id: string; idramo: number; descricao: string; }
export interface TipoEquipamento { id: string; idtipoequipamento: number; nome: string; }
export interface FluxoFinanceiro { id: string; idfluxo: string; descricao: string; fluxo_pai?: string | null; tipo?: string | null; movimento?: string | null; codigo_importacao?: number | null; nivel?: number | null; }
export interface Licenca { id: string; idlicenca: number; data?: string; vencimento?: string; largura?: string; comprimento?: string; altura?: string; horario?: string; carretas?: string; pesos?: string; tara?: string; peso_carga?: string; pbt?: string; autorizacao?: string; orgao?: string; idequipamento?: number; estado?: string; despachante?: string; }
export interface Seguro { 
  id: string; 
  idseguro: number; 
  titular?: string; 
  seguradora?: string; 
  corretora?: string;
  apolice?: string; 
  tipo?: string; 
  veiculo?: string; 
  placa?: string; 
  inicio?: string;
  termino?: string;
  valor_segurado?: number;
  valor_seguro?: number;
  parcelas?: number;
  valor_parcela?: number;
  primeiro_vencimento?: string;
  ultimo_vencimento?: string;
  tipo_pagamento?: string;
  ativo?: boolean;
}

export interface ForRamo {
  idforramo: number;
  idfornecedor: number;
  idramo: number;
  ramo?: FornecedorRamo;
}

export interface ForAtividade {
  idforatividade: number;
  idfornecedor: number;
  idatividade: number;
  atividade?: FornecedorAtividade;
}

// ── RBAC ──────────────────────────────────────────────────────────────────
export interface Perfil {
  id: number;
  idperfil: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  criado_em?: string | null;
}

export interface Modulo {
  id: number;
  idmodulo: number;
  nome: string;
  codigo: string;
  descricao: string | null;
  ativo: boolean;
}

export interface Permissao {
  id: number;
  idpermissao: number;
  idperfil: number;
  idmodulo: number;
  pode_ler: boolean;
  pode_criar: boolean;
  pode_editar: boolean;
  pode_excluir: boolean;
  pode_exportar: boolean;
  modulo?: Modulo;
}

export interface Usuario {
  id: number;
  idusuario: number;
  nome: string;
  username: string;
  idperfil: number | null;
  ativo: boolean;
  ultimo_acesso?: string | null;
  perfil_nome?: string | null;
}

