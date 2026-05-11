"""
import_orcamento.py — Importa tabela 'orcamento' a partir de dump Progress 9.1E (.d)

Fonte: orcament.d
Colunas esperadas (na ordem do dump) — 19 campos:
  idorcamento, idcliente, nome, cnpj_cpf, contato, data, situacao,
  endereco, cidade, cep, forma_pagamento, local_servico, local_entrega,
  descricao, idfuncionario, total, idempresa, fone, email

FKs validadas (registro ignorado se FK não existe):
  idcliente    → cliente.idcliente       (opcional: NULL permitido)
  idfuncionario → funcionario.idfuncionario (opcional: NULL permitido)
  idempresa    → empresa.idempresa       (opcional: NULL permitido)

Uso:
    python import_orcamento.py
    python import_orcamento.py caminho/para/orcament.d
    python import_orcamento.py orcament.d --dry-run
"""

import os
import re
import sys
import argparse
from decimal import Decimal, InvalidOperation
from datetime import date
import psycopg2
from psycopg2.extras import execute_values

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:r0nN1E@localhost:5433/DECISIUM_LOPA"
)
FILE_ENCODING = "latin-1"
EXPECTED_COLS = 19

_TOKEN_RE = re.compile(r'"((?:[^"\\]|\\.)*)"|(\?)|(\S+)')


def parse_progress_line(line: str) -> list:
    tokens = []
    for m in _TOKEN_RE.finditer(line):
        quoted, null, bare = m.group(1), m.group(2), m.group(3)
        if null is not None:
            tokens.append(None)
        elif quoted is not None:
            tokens.append(quoted)
        else:
            tokens.append(bare)
    return tokens


def to_str(val) -> str | None:
    if val is None or val == "":
        return None
    return val


def to_int(val) -> int | None:
    if val is None or val == "" or val == "0":
        return None
    try:
        return int(val)
    except ValueError:
        return None


def to_int_zero(val) -> int | None:
    """Converte para int, preservando 0 como valor válido (para PKs)."""
    if val is None or val == "":
        return None
    try:
        return int(val)
    except ValueError:
        return None


def to_decimal(val) -> Decimal | None:
    if val is None or val == "" or val == "0":
        return None
    try:
        return Decimal(str(val).replace(",", "."))
    except InvalidOperation:
        return None


def to_date(val) -> date | None:
    if val is None or val == "":
        return None
    parts = val.split("/")
    if len(parts) != 3:
        return None
    try:
        day, month, year_str = int(parts[0]), int(parts[1]), int(parts[2])
        if year_str < 100:
            year = 2000 + year_str if year_str < 50 else 1900 + year_str
        else:
            year = year_str
        return date(year, month, day)
    except (ValueError, OverflowError):
        return None


def read_d_file(path: str) -> list[dict]:
    records = []
    skipped = 0

    with open(path, encoding=FILE_ENCODING, errors="replace") as f:
        raw_lines = f.readlines()

    # Mescla linhas com strings multiline (aspas não fechadas)
    merged: list[str] = []
    buf = ""
    for raw in raw_lines:
        line = raw.rstrip("\r\n")
        buf = (buf + " " + line.strip()) if buf else line
        if buf.count('"') % 2 == 0:
            merged.append(buf)
            buf = ""
    if buf:
        merged.append(buf)

    for lineno, raw in enumerate(merged, start=1):
        line = raw.strip()
        if not line or line == ".":
            continue

        tokens = parse_progress_line(line)

        if len(tokens) < EXPECTED_COLS:
            print(f"  [AVISO] Linha {lineno} ignorada "
                  f"({len(tokens)} campos, esperado {EXPECTED_COLS}): {raw.rstrip()[:80]}")
            skipped += 1
            continue

        (
            idorcamento, idcliente, nome, cnpj_cpf, contato,
            data_val, situacao, endereco, cidade, cep,
            forma_pagamento, local_servico, local_entrega, descricao,
            idfuncionario, total, idempresa, fone, email
        ) = tokens[:EXPECTED_COLS]

        if idorcamento is None:
            skipped += 1
            continue

        records.append({
            "idorcamento":    to_int_zero(idorcamento),
            "idcliente":      to_int(idcliente),
            "nome":           to_str(nome),
            "cnpj_cpf":       to_str(cnpj_cpf),
            "contato":        to_str(contato),
            "data":           to_date(data_val),
            "situacao":       to_str(situacao),
            "endereco":       to_str(endereco),
            "cidade":         to_str(cidade),
            "cep":            to_str(cep),
            "forma_pagamento": to_str(forma_pagamento),
            "local_servico":  to_str(local_servico),
            "local_entrega":  to_str(local_entrega),
            "descricao":      to_str(descricao),
            "idfuncionario":  to_int(idfuncionario),
            "total":          to_decimal(total),
            "idempresa":      to_int(idempresa),
            "fone":           to_str(fone),
            "email":          to_str(email),
        })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")

    return records


