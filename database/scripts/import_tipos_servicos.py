"""
import_tipos_servicos.py — Importa tabela 'tipos_servicos' a partir de dump Progress 9.1E (.d)

Colunas esperadas (na ordem do dump):
  idservico, descricao

Uso:
    python import_tipos_servicos.py
    python import_tipos_servicos.py caminho/para/tipos_se.d
    python import_tipos_servicos.py tipos_se.d --dry-run
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


def read_d_file(path: str) -> list[dict]:
    records = []
    skipped = 0

    with open(path, encoding=FILE_ENCODING, errors="replace") as f:
        raw_lines = f.readlines()

    # Mescla linhas com aspas não fechadas (textos multiline do Progress)
    merged: list[str] = []
    buf = ""
    for raw in raw_lines:
        line = raw.rstrip("\r\n")
        if buf:
            buf += " " + line.strip()
        else:
            buf = line
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
                  f"({len(tokens)} campos, esperado {EXPECTED_COLS}): {raw.rstrip()}")
            skipped += 1
            continue

        idservico, descricao = tokens[:EXPECTED_COLS]

        if not idservico:
            print(f"  [AVISO] Linha {lineno} ignorada (idservico vazio): {raw.rstrip()}")
            skipped += 1
            continue

        records.append({
            "idservico": int(idservico),
            "descricao": to_str(descricao),
        })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")

    return records


UPSERT_SQL = """
    INSERT INTO tipos_servicos (idservico, descricao)
    VALUES %s
    ON CONFLICT (idservico) DO UPDATE SET
        descricao = EXCLUDED.descricao
"""


def import_records(records: list[dict], dry_run: bool = False):
    values = [(r["idservico"], r["descricao"]) for r in records]

    if dry_run:
        print(f"\n[DRY-RUN] {len(values)} registro(s) seriam importados:")
        for v in values[:20]:
            print(f"  idservico={v[0]:>4}  descricao={str(v[1])[:60]}")
        if len(values) > 20:
            print(f"  ... e mais {len(values) - 20} registro(s).")
        return

    conn = psycopg2.connect(DB_URL)
    try:
        with conn:
            with conn.cursor() as cur:
                execute_values(cur, UPSERT_SQL, values)
                print(f"  {cur.rowcount} linha(s) afetadas no banco "
                      f"(INSERT + UPDATE via ON CONFLICT).")
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Importa tipos_se.d (Progress 9.1E) → PostgreSQL (upsert por idservico)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "tipos_se.d"),
        help="Caminho para o arquivo .d (padrão: EXTRACAO/tipos_se.d na mesma pasta do script)",
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
