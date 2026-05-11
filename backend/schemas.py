from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict
from datetime import date, datetime
# =============================================
# EMPRESA
# =============================================
class EmpresaBase(BaseModel):
    nome: str
    nomefantasia: Optional[str] = None
    cnpj: Optional[str] = None
    ie: Optional[str] = None
    cep: Optional[str] = None
    idcidade: Optional[int] = None
    idbairro: Optional[int] = None
    logradouro: Optional[str] = None
    tipo_logradouro: Optional[str] = None
    idestado: Optional[str] = None
    numero: Optional[int] = None
    ultima_nf: Optional[int] = None
    serie: Optional[str] = None
    pis: Optional[float] = None
    cofins: Optional[float] = None
    inss: Optional[float] = None
    ir: Optional[float] = None
    csll: Optional[float] = None
    inscricao_municipal: Optional[str] = None
    sequencia: Optional[int] = None
    atividade: Optional[str] = None
    aliquota_aplicada: Optional[float] = None
    deducao: Optional[float] = None
    imposto: Optional[float] = None
    retencao: Optional[float] = None
    status: Optional[str] = "ATIVO"
    model_config = ConfigDict(from_attributes=True)

class EmpresaCreate(EmpresaBase):
    pass

class Empresa(EmpresaBase):
    idempresa: int
    id: int
    has_logo: bool = False

# =============================================
# ORDEM
# =============================================
class OrdemBase(BaseModel):
    sequencial: Optional[int] = None
    numero_os: Optional[int] = None
    idcliente: Optional[int] = None
    idempresa: Optional[int] = None
    data: Optional[date] = None
    inicio_01: Optional[str] = None
    termino_01: Optional[str] = None
    inicio_02: Optional[str] = None
    termino_02: Optional[str] = None
    valor_hora: Optional[float] = None
    valor_servicos: Optional[float] = None
    valor_os: Optional[float] = None
    local_servico: Optional[str] = None
    local_entrega: Optional[str] = None
    km_inicio: Optional[int] = None
    km_final: Optional[int] = None
    km_total: Optional[int] = None
    valor_km: Optional[float] = None
    pedagio: Optional[float] = None
    desconto: Optional[float] = None
    saida: Optional[float] = None
    escolta: Optional[float] = None
    valor_frete: Optional[float] = None
    servico_prestado: Optional[str] = None
    idequipamento: Optional[int] = None
    idfuncionario: Optional[int] = None
    funcionario_2: Optional[int] = None
    funcionario_3: Optional[int] = None
    situacao: Optional[bool] = None
    valor_pago: Optional[float] = None
    idfluxo: Optional[str] = None
    idorcamento: Optional[int] = None
    empresa_nota: Optional[int] = None
    total_horas: Optional[float] = None
    cidade_servico: Optional[str] = None
    idfechamento: Optional[int] = None
    porcentagem: Optional[float] = None
    cidade_entrega: Optional[str] = None
    valor_total_km: Optional[float] = None
    idconhecimento: Optional[int] = None
    seguro: Optional[float] = None
    idservico: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

class OrdemCreate(OrdemBase):
    pass

class OrdemEmpresa(BaseModel):
    idempresa: int
    nome: Optional[str] = None
    nomefantasia: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class OrdemEquipamento(BaseModel):
    idequipamento: int
    nome: Optional[str] = None
    placa: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class OrdemFuncionario(BaseModel):
    idfuncionario: int
    nome: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class OrdemServico(BaseModel):
    idservico: int
    descricao: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class OrdemFluxo(BaseModel):
    idfluxo: str
    descricao: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class OrdemCliente(BaseModel):
    idcliente: int
    nome: Optional[str] = None
    nomefantasia: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class Ordem(OrdemBase):
    idordem: int
    id: int
    empresa_rel:     Optional[OrdemEmpresa]     = None
    equipamento_rel: Optional[OrdemEquipamento] = None
    funcionario_rel: Optional[OrdemFuncionario] = None
    fluxo_rel:       Optional[OrdemFluxo]       = None
    cliente_rel:     Optional[OrdemCliente]     = None

