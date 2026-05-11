from sqlalchemy import Column, Integer, String, LargeBinary, Float, Boolean, ForeignKey, Date, DateTime, Text, Numeric, PrimaryKeyConstraint, UniqueConstraint
from sqlalchemy.orm import relationship, deferred
from database import Base
from datetime import datetime

# Entidades Principais

# =============================================
# EMPRESA
# =============================================
class Empresa(Base):
    __tablename__ = "empresa"
    idempresa = Column(Integer, primary_key=True)
    nome = Column(String, nullable=False)
    nomefantasia = Column(String)
    cnpj = Column(String)
    ie = Column(String)
    cep = Column(String)
    idcidade = Column(Integer, ForeignKey("cidade.idcidade"))
    idbairro = Column(Integer, ForeignKey("bairro.idbairro"))
    logradouro = Column(String)
    tipo_logradouro = Column(String)
    idestado = Column(String, ForeignKey("estados.idestado"))
    numero = Column(Integer)
    ultima_nf = Column(Integer)
    serie = Column(String)
    pis = Column(Float)
    cofins = Column(Float)
    inss = Column(Float)
    ir = Column(Float)
    csll = Column(Float)
    inscricao_municipal = Column(String)
    sequencia = Column(Integer)
    atividade = Column(String)
    aliquota_aplicada = Column(Float)
    deducao = Column(Numeric)
    imposto = Column(Numeric)
    retencao = Column(Numeric)
    status = Column(String, default="ATIVO")
    logo = deferred(Column(LargeBinary))

    @property
    def id(self):
        return self.idempresa

# =============================================
# CLIENTE
# =============================================
class Cliente(Base):
    __tablename__ = "cliente"
    idcliente = Column(Integer, primary_key=True)
    nome = Column(String)
    nomefantasia = Column(String)
    data_cadastro = Column(Date)
    cnpj_cpf = Column(String)
    ie_rg = Column(String)
    tipo = Column(String)
    observacao = Column(Text)
    site = Column(String)
    contato = Column(String)
    status = Column(String, default="ATIVO")

    enderecos = relationship("ClienteEndereco", back_populates="cliente", lazy="select", cascade="all, delete-orphan")
    contatos = relationship("ClienteContato", back_populates="cliente", lazy="select", cascade="all, delete-orphan")

    @property
    def id(self):
        return self.idcliente

class ClienteEndereco(Base):
    __tablename__ = "cliente_endereco"
    idcliend = Column(Integer, primary_key=True)
    idcliente = Column(Integer, ForeignKey("cliente.idcliente"))
    idcidade = Column(Integer, ForeignKey("cidade.idcidade"))
    logradouro = Column(String)
    numero = Column(String)
    tipo_logradouro = Column(String)
    idestado = Column(String, ForeignKey("estados.idestado"))
    idbairro = Column(Integer, ForeignKey("bairro.idbairro"))
    complemento = Column(String)
    cep = Column(String)
    tipo_endereco = Column(String)

    cliente = relationship("Cliente", back_populates="enderecos")

class ClienteContato(Base):
    __tablename__ = "cliente_contato"
    idclienteforma = Column(Integer, primary_key=True)
    idcliente = Column(Integer, ForeignKey("cliente.idcliente"))
    idformacontato = Column(Integer, ForeignKey("forma_contato.idformacontato"))
    valor = Column(String)
    observacao = Column(String)
    idfuncionario = Column(Integer, ForeignKey("funcionario.idfuncionario"))
    idfornecedor = Column(Integer, ForeignKey("fornecedor.idfornecedor"))
    zap = Column(String)
    aniversario = Column(Date)

    cliente = relationship("Cliente", back_populates="contatos")

# =============================================
# FORNECEDOR
# =============================================
class Fornecedor(Base):
    __tablename__ = "fornecedor"
    idfornecedor = Column(Integer, primary_key=True)
    nome = Column(String)
    nomefantasia = Column(String)
    data_cadastro = Column(Date)
    cnpj_cpf = Column(String)
    ie_rg = Column(String)
    tipo = Column(String)
    site = Column(String)
    cep = Column(String)
    idcidade = Column(Integer, ForeignKey("cidade.idcidade"))
    idbairro = Column(Integer, ForeignKey("bairro.idbairro"))
    logradouro = Column(String)
    tipo_logradouro = Column(String)
    idestado = Column(String, ForeignKey("estados.idestado"))
    contato = Column(String)
    observacao = Column(Text)
    complemento = Column(String)
    numero = Column(String)
    status = Column(String, default="ATIVO")

    @property
    def id(self):
        return self.idfornecedor

    ramos = relationship("ForRamo", back_populates="fornecedor", cascade="all, delete-orphan")
    atividades = relationship("ForAtividade", back_populates="fornecedor", cascade="all, delete-orphan")

