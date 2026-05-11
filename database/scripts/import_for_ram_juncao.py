"""
import_for_ram_juncao.py — Importa junção fornecedor↔ramo a partir de dump Progress 9.1E (.d)

Fonte: for_ram.d
Formato: idfornecedor idramo (2 campos por linha)
Destino: tabela 'for_ramo' (serial PK idforramo, idfornecedor, idramo)

Nota: ON CONFLICT (idfornecedor, idramo) DO NOTHING.
      Constraint UNIQUE criada automaticamente se não existir.

Uso:
    python import_for_ram_juncao.py
    python import_for_ram_juncao.py caminho/para/for_ram.d
    python import_for_ram_juncao.py for_ram.d --dry-run
"""

import os
import re
import sys
import argparse
import psycopg2
from psycopg2.extras import execute_values

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:r0nN1E@localhost:5433/DECISIUM_LOPA"
)
FILE_ENCODING = "latin-1"
EXPECTED_COLS = 2

_TOKEN_RE = re.compile(r'"((?:[^"\\]|\\.)*)"|(\?)|(\S+)')


def parse_progress_line(line):
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


def to_int(val):
    if val is None or val == "" or val == "0":
        return None
    try:
        return int(val)
    except ValueError:
        return None


def ensure_unique_constraint(conn):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'for_ramo'
              AND constraint_name = 'uq_for_ramo_fornecedor_ramo'
        """)
        if not cur.fetchone():
            cur.execute("""
                ALTER TABLE for_ramo
                ADD CONSTRAINT uq_for_ramo_fornecedor_ramo
                UNIQUE (idfornecedor, idramo)
            """)
            print("  Constraint UNIQUE criada em for_ramo(idfornecedor, idramo).")


def read_d_file(path):
    records = []
    skipped = 0
    with open(path, encoding=FILE_ENCODING, errors="replace") as f:
        for lineno, raw in enumerate(f, start=1):
            line = raw.strip()
            if not line or line == ".":
                continue
            tokens = parse_progress_line(line)
            if len(tokens) < EXPECTED_COLS:
                print(f"  [AVISO] Linha {lineno} ignorada ({len(tokens)} campos): {raw.rstrip()}")
                skipped += 1
                continue
            forn = to_int(tokens[0])
            ramo = to_int(tokens[1])
            if forn is None or ramo is None:
                skipped += 1
                continue
            records.append({"idfornecedor": forn, "idramo": ramo})
    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")
    return records


UPSERT_SQL = """
    INSERT INTO for_ramo (idfornecedor, idramo)
    VALUES %s
    ON CONFLICT (idfornecedor, idramo) DO NOTHING
"""


def get_valid_fornecedores(conn) -> set:
    with conn.cursor() as cur:
        cur.execute("SELECT idfornecedor FROM fornecedor")
        return {row[0] for row in cur.fetchall()}


def import_records(records, dry_run=False):
    seen = set()
    deduped = []
    for r in records:
        key = (r["idfornecedor"], r["idramo"])
        if key not in seen:
            seen.add(key)
            deduped.append(r)
    if len(deduped) < len(records):
        print(f"  {len(records) - len(deduped)} duplicata(s) removida(s).")

    if dry_run:
        values = [(r["idfornecedor"], r["idramo"]) for r in deduped]
        print(f"\n[DRY-RUN] {len(values)} par(es) seriam importados:")
        for v in values[:20]:
            print(f"  idfornecedor={v[0]:>5}  idramo={v[1]:>5}")
        if len(values) > 20:
            print(f"  ... e mais {len(values) - 20} registro(s).")
        return

    conn = psycopg2.connect(DB_URL)
    try:
        with conn:
            valid_ids = get_valid_fornecedores(conn)
            filtered = [r for r in deduped if r["idfornecedor"] in valid_ids]
            ignorados = len(deduped) - len(filtered)
            if ignorados:
                print(f"  {ignorados} registro(s) ignorados (idfornecedor não existe na tabela fornecedor).")
            if not filtered:
                print("  Nenhum registro válido para importar.")
                return
            ensure_unique_constraint(conn)
            values = [(r["idfornecedor"], r["idramo"]) for r in filtered]
            with conn.cursor() as cur:
                execute_values(cur, UPSERT_SQL, values)
                print(f"  {cur.rowcount} linha(s) inseridas no banco.")
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Importa for_ram.d (Progress 9.1E) → PostgreSQL for_ramo (junção)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "for_ram.d"),
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