# =============================================
# PAIS / ESTADO / CIDADE / BAIRRO
# =============================================
class PaisBase(BaseModel):
    idpais: str
    nacionalidade: Optional[str] = None
    nome: Optional[str] = None
    sigla: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class PaisCreate(PaisBase):
    pass

class Pais(PaisBase):
    pass

class EstadoBase(BaseModel):
    idestado: str
    nome: Optional[str] = None
    idpais: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class EstadoCreate(EstadoBase):
    pass

class Estado(EstadoBase):
    pass

class CidadeBase(BaseModel):
    ddd: Optional[int] = None
    idestado: Optional[str] = None
    idpais: Optional[str] = None
    nome: Optional[str] = None
    codigo_ibge: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class CidadeCreate(CidadeBase):
    pass

class Cidade(CidadeBase):
    idcidade: int

class BairroBase(BaseModel):
    idcidade: Optional[int] = None
    nome: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class BairroCreate(BairroBase):
    pass

class Bairro(BairroBase):
    idbairro: int

# =============================================
# LOGRADOURO
# =============================================
class LogradouroBase(BaseModel):
    cep:       Optional[int] = None
    idbairro:  Optional[int] = None
    logradouro: Optional[str] = None
    tipo:      Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class LogradouroCreate(LogradouroBase):
    pass

class Logradouro(LogradouroBase):
    idlogradouro: int
    bairro_rel:   Optional[Bairro] = None

# =============================================
# CLIENTE
# =============================================
class ClienteEnderecoBase(BaseModel):
    idcliend: Optional[int] = None
    idcliente: Optional[int] = None
    idcidade: Optional[int] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    tipo_logradouro: Optional[str] = None
    idestado: Optional[str] = None
    idbairro: Optional[int] = None
    complemento: Optional[str] = None
    cep: Optional[str] = None
    tipo_endereco: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class ClienteContatoBase(BaseModel):
    idclienteforma: Optional[int] = None
    idcliente: Optional[int] = None
    idformacontato: Optional[int] = None
    valor: Optional[str] = None
    observacao: Optional[str] = None
    idfuncionario: Optional[int] = None
    idfornecedor: Optional[int] = None
    zap: Optional[str] = None
    aniversario: Optional[date] = None
    model_config = ConfigDict(from_attributes=True)

class ClienteBase(BaseModel):
    nome: Optional[str] = None
    nomefantasia: Optional[str] = None
    data_cadastro: Optional[date] = None
    cnpj_cpf: Optional[str] = None
    ie_rg: Optional[str] = None
    tipo: Optional[str] = None
    observacao: Optional[str] = None
    site: Optional[str] = None
    contato: Optional[str] = None
    status: Optional[str] = "ATIVO"
    model_config = ConfigDict(from_attributes=True)

class ClienteCreate(ClienteBase):
    enderecos: Optional[List[ClienteEnderecoBase]] = []
    contatos: Optional[List[ClienteContatoBase]] = []

class Cliente(ClienteBase):
    idcliente: int
    id: int
    enderecos: Optional[List[ClienteEnderecoBase]] = []
    contatos: Optional[List[ClienteContatoBase]] = []

# =============================================
# FORNECEDOR
# =============================================
class FornecedorBase(BaseModel):
    nome: Optional[str] = None
    nomefantasia: Optional[str] = None
    data_cadastro: Optional[date] = None
    cnpj_cpf: Optional[str] = None
    ie_rg: Optional[str] = None
    tipo: Optional[str] = None
    site: Optional[str] = None
    cep: Optional[str] = None
    idcidade: Optional[int] = None
    idbairro: Optional[int] = None
    logradouro: Optional[str] = None
    tipo_logradouro: Optional[str] = None
    idestado: Optional[str] = None
    contato: Optional[str] = None
    observacao: Optional[str] = None
    complemento: Optional[str] = None
    numero: Optional[str] = None
    status: Optional[str] = "ATIVO"
    model_config = ConfigDict(from_attributes=True)

class FornecedorCreate(FornecedorBase):
    pass

class Fornecedor(FornecedorBase):
    idfornecedor: int
    id: int

# =============================================
# FUNCIONÁRIO
# =============================================
class CargoBase(BaseModel):
    nome: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class CargoCreate(CargoBase):
    pass