class ForRamo(Base):
    __tablename__ = "for_ramo"
    idforramo = Column(Integer, primary_key=True)
    idfornecedor = Column(Integer, ForeignKey("fornecedor.idfornecedor"))
    idramo = Column(Integer, ForeignKey("fornecedor_ramo.idramo"))

    fornecedor = relationship("Fornecedor", back_populates="ramos")
    ramo = relationship("FornecedorRamo")

class ForAtividade(Base):
    __tablename__ = "for_atividade"
    idforatividade = Column(Integer, primary_key=True)
    idfornecedor = Column(Integer, ForeignKey("fornecedor.idfornecedor"))
    idatividade = Column(Integer, ForeignKey("fornecedor_atividade.idatividade"))

    fornecedor = relationship("Fornecedor", back_populates="atividades")
    atividade = relationship("FornecedorAtividade")

# =============================================
# FUNCIONÁRIO
# =============================================
class Funcionario(Base):
    __tablename__ = "funcionario"
    idfuncionario = Column(Integer, primary_key=True)
    nome = Column(String)
    apelido = Column(String)
    observacao = Column(Text)
    cpf = Column(String)
    rg = Column(String)
    ctpf = Column(String)
    serie = Column(String)
    pis = Column(String)
    idcargo = Column(Integer, ForeignKey("cargo.idcargo"))
    admissao = Column(Date)
    demissao = Column(Date)
    nascimento = Column(Date)
    cbo = Column(String)
    cep = Column(String)
    idcidade = Column(Integer, ForeignKey("cidade.idcidade"))
    idbairro = Column(Integer, ForeignKey("bairro.idbairro"))
    logradouro = Column(String)
    tipo_logradouro = Column(String)
    idestado = Column(String, ForeignKey("estados.idestado"))
    numero = Column(Integer)
    cnh = Column(String)
    validade_cnh = Column(Date)
    categoria = Column(String)
    complemento = Column(String)
    pe = Column(Integer)
    validade_exame = Column(Date)
    data_toxicologico = Column(Date)
    status = Column(String, default="ATIVO")

    @property
    def id(self):
        return self.idfuncionario

    cargo_rel = relationship("Cargo", lazy="joined")
    descontos = relationship("Desconto", back_populates="funcionario_rel", lazy="dynamic")

class Desconto(Base):
    __tablename__ = "descontos"
    iddesconto    = Column(Integer, primary_key=True)
    idfuncionario = Column(Integer, ForeignKey("funcionario.idfuncionario"))
    valor         = Column(Numeric(15, 2))
    descricao     = Column(Text)
    data          = Column(Date)

    @property
    def id(self):
        return self.iddesconto

    funcionario_rel = relationship("Funcionario", back_populates="descontos")

# =============================================
# EQUIPAMENTO
# =============================================
class Equipamento(Base):
    __tablename__ = "equipamento"
    idequipamento = Column(Integer, primary_key=True)
    nome = Column(String)
    placa = Column(String)
    valor = Column(Numeric)
    marca = Column(String)
    modelo = Column(String)
    ano_fabricacao = Column(Integer)
    ano_modelo = Column(Integer)
    valor_pago = Column(Numeric)
    antigo_dono = Column(String)
    renavan = Column(String)
    chassi = Column(String)
    km_atual = Column(Integer)
    idtipoequipamento = Column(Integer, ForeignKey("tipo_equipamento.idtipoequipamento"))
    idfluxo = Column(String, ForeignKey("fluxo_financeiro.idfluxo"))
    idempresa = Column(Integer, ForeignKey("empresa.idempresa"))
    data_aquisicao = Column(Date)
    km_inicial = Column(Integer)
    gera_faturamento = Column(Boolean)
    observacao = Column(Text)
    tara = Column(Integer)
    kilo = Column(Integer)
    m3 = Column(Integer)
    rodado = Column(Integer)
    carroceria = Column(Integer)
    uflicencimento = Column(String)
    tacografo = Column(Date)
    comprador = Column(Text)
    status = Column(String, default="DISPONÍVEL")

    @property
    def id(self):
        return self.idequipamento

    componentes = relationship("EquipamentoConjunto", back_populates="equipamento", lazy="subquery")

