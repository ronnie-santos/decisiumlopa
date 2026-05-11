"""
import_fluxo_financeiro.py — Importa tabela 'fluxo_financeiro' a partir de dump Progress 9.1E (.d)

Formato .d do Progress:
  - Um registro por linha
  - Strings entre aspas duplas
  - Campos separados por espaço
  - Valor desconhecido/nulo representado por ?
  - Encoding padrão: latin-1 (cp1252)

Colunas esperadas (na ordem do dump):
  idfluxo, descricao, fluxo_pai, tipo, movimento, codigo_importacao, nivel

Uso:
    python import_fluxo_financeiro.py                          # usa EXTRACAO/fluxo_fi.d relativo ao script
    python import_fluxo_financeiro.py caminho/para/fluxo_fi.d
    python import_fluxo_financeiro.py fluxo_fi.d --dry-run     # apenas exibe sem gravar
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
EXPECTED_COLS = 7

# ── Parser de linha .d ────────────────────────────────────────────────────────
_TOKEN_RE = re.compile(r'"((?:[^"\\]|\\.)*)"|(\?)|(\S+)')


def parse_progress_line(line: str) -> list[str | None]:
    """
    Faz parse de uma linha no formato Progress .d e retorna lista de valores.
    Strings entre aspas → str
    ? → None
    Outros tokens → str
    """
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
def to_int(val: str | None) -> int | None:
    """Converte string para int. None ou vazio vira None."""
    if val is None or val == "":
        return None
    try:
        return int(val)
    except ValueError:
        return None


def to_str(val: str | None) -> str | None:
    """Converte string vazia para None."""
    if val is None or val == "":
        return None
    return val


# ── Leitura do arquivo ────────────────────────────────────────────────────────
def read_d_file(path: str) -> list[dict]:
    """Lê o arquivo .d e retorna lista de dicts prontos para importação."""
    records = []
    skipped = 0

    with open(path, encoding=FILE_ENCODING, errors="replace") as f:
        for lineno, raw in enumerate(f, start=1):
            line = raw.strip()

            # Ignorar linhas vazias e marcadores de fim de registro (.)
            if not line or line == ".":
                continue

            tokens = parse_progress_line(line)

            if len(tokens) < EXPECTED_COLS:
                print(f"  [AVISO] Linha {lineno} ignorada "
                      f"({len(tokens)} campos, esperado {EXPECTED_COLS}): {raw.rstrip()}")
                skipped += 1
                continue

            (
                idfluxo, descricao, fluxo_pai, tipo,
                movimento, codigo_importacao, nivel
            ) = tokens[:EXPECTED_COLS]

            if not idfluxo:
                print(f"  [AVISO] Linha {lineno} ignorada (idfluxo vazio): {raw.rstrip()}")
                skipped += 1
                continue

            records.append({
                "idfluxo":           idfluxo,
                "descricao":         to_str(descricao),
                "fluxo_pai":         to_str(fluxo_pai),
                "tipo":              to_str(tipo),
                "movimento":         to_str(movimento),
                "codigo_importacao": to_int(codigo_importacao),
                "nivel":             to_int(nivel),
            })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")

    return records


# ── Importação (UPSERT) ───────────────────────────────────────────────────────
UPSERT_SQL = """
    INSERT INTO fluxo_financeiro (
        idfluxo, descricao, fluxo_pai, tipo, movimento, codigo_importacao, nivel
    )
    VALUES %s
    ON CONFLICT (idfluxo) DO UPDATE SET
        descricao          = EXCLUDED.descricao,
        fluxo_pai          = EXCLUDED.fluxo_pai,
        tipo               = EXCLUDED.tipo,
        movimento          = EXCLUDED.movimento,
        codigo_importacao  = EXCLUDED.codigo_importacao,
        nivel              = EXCLUDED.nivel
"""


def import_records(records: list[dict], dry_run: bool = False):
    values = [
        (
            r["idfluxo"], r["descricao"], r["fluxo_pai"], r["tipo"],
            r["movimento"], r["codigo_importacao"], r["nivel"],
        )
        for r in records
    ]

    if dry_run:
        print(f"\n[DRY-RUN] {len(values)} registro(s) seriam importados:")
        for v in values[:20]:
            print(f"  idfluxo={str(v[0]):<12}  descricao={str(v[1])[:40]:<40}  "
                  f"nivel={v[6]}  tipo={str(v[3]):<8}  mov={str(v[4]):<8}")
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
        description="Importa fluxo_fi.d (Progress 9.1E) → PostgreSQL (upsert por idfluxo)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "fluxo_fi.d"),
        help="Caminho para o arquivo .d (padrão: EXTRACAO/fluxo_fi.d na mesma pasta do script)",
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
