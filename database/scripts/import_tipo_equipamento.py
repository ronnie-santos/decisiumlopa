"""
import_tipo_equipamento.py — Importa tabela 'tipo_equipamento' a partir de dump Progress 9.1E (.d)

Colunas esperadas (na ordem do dump):
  idtipoequipamento, nome

Uso:
    python import_tipo_equipamento.py
    python import_tipo_equipamento.py caminho/para/tipo_equ.d
    python import_tipo_equipamento.py tipo_equ.d --dry-run
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
        for lineno, raw in enumerate(f, start=1):
            line = raw.strip()
            if not line or line == ".":
                continue

            tokens = parse_progress_line(line)

            if len(tokens) < EXPECTED_COLS:
                print(f"  [AVISO] Linha {lineno} ignorada "
                      f"({len(tokens)} campos, esperado {EXPECTED_COLS}): {raw.rstrip()}")
                skipped += 1
                continue

            idtipoequipamento, nome = tokens[:EXPECTED_COLS]

            if not idtipoequipamento:
                print(f"  [AVISO] Linha {lineno} ignorada (idtipoequipamento vazio): {raw.rstrip()}")
                skipped += 1
                continue

            records.append({
                "idtipoequipamento": int(idtipoequipamento),
                "nome":              to_str(nome),
            })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")

    return records


UPSERT_SQL = """
    INSERT INTO tipo_equipamento (idtipoequipamento, nome)
    VALUES %s
    ON CONFLICT (idtipoequipamento) DO UPDATE SET
        nome = EXCLUDED.nome
"""


def import_records(records: list[dict], dry_run: bool = False):
    values = [(r["idtipoequipamento"], r["nome"]) for r in records]

    if dry_run:
        print(f"\n[DRY-RUN] {len(values)} registro(s) seriam importados:")
        for v in values[:20]:
            print(f"  idtipoequipamento={v[0]:>4}  nome={str(v[1])[:60]}")
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
        description="Importa tipo_equ.d (Progress 9.1E) → PostgreSQL (upsert por idtipoequipamento)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "tipo_equ.d"),
        help="Caminho para o arquivo .d (padrão: EXTRACAO/tipo_equ.d na mesma pasta do script)",
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