class EquipamentoConjunto(Base):
    __tablename__ = "equipamento_conjunto"
    idconjunto = Column(Integer, primary_key=True)
    idequipamento = Column(Integer, ForeignKey("equipamento.idequipamento"))
    item = Column(Integer)

    equipamento = relationship("Equipamento", back_populates="componentes")


# =============================================
# ORDEM DE SERVIÇO
# =============================================

class Ordem(Base):
    __tablename__ = "ordem"
    idordem = Column(Integer, primary_key=True, autoincrement=True)
    sequencial = Column(Integer)
    numero_os = Column(Integer)
    idcliente = Column(Integer)                                              # sem FK constraint no banco
    idempresa = Column(Integer, ForeignKey("empresa.idempresa"))
    data = Column(Date)
    inicio_01 = Column(String(5))
    termino_01 = Column(String(5))
    inicio_02 = Column(String(5))
    termino_02 = Column(String(5))
    valor_hora = Column(Numeric(10,2))
    valor_servicos = Column(Numeric(10,2))
    valor_os = Column(Numeric(10,2))
    local_servico = Column(String(100))
    local_entrega = Column(String(100))
    km_inicio = Column(Integer)
    km_final = Column(Integer)
    km_total = Column(Integer)
    valor_km = Column(Numeric(10,2))
    pedagio = Column(Numeric(10,2))
    desconto = Column(Numeric(10,2))
    saida = Column(Numeric(10,2))
    escolta = Column(Numeric(10,2))
    valor_frete = Column(Numeric(10,2))
    servico_prestado = Column(Text)
    idequipamento = Column(Integer, ForeignKey("equipamento.idequipamento"))
    idfuncionario = Column(Integer, ForeignKey("funcionario.idfuncionario"))
    funcionario_2 = Column(Integer)                                          # sem FK constraint no banco
    funcionario_3 = Column(Integer)                                          # sem FK constraint no banco
    situacao = Column(Boolean)
    valor_pago = Column(Numeric(10,2))
    idfluxo = Column(String, ForeignKey("fluxo_financeiro.idfluxo"))
    idorcamento = Column(Integer)                                            # sem FK constraint no banco
    empresa_nota = Column(Integer)
    total_horas = Column(Numeric(10,2))
    cidade_servico = Column(String(100))
    idfechamento = Column(Integer, ForeignKey("fechamento.idfechamento"))
    porcentagem = Column(Numeric(10,2))
    cidade_entrega = Column(String(100))
    valor_total_km = Column(Numeric(10,2))
    idconhecimento = Column(Integer)
    seguro = Column(Numeric(10,2))
    idservico = Column(Integer)                                              # sem FK constraint no banco

    # Relacionamentos
    empresa_rel     = relationship("Empresa",      foreign_keys=[idempresa],    lazy="joined")
    equipamento_rel = relationship("Equipamento",  foreign_keys=[idequipamento],lazy="joined")
    funcionario_rel = relationship("Funcionario",  foreign_keys=[idfuncionario],lazy="joined")
    fluxo_rel       = relationship("FluxoFinanceiro", foreign_keys=[idfluxo],   lazy="joined")
    fechamento_rel  = relationship("Fechamento",   foreign_keys=[idfechamento], lazy="select")
    cliente_rel     = relationship("Cliente",      primaryjoin="Ordem.idcliente == Cliente.idcliente", foreign_keys="[Ordem.idcliente]", lazy="joined")

    @property
    def id(self):
        return self.idordem


# =============================================
# TABELAS COM INFORMAÇÕES OPERACIONAIS
# =============================================
class Licenca(Base):
    __tablename__ = "licenca"
    idlicenca = Column(Integer, primary_key=True, autoincrement=True)
    data = Column(Date)
    vencimento = Column(Date)
    largura = Column(String(15))
    comprimento = Column(String(15))
    altura = Column(String(15))
    horario = Column(String(15))
    carretas = Column(String(50))
    pesos = Column(String(15))
    tara = Column(String(15))
    peso_carga = Column(String(15))
    pbt = Column(String(15))
    autorizacao = Column(String(15))
    orgao = Column(String(50))
    idequipamento = Column(Integer)
    estado = Column(String(20))
    despachante = Column(String(50))
    
    @property
    def id(self): return self.idlicenca

