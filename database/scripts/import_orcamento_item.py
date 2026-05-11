"""
import_orcamento_item.py — Importa tabela 'orcamento_item' a partir de dump Progress 9.1E (.d)

Fonte: orcitem.d
Colunas esperadas (na ordem do dump) — 8 campos:
  idorcamento, idequipamento, idservico, unidade,
  valor_unitario, valor_total, nome_item, quantidade

PK composta: (idorcamento, idequipamento, idservico)
  ATENÇÃO: idequipamento e idservico podem ser 0 (componente "nulo" do Progress).
  O banco NÃO possui FK constraint nessas colunas — apenas NOT NULL.

FKs validadas (registro ignorado se FK não existe):
  idorcamento  → orcamento.idorcamento      (única FK real — obrigatório)

Uso:
    python import_orcamento_item.py
    python import_orcamento_item.py caminho/para/orcitem.d
    python import_orcamento_item.py orcitem.d --dry-run
"""

import os
import re
import sys
import argparse
from decimal import Decimal, InvalidOperation
import psycopg2
from psycopg2.extras import execute_values

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:r0nN1E@localhost:5433/DECISIUM_LOPA"
)
FILE_ENCODING = "latin-1"
EXPECTED_COLS = 8

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


def to_int_zero(val) -> int | None:
    """Preserva 0 como valor válido (parte de PKs compostas no Progress)."""
    if val is None or val == "":
        return None
    try:
        return int(val)
    except ValueError:
        return None


def to_decimal(val) -> Decimal | None:
    if val is None or val == "":
        return None
    try:
        return Decimal(str(val).replace(",", "."))
    except InvalidOperation:
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
                      f"({len(tokens)} campos, esperado {EXPECTED_COLS}): {raw.rstrip()[:80]}")
                skipped += 1
                continue

            (
                idorcamento, idequipamento, idservico, unidade,
                valor_unitario, valor_total, nome_item, quantidade
            ) = tokens[:EXPECTED_COLS]

            # PK composta — todos obrigatórios
            ido = to_int_zero(idorcamento)
            ide = to_int_zero(idequipamento)
            ids = to_int_zero(idservico)

            if ido is None or ide is None or ids is None:
                print(f"  [AVISO] Linha {lineno} ignorada (PK nula): {raw.rstrip()[:80]}")
                skipped += 1
                continue

            records.append({
                "idorcamento":    ido,
                "idequipamento":  ide,
                "idservico":      ids,
                "unidade":        (to_str(unidade) or "")[:8],
                "valor_unitario": to_decimal(valor_unitario),
                "valor_total":    to_decimal(valor_total),
                "nome_item":      (to_str(nome_item) or "")[:60],
                "quantidade":     to_decimal(quantidade),
            })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")

    return records


def get_valid_ids(conn) -> dict:
    with conn.cursor() as cur:
        cur.execute("SELECT idorcamento FROM orcamento")
        orcamentos = {row[0] for row in cur.fetchall()}
    return {"orcamentos": orcamentos}


def filter_records(records: list[dict], valid_ids: dict) -> tuple[list[dict], int]:
    """Valida apenas idorcamento → FK real com constraint no banco."""
    filtered = []
    ignored = 0
    for r in records:
        if r["idorcamento"] not in valid_ids["orcamentos"]:
            ignored += 1
            continue
        filtered.append(r)
    return filtered, ignored


INSERT_SQL = """
    INSERT INTO orcamento_item (
        idorcamento, idequipamento, idservico, unidade,
        valor_unitario, valor_total, nome_item, quantidade
    )
    VALUES %s
"""


def import_records(records: list[dict], dry_run: bool = False):
    if dry_run:
        print(f"\n[DRY-RUN] {len(records)} registro(s) seriam importados:")
        for r in records[:20]:
            print(f"  idorc={r['idorcamento']:>5}  equip={r['idequipamento']:>5}  "
                  f"serv={r['idservico']:>5}  qtd={r['quantidade']}  "
                  f"item={str(r['nome_item'])[:30]}")
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
                    r["idorcamento"], r["idequipamento"], r["idservico"],
                    r["unidade"], r["valor_unitario"], r["valor_total"],
                    r["nome_item"], r["quantidade"],
                )
                for r in filtered
            ]
            with conn.cursor() as cur:
                # Apaga itens existentes dos orçamentos sendo importados (sem PK/UNIQUE no banco)
                orc_ids = list({r["idorcamento"] for r in filtered})
                cur.execute("DELETE FROM orcamento_item WHERE idorcamento = ANY(%s)", (orc_ids,))
                deleted = cur.rowcount
                execute_values(cur, INSERT_SQL, values)
                print(f"  {deleted} item(ns) removidos (reimport) -> {len(values)} inseridos.")
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Importa orcitem.d (Progress 9.1E) → PostgreSQL orcamento_item (PK composta)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "orcitem.d"),
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