class Cargo(CargoBase):
    idcargo: int
    id: int

class FuncionarioBase(BaseModel):
    nome: Optional[str] = None
    apelido: Optional[str] = None
    observacao: Optional[str] = None
    cpf: Optional[str] = None
    rg: Optional[str] = None
    ctpf: Optional[str] = None
    serie: Optional[str] = None
    pis: Optional[str] = None
    idcargo: Optional[int] = None
    admissao: Optional[date] = None
    demissao: Optional[date] = None
    nascimento: Optional[date] = None
    cbo: Optional[str] = None
    cep: Optional[str] = None
    idcidade: Optional[int] = None
    idbairro: Optional[int] = None
    logradouro: Optional[str] = None
    tipo_logradouro: Optional[str] = None
    idestado: Optional[str] = None
    numero: Optional[int] = None
    cnh: Optional[str] = None
    validade_cnh: Optional[date] = None
    categoria: Optional[str] = None
    complemento: Optional[str] = None
    pe: Optional[int] = None
    validade_exame: Optional[date] = None
    data_toxicologico: Optional[date] = None
    status: Optional[str] = "ATIVO"
    model_config = ConfigDict(from_attributes=True)

class FuncionarioCreate(FuncionarioBase):
    pass

class Funcionario(FuncionarioBase):
    idfuncionario: int
    id: int
    cargo: Optional[str] = None

class DescontoBase(BaseModel):
    idfuncionario: Optional[int] = None
    valor: Optional[float] = None
    descricao: Optional[str] = None
    data: Optional[date] = None
    model_config = ConfigDict(from_attributes=True)

class DescontoCreate(DescontoBase):
    pass

class Desconto(DescontoBase):
    iddesconto: int
    id: int

# =============================================
# EQUIPAMENTO
# =============================================
class TipoEquipamentoBase(BaseModel):
    nome: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class TipoEquipamentoCreate(TipoEquipamentoBase):
    pass

class TipoEquipamento(TipoEquipamentoBase):
    idtipoequipamento: int
    id: int

class EquipamentoConjuntoBase(BaseModel):
    idconjunto: Optional[int] = None
    idequipamento: Optional[int] = None
    item: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

class EquipamentoBase(BaseModel):
    nome: Optional[str] = None
    placa: Optional[str] = None
    valor: Optional[float] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    ano_fabricacao: Optional[int] = None
    ano_modelo: Optional[int] = None
    valor_pago: Optional[float] = None
    antigo_dono: Optional[str] = None
    renavan: Optional[str] = None
    chassi: Optional[str] = None
    km_atual: Optional[int] = None
    idtipoequipamento: Optional[int] = None
    idfluxo: Optional[str] = None
    idempresa: Optional[int] = None
    data_aquisicao: Optional[date] = None
    km_inicial: Optional[int] = None
    gera_faturamento: Optional[bool] = None
    observacao: Optional[str] = None
    tara: Optional[int] = None
    kilo: Optional[int] = None
    m3: Optional[int] = None
    rodado: Optional[int] = None
    carroceria: Optional[int] = None
    uflicencimento: Optional[str] = None
    tacografo: Optional[date] = None
    comprador: Optional[str] = None
    status: Optional[str] = "DISPONÍVEL"
    model_config = ConfigDict(from_attributes=True)

class EquipamentoCreate(EquipamentoBase):
    pass

class Equipamento(EquipamentoBase):
    idequipamento: int
    id: int
    componentes: Optional[List[EquipamentoConjuntoBase]] = []

# =============================================
# FLUXO FINANCEIRO
# =============================================
class FluxoFinanceiroBase(BaseModel):
    descricao: Optional[str] = None
    fluxo_pai: Optional[str] = None
    tipo: Optional[str] = None
    movimento: Optional[str] = None
    codigo_importacao: Optional[int] = None
    nivel: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

class FluxoFinanceiroCreate(FluxoFinanceiroBase):
    idfluxo: str  # obrigatorio: chave alfanumerica definida pelo usuario

class FluxoFinanceiro(FluxoFinanceiroBase):
    idfluxo: str
    id: Optional[str] = None


