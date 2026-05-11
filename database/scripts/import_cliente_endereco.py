"""
import_cliente_endereco.py — Importa tabela 'cliente_endereco' a partir de dump Progress 9.1E (.d)

Fonte: CLIEND.d
Colunas esperadas (na ordem do dump) — 11 campos:
  idcliente, idcidade, logradouro, numero, tipo_logradouro,
  idestado, idcliend(PK), idbairro, complemento, cep, tipo_endereco

Atenção: no dump, o campo idcliend (PK) está na posição [6], não na [0].
         O campo [0] é idcliente (FK).

Uso:
    python import_cliente_endereco.py
    python import_cliente_endereco.py caminho/para/CLIEND.d
    python import_cliente_endereco.py CLIEND.d --dry-run
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
EXPECTED_COLS = 11

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


def to_int_zero(val: str | None) -> int | None:
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

        # Ordem no dump: idcliente[0] idcidade[1] logradouro[2] numero[3]
        #                tipo_logradouro[4] idestado[5] idcliend(PK)[6]
        #                idbairro[7] complemento[8] cep[9] tipo_endereco[10]
        (
            idcliente, idcidade, logradouro, numero, tipo_logradouro,
            idestado, idcliend, idbairro, complemento, cep, tipo_endereco
        ) = tokens[:EXPECTED_COLS]

        if not idcliend:
            print(f"  [AVISO] Linha {lineno} ignorada (idcliend vazio): {raw.rstrip()[:80]}")
            skipped += 1
            continue

        records.append({
            "idcliend":       int(idcliend),
            "idcliente":      to_int_zero(idcliente),
            "idcidade":       to_int(idcidade),
            "logradouro":     to_str(logradouro),
            "numero":         to_str(numero),
            "tipo_logradouro": to_str(tipo_logradouro),
            "idestado":       to_str(idestado),
            "idbairro":       to_int(idbairro),
            "complemento":    to_str(complemento),
            "cep":            to_str(cep),
            "tipo_endereco":  to_str(tipo_endereco),
        })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")

    return records


UPSERT_SQL = """
    INSERT INTO cliente_endereco (
        idcliend, idcliente, idcidade, logradouro, numero,
        tipo_logradouro, idestado, idbairro, complemento, cep, tipo_endereco
    )
    VALUES %s
    ON CONFLICT (idcliend) DO UPDATE SET
        idcliente      = EXCLUDED.idcliente,
        idcidade       = EXCLUDED.idcidade,
        logradouro     = EXCLUDED.logradouro,
        numero         = EXCLUDED.numero,
        tipo_logradouro = EXCLUDED.tipo_logradouro,
        idestado       = EXCLUDED.idestado,
        idbairro       = EXCLUDED.idbairro,
        complemento    = EXCLUDED.complemento,
        cep            = EXCLUDED.cep,
        tipo_endereco  = EXCLUDED.tipo_endereco
"""


def get_valid_clientes(conn) -> set:
    with conn.cursor() as cur:
        cur.execute("SELECT idcliente FROM cliente")
        return {row[0] for row in cur.fetchall()}


def import_records(records: list[dict], dry_run: bool = False):
    if dry_run:
        values = [
            (
                r["idcliend"], r["idcliente"], r["idcidade"], r["logradouro"],
                r["numero"], r["tipo_logradouro"], r["idestado"], r["idbairro"],
                r["complemento"], r["cep"], r["tipo_endereco"],
            )
            for r in records
        ]
        print(f"\n[DRY-RUN] {len(values)} registro(s) seriam importados:")
        for v in values[:20]:
            print(f"  idcliend={v[0]:>5}  cliente={str(v[1]):>5}  "
                  f"logradouro={str(v[3])[:30]:<30}  cep={v[9]}")
        if len(values) > 20:
            print(f"  ... e mais {len(values) - 20} registro(s).")
        return

    conn = psycopg2.connect(DB_URL)
    try:
        with conn:
            valid_ids = get_valid_clientes(conn)
            filtered = [r for r in records if r["idcliente"] in valid_ids]
            ignorados = len(records) - len(filtered)
            if ignorados:
                print(f"  {ignorados} registro(s) ignorados (idcliente não existe na tabela cliente).")
            if not filtered:
                print("  Nenhum registro válido para importar.")
                return
            values = [
                (
                    r["idcliend"], r["idcliente"], r["idcidade"], r["logradouro"],
                    r["numero"], r["tipo_logradouro"], r["idestado"], r["idbairro"],
                    r["complemento"], r["cep"], r["tipo_endereco"],
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
        description="Importa CLIEND.d (Progress 9.1E) → PostgreSQL (upsert por idcliend)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "CLIEND.d"),
        help="Caminho para o arquivo .d (padrão: EXTRACAO/CLIEND.d)",
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
