"""
import_forma_pagamento.py — Importa tabela 'forma_pagamento' a partir de dump Progress 9.1E (.d)

Colunas esperadas (na ordem do dump):
  idformapgto, nome, cor_fundo, cor_fonte

Uso:
    python import_forma_pagamento.py
    python import_forma_pagamento.py caminho/para/forma_pa.d
    python import_forma_pagamento.py forma_pa.d --dry-run
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
EXPECTED_COLS = 4

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
    if val is None or val == "":
        return None
    try:
        return int(val)
    except ValueError:
        return None


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

            idformapgto, nome, cor_fundo, cor_fonte = tokens[:EXPECTED_COLS]

            if not idformapgto:
                print(f"  [AVISO] Linha {lineno} ignorada (idformapgto vazio): {raw.rstrip()}")
                skipped += 1
                continue

            records.append({
                "idformapgto": int(idformapgto),
                "nome":        to_str(nome),
                "cor_fundo":   to_int(cor_fundo),
                "cor_fonte":   to_int(cor_fonte),
            })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")

    return records


UPSERT_SQL = """
    INSERT INTO forma_pagamento (idformapgto, nome, cor_fundo, cor_fonte)
    VALUES %s
    ON CONFLICT (idformapgto) DO UPDATE SET
        nome      = EXCLUDED.nome,
        cor_fundo = EXCLUDED.cor_fundo,
        cor_fonte = EXCLUDED.cor_fonte
"""


def import_records(records: list[dict], dry_run: bool = False):
    values = [
        (r["idformapgto"], r["nome"], r["cor_fundo"], r["cor_fonte"])
        for r in records
    ]

    if dry_run:
        print(f"\n[DRY-RUN] {len(values)} registro(s) seriam importados:")
        for v in values[:20]:
            print(f"  idformapgto={v[0]:>4}  nome={str(v[1]):<40}  "
                  f"cor_fundo={v[2]}  cor_fonte={v[3]}")
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
        description="Importa forma_pa.d (Progress 9.1E) → PostgreSQL (upsert por idformapgto)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "forma_pa.d"),
        help="Caminho para o arquivo .d (padrão: EXTRACAO/forma_pa.d na mesma pasta do script)",
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
