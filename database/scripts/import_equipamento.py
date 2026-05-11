"""
import_equipamento.py — Importa tabela 'equipamento' a partir de dump Progress 9.1E (.d)

Colunas esperadas (na ordem do dump):
  idequipamento, nome, placa, valor, marca, modelo, ano_fabricacao, ano_modelo,
  valor_pago, antigo_dono, renavan, chassi, km_atual, idtipoequipamento, idfluxo,
  idempresa, data_aquisicao, km_inicial, gera_faturamento, observacao,
  tara, kilo, m3, rodado, carroceria, uflicencimento, tacografo, comprador

Notas:
  - gera_faturamento é booleano Progress (yes/no)
  - Datas no formato DD/MM/YY: ano < 50 → 20XX, ano >= 50 → 19XX
  - status não está no dump: definido como 'DISPONÍVEL' por padrão

Uso:
    python import_equipamento.py
    python import_equipamento.py caminho/para/equipame.d
    python import_equipamento.py equipame.d --dry-run
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
EXPECTED_COLS = 28

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


def to_numeric(val: str | None):
    if val is None or val == "":
        return None
    try:
        return float(val)
    except ValueError:
        return None


def to_bool(val: str | None) -> bool | None:
    if val is None:
        return None
    v = val.lower()
    if v == "yes":
        return True
    if v == "no":
        return False
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
        for lineno, raw in enumerate(f, start=1):
            line = raw.strip()
            if not line or line == ".":
                continue

            tokens = parse_progress_line(line)

            if len(tokens) < EXPECTED_COLS:
                print(f"  [AVISO] Linha {lineno} ignorada "
                      f"({len(tokens)} campos, esperado {EXPECTED_COLS}): {raw.rstrip()}")
                skipped += 1
                continue

            (
                idequipamento, nome, placa, valor, marca, modelo,
                ano_fabricacao, ano_modelo, valor_pago, antigo_dono,
                renavan, chassi, km_atual, idtipoequipamento, idfluxo,
                idempresa, data_aquisicao, km_inicial, gera_faturamento, observacao,
                tara, kilo, m3, rodado, carroceria, uflicencimento, tacografo, comprador
            ) = tokens[:EXPECTED_COLS]

            if not idequipamento:
                print(f"  [AVISO] Linha {lineno} ignorada (idequipamento vazio): {raw.rstrip()}")
                skipped += 1
                continue

            records.append({
                "idequipamento":    int(idequipamento),
                "nome":             to_str(nome),
                "placa":            to_str(placa),
                "valor":            to_numeric(valor),
                "marca":            to_str(marca),
                "modelo":           to_str(modelo),
                "ano_fabricacao":   to_int_zero(ano_fabricacao),
                "ano_modelo":       to_int_zero(ano_modelo),
                "valor_pago":       to_numeric(valor_pago),
                "antigo_dono":      to_str(antigo_dono),
                "renavan":          to_str(renavan),
                "chassi":           to_str(chassi),
                "km_atual":         to_int_zero(km_atual),
                "idtipoequipamento": to_int(idtipoequipamento),
                "idfluxo":          to_str(idfluxo),
                "idempresa":        to_int(idempresa),
                "data_aquisicao":   to_date(data_aquisicao),
                "km_inicial":       to_int_zero(km_inicial),
                "gera_faturamento": to_bool(gera_faturamento),
                "observacao":       to_str(observacao),
                "tara":             to_int_zero(tara),
                "kilo":             to_int_zero(kilo),
                "m3":               to_int_zero(m3),
                "rodado":           to_int_zero(rodado),
                "carroceria":       to_int_zero(carroceria),
                "uflicencimento":   to_str(uflicencimento),
                "tacografo":        to_date(tacografo),
                "comprador":        to_str(comprador),
                "status":           "DISPONÍVEL",
            })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")

    return records


UPSERT_SQL = """
    INSERT INTO equipamento (
        idequipamento, nome, placa, valor, marca, modelo,
        ano_fabricacao, ano_modelo, valor_pago, antigo_dono,
        renavan, chassi, km_atual, idtipoequipamento, idfluxo,
        idempresa, data_aquisicao, km_inicial, gera_faturamento, observacao,
        tara, kilo, m3, rodado, carroceria, uflicencimento, tacografo, comprador, status
    )
    VALUES %s
    ON CONFLICT (idequipamento) DO UPDATE SET
        nome             = EXCLUDED.nome,
        placa            = EXCLUDED.placa,
        valor            = EXCLUDED.valor,
        marca            = EXCLUDED.marca,
        modelo           = EXCLUDED.modelo,
        ano_fabricacao   = EXCLUDED.ano_fabricacao,
        ano_modelo       = EXCLUDED.ano_modelo,
        valor_pago       = EXCLUDED.valor_pago,
        antigo_dono      = EXCLUDED.antigo_dono,
        renavan          = EXCLUDED.renavan,
        chassi           = EXCLUDED.chassi,
        km_atual         = EXCLUDED.km_atual,
        idtipoequipamento = EXCLUDED.idtipoequipamento,
        idfluxo          = EXCLUDED.idfluxo,
        idempresa        = EXCLUDED.idempresa,
        data_aquisicao   = EXCLUDED.data_aquisicao,
        km_inicial       = EXCLUDED.km_inicial,
        gera_faturamento = EXCLUDED.gera_faturamento,
        observacao       = EXCLUDED.observacao,
        tara             = EXCLUDED.tara,
        kilo             = EXCLUDED.kilo,
        m3               = EXCLUDED.m3,
        rodado           = EXCLUDED.rodado,
        carroceria       = EXCLUDED.carroceria,
        uflicencimento   = EXCLUDED.uflicencimento,
        tacografo        = EXCLUDED.tacografo,
        comprador        = EXCLUDED.comprador,
        status           = EXCLUDED.status
"""


def import_records(records: list[dict], dry_run: bool = False):
    values = [
        (
            r["idequipamento"], r["nome"], r["placa"], r["valor"],
            r["marca"], r["modelo"], r["ano_fabricacao"], r["ano_modelo"],
            r["valor_pago"], r["antigo_dono"], r["renavan"], r["chassi"],
            r["km_atual"], r["idtipoequipamento"], r["idfluxo"], r["idempresa"],
            r["data_aquisicao"], r["km_inicial"], r["gera_faturamento"], r["observacao"],
            r["tara"], r["kilo"], r["m3"], r["rodado"], r["carroceria"],
            r["uflicencimento"], r["tacografo"], r["comprador"], r["status"],
        )
        for r in records
    ]

    if dry_run:
        print(f"\n[DRY-RUN] {len(values)} registro(s) seriam importados:")
        for v in values[:20]:
            print(f"  id={v[0]:>4}  nome={str(v[1]):<45}  "
                  f"placa={str(v[2]):<10}  empresa={v[15]}")
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
        description="Importa equipame.d (Progress 9.1E) → PostgreSQL (upsert por idequipamento)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "equipame.d"),
        help="Caminho para o arquivo .d (padrão: EXTRACAO/equipame.d na mesma pasta do script)",
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
