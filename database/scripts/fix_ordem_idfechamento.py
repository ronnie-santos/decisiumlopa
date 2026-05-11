"""
fix_ordem_idfechamento.py — Corrige idfechamento na tabela ordem.

O script import_ordem.py tinha cidade_servico e idfechamento trocados
no tuple de values, fazendo com que cidade_servico recebesse o valor
numérico que deveria estar em idfechamento.

Este script copia cidade_servico → idfechamento apenas onde cidade_servico
contém somente dígitos (registros afetados pelo bug), sem tocar os demais.

Uso:
    python fix_ordem_idfechamento.py
    python fix_ordem_idfechamento.py --dry-run
"""

import os
import sys
import argparse
import psycopg2

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:r0nN1E@localhost:5433/DECISIUM_LOPA"
)

CHECK_SQL = """
    SELECT COUNT(*)
    FROM ordem
    WHERE TRIM(cidade_servico) ~ '^[0-9]+$'
      AND cidade_servico IS NOT NULL
"""

DRY_RUN_SQL = """
    SELECT idordem, TRIM(cidade_servico), idfechamento
    FROM ordem
    WHERE TRIM(cidade_servico) ~ '^[0-9]+$'
      AND cidade_servico IS NOT NULL
    ORDER BY idordem
"""

UPDATE_SQL = """
    UPDATE ordem
    SET idfechamento = TRIM(cidade_servico)::integer
    WHERE TRIM(cidade_servico) ~ '^[0-9]+$'
      AND cidade_servico IS NOT NULL
      AND TRIM(cidade_servico)::integer > 0
      AND TRIM(cidade_servico)::integer IN (SELECT idfechamento FROM fechamento)
"""


def main():
    parser = argparse.ArgumentParser(
        description="Copia cidade_servico → idfechamento onde valor é numérico"
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print(f"Banco : {DB_URL.split('@')[-1]}")
    print(f"Modo  : {'DRY-RUN' if args.dry_run else 'UPDATE REAL'}")
    print("-" * 60)

    conn = psycopg2.connect(DB_URL)
    try:
        with conn.cursor() as cur:
            cur.execute(CHECK_SQL)
            total = cur.fetchone()[0]
            print(f"Registros com cidade_servico numérico: {total}")

            if total == 0:
                print("Nenhum registro a corrigir.")
                return

            if args.dry_run:
                cur.execute(DRY_RUN_SQL)
                rows = cur.fetchall()
                print(f"\n{'idordem':>8}  {'cidade_servico':>16}  {'idfechamento_atual':>18}")
                print("-" * 50)
                for idordem, cs, ifech in rows[:50]:
                    print(f"{idordem:>8}  {str(cs):>16}  {str(ifech):>18}")
                if len(rows) > 50:
                    print(f"  ... e mais {len(rows) - 50} registro(s).")
                print("\n[DRY-RUN] Nenhuma alteração aplicada.")
                return

            with conn:
                with conn.cursor() as cur2:
                    cur2.execute(UPDATE_SQL)
                    print(f"{cur2.rowcount} registro(s) atualizados (idfechamento = cidade_servico).")

    finally:
        conn.close()

    print("-" * 60)
    print("Concluído.")


if __name__ == "__main__":
    main()