class TextoPadraoBase(BaseModel):
    texto: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
class TextoPadraoCreate(TextoPadraoBase): pass
class TextoPadrao(TextoPadraoBase):
    idtexto: int
    id: int

class ContratoBase(BaseModel):
    descricao: Optional[str] = None
    clausulas: Optional[str] = None
    ativo:     Optional[bool] = True
    model_config = ConfigDict(from_attributes=True)
class ContratoCreate(ContratoBase): pass
class Contrato(ContratoBase):
    idcontrato: int
    id: int

class FormaPagamentoBase(BaseModel):
    nome: Optional[str] = None
    cor_fundo: Optional[int] = None
    cor_fonte: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)
class FormaPagamentoCreate(FormaPagamentoBase): pass
class FormaPagamento(FormaPagamentoBase):
    idformapgto: int
    id: int

class FormaContatoBase(BaseModel):
    nome: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
class FormaContatoCreate(FormaContatoBase): pass
class FormaContato(FormaContatoBase):
    idformacontato: int
    id: int

class FornecedorAtividadeBase(BaseModel):
    descricao: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
class FornecedorAtividadeCreate(FornecedorAtividadeBase): pass
class FornecedorAtividade(FornecedorAtividadeBase):
    idatividade: int
    id: int

class FornecedorRamoBase(BaseModel):
    descricao: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
class FornecedorRamoCreate(FornecedorRamoBase): pass
class FornecedorRamo(FornecedorRamoBase):
    idramo: int
    id: int

class ForRamoBase(BaseModel):
    idfornecedor: int
    idramo: int
    model_config = ConfigDict(from_attributes=True)
class ForRamoCreate(ForRamoBase): pass
class ForRamo(ForRamoBase):
    idforramo: int
    ramo: Optional[FornecedorRamo] = None

class ForAtividadeBase(BaseModel):
    idfornecedor: int
    idatividade: int
    model_config = ConfigDict(from_attributes=True)
class ForAtividadeCreate(ForAtividadeBase): pass
class ForAtividade(ForAtividadeBase):
    idforatividade: int
    atividade: Optional[FornecedorAtividade] = None

class LicencaBase(BaseModel):
    data: Optional[date] = None
    vencimento: Optional[date] = None
    largura: Optional[str] = None
    comprimento: Optional[str] = None
    altura: Optional[str] = None
    horario: Optional[str] = None
    carretas: Optional[str] = None
    pesos: Optional[str] = None
    tara: Optional[str] = None
    peso_carga: Optional[str] = None
    pbt: Optional[str] = None
    autorizacao: Optional[str] = None
    orgao: Optional[str] = None
    idequipamento: Optional[int] = None
    estado: Optional[str] = None
    despachante: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
class LicencaCreate(LicencaBase): pass
class Licenca(LicencaBase):
    idlicenca: int
    id: int

class SeguroBase(BaseModel):
    titular: Optional[str] = None
    seguradora: Optional[str] = None
    corretora: Optional[str] = None
    apolice: Optional[str] = None
    tipo: Optional[str] = None
    veiculo: Optional[str] = None
    placa: Optional[str] = None
    inicio: Optional[date] = None
    termino: Optional[date] = None
    valor_segurado: Optional[float] = None
    valor_seguro: Optional[float] = None
    parcelas: Optional[int] = None
    valor_parcela: Optional[float] = None
    primeiro_vencimento: Optional[date] = None
    ultimo_vencimento: Optional[date] = None
    tipo_pagamento: Optional[str] = None
    ativo: Optional[bool] = None
    model_config = ConfigDict(from_attributes=True)
class SeguroCreate(SeguroBase): pass
class Seguro(SeguroBase):
    idseguro: int
    id: int


# =============================================
# CONTAS A RECEBER
# =============================================
class ContasReceberBase(BaseModel):
    vencimento: Optional[date] = None
    valor: Optional[float] = None
    valor_pago: Optional[float] = None
    situacao: Optional[bool] = False
    idfechamento: Optional[int] = None
    codigo_banco: Optional[str] = None
    linha_digitavel: Optional[str] = None
    codigo_de_barra: Optional[str] = None
    ban_codigo: Optional[int] = None
    parcela: Optional[str] = None
    ultimo_pagamento: Optional[date] = None
    model_config = ConfigDict(from_attributes=True)

