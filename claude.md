# Decisium Lopa — Documentação Completa do Projeto (PRD + Contexto Técnico)

## 1. Visão Geral do Produto

### 1.1 O que é
**Decisium Lopa** é um sistema ERP (Enterprise Resource Planning) web, desenvolvido sob medida para a empresa **Lopa Guindastes e Transportes Ltda**, que atua no segmento de **logística, guindastes e transportes especiais**. O sistema gerencia todo o ciclo operacional e financeiro da empresa: desde o cadastro de clientes, fornecedores e equipamentos, passando por orçamentos e ordens de serviço, até o controle financeiro completo (contas a pagar, contas a receber, fluxo de caixa e notas fiscais).

### 1.2 Objetivo
Substituir um sistema legado desktop por uma aplicação web moderna, mantendo a base de dados PostgreSQL existente (com dados migrados) e oferecendo uma interface responsiva e intuitiva.

### 1.3 Público-Alvo
- **Administradores da empresa**: Gestão de empresas, usuários e permissões.
- **Operadores**: Cadastro de clientes, fornecedores, funcionários, equipamentos, licenças e seguros.
- **Setor Financeiro**: Contas a pagar/receber, fechamentos de OS, notas fiscais e fluxo de caixa.

## 2. Arquitetura Técnica

### 2.1 Stack de Tecnologias

| Camada        | Tecnologia                              | Versão    |
|---------------|---------------------------------------- |-----------|
| **Frontend**  | React + TypeScript                      | React 19  |
| **Bundler**   | Vite                                    | 6.2       |
| **Estilização** | Tailwind CSS (v4, plugin Vite)        | 4.1       |
| **Ícones**    | Lucide React                            | 0.546     |
| **Animações** | Motion (framer-motion successor)        | 12.x      |
| **Roteamento**| React Router DOM                        | 7.13      |
| **Backend**   | Python FastAPI                          | latest    |
| **ORM**       | SQLAlchemy                              | latest    |
| **Validação** | Pydantic (v2, com `model_validate`)     | latest    |
| **Banco**     | PostgreSQL                              | 14+       |
| **Driver DB** | psycopg2-binary                         | latest    |

### 2.2 Estrutura de Diretórios
```
LOPA/
├── backend/
│   ├── routers/          # 37 routers CRUD
│   ├── reports/          # Geração de relatórios (base_report, cliente_report)
│   ├── tests/            # Testes unitários
│   ├── main.py           # Entrypoint FastAPI
│   ├── models.py         # SQLAlchemy models
│   ├── schemas.py        # Pydantic schemas
│   ├── util.py           # Utilitários compartilhados
│   └── requirements.txt
├── database/
│   ├── database.py       # Conexão SQLAlchemy
│   ├── scripts/          # Scripts de importação do legado
│   └── seeds/            # Seeds iniciais
├── docs/                 # Documentação viva do projeto
├── frontend/
│   ├── components/
│   │   ├── ui/           # Button, Input, InputCurrency, Modal, DataGrid, cn.ts
│   │   ├── Header.tsx
│   │   ├── Layout.tsx
│   │   └── Sidebar.tsx
│   ├── context/          # AuthContext
│   ├── pages/            # 31 páginas implementadas
│   ├── utils/            # Utilitários frontend
│   ├── types.ts          # Tipos TypeScript compartilhados
│   ├── App.tsx
│   └── main.tsx
├── package.json          # Scripts npm (dev, build, dev:backend)
├── vite.config.ts
└── tsconfig.json
```

### 2.3 Conexão com Banco de Dados

```python
# database/database.py
DATABASE_URL = os.getenv("DATABASE_URL")  
# Fallback: "postgresql://postgres:r0nN1E@localhost:5433/DECISIUM_LOPA"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
```

- **PostgreSQL** escuta na porta **5433** (não 5432 padrão).
- O banco se chama `DECISIUM_LOPA`.
- Usuário: `postgres`, Senha: `r0nN1E`.
- O backend **NÃO** cria tabelas automaticamente (`create_all` comentado em `main.py`).


## 3. Modelo de Dados (Banco PostgreSQL)

### 3.1 Tabelas Ativas (usadas pelo sistema)

O banco contém **51 tabelas no total**:

