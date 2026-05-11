"""
Migration: Sistema RBAC
Substitui perm_programas / perm_usuarios / perm_usuarios_programas
pelas tabelas: perfil / modulo / permissao / usuario

Execucao:
    cd backend
    python migrations/migrate_rbac.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2
import bcrypt

DB = dict(
    dbname="DECISIUM_LOPA",
    user="postgres",
    password="r0nN1E",
    host="localhost",
    port=5433,
)


def hash_senha(senha: str) -> str:
    return bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def run():
    conn = psycopg2.connect(**DB)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        print("=== Migration RBAC ===\n")

        # 1. Dropar tabelas antigas
        print("[1] Dropando tabelas antigas...")
        cur.execute("DROP TABLE IF EXISTS perm_usuarios_programas CASCADE;")
        cur.execute("DROP TABLE IF EXISTS perm_usuarios CASCADE;")
        cur.execute("DROP TABLE IF EXISTS perm_programas CASCADE;")
        print("    OK - perm_usuarios_programas, perm_usuarios, perm_programas removidas\n")

        # 2. Criar tabela perfil
        print("[2] Criando tabela 'perfil'...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS perfil (
                idperfil  SERIAL PRIMARY KEY,
                nome      VARCHAR(50)  NOT NULL UNIQUE,
                descricao VARCHAR(200),
                ativo     BOOLEAN      NOT NULL DEFAULT TRUE,
                criado_em TIMESTAMP    NOT NULL DEFAULT NOW()
            );
        """)
        print("    OK - perfil\n")

        # 3. Criar tabela modulo
        print("[3] Criando tabela 'modulo'...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS modulo (
                idmodulo  SERIAL PRIMARY KEY,
                nome      VARCHAR(100) NOT NULL,
                codigo    VARCHAR(60)  NOT NULL UNIQUE,
                descricao VARCHAR(200),
                ativo     BOOLEAN      NOT NULL DEFAULT TRUE
            );
        """)
        print("    OK - modulo\n")

        # 4. Criar tabela permissao
        print("[4] Criando tabela 'permissao'...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS permissao (
                idpermissao   SERIAL PRIMARY KEY,
                idperfil      INTEGER NOT NULL REFERENCES perfil(idperfil) ON DELETE CASCADE,
                idmodulo      INTEGER NOT NULL REFERENCES modulo(idmodulo) ON DELETE CASCADE,
                pode_ler      BOOLEAN NOT NULL DEFAULT FALSE,
                pode_criar    BOOLEAN NOT NULL DEFAULT FALSE,
                pode_editar   BOOLEAN NOT NULL DEFAULT FALSE,
                pode_excluir  BOOLEAN NOT NULL DEFAULT FALSE,
                pode_exportar BOOLEAN NOT NULL DEFAULT FALSE,
                UNIQUE (idperfil, idmodulo)
            );
        """)
        print("    OK - permissao\n")

        # 5. Criar tabela usuario
        print("[5] Criando tabela 'usuario'...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS usuario (
                idusuario     SERIAL PRIMARY KEY,
                nome          VARCHAR(100) NOT NULL,
                username      VARCHAR(50)  NOT NULL UNIQUE,
                senha_hash    VARCHAR(200) NOT NULL,
                idperfil      INTEGER REFERENCES perfil(idperfil) ON DELETE SET NULL,
                ativo         BOOLEAN      NOT NULL DEFAULT TRUE,
                ultimo_acesso TIMESTAMP
            );
        """)
        print("    OK - usuario\n")

        # 6. Seed: Perfis
        print("[6] Inserindo perfis iniciais...")
        perfis = [
            ("Administrador", "Acesso total ao sistema"),
            ("Operador",      "Acesso operacional (sem admin)"),
            ("Visualizador",  "Somente leitura"),
        ]
        for nome, desc in perfis:
            cur.execute(
                "INSERT INTO perfil (nome, descricao) VALUES (%s, %s) ON CONFLICT (nome) DO NOTHING;",
                (nome, desc),
            )
        print("    OK - Administrador, Operador, Visualizador\n")

        # 7. Seed: Modulos (todos os itens de menu)
        print("[7] Inserindo modulos (itens de menu)...")
        modulos = [
            # (codigo,                    nome,                              descricao)
            # Nav principal
            ("dashboard",                "Dashboard",                       "Painel principal"),
            ("orcamentos",               "Orcamentos",                      "Gestao de orcamentos"),
            ("ordens_servico",           "Ordem de Servico",                "Gestao de ordens de servico"),
            ("faturamento",              "Faturamento",                     "Fechamento e faturamento de OS"),
            ("contas_receber",           "Contas a Receber",                "Parcelas a receber"),
            ("compras",                  "Compras",                         "Gestao de compras"),
            ("contas_pagar",             "Contas a Pagar",                  "Parcelas a pagar"),
            # Operacao
            ("clientes",                 "Clientes",                        "Cadastro de clientes"),
            ("fornecedores",             "Fornecedores",                    "Cadastro de fornecedores"),
            ("nota_fiscal",              "Nota Fiscal",                     "Emissao de notas fiscais"),
            ("conhecimento",             "Conhecimento CT-e",               "Conhecimentos de transporte"),
            ("licencas",                 "Licencas",                        "Licencas de transporte"),
            ("seguros",                  "Seguros",                         "Apolices de seguro"),
            # Relatorios
            ("rel_clientes",             "Relatorio: Clientes",             "Listagem de clientes"),
            ("rel_ordens",               "Relatorio: Ordens de Servico",    "Relatorio de OS"),
            ("rel_contas_pagar",         "Relatorio: Contas a Pagar",       "Relatorio de pagamentos"),
            ("rel_contas_receber",       "Relatorio: Contas a Receber",     "Relatorio de recebimentos"),
            ("rel_compras_produtos",     "Relatorio: Compras e Produtos",   "Relatorio de compras"),
            ("rel_fluxo_caixa",          "Relatorio: Fluxo de Caixa",       "Relatorio de fluxo de caixa"),
            ("rel_comissao",             "Relatorio: Comissao",             "Relatorio de comissoes"),
            ("rel_dre",                  "Relatorio: DRE",                  "Demonstracao de Resultado"),
            ("rel_analise_financeira",   "Relatorio: Analise Financeira",   "Analise financeira"),
            # Configuracoes
            ("equipamentos",             "Equipamentos",                    "Cadastro de equipamentos"),
            ("funcionarios",             "Funcionarios",                    "Cadastro de funcionarios"),
            ("produtos_servicos",        "Produtos e Servicos",             "Catalogo de produtos"),
            ("servicos_oferecidos",      "Servicos Oferecidos",             "Tipos de servicos prestados"),
            ("tipos_equipamentos",       "Tipos de Equipamentos",           "Classificacao de equipamentos"),
            ("formas_contato",           "Formas de Contato",               "Tipos de contato"),
            ("formas_pagamento",         "Formas de Pagamento",             "Metodos de pagamento"),
            ("ramos_fornecedor",         "Ramos dos Fornecedores",          "Ramos de atuacao"),
            ("atividades_fornecedor",    "Atividades dos Fornecedores",     "Atividades de fornecedores"),
            ("cargos",                   "Cargos dos Funcionarios",         "Cargos e funcoes"),
            ("tipos_servicos",           "Tipos de Servicos",               "Classificacao de servicos"),
            ("texto_padrao",             "Texto Padrao",                    "Templates de orcamento"),
            ("clausulas_orcamento",      "Clausulas de Orcamento",          "Clausulas contratuais"),
            ("fluxo_financeiro",         "Fluxo Financeiro",                "Plano de contas"),
            ("localizacao",              "Paises / Estados / Cidades",      "Tabelas de localizacao"),
            # Admin
            ("empresas",                 "Empresas",                        "Cadastro de empresas"),
            ("admin_usuarios",           "Usuarios",                        "Gestao de usuarios do sistema"),
            ("admin_perfis",             "Perfis e Permissoes",             "Gestao de perfis e permissoes"),
            ("admin_modulos",            "Modulos",                         "Catalogo de modulos"),
        ]
        for codigo, nome, desc in modulos:
            cur.execute(
                "INSERT INTO modulo (codigo, nome, descricao) VALUES (%s, %s, %s) ON CONFLICT (codigo) DO NOTHING;",
                (codigo, nome, desc),
            )
        print(f"    OK - {len(modulos)} modulos inseridos\n")

        # 8. Permissao total para Administrador
        print("[8] Concedendo permissao total ao perfil Administrador...")
        cur.execute("SELECT idperfil FROM perfil WHERE nome = 'Administrador';")
        row = cur.fetchone()
        if row:
            idperfil_admin = row[0]
            cur.execute("SELECT idmodulo FROM modulo;")
            mod_ids = [r[0] for r in cur.fetchall()]
            for idmodulo in mod_ids:
                cur.execute("""
                    INSERT INTO permissao
                        (idperfil, idmodulo, pode_ler, pode_criar, pode_editar, pode_excluir, pode_exportar)
                    VALUES (%s, %s, TRUE, TRUE, TRUE, TRUE, TRUE)
                    ON CONFLICT (idperfil, idmodulo) DO NOTHING;
                """, (idperfil_admin, idmodulo))
            print(f"    OK - {len(mod_ids)} permissoes criadas para Administrador\n")

        # 9. Usuario admin inicial
        print("[9] Criando usuario admin inicial...")
        cur.execute("SELECT idperfil FROM perfil WHERE nome = 'Administrador';")
        row = cur.fetchone()
        if row:
            idperfil_admin = row[0]
            senha_hash = hash_senha("admin123")
            cur.execute("""
                INSERT INTO usuario (nome, username, senha_hash, idperfil, ativo)
                VALUES ('Administrador', 'admin', %s, %s, TRUE)
                ON CONFLICT (username) DO NOTHING;
            """, (senha_hash, idperfil_admin))
            print("    OK - usuario 'admin' criado (senha: admin123)\n")

        conn.commit()
        print("=== Migration concluida com sucesso! ===")

    except Exception as e:
        conn.rollback()
        print(f"\n[ERRO] {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    run()
