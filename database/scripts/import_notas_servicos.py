"""
import_notas_servicos.py — Importa tabela 'nota_fiscal_servico' a partir de dump Progress 9.1 (.d)

Colunas esperadas (na ordem do dump) — 9 campos:
  sequencial, idnota, idservico, valor_unitario, quantidade, desconto,
  valor_total, dps, idempresa

Validações de FK aplicadas antes da importação:
  idnota    → nota_fiscal.idnota       (obrigatório — registro ignorado se não existir)
  idservico → tipos_servicos.idservico  (obrigatório — registro ignorado se não existir)
  idempresa → empresa.idempresa         (opcional   — NULL aceito; validado se informado)

Uso:
    python import_notas_servicos.py
    python import_notas_servicos.py caminho/para/NFS.d
    python import_notas_servicos.py NFS.d --dry-run
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
FILE_ENCODING = "ISO8859-1"
EXPECTED_COLS = 9

_TOKEN_RE = re.compile(r'"((?:[^"\\]|\\.)*)"|(\?)|(\S+)')


# ── Parsers de linha Progress ──────────────────────────────────────────────────

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


# ── Conversores de tipo ────────────────────────────────────────────────────────

def to_int(val) -> int | None:
    """Converte para int; retorna None para vazio, None ou '0'."""
    if val is None or val == "" or val == "0":
        return None
    try:
        return int(val)
    except ValueError:
        return None


def to_int_required(val) -> int | None:
    """Converte para int sem tratar 0 como None (para PKs e sequenciais)."""
    if val is None or val == "":
        return None
    try:
        return int(float(val))
    except ValueError:
        return None


def to_numeric(val):
    if val is None or val == "":
        return None
    try:
        return float(val)
    except ValueError:
        return None


def to_str(val) -> str | None:
    if val is None or val == "":
        return None
    return val


# ── Leitura do arquivo .d ──────────────────────────────────────────────────────

def read_d_file(path: str) -> list[dict]:
    records = []
    skipped = 0

    with open(path, encoding=FILE_ENCODING, errors="replace") as f:
        raw_lines = f.readlines()

    # Junta linhas quebradas dentro de strings (aspas ímpares)
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

        # Pula linhas vazias, separador "." e metadados do footer Progress
        if not line or line == ".":
            continue
        if line.startswith(("records=", "ldbname=", "timestamp=", "numformat=",
                             "dateformat=", "cpstream=", "map=")):
            continue

        tokens = parse_progress_line(line)

        if len(tokens) < EXPECTED_COLS:
            print(f"  [AVISO] Linha {lineno} ignorada "
                  f"({len(tokens)} campos, esperado {EXPECTED_COLS}): {raw.rstrip()[:80]}")
            skipped += 1
            continue

        (
            idnota, sequencial, idservico,
            valor_unitario, quantidade, desconto, valor_total,
            dps, idempresa
        ) = tokens[:EXPECTED_COLS]

        # PK composta obrigatória
        seq = to_int_required(sequencial)
        id_nota = to_int_required(idnota)
        id_svc = to_int_required(idservico)

        if seq is None or id_nota is None or id_svc is None:
            print(f"  [AVISO] Linha {lineno} ignorada (PK incompleta — "
                  f"sequencial={sequencial}, idnota={idnota}, idservico={idservico})")
            skipped += 1
            continue

        records.append({
            "sequencial":     seq,
            "idnota":         id_nota,
            "idservico":      id_svc,
            "valor_unitario": to_numeric(valor_unitario),
            "quantidade":     to_numeric(quantidade),
            "desconto":       to_numeric(desconto),
            "valor_total":    to_numeric(valor_total),
            "dps":            to_str(dps),
            "idempresa":      to_int(idempresa),   # 0 → NULL (campo opcional)
        })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas na leitura.")

    return records


# ── SQL de upsert ──────────────────────────────────────────────────────────────

UPSERT_SQL = """
    INSERT INTO nota_fiscal_servico (
        idnota, sequencial, idservico,
        valor_unitario, quantidade, desconto, valor_total,
        dps, idempresa
    )
    VALUES %s
    ON CONFLICT (idnota, sequencial, idservico) DO UPDATE SET
        valor_unitario = EXCLUDED.valor_unitario,
        quantidade     = EXCLUDED.quantidade,
        desconto       = EXCLUDED.desconto,
        valor_total    = EXCLUDED.valor_total,
        dps            = EXCLUDED.dps,
        idempresa      = EXCLUDED.idempresa