#### Entidades Principais
| Tabela                  | PK               | Descrição                          |
|-------------------------|-------------------|------------------------------------|
| `empresa`               | `idempresa` (int) | Unidades de negócio da empresa     |
| `cliente`               | `idcliente` (int) | Cadastro de clientes               |
| `cliente_endereco`      | `idcliend` (int)  | Endereços dos clientes (N:1)       |
| `cliente_contato`       | `idclienteforma` (int) | Formas de contato dos clientes (N:1) |
| `ordem`            | `idordem` (int)       | Ordens de serviço                  |
| `fechamento`       | `idfechamento` (int)  | Fechamento de OS → geração de NF   |
| `fornecedor`            | `idfornecedor` (int) | Cadastro de fornecedores         |
| `for_ramo`              | `idforramo` (int) | Junção fornecedor↔ramo (N:N)       |
| `for_atividade`         | `idforatividade` (int) | Junção fornecedor↔atividade (N:N) |
| `funcionario`           | `idfuncionario` (int) | Cadastro de funcionários        |
| `equipamento`           | `idequipamento` (int) | Cadastro de equipamentos (guindastes, caminhões) |
| `equipamento_conjunto`  | `idconjunto` (int)    | Componentes do equipamento      |

#### Tabelas Auxiliares / Lookup
| Tabela                  | PK                     | Descrição                        |
|-------------------------|------------------------|----------------------------------|
| `pais`                  | `idpais` (varchar)     | Países (ex: "BRA")              |
| `estados`               | `idestado` (varchar)   | Estados/UFs (ex: "SP")          |
| `cidade`                | `idcidade` (int)       | Cidades com DDD e código IBGE   |
| `bairro`                | `idbairro` (int)       | Bairros vinculados a cidade     |
| `cargo`                 | `idcargo` (int)        | Cargos dos funcionários          |
| `forma_contato`         | `idformacontato` (int) | Tipos de contato (Tel, Email...) |
| `forma_pagamento`       | `idformapgto` (int)    | Formas de pagamento              |
| `fornecedor_ramo`       | `idramo` (int)         | Ramos de atuação dos fornecedores |
| `fornecedor_atividade`  | `idatividade` (int)    | Atividades dos fornecedores      |
| `tipo_equipamento`      | `idtipoequipamento` (int) | Tipos de equipamento          |
| `tipos_servicos`        | `idservico` (int)      | Tipos de serviço                 |
| `servicos`              | `nome` (varchar)       | Serviços oferecidos              |
| `texto_padrao`          | `idtexto` (int)        | Textos padrão para orçamentos    |
| `fluxo_financeiro`      | `idfluxo` (varchar)    | Plano de contas hierárquico      |

#### Tabelas Operacionais/Financeiras (parcialmente implementadas no frontend)
| Tabela             | PK                    | Descrição                          |
|--------------------|-----------------------|------------------------------------|
| `descontos`        | `iddesconto` (int)    | Descontos dos funcionarios         |
| `orcamento`        | `idorcamento` (int)   | Orçamentos para clientes           |
| `orcamento_item`   | `idorcamento+idequipamento+idservico` | Itens do orçamento  |
| `compras`          | `idcompras` (int)     | Compras (vinculadas a fornecedor)  |
| `compra_itens`     | `idcompras+idproduto` | Itens da compra                    |
| `contas_pagar`     | `idcontaspagar` (int) | Parcelas de contas a pagar         |
| `contas_receber`   | `idcontasreceber` (int)| Parcelas de contas a receber       |
| `nota_fiscal`      | `idnota` (int)        | Notas fiscais de serviço           |
| `nota_fiscal_servico`| `idnota+sequencial+idservico+idempresa`       | Servicos das notas fiscais de serviço           |
| `conhecimento`     | `idconhecimento` (int)| CT-e (conhecimento de transporte)  |
| `licenca`          | `idlicenca` (int)     | Licenças de transporte especial    |
| `seguros`          | `idseguro` (int)      | Apólices de seguro                 |
| `pagamentos_cp`    | PK composta           | Pagamentos associados a contas a pagar |
| `pagamentos_cr`    | PK composta           | Pagamentos associados a contas a receber |

#### Tabelas de Sistema (Admin)
| Tabela                      | PK                | Descrição                     |
|-----------------------------|--------------------|------------------------------ |
| `perm_usuarios`             | `usr_codigo` (int) | Usuários do sistema           |
| `perm_programas`            | `prg_codigo` (int) | Programas/Módulos             |
| `perm_usuarios_programas`   | Composta           | Acesso do usuário ao programa |

## 4. API REST — Endpoints

### 4.1 Padrão de Endpoints

