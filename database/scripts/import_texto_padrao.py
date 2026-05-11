"""
import_texto_padrao.py — Importa tabela 'texto_padrao' a partir de dump Progress 9.1E (.d)

Formato .d do Progress:
  - Um registro por linha
  - Strings entre aspas duplas
  - Campos separados por espaço
  - Valor desconhecido/nulo representado por ?
  - Encoding padrão: latin-1 (cp1252)

Colunas esperadas (na ordem do dump):
  texto, idtexto

Uso:
    python import_texto_padrao.py                        # usa EXTRACAO/texto_pa.d relativo ao script
    python import_texto_padrao.py caminho/para/texto_pa.d
    python import_texto_padrao.py texto_pa.d --dry-run   # apenas exibe sem gravar
"""

import os
import re
import sys
import argparse
import psycopg2
from psycopg2.extras import execute_values

# ── Configuração do banco ──────────────────────────────────────────────────────
DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:r0nN1E@localhost:5433/DECISIUM_LOPA"
)

# ── Encoding do arquivo Progress ──────────────────────────────────────────────
FILE_ENCODING = "latin-1"

# ── Número de colunas esperadas no .d ─────────────────────────────────────────
EXPECTED_COLS = 2

# ── Parser de linha .d ────────────────────────────────────────────────────────
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


# ── Helpers de conversão ──────────────────────────────────────────────────────
def to_str(val: str | None) -> str | None:
    if val is None or val == "":
        return None
    return val


# ── Leitura do arquivo ────────────────────────────────────────────────────────
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

        texto, idtexto = tokens[:EXPECTED_COLS]

        if not idtexto:
            print(f"  [AVISO] Linha {lineno} ignorada (idtexto vazio): {raw.rstrip()}")
            skipped += 1
            continue

        records.append({
            "idtexto": int(idtexto),
            "texto":   to_str(texto),
        })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")

    return records


# ── Importação (UPSERT) ───────────────────────────────────────────────────────
UPSERT_SQL = """
    INSERT INTO texto_padrao (idtexto, texto)
    VALUES %s
    ON CONFLICT (idtexto) DO UPDATE SET
        texto = EXCLUDED.texto
"""


def import_records(records: list[dict], dry_run: bool = False):
    values = [(r["idtexto"], r["texto"]) for r in records]

    if dry_run:
        print(f"\n[DRY-RUN] {len(values)} registro(s) seriam importados:")
        for v in values[:20]:
            print(f"  idtexto={v[0]:>4}  texto={str(v[1])[:70]}")
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


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Importa texto_pa.d (Progress 9.1E) → PostgreSQL (upsert por idtexto)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "texto_pa.d"),
        help="Caminho para o arquivo .d (padrão: EXTRACAO/texto_pa.d na mesma pasta do script)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Exibe os dados sem gravar no banco",
    )
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