class Seguro(Base):
    __tablename__ = "seguros"
    idseguro = Column(Integer, primary_key=True, autoincrement=True)
    titular = Column(String(50))
    seguradora = Column(String(50))
    corretora = Column(String(50))
    apolice = Column(String(50))
    tipo = Column(String(50))
    veiculo = Column(String(50))
    placa = Column(String(8))
    inicio = Column(Date)
    termino = Column(Date)
    valor_segurado = Column(Numeric(15, 2))
    valor_seguro = Column(Numeric(15, 2))
    parcelas = Column(Integer)
    valor_parcela = Column(Numeric(15, 2))
    primeiro_vencimento = Column(Date)
    ultimo_vencimento = Column(Date)
    tipo_pagamento = Column(String(40))
    ativo = Column(Boolean)
    
    @property
    def id(self): return self.idseguro

class FluxoFinanceiro(Base):
    __tablename__ = "fluxo_financeiro"
    idfluxo = Column(String, primary_key=True)
    descricao = Column(String)
    fluxo_pai = Column(String)
    tipo = Column(String)
    movimento = Column(String)
    codigo_importacao = Column(Integer)
    nivel = Column(Integer)

    @property
    def id(self): return self.idfluxo

# =============================================
# TABELAS AUXILIARES (referenciadas por FKs)
# =============================================
class Pais(Base):
    __tablename__ = "pais"
    idpais = Column(String, primary_key=True)
    nacionalidade = Column(String)
    nome = Column(String)
    sigla = Column(String)

class Estado(Base):
    __tablename__ = "estados"
    idestado = Column(String, primary_key=True)
    nome = Column(String)
    idpais = Column(String, ForeignKey("pais.idpais"), nullable=False)

class Cidade(Base):
    __tablename__ = "cidade"
    idcidade = Column(Integer, primary_key=True)
    ddd = Column(Integer)
    idestado = Column(String, ForeignKey("estados.idestado"))
    idpais = Column(String, ForeignKey("pais.idpais"))
    nome = Column(String)
    codigo_ibge = Column(String)

    @property
    def id(self):
        return self.idcidade

class Bairro(Base):
    __tablename__ = "bairro"
    idbairro = Column(Integer, primary_key=True)
    idcidade = Column(Integer, ForeignKey("cidade.idcidade"))
    nome = Column(String)

    @property
    def id(self):
        return self.idbairro

class Logradouro(Base):
    __tablename__ = "logradouro"
    idlogradouro = Column(Integer, primary_key=True)
    cep          = Column(Integer)
    idbairro     = Column(Integer, ForeignKey("bairro.idbairro"))
    logradouro   = Column(String(50))
    tipo         = Column(String(20))

    bairro_rel   = relationship("Bairro", lazy="joined")

    @property
    def id(self):
        return self.idlogradouro

class FormaContato(Base):
    __tablename__ = "forma_contato"
    idformacontato = Column(Integer, primary_key=True)
    nome = Column(String)

    @property
    def id(self): return self.idformacontato

class TextoPadrao(Base):
    __tablename__ = "texto_padrao"
    texto = Column(String)
    idtexto = Column(Integer, primary_key=True)

    @property
    def id(self): return self.idtexto

class Contrato(Base):
    __tablename__ = "contratos"
    idcontrato = Column(Integer, primary_key=True)
    descricao  = Column(String(255))
    clausulas  = Column(Text)
    ativo      = Column(Boolean, default=True)

    @property
    def id(self): return self.idcontrato

class FormaPagamento(Base):
    __tablename__ = "forma_pagamento"
    idformapgto = Column(Integer, primary_key=True)
    nome = Column(String)
    cor_fundo = Column(Integer)
    cor_fonte = Column(Integer)
    
    @property
    def id(self): return self.idformapgto

class FornecedorAtividade(Base):
    __tablename__ = "fornecedor_atividade"
    idatividade = Column(Integer, primary_key=True)
    descricao = Column(String)
    
    @property
    def id(self): return self.idatividade

class FornecedorRamo(Base):
    __tablename__ = "fornecedor_ramo"
    idramo = Column(Integer, primary_key=True)
    descricao = Column(String)
    
    @property
    def id(self): return self.idramo