def get_valid_ids(conn) -> dict:
    """Retorna conjuntos de IDs válidos para cada FK."""
    with conn.cursor() as cur:
        cur.execute("SELECT idcliente FROM cliente")
        clientes = {row[0] for row in cur.fetchall()}
        cur.execute("SELECT idfuncionario FROM funcionario")
        funcionarios = {row[0] for row in cur.fetchall()}
        cur.execute("SELECT idempresa FROM empresa")
        empresas = {row[0] for row in cur.fetchall()}
    return {"clientes": clientes, "funcionarios": funcionarios, "empresas": empresas}


def filter_records(records: list[dict], valid_ids: dict) -> tuple[list[dict], int]:
    """Remove registros com FKs inválidas. Retorna (filtrados, qtd_ignorados)."""
    filtered = []
    ignored = 0
    for r in records:
        # FK idcliente: só valida se não for NULL
        if r["idcliente"] is not None and r["idcliente"] not in valid_ids["clientes"]:
            ignored += 1
            continue
        # FK idfuncionario: só valida se não for NULL
        if r["idfuncionario"] is not None and r["idfuncionario"] not in valid_ids["funcionarios"]:
            ignored += 1
            continue
        # FK idempresa: só valida se não for NULL
        if r["idempresa"] is not None and r["idempresa"] not in valid_ids["empresas"]:
            ignored += 1
            continue
        filtered.append(r)
    return filtered, ignored


UPSERT_SQL = """
    INSERT INTO orcamento (
        idorcamento, idcliente, nome, cnpj_cpf, contato, data, situacao,
        endereco, cidade, cep, forma_pagamento, local_servico, local_entrega,
        descricao, idfuncionario, total, idempresa, fone, email
    )
    VALUES %s
    ON CONFLICT (idorcamento) DO UPDATE SET
        idcliente      = EXCLUDED.idcliente,
        nome           = EXCLUDED.nome,
        cnpj_cpf       = EXCLUDED.cnpj_cpf,
        contato        = EXCLUDED.contato,
        data           = EXCLUDED.data,
        situacao       = EXCLUDED.situacao,
        endereco       = EXCLUDED.endereco,
        cidade         = EXCLUDED.cidade,
        cep            = EXCLUDED.cep,
        forma_pagamento = EXCLUDED.forma_pagamento,
        local_servico  = EXCLUDED.local_servico,
        local_entrega  = EXCLUDED.local_entrega,
        descricao      = EXCLUDED.descricao,
        idfuncionario  = EXCLUDED.idfuncionario,
        total          = EXCLUDED.total,
        idempresa      = EXCLUDED.idempresa,
        fone           = EXCLUDED.fone,
        email          = EXCLUDED.email
"""


def import_records(records: list[dict], dry_run: bool = False):
    if dry_run:
        print(f"\n[DRY-RUN] {len(records)} registro(s) seriam importados:")
        for r in records[:20]:
            print(f"  id={str(r['idorcamento']):>5}  cliente={str(r['idcliente']):>5}  "
                  f"nome={str(r['nome'])[:35]:<35}  total={r['total']}")
        if len(records) > 20:
            print(f"  ... e mais {len(records) - 20} registro(s).")
        return

    conn = psycopg2.connect(DB_URL)
    try:
        with conn:
            valid_ids = get_valid_ids(conn)
            filtered, ignored = filter_records(records, valid_ids)
            if ignored:
                print(f"  {ignored} registro(s) ignorados (FK não existe).")
            if not filtered:
                print("  Nenhum registro válido para importar.")
                return
            values = [
                (
                    r["idorcamento"], r["idcliente"], r["nome"], r["cnpj_cpf"],
                    r["contato"], r["data"], r["situacao"], r["endereco"],
                    r["cidade"], r["cep"], r["forma_pagamento"], r["local_servico"],
                    r["local_entrega"], r["descricao"], r["idfuncionario"],
                    r["total"], r["idempresa"], r["fone"], r["email"],
                )
                for r in filtered
            ]
            with conn.cursor() as cur:
                execute_values(cur, UPSERT_SQL, values)
                print(f"  {cur.rowcount} linha(s) afetadas no banco "
                      f"(INSERT + UPDATE via ON CONFLICT).")
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Importa orcament.d (Progress 9.1E) → PostgreSQL (upsert por idorcamento)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "orcament.d"),
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    path = os.path.abspath(args.arquivo)
    if not os.path.exists(path):
        print(f"[ERRO] Arquivo não encontrado: {path}")
        sys.exit(1)

    print(f"Arquivo  : {path}")
    print(f"Banco    : {DB_URL.split('@')[-1]}")
    print(f"Modo     : {'DRY-RUN' if args.dry_run else 'IMPORTAÇÃO (upsert)'}")
    print("-" * 60)
    print("Lendo arquivo...")
    records = read_d_file(path)
    print(f"  {len(records)} registro(s) lidos.")
    if not records:
        print("Nenhum registro para importar.")
        sys.exit(0)
    print("Importando...")
    import_records(records, dry_run=args.dry_run)
    print("-" * 60)
    print("Concluído.")


if __name__ == "__main__":
    main()
