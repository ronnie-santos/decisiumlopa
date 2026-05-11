"""
import_logradouro.py — Importa tabela 'logradouro' a partir de dump Progress 9.1E (.d)

Formato .d do Progress:
  - Um registro por linha
  - Strings entre aspas duplas
  - Campos separados por espaço
  - Valor desconhecido/nulo representado por ?
  - Encoding padrão: latin-1 (cp1252)

Colunas esperadas (na ordem do dump): idlogradouro, cep, idbairro, logradouro, tipo

Arquivo Progress: logradou.d  (nome truncado pelo Progress)

Uso:
    python import_logradouro.py                            # usa logradou.d na pasta extracao/
    python import_logradouro.py caminho/para/logradou.d
    python import_logradouro.py logradou.d --dry-run      # apenas exibe sem gravar
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


def to_int(value: str | None) -> int | None:
    """Converte string para int, retornando None se inválido."""
    if value is None:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


# ── Leitura do arquivo ────────────────────────────────────────────────────────
def read_d_file(path: str) -> list[dict]:
    """Lê o arquivo .d e retorna lista de dicts prontos para inserção."""
    records = []
    skipped = 0

    with open(path, encoding=FILE_ENCODING, errors="replace") as f:
        for lineno, raw in enumerate(f, start=1):
            line = raw.strip()

            # Ignorar linhas vazias e marcadores de fim de registro (.)
            if not line or line == ".":
                continue

            tokens = parse_progress_line(line)

            if len(tokens) < 4:
                print(f"  [AVISO] Linha {lineno} ignorada (menos de 4 campos): {raw.rstrip()}")
                skipped += 1
                continue

            idlogradouro, cep, idbairro, logradouro = tokens[:4]
            tipo = tokens[4] if len(tokens) > 4 else None

            if idlogradouro is None:
                print(f"  [AVISO] Linha {lineno} ignorada (idlogradouro vazio): {raw.rstrip()}")
                skipped += 1
                continue

            records.append({
                "idlogradouro": to_int(idlogradouro),
                "cep":          to_int(cep),
                "idbairro":     to_int(idbairro),
                "logradouro":   logradouro,
                "tipo":         tipo,
            })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")

    return records


# ── Importação ────────────────────────────────────────────────────────────────
INSERT_SQL = """
    INSERT INTO logradouro (idlogradouro, cep, idbairro, logradouro, tipo)
    VALUES %s
"""


def import_records(records: list[dict], dry_run: bool = False):
    values = [
        (r["idlogradouro"], r["cep"], r["idbairro"], r["logradouro"], r["tipo"])
        for r in records
    ]

    if dry_run:
        print(f"\n[DRY-RUN] {len(values)} registro(s) seriam importados:")
        for v in values[:20]:
            print(f"  {v}")
        if len(values) > 20:
            print(f"  ... e mais {len(values) - 20} registro(s).")
        return

    conn = psycopg2.connect(DB_URL)
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("SELECT idlogradouro FROM logradouro")
                existing = {row[0] for row in cur.fetchall()}

                new_values = [v for v in values if v[0] not in existing]
                skipped = len(values) - len(new_values)

                if new_values:
                    execute_values(cur, INSERT_SQL, new_values)
                    print(f"  {len(new_values)} registro(s) inseridos.")
                if skipped:
                    print(f"  {skipped} registro(s) já existentes, ignorados.")
                if not new_values:
                    print("  Nenhum registro novo para inserir.")
    finally:
        conn.close()


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Importa logradou.d (Progress 9.1E) → PostgreSQL")
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "extracao/logradou.d"),
        help="Caminho para o arquivo .d (padrão: logradou.d na pasta extracao/)",
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
    print(f"Modo     : {'DRY-RUN' if args.dry_run else 'IMPORTAÇÃO'}")
    print("-" * 60)

    print("Lendo arquivo...")
    records = read_d_file(path)
    print(f"  {len(records)} registro(s) lidos.")

    print("Importando...")
    import_records(records, dry_run=args.dry_run)

    print("-" * 60)
    print("Concluído.")


if __name__ == "__main__":
    main()