class TipoServico(Base):
    __tablename__ = 'tipos_servicos'
    idservico = Column(Integer, primary_key=True)
    descricao = Column(String)
    
    @property
    def id(self): return self.idservico

class Servico(Base):
    __tablename__ = 'servicos'
    nome = Column(String(100), primary_key=True)
    unidade = Column(String(8))
    valor = Column(Numeric(15, 2))
    
    @property
    def id(self): return self.nome

class TipoEquipamento(Base):
    __tablename__ = "tipo_equipamento"
    idtipoequipamento = Column(Integer, primary_key=True)
    nome = Column(String)

    @property
    def id(self):
        return self.idtipoequipamento

class Cargo(Base):
    __tablename__ = "cargo"
    idcargo = Column(Integer, primary_key=True)
    nome = Column(String)

    @property
    def id(self):
        return self.idcargo

# =============================================
# ORÇAMENTO
# =============================================
class Orcamento(Base):
    __tablename__ = "orcamento"
    idorcamento = Column(Integer, primary_key=True, autoincrement=True)
    idcliente = Column(Integer, ForeignKey("cliente.idcliente"))
    nome = Column(String)
    cnpj_cpf = Column(String)
    contato = Column(String)
    data = Column(Date)
    situacao = Column(String)
    endereco = Column(String)
    cidade = Column(String)
    cep = Column(String)
    forma_pagamento = Column(String)
    local_servico = Column(String)
    local_entrega = Column(String)
    descricao = Column(Text)
    idfuncionario = Column(Integer, ForeignKey("funcionario.idfuncionario"))
    total = Column(Numeric(15, 2))
    idempresa = Column(Integer, ForeignKey("empresa.idempresa"))
    fone = Column(String)
    email = Column(String)
    idcontrato = Column(Integer, ForeignKey("contratos.idcontrato"))

    empresa_rel = relationship("Empresa", lazy="joined")
    funcionario_rel = relationship("Funcionario", foreign_keys=[idfuncionario], lazy="joined")
    cliente_rel = relationship("Cliente", lazy="joined")
    contrato_rel = relationship("Contrato", lazy="joined")
    itens = relationship("OrcamentoItem", back_populates="orcamento", cascade="all, delete-orphan", lazy="subquery")

    @property
    def id(self):
        return self.idorcamento

class OrcamentoItem(Base):
    __tablename__ = "orcamento_item"
    __table_args__ = (PrimaryKeyConstraint("idorcamento", "idequipamento", "idservico"),)
    idorcamento = Column(Integer, ForeignKey("orcamento.idorcamento"), nullable=False)
    idequipamento = Column(Integer, ForeignKey("equipamento.idequipamento"), nullable=False)
    idservico = Column(Integer, nullable=False)
    unidade = Column(String, nullable=False)
    valor_unitario = Column(Numeric(15, 2))
    valor_total = Column(Numeric(15, 2))
    nome_item = Column(String)
    quantidade = Column(Numeric(15, 3))

    orcamento = relationship("Orcamento", back_populates="itens")
    equipamento_rel = relationship("Equipamento", lazy="joined")

# =============================================
# FECHAMENTO DE OS / CONTAS A RECEBER
# =============================================
class Fechamento(Base):
    __tablename__ = "fechamento"
    idfechamento = Column(Integer, primary_key=True)
    data = Column(Date)
    valor = Column(Numeric(15, 2))
    total_itens = Column(Integer)
    parcelas = Column(Integer)
    gerar_nf = Column(Boolean, default=False)
    idempresa = Column(Integer, ForeignKey("empresa.idempresa"))
    valor_pago = Column(Numeric(15, 2))
    data_geracao_nf = Column(Date)
    idcliente = Column(Integer, ForeignKey("cliente.idcliente"))
    desconto = Column(Numeric(15, 2))
    juros = Column(Numeric(15, 2))
    situacao = Column(Boolean, default=False)
    idconhecimento = Column(Integer)

    empresa_rel = relationship("Empresa", foreign_keys=[idempresa], lazy="joined")
    cliente_rel = relationship("Cliente", foreign_keys=[idcliente], lazy="joined")
    contas = relationship("ContasReceber", back_populates="fechamento_rel", cascade="all, delete-orphan", lazy="select")

    @property
    def id(self):
        return self.idfechamento

    @property
    def cliente_nome(self):
        if self.cliente_rel:
            return self.cliente_rel.nomefantasia or self.cliente_rel.nome
        return None