Todos os routers seguem o padrão CRUD:

| Método    | Rota                   | Descrição                |
|-----------|------------------------|--------------------------|
| `GET`     | `/{entidade}`          | Listar todos             |
| `GET`     | `/{entidade}/{id}`     | Buscar por ID            |
| `POST`    | `/{entidade}`          | Criar novo               |
| `PUT`     | `/{entidade}/{id}`     | Atualizar existente      |
| `DELETE`  | `/{entidade}/{id}`     | Excluir (com IntegrityError handling) |

## 5. Padrões de Código e Convenções

### 5.1 Backend (Python)

#### Padrão de Router
Todo router segue este template:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
import models, schemas
from database import get_db

router = APIRouter(prefix="/entidades", tags=["entidades"])

@router.get("", response_model=List[schemas.Entidade])
def get_all(db: Session = Depends(get_db)):
    return db.query(models.Entidade).order_by(models.Entidade.nome.asc()).all()

@router.post("", response_model=schemas.Entidade)
def create(item: schemas.EntidadeCreate, db: Session = Depends(get_db)):
    db_item = models.Entidade(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{id}", response_model=schemas.Entidade)
def update(id: int, item: schemas.EntidadeCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.Entidade).filter(models.Entidade.pk == id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Não encontrado")
    for key, value in item.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{id}")
def delete(id: int, db: Session = Depends(get_db)):
    db_item = db.query(models.Entidade).filter(models.Entidade.pk == id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Não encontrado")
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Registro vinculado a outros dados.")
    return {"ok": True, "message": "Excluído com sucesso"}
```

#### Padrão de Model
Todos os models possuem uma `@property id` que retorna o valor da PK real:

```python
class Entidade(Base):
    __tablename__ = "tabela"
    identidade = Column(Integer, primary_key=True)
    ...
    @property
    def id(self):
        return self.identidade
```

#### Padrão de Schema (Pydantic)
Tripla de classes: `Base` → `Create` → `Response`:

```python
class EntidadeBase(BaseModel):
    campo: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class EntidadeCreate(EntidadeBase):
    pass  # herda tudo

class Entidade(EntidadeBase):
    identidade: int    # PK do banco
    id: int            # alias via @property do model
```

#### Routers Implementados (37)
`atividade_fornecedor`, `auxiliares`, `bairro`, `cargo`, `cep`, `cidade`, `cliente`, `compras`, `conhecimento`, `contas_receber`, `contaspagar`, `dashboard`, `empresa`, `equipamento`, `estado`, `fechamento`, `fluxo_financeiro`, `formacontato`, `formapagamento`, `fornecedor`, `fornecedor_ramo`, `funcionario`, `licenca`, `logradouro`, `nota_fiscal`, `orcamento`, `ordem`, `pais`, `produto`, `programas`, `seguro`, `servico`, `textopadrao`, `tipo_equipamento`, `tipo_servico`, `usuarios`, `usuarios_programas`

### 5.2 Frontend (React/TypeScript)

#### Padrão de Página (CRUD)
Cada módulo CRUD segue este padrão:

1. **Estados**: lista de entidades, formData, searchTerm, modais (view/edit/delete/validation)
2. **useEffect**: `fetchEntidades()` no mount
3. **fetchEntidades()**: `GET /api/{entidade}`, mapeia `id = String(pk)`
4. **handleSave()**: Valida campos, `POST` ou `PUT /api/{entidade}/{id}`
5. **handleConfirmDelete()**: `DELETE /api/{entidade}/{id}`
6. **UI**: Filtros + Tabela paginada + Modal de formulário

#### Convenção de IDs
- No backend, PKs são `int` ou `string` nativos.
- No frontend, muitos componentes trabalham com `id` como `string`.
- A conversão é feita no `fetchEntidades()` via `id: String(entidade.pkField)`.
- No `handleSave()`, o `id` é removido do payload antes do envio.

#### Tratamento de Foreign Keys (PADRÃO CRÍTICO)
Ao enviar campos de FK (`idcidade`, `idbairro`, `idestado`, `idcargo`, etc.):

```typescript
// ✅ PADRÃO CORRETO - função parseId
const parseId = (val: any): number | null => {
  if (!val || val === "" || val === 0 || val === "0") return null;
  return Number(val);
};

// Aplicado no cleanPayload antes de POST/PUT
const payload = {
  ...formData,
  idcidade: parseId(formData.idcidade),
  idbairro: parseId(formData.idbairro),
};
```

#### Páginas Implementadas (31 ✅ + 6 ⏳ Placeholder)
| Status | Página | Rota | Descrição |
|--------|--------|------|-----------|
| ✅ | Dashboard | `/` | Painel inicial |
| ✅ | Login | `/login` | Autenticação |
| ✅ | Orçamentos | `/budgets` | Gestão de orçamentos |
| ✅ | Ordens de Serviço | `/service-orders` | Gestão de OS |
| ✅ | Clientes | `/operations/customers` | Cadastro de clientes |
| ✅ | Funcionários | `/operations/employees` | Cadastro de funcionários |
| ✅ | Fornecedores | `/operations/suppliers` | Cadastro de fornecedores |
| ✅ | Equipamentos | `/operations/equipment` | Cadastro de equipamentos |
| ✅ | Licenças | `/operations/licenses` | Gestão de licenças |
| ✅ | Seguros | `/operations/insurance` | Gestão de apólices |
| ✅ | Produtos/Serviços | `/operations/products-services` | Cadastro de produtos e serviços |
| ✅ | Notas Fiscais | `/operations/invoices` | Gestão de notas fiscais |
| ✅ | Conhecimentos (CT-e) | `/operations/conhecimentos` | Conhecimentos de transporte |
| ✅ | Contas a Receber | `/finance/receivables` | Gestão de recebimentos |
| ✅ | Contas a Pagar | `/finance/payables` | Gestão de pagamentos |
| ✅ | Fechamento de OS | `/finance/os-closing` | Fechamento de ordens |
| ⏳ | Apólices de Seguro | `/finance/insurance` | Placeholder |
| ⏳ | Relatório: Contas a Pagar | `/reports/payables` | Placeholder |
| ⏳ | Relatório: Contas a Receber | `/reports/receivables` | Placeholder |
| ⏳ | Relatório: Fluxo de Caixa | `/reports/cash-flow` | Placeholder |
| ✅ | Relatório: Clientes | `/reports/clientes` | Listagem de clientes |
| ⏳ | Configurações Gerais | `/settings` | Placeholder |
| ✅ | Serviços Oferecidos | `/settings/offered-services` | Cadastro de serviços |
| ✅ | Tipos de Equipamento | `/settings/equipment-types` | Tipos de equipamento |
| ✅ | Formas de Contato | `/settings/contact-methods` | Tipos de contato |
| ✅ | Formas de Pagamento | `/settings/payment-methods` | Métodos de pagamento |
| ✅ | Ramos Fornecedor | `/settings/supplier-branches` | Ramos de atividade |
| ✅ | Atividades Fornecedor | `/settings/supplier-activities` | Atividades de fornecedores |
| ✅ | Cargos | `/settings/employee-roles` | Cargos de funcionários |
| ✅ | Tipos de Serviço | `/settings/service-types` | Tipos de serviços |
| ✅ | Template Orçamento | `/settings/budget-template` | Textos padrão |
| ✅ | Fluxo Financeiro | `/settings/cash-flow` | Plano de contas |
| ✅ | Localização | `/settings/localizacao` | Países, Estados, Cidades, Bairros |
| ✅ | Empresas | `/admin/companies` | Gestão de empresas |
| ✅ | Usuários | `/admin/users` | Gestão de usuários |
| ✅ | Programas | `/admin/programs` | Gestão de módulos |
| ⏳ | Permissões | `/admin/permissions` | Placeholder |

### 5.3 Componentes de UI (`frontend/components/ui/`)

#### Button
Variantes: `default` (vermelho #B21212), `outline`, `ghost`, `destructive`  
Tamanhos: `default`, `sm`, `lg`, `icon`

#### Input
Label + input com estilo slate/tailwind. Aceita `label`, `disabled`, e todos os props de `<input>`.

#### InputCurrency
Campo monetário formatado em BRL. Exibe valor formatado, envia número para o estado.

#### Modal
Backdrop escuro + card branco centralizado. Props: `isOpen`, `onClose`, `title`, `children`, `footer`, `className`.

#### DataGrid
Tabela paginada reutilizável com suporte a colunas configuráveis, busca e ordenação.

#### cn.ts
Utilitário de composição de classes Tailwind (wrapper de `clsx` + `tailwind-merge`).

### 5.4 Design System

- **Cor primária**: `#B21212` (vermelho escuro)
- **Sidebar**: `#111827` (slate escuro)
- **Backgrounds**: `#F8FAFC` (slate-50)
- **Cards**: brancos com `border-slate-100` e `shadow-sm`
- **Status badges**: `ATIVO` → verde, `INATIVO` → cinza
- **Typography**: Tailwind defaults (sans serif)
- **Espaçamento**: 8px grid (p-2, p-4, p-6, p-8)
- **Font**: uppercase tracking-wider/widest para labels e títulos

## 6. Status do Projeto (Atualizado Abril 2026)

### 6.1 Backend (FastAPI + Python)
- ✅ Configuração do ambiente (CORS, middleware)
- ✅ 37 routers CRUD implementados (inclui bairro, cep, cidade, estado, pais, logradouro, nota_fiscal, conhecimento)
- ✅ Modelos SQLAlchemy com mapeamento de PKs via `@property id`
- ✅ Schemas Pydantic com o padrão Base → Create → Response
- ✅ Integração com PostgreSQL (porta 5433)
- ✅ Tratamento de IntegrityError para relacionamentos
- ✅ Módulo de relatórios (`backend/reports/`) com base_report e cliente_report
- ✅ Utilitários compartilhados em `backend/util.py`
- ⏳ Testes unitários e de integração (`backend/tests/` criado, sem cobertura)
- ⏳ Validações avançadas em alguns endpoints

### 6.2 Frontend (React 19 + TypeScript + Vite)
- ✅ Estrutura de projeto com Vite 6.2
- ✅ Roteamento completo com React Router v7.13 (37 rotas)
- ✅ Layout base com Sidebar + Header + Content
- ✅ Componentes de UI (Button, Input, InputCurrency, Modal, DataGrid, cn.ts)
- ✅ AuthContext para gerenciamento de sessão
- ✅ 31 páginas implementadas (84% do roadmap)
- ✅ Tailwind CSS v4.1 com plugin Vite
- ✅ Motion (Framer Motion successor) para animações
- ✅ `frontend/types.ts` — tipos TypeScript compartilhados
- ⏳ 6 páginas Placeholder (Relatórios, Apólices, Configurações Gerais, Permissões)
- ⏳ Alertas/notificações globais melhorados
- ⏳ Testes com Vitest/React Testing Library

### 6.3 Banco de Dados (PostgreSQL)
- ✅ 51 tabelas criadas e mapeadas nos models
- ✅ Relacionamentos N:1 e N:N
- ✅ Dados migrados do sistema legado (40+ scripts de importação)
- ✅ FKs com suporte a NULL para campos opcionais
- ⏳ Índices de performance (em andamento)
- ⏳ Triggers para auditoria (planejado)

### 6.4 Roadmap Próximas Prioridades
1. **Abr-Mai**: Completar 6 páginas Placeholder (Relatórios, Apólices, Permissões)
2. **Mai**: Paginação robusta em tabelas grandes (cliente, ordem, notas)
3. **Mai-Jun**: Testes e validações em larga escala
4. **Jun**: Deploy em produção e otimizações de performance

## 7. Scripts Úteis

### Backend
```bash
npm run dev:backend  # Inicia uvicorn em 8005 com reload
```

### Frontend
```bash
npm install          # Instala dependências
npm run dev          # Inicia Vite em 3000 (host 0.0.0.0)
npm run build        # Build para produção
```

## 8. Notas Críticas e Alertas

### ⚠️ Padrões Críticos a Manter
1. **Foreign Keys sempre como `parseId()`** - Evita erros de vinculação
2. **Conversão de ID no fetch** - Sempre mapear PK nativa para `id: String(...)`
3. **IntegrityError handling** - Routers DELETE devem tratar constraint violations
4. **Model `@property id`** - Todos os models devem expor PKs como `id`
5. **CORS configurado** - Produção requer ajustes dos origins

### ⚠️ Problemas Conhecidos e Soluções
- **Conflito de portás**: Backend deve estar em 8005, Frontend em 3000
- **Ciclo de FK**: Verificar ordem de criação/atualização em cascatas
- **Estado frontend**: Alguns componentes podem perder sincronização com backend
- **Performance**: Tabelas grandes (ex: cliente, ordem) precisam de paginação otimizada

### ⚠️ Proximos Passos Recomendados
1. Implementar paginação robusta em tabelas grandes
2. Adicionar filtros avançados (busca por múltiplos campos, datas)
3. Implementar permissões granulares por usuário
4. Adicionar logs e auditoria de operações
5. Validar campo obrigatório vs. nullable no frontend

