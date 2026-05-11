"""
import_contas_receber.py — Importa tabela 'contas_receber' a partir de dump Progress 9.1E (.d)

Fonte: contas_r.d
Colunas esperadas (na ordem do dump) — 12 campos:
   1  idcontasreceber
   2  vencimento
   3  valor
   4  valor_pago
   5  situacao         (yes/no → boolean)
   6  idfechamento
   7  codigo_banco
   8  linha_digitavel
   9  codigo_de_barra
  10  ban_codigo
  11  parcela
  12  ultimo_pagamento

FKs validadas (registro ignorado se FK não existe):
  idfechamento → fechamento.idfechamento  (obrigatório)

Uso:
    python import_contas_receber.py
    python import_contas_receber.py caminho/para/contas_r.d
    python import_contas_receber.py contas_r.d --dry-run
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
EXPECTED_COLS = 12

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
    """Preserva 0 como valor válido (para PKs)."""
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


def to_bool(val) -> bool | None:
    if val is None or val == "":
        return None
    return val.lower() in ("yes", "true", "1", "t")


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
            idcontasreceber, vencimento, valor, valor_pago, situacao,
            idfechamento, codigo_banco, linha_digitavel, codigo_de_barra,
            ban_codigo, parcela, ultimo_pagamento
        ) = tokens[:EXPECTED_COLS]

        if idcontasreceber is None:
            skipped += 1
            continue

        records.append({
            "idcontasreceber":  to_int_zero(idcontasreceber),
            "vencimento":       to_date(vencimento),
            "valor":            to_decimal(valor),
            "valor_pago":       to_decimal(valor_pago),
            "situacao":         to_bool(situacao),
            "idfechamento":     to_int(idfechamento),
            "codigo_banco":     to_str(codigo_banco),
            "linha_digitavel":  to_str(linha_digitavel),
            "codigo_de_barra":  to_str(codigo_de_barra),
            "ban_codigo":       to_int(ban_codigo),
            "parcela":          to_str(parcela),
            "ultimo_pagamento": to_date(ultimo_pagamento),
        })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")

    return records


def get_valid_fechamentos(conn) -> set:
    with conn.cursor() as cur:
        cur.execute("SELECT idfechamento FROM fechamento")
        return {row[0] for row in cur.fetchall()}


def filter_records(records: list[dict], fechamentos: set) -> tuple[list[dict], int]:
    filtered = []
    ignored = 0
    for r in records:
        if r["idfechamento"] not in fechamentos:
            ignored += 1
            continue
        filtered.append(r)
    return filtered, ignored


UPSERT_SQL = """
    INSERT INTO contas_receber (
        idcontasreceber, vencimento, valor, valor_pago, situacao,
        idfechamento, codigo_banco, linha_digitavel, codigo_de_barra,
        ban_codigo, parcela, ultimo_pagamento
    )
    VALUES %s
    ON CONFLICT (idcontasreceber) DO UPDATE SET
        vencimento       = EXCLUDED.vencimento,
        valor            = EXCLUDED.valor,
        valor_pago       = EXCLUDED.valor_pago,
        situacao         = EXCLUDED.situacao,
        idfechamento     = EXCLUDED.idfechamento,
        codigo_banco     = EXCLUDED.codigo_banco,
        linha_digitavel  = EXCLUDED.linha_digitavel,
        codigo_de_barra  = EXCLUDED.codigo_de_barra,
        ban_codigo       = EXCLUDED.ban_codigo,
        parcela          = EXCLUDED.parcela,
        ultimo_pagamento = EXCLUDED.ultimo_pagamento
"""


def import_records(records: list[dict], dry_run: bool = False):
    if dry_run:
        print(f"\n[DRY-RUN] {len(records)} registro(s) seriam importados:")
        for r in records[:20]:
            print(f"  id={str(r['idcontasreceber']):>6}  fech={str(r['idfechamento']):>5}  "
                  f"venc={r['vencimento']}  valor={r['valor']}  parc={r['parcela']}")
        if len(records) > 20:
            print(f"  ... e mais {len(records) - 20} registro(s).")
        return

    conn = psycopg2.connect(DB_URL)
    try:
        with conn:
            fechamentos = get_valid_fechamentos(conn)
            filtered, ignored = filter_records(records, fechamentos)
            if ignored:
                print(f"  {ignored} registro(s) ignorados (idfechamento não existe em fechamento).")
            if not filtered:
                print("  Nenhum registro válido para importar.")
                return
            values = [
                (
                    r["idcontasreceber"], r["vencimento"], r["valor"], r["valor_pago"],
                    r["situacao"], r["idfechamento"], r["codigo_banco"],
                    r["linha_digitavel"], r["codigo_de_barra"], r["ban_codigo"],
                    r["parcela"], r["ultimo_pagamento"],
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
        description="Importa contas_r.d (Progress 9.1E) → PostgreSQL (upsert por idcontasreceber)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "contas_r.d"),
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