class ContasReceber(Base):
    __tablename__ = "contas_receber"
    idcontasreceber = Column(Integer, primary_key=True)
    vencimento = Column(Date)
    valor = Column(Numeric(15, 2))
    valor_pago = Column(Numeric(15, 2))
    situacao = Column(Boolean, default=False)
    idfechamento = Column(Integer, ForeignKey("fechamento.idfechamento"))
    codigo_banco = Column(String)
    linha_digitavel = Column(String)
    codigo_de_barra = Column(String)
    ban_codigo = Column(Integer)
    parcela = Column(String)
    ultimo_pagamento = Column(Date)

    fechamento_rel = relationship("Fechamento", back_populates="contas")

    @property
    def id(self):
        return self.idcontasreceber


# =============================================
# PRODUTOS / SERVIÇOS
# =============================================
class ProdutoServico(Base):
    __tablename__ = "produtos_servicos"
    idproduto = Column(Integer, primary_key=True, autoincrement=True)
    descricao = Column(String(50))
    ncmsh = Column(String(20))
    cst = Column(String(8))
    unidade = Column(String(8))
    ipi = Column(Numeric(15, 2))
    icms = Column(Numeric(15, 2))
    marca_km = Column(Boolean)

    @property
    def id(self):
        return self.idproduto


# =============================================
# COMPRAS
# =============================================
class Compra(Base):
    __tablename__ = "compras"
    idcompras = Column(Integer, primary_key=True, autoincrement=True)
    idfornecedor = Column(Integer, ForeignKey("fornecedor.idfornecedor"))
    valor = Column(Numeric(15, 2))
    parcelas = Column(Integer)
    emissao = Column(Date)
    frete = Column(Numeric(15, 2))
    serie = Column(String(8))
    ir = Column(Numeric(15, 2))
    observacao = Column(Text)
    idfluxo = Column(String(8), ForeignKey("fluxo_financeiro.idfluxo"))
    inss = Column(Numeric(15, 2))
    vencimento = Column(Date)
    idempresa = Column(Integer, ForeignKey("empresa.idempresa"))
    situacao = Column(Boolean, default=False)
    data_quitacao = Column(Date)
    base_calculo = Column(Numeric(15, 2))
    icms = Column(Numeric(15, 2))
    base_icms = Column(Numeric(15, 2))
    seguro = Column(Numeric(15, 2))
    desconto = Column(Numeric(15, 2))
    ipi = Column(Numeric(15, 2))
    valor_produto = Column(Numeric(15, 2))
    forma_pagamento = Column(String(30))
    codigo_importado = Column(Integer)
    nota = Column(String(15))

    empresa_rel = relationship("Empresa", foreign_keys=[idempresa], lazy="joined")
    fornecedor_rel = relationship("Fornecedor", foreign_keys=[idfornecedor], lazy="joined")
    fluxo_rel = relationship("FluxoFinanceiro", foreign_keys=[idfluxo], lazy="joined")
    itens = relationship("CompraItem", back_populates="compra_rel", cascade="all, delete-orphan", lazy="subquery")
    contas_pagar = relationship("ContasPagar", back_populates="compra_rel", cascade="all, delete-orphan", lazy="subquery")

    @property
    def id(self):
        return self.idcompras


class CompraItem(Base):
    __tablename__ = "compra_itens"
    __table_args__ = (PrimaryKeyConstraint("idcompras", "idproduto", "idequipamento"),)
    idcompras = Column(Integer, ForeignKey("compras.idcompras"), nullable=False)
    idproduto = Column(Integer, ForeignKey("produtos_servicos.idproduto"), nullable=False)
    idequipamento = Column(Integer, ForeignKey("equipamento.idequipamento"), nullable=False)
    quantidade = Column(Numeric(15, 2), nullable=False)
    valor_unitario = Column(Numeric(15, 2), nullable=False)
    valor_total = Column(Numeric(15, 2), nullable=False)
    km = Column(Integer)

    compra_rel = relationship("Compra", back_populates="itens")
    produto_rel = relationship("ProdutoServico", lazy="joined")
    equipamento_rel = relationship("Equipamento", lazy="joined")


