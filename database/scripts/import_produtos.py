"""
import_produtos.py — Importa tabela 'produtos_servicos' a partir de dump Progress 9.1E (.d)

Colunas esperadas (na ordem do dump):
  idproduto, descricao, ncmsh, cst, unidade, ipi, icms, marca_km

Nota: marca_km é booleano Progress (yes/no).

Uso:
    python import_produtos.py
    python import_produtos.py caminho/para/produtos.d
    python import_produtos.py produtos.d --dry-run
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
EXPECTED_COLS = 8

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


def to_numeric(val: str | None):
    if val is None or val == "":
        return None
    try:
        return float(val)
    except ValueError:
        return None


def to_bool(val: str | None) -> bool | None:
    """Converte 'yes'/'no' do Progress para bool Python."""
    if val is None:
        return None
    v = val.lower()
    if v == "yes":
        return True
    if v == "no":
        return False
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

            idproduto, descricao, ncmsh, cst, unidade, ipi, icms, marca_km = tokens[:EXPECTED_COLS]

            if not idproduto:
                print(f"  [AVISO] Linha {lineno} ignorada (idproduto vazio): {raw.rstrip()}")
                skipped += 1
                continue

            # idproduto=0 é registro inválido (linha de cabeçalho legada)
            if idproduto == "0":
                skipped += 1
                continue

            records.append({
                "idproduto": int(idproduto),
                "descricao": to_str(descricao),
                "ncmsh":     to_str(ncmsh),
                "cst":       to_str(cst),
                "unidade":   to_str(unidade),
                "ipi":       to_numeric(ipi),
                "icms":      to_numeric(icms),
                "marca_km":  to_bool(marca_km),
            })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")

    return records


UPSERT_SQL = """
    INSERT INTO produtos_servicos (idproduto, descricao, ncmsh, cst, unidade, ipi, icms, marca_km)
    VALUES %s
    ON CONFLICT (idproduto) DO UPDATE SET
        descricao = EXCLUDED.descricao,
        ncmsh     = EXCLUDED.ncmsh,
        cst       = EXCLUDED.cst,
        unidade   = EXCLUDED.unidade,
        ipi       = EXCLUDED.ipi,
        icms      = EXCLUDED.icms,
        marca_km  = EXCLUDED.marca_km
"""


def import_records(records: list[dict], dry_run: bool = False):
    values = [
        (
            r["idproduto"], r["descricao"], r["ncmsh"], r["cst"],
            r["unidade"], r["ipi"], r["icms"], r["marca_km"],
        )
        for r in records
    ]

    if dry_run:
        print(f"\n[DRY-RUN] {len(values)} registro(s) seriam importados:")
        for v in values[:20]:
            print(f"  id={v[0]:>6}  descricao={str(v[1]):<40}  "
                  f"unidade={str(v[4]):<8}  marca_km={v[7]}")
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
        description="Importa produtos.d (Progress 9.1E) → PostgreSQL (upsert por idproduto)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "produtos.d"),
        help="Caminho para o arquivo .d (padrão: EXTRACAO/produtos.d na mesma pasta do script)",
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