class ContasReceberCreate(ContasReceberBase):
    pass

class ContasReceber(ContasReceberBase):
    idcontasreceber: int
    id: int

# =============================================
# FECHAMENTO
# =============================================
class FechamentoBase(BaseModel):
    data: Optional[date] = None
    valor: Optional[float] = None
    total_itens: Optional[int] = None
    parcelas: Optional[int] = None
    gerar_nf: Optional[bool] = False
    idempresa: Optional[int] = None
    valor_pago: Optional[float] = None
    data_geracao_nf: Optional[date] = None
    idcliente: Optional[int] = None
    desconto: Optional[float] = None
    juros: Optional[float] = None
    situacao: Optional[bool] = False
    idconhecimento: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

class FechamentoCreate(FechamentoBase):
    contas: Optional[List[ContasReceberCreate]] = []

class FechamentoEmpresa(BaseModel):
    idempresa: int
    nome: Optional[str] = None
    nomefantasia: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class FechamentoCliente(BaseModel):
    idcliente: int
    nome: Optional[str] = None
    nomefantasia: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class Fechamento(FechamentoBase):
    idfechamento: int
    id: int
    empresa_rel: Optional[FechamentoEmpresa] = None
    cliente_rel: Optional[FechamentoCliente] = None
    contas: Optional[List[ContasReceber]] = []

class ParcelaFecharPayload(BaseModel):
    vencimento: date
    valor: float
    parcela: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class FecharOSPayload(BaseModel):
    ids_ordens: List[int]
    idcliente: int
    idempresa: int
    gerar_nf: bool
    parcelas: List[ParcelaFecharPayload]
    model_config = ConfigDict(from_attributes=True)

class RegistrarPagamentoPayload(BaseModel):
    valor_pago: float
    data_pagamento: date
    model_config = ConfigDict(from_attributes=True)

# =============================================
# PRODUTO / SERVIÇO (produtos_servicos)
# =============================================
class ProdutoServicoBase(BaseModel):
    descricao: Optional[str] = None
    ncmsh: Optional[str] = None
    cst: Optional[str] = None
    unidade: Optional[str] = None
    ipi: Optional[float] = None
    icms: Optional[float] = None
    marca_km: Optional[bool] = None
    model_config = ConfigDict(from_attributes=True)

class ProdutoServicoCreate(ProdutoServicoBase):
    pass

class ProdutoServico(ProdutoServicoBase):
    idproduto: int
    id: int

# =============================================
# CONTAS A PAGAR
# =============================================
class ContasPagarBase(BaseModel):
    vencimento: Optional[date] = None
    valor: Optional[float] = None
    valor_pago: Optional[float] = None
    situacao: Optional[bool] = False
    parcela: Optional[str] = None
    idcompras: Optional[int] = None
    ultimo_pagamento: Optional[date] = None
    desconto: Optional[float] = None
    observacao: Optional[str] = None
    valor_original: Optional[float] = None
    model_config = ConfigDict(from_attributes=True)

class ContasPagarCreate(ContasPagarBase):
    pass

class ContasPagar(ContasPagarBase):
    idcontaspagar: int
    id: int

class RegistrarPagamentoPagarPayload(BaseModel):
    valor_pago: float
    data_pagamento: date
    observacao: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class ContasPagarListItem(ContasPagar):
    fornecedor_nome: Optional[str] = None
    nota_numero: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# =============================================
# COMPRAS
# =============================================
class CompraItemBase(BaseModel):
    idproduto: int
    idequipamento: int
    quantidade: float
    valor_unitario: float
    valor_total: float
    km: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

class CompraItemCreate(CompraItemBase):
    pass

class CompraItemProduto(BaseModel):
    idproduto: int
    descricao: Optional[str] = None
    unidade: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class CompraItemEquipamento(BaseModel):
    idequipamento: int
    nome: Optional[str] = None
    placa: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class CompraItem(CompraItemBase):
    idcompras: int
    produto_rel: Optional[CompraItemProduto] = None
    equipamento_rel: Optional[CompraItemEquipamento] = None