# =============================================
# CONTAS A PAGAR
# =============================================
class ContasPagar(Base):
    __tablename__ = "contas_pagar"
    idcontaspagar = Column(Integer, primary_key=True, autoincrement=True)
    vencimento = Column(Date)
    valor = Column(Numeric(15, 2))
    valor_pago = Column(Numeric(15, 2))
    situacao = Column(Boolean, default=False)
    parcela = Column(String(8))
    idcompras = Column(Integer, ForeignKey("compras.idcompras"))
    ultimo_pagamento = Column(Date)
    desconto = Column(Numeric(15, 2))
    observacao = Column(Text)
    valor_original = Column(Numeric(15, 2))

    compra_rel = relationship("Compra", back_populates="contas_pagar")

    @property
    def id(self):
        return self.idcontaspagar


# =============================================
# CONHECIMENTO DE TRANSPORTE (CT-e)
# =============================================
class Conhecimento(Base):
    __tablename__ = "conhecimento"
    idconhecimento = Column(Integer, primary_key=True, autoincrement=True)
    data = Column(Date)
    natureza_prestacao = Column(String)
    codigo_natureza = Column(Integer)
    remetente = Column(Integer)
    destinatario = Column(Integer)
    forma_pagamento = Column(String)
    notas_fiscais = Column(String)
    como_sera_pago = Column(String)
    natureza_carga = Column(String)
    quantidade = Column(Integer)
    especie = Column(String)
    peso = Column(Numeric)
    valor_mercadoria = Column(Numeric)
    marca = Column(String)
    placa = Column(String)
    local = Column(String)
    estado = Column(String)
    local_coleta = Column(String)
    local_entrega = Column(String)
    frete_valor = Column(Numeric)
    sec_cat = Column(Numeric)
    seguro = Column(Numeric)
    pedagio = Column(Numeric)
    outros = Column(Numeric)
    total_frete = Column(Numeric)
    base_calculo = Column(Numeric)
    aliquota = Column(Numeric)
    icms = Column(Numeric)
    idfuncionario = Column(Integer, ForeignKey("funcionario.idfuncionario"))
    observacao = Column(Text)
    data_pagamento = Column(Date)
    vencimento = Column(Date)
    idfechamento = Column(Integer, ForeignKey("fechamento.idfechamento"))
    idempresa = Column(Integer, ForeignKey("empresa.idempresa"), nullable=False)
    cfop = Column(String)
    previsao_entrega = Column(Date)
    idequipamento = Column(Integer, ForeignKey("equipamento.idequipamento"))
    chave = Column(String)
    idcte = Column(String)
    cancelado = Column(String)
    protocolo_cte = Column(String)
    justificativa = Column(String)
    tomador = Column(Integer)
    numero_cte = Column(Integer, nullable=False)
    texto_outros = Column(String)

    empresa_rel     = relationship("Empresa",     foreign_keys=[idempresa],    lazy="joined")
    funcionario_rel = relationship("Funcionario", foreign_keys=[idfuncionario],lazy="joined")
    equipamento_rel = relationship("Equipamento", foreign_keys=[idequipamento],lazy="joined")
    fechamento_rel  = relationship("Fechamento",  foreign_keys=[idfechamento], lazy="joined")

    @property
    def id(self): return self.idconhecimento


# =============================================
# NOTA FISCAL
# =============================================
class NotaFiscal(Base):
    __tablename__ = "nota_fiscal"
    idnota = Column(Integer, primary_key=True, autoincrement=True)
    idfechamento = Column(Integer, ForeignKey("fechamento.idfechamento"))
    idempresa = Column(Integer, ForeignKey("empresa.idempresa"), nullable=False)
    valor_nota = Column(Numeric)
    data_emissao = Column(Date)
    serie = Column(String)
    observacao = Column(Text)
    pis = Column(Numeric)
    cofins = Column(Numeric)
    inss = Column(Numeric)
    ir = Column(Numeric)
    csll = Column(Numeric)
    outras_retencoes = Column(Numeric)
    imposto = Column(Numeric)
    total_retencao = Column(Numeric)
    vencimento = Column(Date)
    idcliente = Column(Integer, ForeignKey("cliente.idcliente"))
    sequencia = Column(Integer)
    hora = Column(String)
    local_servico = Column(String)
    dentro_pais = Column(String)
    resp_imposto = Column(String)
    valor_servicos = Column(Numeric)
    valor_materiais = Column(Numeric)
    base_calculo = Column(Numeric)
    valor_liquido = Column(Numeric)
    iss = Column(Numeric)
    link = Column(String)
    deducoes = Column(Numeric)
    numero = Column(Integer)
    chave_nfe = Column(String)
    dps = Column(String, nullable=False)

    empresa_rel    = relationship("Empresa",  foreign_keys=[idempresa],   lazy="joined")
    cliente_rel    = relationship("Cliente",  foreign_keys=[idcliente],   lazy="joined")
    fechamento_rel = relationship("Fechamento", foreign_keys=[idfechamento], lazy="joined")
    servicos       = relationship("NotaFiscalServico", back_populates="nota_rel",
                                  cascade="all, delete-orphan", lazy="subquery")

    @property
    def id(self): return self.idnota


