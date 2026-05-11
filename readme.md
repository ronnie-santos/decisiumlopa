# Decisium Lopa

ERP web corporativo desenvolvido para a empresa **Lopa Guindastes e Transportes Ltda**, especializada em logística, guindastes e transportes especiais.

O sistema foi projetado para substituir um sistema legado desktop por uma arquitetura moderna baseada em tecnologias web, mantendo integração total com a base PostgreSQL existente.

---

# Visão Geral

O projeto contempla:

- Gestão de clientes
- Gestão de fornecedores
- Gestão de funcionários
- Gestão de equipamentos
- Ordens de serviço
- Orçamentos
- Contas a pagar
- Contas a receber
- Fluxo financeiro
- Notas fiscais
- Licenças e seguros
- Controle administrativo e permissões

---

# Stack Tecnológica

## Frontend
- React 19
- TypeScript
- Vite 6
- Tailwind CSS v4
- React Router DOM
- Motion
- Lucide React

## Backend
- Python
- FastAPI
- SQLAlchemy
- Pydantic v2

## Banco de Dados
- PostgreSQL 14+

---

# Arquitetura do Projeto

```text
LOPA/
├── backend/
├── database/
├── docs/
├── frontend/
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

# Estrutura do Sistema

## Backend
- API REST FastAPI
- 37 routers CRUD
- SQLAlchemy ORM
- Relatórios
- Integração PostgreSQL

## Frontend
- React + TypeScript
- Layout responsivo
- Sistema modular
- Componentes reutilizáveis
- Dashboard operacional e financeiro

---

# Banco de Dados

O sistema utiliza PostgreSQL com estrutura legada migrada.

## Configuração padrão

```env
DATABASE_URL=postgresql://postgres:SENHA@localhost:5433/DECISIUM_LOPA
```

## Porta PostgreSQL
```text
5433
```

---

# Execução do Projeto

## Backend

```bash
cd backend

pip install -r requirements.txt

uvicorn main:app --reload --port 8005
```

---

## Frontend

```bash
npm install

npm run dev
```

---

# Portas Utilizadas

| Serviço | Porta |
|---|---|
| Frontend | 3000 |
| Backend | 8005 |
| PostgreSQL | 5433 |

---

# Funcionalidades Implementadas

- Dashboard
- Clientes
- Funcionários
- Fornecedores
- Equipamentos
- Licenças
- Seguros
- Produtos e Serviços
- Notas Fiscais
- Conhecimentos (CT-e)
- Contas a Pagar
- Contas a Receber
- Fluxo Financeiro
- Empresas
- Usuários
- Programas
- Localização
- Serviços Oferecidos

---

# Status do Projeto

## Backend
- CRUDs implementados
- Integração PostgreSQL
- Relatórios
- Estrutura modular

## Frontend
- Estrutura React completa
- 31 páginas implementadas
- Layout responsivo
- Componentes reutilizáveis

## Próximos Passos
- Paginação avançada
- Permissões granulares
- Logs e auditoria
- Testes automatizados
- Deploy produção

---

# Padrões Importantes

## Foreign Keys
Sempre utilizar tratamento via `parseId()` no frontend para evitar inconsistências de FK.

## Tratamento de Exclusão
Todos os DELETEs devem tratar `IntegrityError`.

## Conversão de IDs
Frontend trabalha com `id` em string para padronização.

---

# Segurança

O projeto utiliza:

- Controle de permissões
- Estrutura modular
- Separação frontend/backend
- Tratamento de integridade relacional

---

# Documentação Técnica

A documentação completa do projeto está disponível em:

```text
CLAUDE.md
```

---

# Ambiente de Desenvolvimento

## Requisitos

- Node.js 20+
- Python 3.11+
- PostgreSQL 14+
- Git

---

# Deploy

Ambiente alvo:

- Ubuntu Server 26.04 LTS
- PostgreSQL
- Python FastAPI
- React/Vite
- Nginx (planejado)

---

# Autor

Projeto desenvolvido para:

**Lopa Guindastes e Transportes Ltda**

---

# Licença

Projeto privado e proprietário.