class CompraBase(BaseModel):
    idfornecedor: Optional[int] = None
    valor: Optional[float] = None
    parcelas: Optional[int] = None
    emissao: Optional[date] = None
    frete: Optional[float] = None
    serie: Optional[str] = None
    ir: Optional[float] = None
    observacao: Optional[str] = None
    idfluxo: Optional[str] = None
    inss: Optional[float] = None
    vencimento: Optional[date] = None
    idempresa: Optional[int] = None
    situacao: Optional[bool] = False
    data_quitacao: Optional[date] = None
    base_calculo: Optional[float] = None
    icms: Optional[float] = None
    base_icms: Optional[float] = None
    seguro: Optional[float] = None
    desconto: Optional[float] = None
    ipi: Optional[float] = None
    valor_produto: Optional[float] = None
    forma_pagamento: Optional[str] = None
    codigo_importado: Optional[int] = None
    nota: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class CompraCreate(CompraBase):
    itens: Optional[List[CompraItemCreate]] = []
    contas_pagar: Optional[List[ContasPagarCreate]] = []

class CompraFornecedor(BaseModel):
    idfornecedor: int
    nome: Optional[str] = None
    nomefantasia: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class CompraEmpresa(BaseModel):
    idempresa: int
    nome: Optional[str] = None
    nomefantasia: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class Compra(CompraBase):
    idcompras: int
    id: int
    fornecedor_rel: Optional[CompraFornecedor] = None
    empresa_rel: Optional[CompraEmpresa] = None
    itens: Optional[List[CompraItem]] = []
    contas_pagar: Optional[List[ContasPagar]] = []

# =============================================
# TIPO SERVICO
# =============================================
class TipoServicoBase(BaseModel):
    descricao: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
class TipoServicoCreate(TipoServicoBase): pass
class TipoServico(TipoServicoBase):
    idservico: int
    id: int

class ServicoBase(BaseModel):
    nome: str
    unidade: Optional[str] = None
    valor: Optional[float] = None
    model_config = ConfigDict(from_attributes=True)

class ServicoCreate(ServicoBase): pass

class Servico(ServicoBase):
    id: str

# =============================================
# ORÇAMENTO
# =============================================
class OrcamentoItemBase(BaseModel):
    idequipamento: int
    idservico: int
    unidade: str
    nome_item: Optional[str] = None
    quantidade: Optional[float] = None
    valor_unitario: Optional[float] = None
    valor_total: Optional[float] = None
    model_config = ConfigDict(from_attributes=True)

class OrcamentoItemCreate(OrcamentoItemBase):
    pass

class OrcamentoItemEquipamento(BaseModel):
    idequipamento: int
    nome: Optional[str] = None
    placa: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class OrcamentoItemServico(BaseModel):
    idservico: int
    descricao: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class OrcamentoItem(OrcamentoItemBase):
    idorcamento: int
    equipamento_rel: Optional[OrcamentoItemEquipamento] = None

class OrcamentoBase(BaseModel):
    idcliente: Optional[int] = None
    idempresa: Optional[int] = None
    idfuncionario: Optional[int] = None
    nome: Optional[str] = None
    cnpj_cpf: Optional[str] = None
    contato: Optional[str] = None
    data: Optional[date] = None
    situacao: Optional[str] = "PENDENTE"
    endereco: Optional[str] = None
    cidade: Optional[str] = None
    cep: Optional[str] = None
    forma_pagamento: Optional[str] = None
    local_servico: Optional[str] = None
    local_entrega: Optional[str] = None
    descricao: Optional[str] = None
    total: Optional[float] = None
    fone: Optional[str] = None
    email: Optional[str] = None
    idcontrato: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

class OrcamentoCreate(OrcamentoBase):
    itens: Optional[List[OrcamentoItemCreate]] = []

class OrcamentoEmpresa(BaseModel):
    idempresa: int
    nome: Optional[str] = None
    nomefantasia: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class OrcamentoFuncionario(BaseModel):
    idfuncionario: int
    nome: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class OrcamentoCliente(BaseModel):
    idcliente: int
    nome: Optional[str] = None
    nomefantasia: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class Orcamento(OrcamentoBase):
    idorcamento: int
    id: int
    itens: Optional[List[OrcamentoItem]] = []
    empresa_rel: Optional[OrcamentoEmpresa] = None
    funcionario_rel: Optional[OrcamentoFuncionario] = None
    cliente_rel: Optional[OrcamentoCliente] = None