class NotaFiscalServico(Base):
    __tablename__ = "nota_fiscal_servico"
    __table_args__ = (PrimaryKeyConstraint("idnota", "sequencial", "idservico"),)
    idnota      = Column(Integer, ForeignKey("nota_fiscal.idnota"), nullable=False)
    sequencial  = Column(Integer, nullable=False)
    idservico   = Column(Integer, ForeignKey("tipos_servicos.idservico"), nullable=False)
    valor_unitario = Column(Numeric)
    quantidade  = Column(Numeric)
    desconto    = Column(Numeric)
    valor_total = Column(Numeric)
    dps         = Column(String)
    idempresa   = Column(Integer, ForeignKey("empresa.idempresa"))

    nota_rel    = relationship("NotaFiscal", back_populates="servicos")
    servico_rel = relationship("TipoServico", lazy="joined")
    empresa_rel = relationship("Empresa", foreign_keys=[idempresa], lazy="joined")


# =============================================
# SISTEMA RBAC
# =============================================
class Perfil(Base):
    __tablename__ = "perfil"
    idperfil  = Column(Integer, primary_key=True)
    nome      = Column(String(50), nullable=False, unique=True)
    descricao = Column(String(200))
    ativo     = Column(Boolean, default=True)
    criado_em = Column(DateTime, default=datetime.utcnow)

    @property
    def id(self):
        return self.idperfil

    usuarios   = relationship("Usuario",   back_populates="perfil_rel", lazy="dynamic")
    permissoes = relationship("Permissao", back_populates="perfil_rel", cascade="all, delete-orphan")

class Modulo(Base):
    __tablename__ = "modulo"
    idmodulo  = Column(Integer, primary_key=True)
    nome      = Column(String(100), nullable=False)
    codigo    = Column(String(60), nullable=False, unique=True)
    descricao = Column(String(200))
    ativo     = Column(Boolean, default=True)

    @property
    def id(self):
        return self.idmodulo

    permissoes = relationship("Permissao", back_populates="modulo_rel")

class Permissao(Base):
    __tablename__ = "permissao"
    __table_args__ = (UniqueConstraint("idperfil", "idmodulo"),)
    idpermissao  = Column(Integer, primary_key=True)
    idperfil     = Column(Integer, ForeignKey("perfil.idperfil"), nullable=False)
    idmodulo     = Column(Integer, ForeignKey("modulo.idmodulo"), nullable=False)
    pode_ler     = Column(Boolean, default=False)
    pode_criar   = Column(Boolean, default=False)
    pode_editar  = Column(Boolean, default=False)
    pode_excluir = Column(Boolean, default=False)
    pode_exportar= Column(Boolean, default=False)

    @property
    def id(self):
        return self.idpermissao

    perfil_rel = relationship("Perfil", back_populates="permissoes")
    modulo_rel = relationship("Modulo", back_populates="permissoes", lazy="joined")

class Usuario(Base):
    __tablename__ = "usuario"
    idusuario    = Column(Integer, primary_key=True)
    nome         = Column(String(100), nullable=False)
    username     = Column(String(50), nullable=False, unique=True)
    senha_hash   = Column(String(200), nullable=False)
    idperfil     = Column(Integer, ForeignKey("perfil.idperfil"), nullable=True)
    ativo        = Column(Boolean, default=True)
    ultimo_acesso= Column(DateTime, nullable=True)

    @property
    def id(self):
        return self.idusuario

    perfil_rel = relationship("Perfil", back_populates="usuarios", lazy="joined")

