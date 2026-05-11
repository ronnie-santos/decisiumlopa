"""
import_fechamento.py — Importa tabela 'fechamento' a partir de dump Progress 9.1E (.d)

Fonte: fechamen.d
Colunas esperadas (na ordem do dump) — 14 campos:
   1  idfechamento
   2  data
   3  valor
   4  total_itens
   5  parcelas
   6  gerar_nf         (yes/no → boolean)
   7  idempresa
   8  valor_pago
   9  data_geracao_nf
  10  idcliente
  11  desconto
  12  juros
  13  situacao         (yes/no → boolean)
  14  idconhecimento

FKs validadas (registro ignorado se FK não existe):
  idempresa  → empresa.idempresa   (obrigatório se não NULL)
  idcliente  → cliente.idcliente   (obrigatório se não NULL)

Uso:
    python import_fechamento.py
    python import_fechamento.py caminho/para/fechamen.d
    python import_fechamento.py fechamen.d --dry-run
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
EXPECTED_COLS = 14

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
            idfechamento, data_val, valor, total_itens, parcelas,
            gerar_nf, idempresa, valor_pago, data_geracao_nf,
            idcliente, desconto, juros, situacao, idconhecimento
        ) = tokens[:EXPECTED_COLS]

        if idfechamento is None:
            skipped += 1
            continue

        records.append({
            "idfechamento":    to_int_zero(idfechamento),
            "data":            to_date(data_val),
            "valor":           to_decimal(valor),
            "total_itens":     to_int_zero(total_itens),
            "parcelas":        to_int_zero(parcelas),
            "gerar_nf":        to_bool(gerar_nf),
            "idempresa":       to_int(idempresa),
            "valor_pago":      to_decimal(valor_pago),
            "data_geracao_nf": to_date(data_geracao_nf),
            "idcliente":       to_int(idcliente),
            "desconto":        to_decimal(desconto),
            "juros":           to_decimal(juros),
            "situacao":        to_bool(situacao),
            "idconhecimento":  to_int(idconhecimento),
        })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")

    return records


def get_valid_ids(conn) -> dict:
    with conn.cursor() as cur:
        cur.execute("SELECT idempresa FROM empresa")
        empresas = {row[0] for row in cur.fetchall()}
        cur.execute("SELECT idcliente FROM cliente")
        clientes = {row[0] for row in cur.fetchall()}
    return {"empresas": empresas, "clientes": clientes}


def filter_records(records: list[dict], valid_ids: dict) -> tuple[list[dict], int]:
    filtered = []
    ignored = 0
    for r in records:
        if r["idempresa"] is not None and r["idempresa"] not in valid_ids["empresas"]:
            ignored += 1
            continue
        if r["idcliente"] is not None and r["idcliente"] not in valid_ids["clientes"]:
            ignored += 1
            continue
        filtered.append(r)
    return filtered, ignored


UPSERT_SQL = """
    INSERT INTO fechamento (
        idfechamento, data, valor, total_itens, parcelas, gerar_nf,
        idempresa, valor_pago, data_geracao_nf, idcliente,
        desconto, juros, situacao, idconhecimento
    )
    VALUES %s
    ON CONFLICT (idfechamento) DO UPDATE SET
        data            = EXCLUDED.data,
        valor           = EXCLUDED.valor,
        total_itens     = EXCLUDED.total_itens,
        parcelas        = EXCLUDED.parcelas,
        gerar_nf        = EXCLUDED.gerar_nf,
        idempresa       = EXCLUDED.idempresa,
        valor_pago      = EXCLUDED.valor_pago,
        data_geracao_nf = EXCLUDED.data_geracao_nf,
        idcliente       = EXCLUDED.idcliente,
        desconto        = EXCLUDED.desconto,
        juros           = EXCLUDED.juros,
        situacao        = EXCLUDED.situacao,
        idconhecimento  = EXCLUDED.idconhecimento
"""


def import_records(records: list[dict], dry_run: bool = False):
    if dry_run:
        print(f"\n[DRY-RUN] {len(records)} registro(s) seriam importados:")
        for r in records[:20]:
            print(f"  id={str(r['idfechamento']):>6}  data={r['data']}  "
                  f"cliente={str(r['idcliente']):>5}  valor={r['valor']}")
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
                    r["idfechamento"], r["data"], r["valor"], r["total_itens"],
                    r["parcelas"], r["gerar_nf"], r["idempresa"], r["valor_pago"],
                    r["data_geracao_nf"], r["idcliente"], r["desconto"],
                    r["juros"], r["situacao"], r["idconhecimento"],
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
        description="Importa fechamen.d (Progress 9.1E) → PostgreSQL (upsert por idfechamento)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "fechamen.d"),
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