# =============================================
# CONHECIMENTO DE TRANSPORTE (CT-e)
# =============================================
class ConhecimentoBase(BaseModel):
    data: Optional[date] = None
    natureza_prestacao: Optional[str] = None
    codigo_natureza: Optional[int] = None
    remetente: Optional[int] = None
    destinatario: Optional[int] = None
    forma_pagamento: Optional[str] = None
    notas_fiscais: Optional[str] = None
    como_sera_pago: Optional[str] = None
    natureza_carga: Optional[str] = None
    quantidade: Optional[int] = None
    especie: Optional[str] = None
    peso: Optional[float] = None
    valor_mercadoria: Optional[float] = None
    marca: Optional[str] = None
    placa: Optional[str] = None
    local: Optional[str] = None
    estado: Optional[str] = None
    local_coleta: Optional[str] = None
    local_entrega: Optional[str] = None
    frete_valor: Optional[float] = None
    sec_cat: Optional[float] = None
    seguro: Optional[float] = None
    pedagio: Optional[float] = None
    outros: Optional[float] = None
    total_frete: Optional[float] = None
    base_calculo: Optional[float] = None
    aliquota: Optional[float] = None
    icms: Optional[float] = None
    idfuncionario: Optional[int] = None
    observacao: Optional[str] = None
    data_pagamento: Optional[date] = None
    vencimento: Optional[date] = None
    idfechamento: Optional[int] = None
    idempresa: Optional[int] = None
    cfop: Optional[str] = None
    previsao_entrega: Optional[date] = None
    idequipamento: Optional[int] = None
    chave: Optional[str] = None
    idcte: Optional[str] = None
    cancelado: Optional[str] = None
    protocolo_cte: Optional[str] = None
    justificativa: Optional[str] = None
    tomador: Optional[int] = None
    numero_cte: Optional[int] = None
    texto_outros: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class ConhecimentoCreate(ConhecimentoBase):
    pass

class ConhecimentoEmpresa(BaseModel):
    idempresa: int
    nome: Optional[str] = None
    nomefantasia: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class ConhecimentoFuncionario(BaseModel):
    idfuncionario: int
    nome: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class ConhecimentoEquipamento(BaseModel):
    idequipamento: int
    nome: Optional[str] = None
    placa: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class ConhecimentoFechamento(BaseModel):
    idfechamento: int
    data: Optional[date] = None
    valor: Optional[float] = None
    idcliente: Optional[int] = None
    cliente_nome: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class Conhecimento(ConhecimentoBase):
    idconhecimento: int
    id: int
    empresa_rel:     Optional[ConhecimentoEmpresa]     = None
    funcionario_rel: Optional[ConhecimentoFuncionario] = None
    equipamento_rel: Optional[ConhecimentoEquipamento] = None
    fechamento_rel:  Optional[ConhecimentoFechamento]  = None


# =============================================
# NOTA FISCAL
# =============================================
class NotaFiscalServicoBase(BaseModel):
    sequencial: int
    idservico: int
    valor_unitario: Optional[float] = None
    quantidade: Optional[float] = None
    desconto: Optional[float] = None
    valor_total: Optional[float] = None
    dps: Optional[str] = None
    idempresa: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

class NotaFiscalServicoCreate(NotaFiscalServicoBase):
    pass

class NotaFiscalServicoTipo(BaseModel):
    idservico: int
    descricao: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class NotaFiscalServico(NotaFiscalServicoBase):
    idnota: int
    servico_rel: Optional[NotaFiscalServicoTipo] = None

