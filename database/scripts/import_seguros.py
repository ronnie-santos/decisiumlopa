"""
import_seguros.py — Importa tabela 'seguros' a partir de dump Progress 9.1E (.d)

Colunas esperadas (na ordem do dump):
  idseguro, titular, tipo, veiculo, placa, seguradora, corretora,
  inicio, termino, valor_segurado, valor_seguro, parcelas, valor_parcela,
  primeiro_vencimento, ultimo_vencimento, tipo_pagamento, ativo, apolice

Uso:
    python import_seguros.py
    python import_seguros.py caminho/para/seguros.d
    python import_seguros.py seguros.d --dry-run
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
EXPECTED_COLS = 18

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


def to_numeric(val: str | None):
    if val is None or val == "":
        return None
    try:
        return float(val)
    except ValueError:
        return None


def to_bool(val: str | None) -> bool | None:
    if val is None:
        return None
    v = val.lower()
    if v == "yes":
        return True
    if v == "no":
        return False
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
            idseguro, titular, tipo, veiculo, placa, seguradora, corretora,
            inicio, termino, valor_segurado, valor_seguro, parcelas, valor_parcela,
            primeiro_vencimento, ultimo_vencimento, tipo_pagamento, ativo, apolice
        ) = tokens[:EXPECTED_COLS]

        if not idseguro:
            print(f"  [AVISO] Linha {lineno} ignorada (idseguro vazio): {raw.rstrip()[:80]}")
            skipped += 1
            continue

        records.append({
            "idseguro":            int(idseguro),
            "titular":             to_str(titular),
            "tipo":                to_str(tipo),
            "veiculo":             to_str(veiculo),
            "placa":               to_str(placa),
            "seguradora":          to_str(seguradora),
            "corretora":           to_str(corretora),
            "inicio":              to_date(inicio),
            "termino":             to_date(termino),
            "valor_segurado":      to_numeric(valor_segurado),
            "valor_seguro":        to_numeric(valor_seguro),
            "parcelas":            to_int(parcelas),
            "valor_parcela":       to_numeric(valor_parcela),
            "primeiro_vencimento": to_date(primeiro_vencimento),
            "ultimo_vencimento":   to_date(ultimo_vencimento),
            "tipo_pagamento":      to_str(tipo_pagamento),
            "ativo":               to_bool(ativo),
            "apolice":             to_str(apolice),
        })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")

    return records


UPSERT_SQL = """
    INSERT INTO seguros (
        idseguro, titular, tipo, veiculo, placa, seguradora, corretora,
        inicio, termino, valor_segurado, valor_seguro, parcelas, valor_parcela,
        primeiro_vencimento, ultimo_vencimento, tipo_pagamento, ativo, apolice
    )
    VALUES %s
    ON CONFLICT (idseguro) DO UPDATE SET
        titular             = EXCLUDED.titular,
        tipo                = EXCLUDED.tipo,
        veiculo             = EXCLUDED.veiculo,
        placa               = EXCLUDED.placa,
        seguradora          = EXCLUDED.seguradora,
        corretora           = EXCLUDED.corretora,
        inicio              = EXCLUDED.inicio,
        termino             = EXCLUDED.termino,
        valor_segurado      = EXCLUDED.valor_segurado,
        valor_seguro        = EXCLUDED.valor_seguro,
        parcelas            = EXCLUDED.parcelas,
        valor_parcela       = EXCLUDED.valor_parcela,
        primeiro_vencimento = EXCLUDED.primeiro_vencimento,
        ultimo_vencimento   = EXCLUDED.ultimo_vencimento,
        tipo_pagamento      = EXCLUDED.tipo_pagamento,
        ativo               = EXCLUDED.ativo,
        apolice             = EXCLUDED.apolice
"""


def import_records(records: list[dict], dry_run: bool = False):
    values = [
        (
            r["idseguro"], r["titular"], r["tipo"], r["veiculo"], r["placa"],
            r["seguradora"], r["corretora"], r["inicio"], r["termino"],
            r["valor_segurado"], r["valor_seguro"], r["parcelas"], r["valor_parcela"],
            r["primeiro_vencimento"], r["ultimo_vencimento"],
            r["tipo_pagamento"], r["ativo"], r["apolice"],
        )
        for r in records
    ]

    if dry_run:
        print(f"\n[DRY-RUN] {len(values)} registro(s) seriam importados:")
        for v in values[:20]:
            print(f"  id={v[0]:>4}  titular={str(v[1])[:40]:<40}  ativo={v[16]}")
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
        description="Importa seguros.d (Progress 9.1E) → PostgreSQL (upsert por idseguro)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "seguros.d"),
        help="Caminho para o arquivo .d (padrão: EXTRACAO/seguros.d)",
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
