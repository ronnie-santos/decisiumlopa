import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import models
from database import engine

# NÃO criar tabelas automaticamente
# models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Decisium Lopa API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "X-Total-Valor", "X-Total-Fornecedores"],
)

@app.get("/")
def read_root():
    return {"message": "Bem-vindo à API do Decisium Lopa"}

from routers import auth as auth_router
app.include_router(auth_router.router)

from routers import (
    empresa, cliente, funcionario, fornecedor, equipamento, auxiliares, cargo,
    textopadrao, formapagamento, formacontato, atividade_fornecedor, fornecedor_ramo,
    tipo_equipamento, fluxo_financeiro, licenca, seguro, tipo_servico, servico,
    usuarios, perfis, modulos, permissoes, orcamento, ordem,
    fechamento, contas_receber, produto, compras, contaspagar, dashboard, test,
    conhecimento, nota_fiscal, logradouro,
    pais, estado, cidade, bairro, cep,
    fluxo_caixa, contratos,
)

app.include_router(auxiliares.router)
app.include_router(empresa.router)
app.include_router(cliente.router)
app.include_router(funcionario.router)
app.include_router(fornecedor.router)
app.include_router(equipamento.router)
app.include_router(cargo.router)
app.include_router(textopadrao.router)
app.include_router(formapagamento.router)
app.include_router(formacontato.router)
app.include_router(atividade_fornecedor.router)
app.include_router(fornecedor_ramo.router)
app.include_router(tipo_equipamento.router)
app.include_router(fluxo_financeiro.router)
app.include_router(licenca.router)
app.include_router(seguro.router)
app.include_router(tipo_servico.router)
app.include_router(servico.router)
app.include_router(usuarios.router)
app.include_router(perfis.router)
app.include_router(modulos.router)
app.include_router(permissoes.router)
app.include_router(orcamento.router)
app.include_router(ordem.router)
app.include_router(fechamento.router)
app.include_router(contas_receber.router)
app.include_router(produto.router)
app.include_router(compras.router)
app.include_router(contaspagar.router)
app.include_router(dashboard.router)
app.include_router(test.router)
app.include_router(conhecimento.router)
app.include_router(nota_fiscal.router)
app.include_router(logradouro.router)
app.include_router(pais.router)
app.include_router(estado.router)
app.include_router(cidade.router)
app.include_router(bairro.router)
app.include_router(cep.router)
app.include_router(fluxo_caixa.router)
app.include_router(contratos.router)