"""


# ── Corrige PK da tabela se estiver incompleta ────────────────────────────────

def ensure_composite_pk(conn):
    """
    O banco legado criou a tabela com PK apenas em idnota.
    O modelo correto exige PK composta (idnota, sequencial, idservico).
    Esta função detecta e corrige a constraint antes da importação.
    """
    with conn.cursor() as cur:
        cur.execute("""
            SELECT array_agg(kcu.column_name::text ORDER BY kcu.ordinal_position)
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'nota_fiscal_servico'
              AND tc.constraint_type = 'PRIMARY KEY'
        """)
        row = cur.fetchone()
        current_pk = row[0] if row else []

    expected_pk = ["idnota", "sequencial", "idservico"]
    if current_pk == expected_pk:
        return  # já está correto

    print(f"  [SCHEMA] PK atual: {current_pk} -> corrigindo para {expected_pk}...")
    with conn.cursor() as cur:
        # Remove FK de nota_fiscal que aponta para esta tabela (se existir)
        cur.execute("""
            SELECT tc.constraint_name, tc.table_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.referential_constraints rc
              ON tc.constraint_name = rc.constraint_name
            JOIN information_schema.table_constraints tc2
              ON rc.unique_constraint_name = tc2.constraint_name
            WHERE tc2.table_name = 'nota_fiscal_servico'
        """)
        fk_deps = cur.fetchall()
        for fk_name, fk_table in fk_deps:
            cur.execute(f'ALTER TABLE "{fk_table}" DROP CONSTRAINT IF EXISTS "{fk_name}"')
            print(f"    Removida FK dependente: {fk_table}.{fk_name}")

        # Trunca tabela (dados legados inválidos com PK simples)
        cur.execute("TRUNCATE TABLE nota_fiscal_servico")

        # Recria PK composta
        cur.execute("ALTER TABLE nota_fiscal_servico DROP CONSTRAINT IF EXISTS nota_fiscal_servico_pkey")
        cur.execute("""
            ALTER TABLE nota_fiscal_servico
            ADD CONSTRAINT nota_fiscal_servico_pkey
            PRIMARY KEY (idnota, sequencial, idservico)
        """)
    conn.commit()
    print("  [SCHEMA] PK composta criada com sucesso.")


# ── Carrega conjuntos de PKs válidas para validação de FK ─────────────────────

def load_valid_sets(conn) -> tuple[set, set, set]:
    with conn.cursor() as cur:
        cur.execute("SELECT idnota FROM nota_fiscal")
        notas = {row[0] for row in cur.fetchall()}

        cur.execute("SELECT idservico FROM tipos_servicos")
        servicos = {row[0] for row in cur.fetchall()}

        cur.execute("SELECT idempresa FROM empresa")
        empresas = {row[0] for row in cur.fetchall()}

    return notas, servicos, empresas


# ── Importação com validação de FK ─────────────────────────────────────────────

def import_records(records: list[dict], dry_run: bool = False):
    if dry_run:
        print(f"\n[DRY-RUN] {len(records)} registro(s) seriam processados (sem gravar):")
        for r in records[:20]:
            print(
                f"  idnota={r['idnota']:>6}  seq={r['sequencial']:>4}  "
                f"svc={r['idservico']:>6}  qtd={r['quantidade']}  "
                f"total={r['valor_total']}  emp={r['idempresa']}"
            )
        if len(records) > 20:
            print(f"  ... e mais {len(records) - 20} registro(s).")
        return

    conn = psycopg2.connect(DB_URL)
    try:
        ensure_composite_pk(conn)
        with conn:
            print("  Carregando chaves válidas do banco...")
            notas_ok, servicos_ok, empresas_ok = load_valid_sets(conn)

            valid = []
            ign_nota = ign_svc = ign_emp = 0

            for r in records:
                # FK obrigatória: idnota
                if r["idnota"] not in notas_ok:
                    ign_nota += 1
                    continue
                # FK obrigatória: idservico
                if r["idservico"] not in servicos_ok:
                    ign_svc += 1
                    continue
                # FK opcional: idempresa (apenas valida se não for NULL)
                if r["idempresa"] is not None and r["idempresa"] not in empresas_ok:
                    ign_emp += 1
                    continue
                valid.append(r)

            # Relatório de rejeições
            total_ign = ign_nota + ign_svc + ign_emp
            if total_ign:
                print(f"  Registros ignorados por FK inválida:")
                if ign_nota:
                    print(f"    • {ign_nota:>5}  idnota não encontrado em nota_fiscal")
                if ign_svc:
                    print(f"    • {ign_svc:>5}  idservico não encontrado em tipos_servicos")
                if ign_emp:
                    print(f"    • {ign_emp:>5}  idempresa não encontrado em empresa")

            if not valid:
                print("  Nenhum registro válido para importar.")
                return

            values = [
                (
                    r["idnota"], r["sequencial"], r["idservico"],
                    r["valor_unitario"], r["quantidade"], r["desconto"], r["valor_total"],
                    r["dps"], r["idempresa"],
                )
                for r in valid
            ]

            with conn.cursor() as cur:
                execute_values(cur, UPSERT_SQL, values)
                print(f"  {cur.rowcount} linha(s) afetadas "
                      f"({len(valid)} válidos de {len(records)} lidos).")
    finally:
        conn.close()


# ── Entry point ────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Importa NFS.d (Progress 9.1) → PostgreSQL tabela nota_fiscal_servico (upsert)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "NFS.d"),
        help="Caminho para o arquivo .d (padrão: EXTRACAO/NFS.d)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Exibe os dados lidos sem gravar no banco",
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
