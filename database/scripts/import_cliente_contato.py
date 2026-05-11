"""
import_cliente_contato.py — Importa tabela 'cliente_contato' a partir de dump Progress 9.1E (.d)

Fonte: cliente_.d
Colunas esperadas (na ordem do dump) — 9 campos:
  idclienteforma, idcliente, idformacontato, valor, observacao,
  idfuncionario, idfornecedor, zap, aniversario

Uso:
    python import_cliente_contato.py
    python import_cliente_contato.py caminho/para/cliente_.d
    python import_cliente_contato.py cliente_.d --dry-run
"""

import os
import re
import sys
import argparse
from datetime import date
import psycopg2
from psycopg2.extras import execute_values

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:r0nN1E@localhost:5433/DECISIUM_LOPA"
)
FILE_ENCODING = "latin-1"
EXPECTED_COLS = 9

_TOKEN_RE = re.compile(r'"((?:[^"\\]|\\.)*)"|(\?)|(\S+)')


def parse_progress_line(line: str) -> list[str | None]:
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


def to_str(val: str | None) -> str | None:
    if val is None or val == "":
        return None
    return val


def to_int(val: str | None) -> int | None:
    if val is None or val == "" or val == "0":
        return None
    try:
        return int(val)
    except ValueError:
        return None


def to_int_zero(val: str | None) -> int | None:
    if val is None or val == "":
        return None
    try:
        return int(val)
    except ValueError:
        return None


def to_date(val: str | None) -> date | None:
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
            idclienteforma, idcliente, idformacontato, valor, observacao,
            idfuncionario, idfornecedor, zap, aniversario
        ) = tokens[:EXPECTED_COLS]

        if not idclienteforma:
            print(f"  [AVISO] Linha {lineno} ignorada (idclienteforma vazio): {raw.rstrip()[:80]}")
            skipped += 1
            continue

        records.append({
            "idclienteforma": int(idclienteforma),
            "idcliente":      to_int(idcliente),
            "idformacontato": to_int_zero(idformacontato),
            "valor":          to_str(valor),
            "observacao":     to_str(observacao),
            "idfuncionario":  to_int(idfuncionario),
            "idfornecedor":   to_int(idfornecedor),
            "zap":            to_str(zap),
            "aniversario":    to_date(aniversario),
        })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")

    return records


UPSERT_SQL = """
    INSERT INTO cliente_contato (
        idclienteforma, idcliente, idformacontato, valor, observacao,
        idfuncionario, idfornecedor, zap, aniversario
    )
    VALUES %s
    ON CONFLICT (idclienteforma) DO UPDATE SET
        idcliente      = EXCLUDED.idcliente,
        idformacontato = EXCLUDED.idformacontato,
        valor          = EXCLUDED.valor,
        observacao     = EXCLUDED.observacao,
        idfuncionario  = EXCLUDED.idfuncionario,
        idfornecedor   = EXCLUDED.idfornecedor,
        zap            = EXCLUDED.zap,
        aniversario    = EXCLUDED.aniversario
"""


def get_valid_clientes(conn) -> set:
    with conn.cursor() as cur:
        cur.execute("SELECT idcliente FROM cliente")
        return {row[0] for row in cur.fetchall()}


def import_records(records: list[dict], dry_run: bool = False):
    if dry_run:
        values = [
            (
                r["idclienteforma"], r["idcliente"], r["idformacontato"],
                r["valor"], r["observacao"], r["idfuncionario"],
                r["idfornecedor"], r["zap"], r["aniversario"],
            )
            for r in records
        ]
        print(f"\n[DRY-RUN] {len(values)} registro(s) seriam importados:")
        for v in values[:20]:
            print(f"  id={v[0]:>5}  cliente={str(v[1]):>5}  forma={str(v[2]):>3}  valor={str(v[3])[:30]}")
        if len(values) > 20:
            print(f"  ... e mais {len(values) - 20} registro(s).")
        return

    conn = psycopg2.connect(DB_URL)
    try:
        with conn:
            valid_ids = get_valid_clientes(conn)
            filtered = [r for r in records if r["idcliente"] in valid_ids]
            ignorados = len(records) - len(filtered)
            if ignorados:
                print(f"  {ignorados} registro(s) ignorados (idcliente não existe na tabela cliente).")
            if not filtered:
                print("  Nenhum registro válido para importar.")
                return
            values = [
                (
                    r["idclienteforma"], r["idcliente"], r["idformacontato"],
                    r["valor"], r["observacao"], r["idfuncionario"],
                    r["idfornecedor"], r["zap"], r["aniversario"],
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
        description="Importa cliente_.d (Progress 9.1E) → PostgreSQL (upsert por idclienteforma)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "cliente_.d"),
        help="Caminho para o arquivo .d (padrão: EXTRACAO/cliente_.d)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Exibe os dados sem gravar no banco")
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