class NotaFiscalBase(BaseModel):
    idfechamento: Optional[int] = None
    idempresa: Optional[int] = None
    valor_nota: Optional[float] = None
    data_emissao: Optional[date] = None
    serie: Optional[str] = None
    observacao: Optional[str] = None
    pis: Optional[float] = None
    cofins: Optional[float] = None
    inss: Optional[float] = None
    ir: Optional[float] = None
    csll: Optional[float] = None
    outras_retencoes: Optional[float] = None
    imposto: Optional[float] = None
    total_retencao: Optional[float] = None
    vencimento: Optional[date] = None
    idcliente: Optional[int] = None
    sequencia: Optional[int] = None
    hora: Optional[str] = None
    local_servico: Optional[str] = None
    dentro_pais: Optional[str] = None
    resp_imposto: Optional[str] = None
    valor_servicos: Optional[float] = None
    valor_materiais: Optional[float] = None
    base_calculo: Optional[float] = None
    valor_liquido: Optional[float] = None
    iss: Optional[float] = None
    link: Optional[str] = None
    deducoes: Optional[float] = None
    numero: Optional[int] = None
    chave_nfe: Optional[str] = None
    dps: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class NotaFiscalCreate(NotaFiscalBase):
    servicos: Optional[List[NotaFiscalServicoCreate]] = []

class NotaFiscalEmpresa(BaseModel):
    idempresa: int
    nome: Optional[str] = None
    nomefantasia: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class NotaFiscalCliente(BaseModel):
    idcliente: int
    nome: Optional[str] = None
    nomefantasia: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class NotaFiscalFechamento(BaseModel):
    idfechamento: int
    data: Optional[date] = None
    idcliente: Optional[int] = None
    cliente_rel: Optional[NotaFiscalCliente] = None
    model_config = ConfigDict(from_attributes=True)

class NotaFiscal(NotaFiscalBase):
    idnota: int
    id: int
    empresa_rel:    Optional[NotaFiscalEmpresa]    = None
    cliente_rel:    Optional[NotaFiscalCliente]    = None
    fechamento_rel: Optional[NotaFiscalFechamento] = None
    servicos:       Optional[List[NotaFiscalServico]] = []


# =============================================
# SISTEMA RBAC
# =============================================
class PerfilBase(BaseModel):
    nome: str
    descricao: Optional[str] = None
    ativo: Optional[bool] = True
    model_config = ConfigDict(from_attributes=True)

class PerfilCreate(PerfilBase):
    pass

class Perfil(PerfilBase):
    idperfil: int
    id: int
    criado_em: Optional[datetime] = None

class ModuloBase(BaseModel):
    nome: str
    codigo: str
    descricao: Optional[str] = None
    ativo: Optional[bool] = True
    model_config = ConfigDict(from_attributes=True)

class ModuloCreate(ModuloBase):
    pass

class Modulo(ModuloBase):
    idmodulo: int
    id: int

class PermissaoBase(BaseModel):
    idperfil: int
    idmodulo: int
    pode_ler: Optional[bool] = False
    pode_criar: Optional[bool] = False
    pode_editar: Optional[bool] = False
    pode_excluir: Optional[bool] = False
    pode_exportar: Optional[bool] = False
    model_config = ConfigDict(from_attributes=True)

class PermissaoCreate(PermissaoBase):
    pass

class Permissao(PermissaoBase):
    idpermissao: int
    id: int
    modulo: Optional[Modulo] = None

class UsuarioBase(BaseModel):
    nome: str
    username: str
    idperfil: Optional[int] = None
    ativo: Optional[bool] = True
    model_config = ConfigDict(from_attributes=True)

class UsuarioCreate(UsuarioBase):
    senha: str

class UsuarioUpdate(UsuarioBase):
    senha: Optional[str] = None

class Usuario(UsuarioBase):
    idusuario: int
    id: int
    ultimo_acesso: Optional[datetime] = None
    perfil_nome: Optional[str] = None


# =============================================
# AUTH
# =============================================
class LoginRequest(BaseModel):
    username: str
    senha: str


class RefreshRequest(BaseModel):
    refresh_token: str


class PermissaoModuloSchema(BaseModel):
    ler: bool = False
    criar: bool = False
    editar: bool = False
    excluir: bool = False
    exportar: bool = False


class UsuarioLogadoSchema(BaseModel):
    id: int
    username: str
    nome: str
    perfil: str
    permissoes: Dict[str, PermissaoModuloSchema]


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    usuario: UsuarioLogadoSchema
