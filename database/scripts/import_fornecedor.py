"""
import_fornecedor.py — Importa tabela 'fornecedor' a partir de dump Progress 9.1E (.d)

Colunas esperadas (na ordem do dump) — 18 campos:
  idfornecedor, nome, nomefantasia, data_cadastro, cnpj_cpf, ie_rg,
  tipo, site, cep, idcidade, idbairro, logradouro, tipo_logradouro,
  idestado, contato, observacao, complemento, numero

Nota: status não está no dump; definido como 'ATIVO' por padrão.

Uso:
    python import_fornecedor.py
    python import_fornecedor.py caminho/para/forneced.d
    python import_fornecedor.py forneced.d --dry-run
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
            idfornecedor, nome, nomefantasia, data_cadastro, cnpj_cpf, ie_rg,
            tipo, site, cep, idcidade, idbairro, logradouro, tipo_logradouro,
            idestado, contato, observacao, complemento, numero
        ) = tokens[:EXPECTED_COLS]

        if not idfornecedor:
            print(f"  [AVISO] Linha {lineno} ignorada (idfornecedor vazio): {raw.rstrip()[:80]}")
            skipped += 1
            continue

        records.append({
            "idfornecedor":  int(idfornecedor),
            "nome":          to_str(nome),
            "nomefantasia":  to_str(nomefantasia),
            "data_cadastro": to_date(data_cadastro),
            "cnpj_cpf":      to_str(cnpj_cpf),
            "ie_rg":         to_str(ie_rg),
            "tipo":          to_str(tipo),
            "site":          to_str(site),
            "cep":           to_str(cep),
            "idcidade":      to_int(idcidade),
            "idbairro":      to_int(idbairro),
            "logradouro":    to_str(logradouro),
            "tipo_logradouro": to_str(tipo_logradouro),
            "idestado":      to_str(idestado),
            "contato":       to_str(contato),
            "observacao":    to_str(observacao),
            "complemento":   to_str(complemento),
            "numero":        to_str(numero),
            "status":        "ATIVO",
        })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")

    return records


UPSERT_SQL = """
    INSERT INTO fornecedor (
        idfornecedor, nome, nomefantasia, data_cadastro, cnpj_cpf, ie_rg,
        tipo, site, cep, idcidade, idbairro, logradouro, tipo_logradouro,
        idestado, contato, observacao, complemento, numero, status
    )
    VALUES %s
    ON CONFLICT (idfornecedor) DO UPDATE SET
        nome           = EXCLUDED.nome,
        nomefantasia   = EXCLUDED.nomefantasia,
        data_cadastro  = EXCLUDED.data_cadastro,
        cnpj_cpf       = EXCLUDED.cnpj_cpf,
        ie_rg          = EXCLUDED.ie_rg,
        tipo           = EXCLUDED.tipo,
        site           = EXCLUDED.site,
        cep            = EXCLUDED.cep,
        idcidade       = EXCLUDED.idcidade,
        idbairro       = EXCLUDED.idbairro,
        logradouro     = EXCLUDED.logradouro,
        tipo_logradouro = EXCLUDED.tipo_logradouro,
        idestado       = EXCLUDED.idestado,
        contato        = EXCLUDED.contato,
        observacao     = EXCLUDED.observacao,
        complemento    = EXCLUDED.complemento,
        numero         = EXCLUDED.numero,
        status         = EXCLUDED.status
"""


def import_records(records: list[dict], dry_run: bool = False):
    values = [
        (
            r["idfornecedor"], r["nome"], r["nomefantasia"], r["data_cadastro"],
            r["cnpj_cpf"], r["ie_rg"], r["tipo"], r["site"], r["cep"],
            r["idcidade"], r["idbairro"], r["logradouro"], r["tipo_logradouro"],
            r["idestado"], r["contato"], r["observacao"],
            r["complemento"], r["numero"], r["status"],
        )
        for r in records
    ]

    if dry_run:
        print(f"\n[DRY-RUN] {len(values)} registro(s) seriam importados:")
        for v in values[:20]:
            print(f"  id={v[0]:>5}  nome={str(v[1])[:40]:<40}  cnpj={v[4]}")
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
        description="Importa forneced.d (Progress 9.1E) → PostgreSQL (upsert por idfornecedor)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "forneced.d"),
        help="Caminho para o arquivo .d (padrão: EXTRACAO/forneced.d)",
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
