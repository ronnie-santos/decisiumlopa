"""
import_licenca.py — Importa tabela 'licenca' a partir de dump Progress 9.1E (.d)

Colunas esperadas (na ordem do dump):
  idlicenca, data, vencimento, largura, comprimento, altura, horario,
  carretas, pesos, tara, peso_carga, pbt, autorizacao, orgao,
  idequipamento, estado, despachante

Uso:
    python import_licenca.py
    python import_licenca.py caminho/para/licenca.d
    python import_licenca.py licenca.d --dry-run
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
EXPECTED_COLS = 17

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
            idlicenca, data, vencimento, largura, comprimento, altura, horario,
            carretas, pesos, tara, peso_carga, pbt, autorizacao, orgao,
            idequipamento, estado, despachante
        ) = tokens[:EXPECTED_COLS]

        if not idlicenca:
            print(f"  [AVISO] Linha {lineno} ignorada (idlicenca vazio): {raw.rstrip()[:80]}")
            skipped += 1
            continue

        records.append({
            "idlicenca":    int(idlicenca),
            "data":         to_date(data),
            "vencimento":   to_date(vencimento),
            "largura":      to_str(largura),
            "comprimento":  to_str(comprimento),
            "altura":       to_str(altura),
            "horario":      to_str(horario),
            "carretas":     to_str(carretas),
            "pesos":        to_str(pesos),
            "tara":         to_str(tara),
            "peso_carga":   to_str(peso_carga),
            "pbt":          to_str(pbt),
            "autorizacao":  to_str(autorizacao),
            "orgao":        to_str(orgao),
            "idequipamento": to_int(idequipamento),
            "estado":       to_str(estado),
            "despachante":  to_str(despachante),
        })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")

    return records


UPSERT_SQL = """
    INSERT INTO licenca (
        idlicenca, data, vencimento, largura, comprimento, altura, horario,
        carretas, pesos, tara, peso_carga, pbt, autorizacao, orgao,
        idequipamento, estado, despachante
    )
    VALUES %s
    ON CONFLICT (idlicenca) DO UPDATE SET
        data         = EXCLUDED.data,
        vencimento   = EXCLUDED.vencimento,
        largura      = EXCLUDED.largura,
        comprimento  = EXCLUDED.comprimento,
        altura       = EXCLUDED.altura,
        horario      = EXCLUDED.horario,
        carretas     = EXCLUDED.carretas,
        pesos        = EXCLUDED.pesos,
        tara         = EXCLUDED.tara,
        peso_carga   = EXCLUDED.peso_carga,
        pbt          = EXCLUDED.pbt,
        autorizacao  = EXCLUDED.autorizacao,
        orgao        = EXCLUDED.orgao,
        idequipamento = EXCLUDED.idequipamento,
        estado       = EXCLUDED.estado,
        despachante  = EXCLUDED.despachante
"""


def import_records(records: list[dict], dry_run: bool = False):
    values = [
        (
            r["idlicenca"], r["data"], r["vencimento"], r["largura"], r["comprimento"],
            r["altura"], r["horario"], r["carretas"], r["pesos"], r["tara"],
            r["peso_carga"], r["pbt"], r["autorizacao"], r["orgao"],
            r["idequipamento"], r["estado"], r["despachante"],
        )
        for r in records
    ]

    if dry_run:
        print(f"\n[DRY-RUN] {len(values)} registro(s) seriam importados:")
        for v in values[:20]:
            print(f"  id={v[0]:>4}  data={v[1]}  autorizacao={str(v[12]):<20}  orgao={v[13]}")
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
        description="Importa licenca.d (Progress 9.1E) → PostgreSQL (upsert por idlicenca)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "licenca.d"),
        help="Caminho para o arquivo .d (padrão: EXTRACAO/licenca.d)",
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
