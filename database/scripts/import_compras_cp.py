"""
import_compras_cp.py — Importa compras, itens e contas_pagar a partir de dumps Progress 9.1E (.d)

Sequência de carga:
  1. Importa compras.d   → tabela 'compras'
  2. Importa itens_co.d  → tabela 'compra_itens'
  3. Importa contas_p.d  → tabela 'contas_pagar'

Colunas esperadas (na ordem do dump):

compras.d — 25 tokens:
  idcompras, idfornecedor, valor, parcelas, emissao, frete, serie, ir,
  observacao, idfluxo, inss, vencimento, idempresa, situacao, data_quitacao,
  base_calculo, icms, base_icms, seguro, desconto, ipi, valor_produto,
  forma_pagamento, codigo_importado, nota

itens_co.d — 7 tokens:
  idcompras, idproduto, quantidade, valor_unitario, valor_total, idequipamento, km

contas_p.d — 11 tokens:
  idcontaspagar, vencimento, valor, valor_pago, situacao, parcela,
  idcompras, ultimo_pagamento, desconto, observacao, valor_original

FKs verificadas:
  compras      → idfornecedor (fornecedor), idempresa (empresa), idfluxo (fluxo_financeiro)
  compra_itens → idcompras (compras), idproduto (produtos_servicos), idequipamento (equipamento)
  contas_pagar → idcompras (compras)

Comportamento:
  - PK existente → UPDATE (upsert via ON CONFLICT)
  - FK não encontrada → avisa e pula o registro (exceto idfluxo que é anulado)
  - idfluxo não encontrado → define NULL e continua (campo menos crítico)

Uso:
    python import_compras_cp.py
    python import_compras_cp.py --dry-run
    python import_compras_cp.py --compras outro/compras.d --itens outro/itens_co.d --contas outro/contas_p.d
"""

import os
import re
import sys
import argparse
from datetime import date
import psycopg2

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:r0nN1E@localhost:5433/DECISIUM_LOPA"
)
FILE_ENCODING = "latin-1"

COMPRAS_COLS = 25
ITENS_COLS   = 7
CONTAS_COLS  = 11

_TOKEN_RE = re.compile(r'"((?:[^"\\]|\\.)*)"|(\?)|(\S+)')


# ─── Parser de linha ──────────────────────────────────────────────────────────

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


# ─── Conversores ─────────────────────────────────────────────────────────────

def to_str(val: str | None) -> str | None:
    if val is None:
        return None
    stripped = val.strip()
    return None if stripped == "" else stripped


def to_int(val: str | None) -> int | None:
    if val is None or val == "":
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def to_decimal(val: str | None) -> float | None:
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def to_bool(val: str | None) -> bool:
    if val is None:
        return False
    return val.lower() in ("yes", "true", "1")


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


# ─── Leitura de arquivo .d ───────────────────────────────────────────────────

def read_d_file(path: str, expected_cols: int, label: str) -> list[list[str | None]]:
    """Lê um arquivo .d do Progress e retorna lista de listas de tokens."""
    rows = []
    skipped = 0

    with open(path, encoding=FILE_ENCODING, errors="replace") as f:
        raw_lines = f.readlines()

    # Junta linhas quebradas no meio de strings entre aspas
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

        if len(tokens) < expected_cols:
            print(f"  [AVISO] {label} linha {lineno} ignorada "
                  f"({len(tokens)} campos, esperado {expected_cols}): {raw.rstrip()[:80]}")
            skipped += 1
            continue

        rows.append(tokens[:expected_cols])

    if skipped:
        print(f"  {skipped} linha(s) ignoradas em {label}.")

    return rows


# ─── Parsers de domínio ───────────────────────────────────────────────────────

def parse_compras(rows: list) -> list[dict]:
    records = []
    for tokens in rows:
        (
            idcompras, idfornecedor, valor, parcelas, emissao,
            frete, serie, ir, observacao, idfluxo,
            inss, vencimento, idempresa, situacao, data_quitacao,
            base_calculo, icms, base_icms, seguro, desconto,
            ipi, valor_produto,
            forma_pagamento,
            codigo_importado, nota
        ) = tokens

        pk = to_int(idcompras)
        if pk is None:
            print("  [AVISO] compras: idcompras vazio — linha ignorada.")
            continue

        records.append({
            "idcompras":        pk,
            "idfornecedor":     to_int(idfornecedor),
            "valor":            to_decimal(valor),
            "parcelas":         to_int(parcelas),
            "emissao":          to_date(emissao),
            "frete":            to_decimal(frete),
            "serie":            to_str(serie),
            "ir":               to_decimal(ir),
            "observacao":       to_str(observacao),
            "idfluxo":          to_str(idfluxo),
            "inss":             to_decimal(inss),
            "vencimento":       to_date(vencimento),
            "idempresa":        to_int(idempresa),
            "situacao":         to_bool(situacao),
            "data_quitacao":    to_date(data_quitacao),
            "base_calculo":     to_decimal(base_calculo),
            "icms":             to_decimal(icms),
            "base_icms":        to_decimal(base_icms),
            "seguro":           to_decimal(seguro),
            "desconto":         to_decimal(desconto),
            "ipi":              to_decimal(ipi),
            "valor_produto":    to_decimal(valor_produto),
            "forma_pagamento":  to_str(forma_pagamento),
            "codigo_importado": to_int(codigo_importado),
            "nota":             to_str(nota),
        })
    return records


def parse_itens(rows: list) -> list[dict]:
    records = []
    for tokens in rows:
        idcompras, idproduto, quantidade, valor_unitario, valor_total, idequipamento, km = tokens

        fk_compras = to_int(idcompras)
        fk_produto  = to_int(idproduto)
        fk_equip    = to_int(idequipamento)

        if fk_compras is None or fk_produto is None or fk_equip is None:
            print(f"  [AVISO] compra_itens: PK composta inválida "
                  f"(idcompras={idcompras}, idproduto={idproduto}, idequipamento={idequipamento}) — linha ignorada.")
            continue

        records.append({
            "idcompras":      fk_compras,
            "idproduto":      fk_produto,
            "idequipamento":  fk_equip,
            "quantidade":     to_decimal(quantidade),
            "valor_unitario": to_decimal(valor_unitario),
            "valor_total":    to_decimal(valor_total),
            "km":             to_int(km),
        })
    return records


def parse_contas_pagar(rows: list) -> list[dict]:
    records = []
    for tokens in rows:
        (
            idcontaspagar, vencimento, valor, valor_pago, situacao,
            parcela, idcompras, ultimo_pagamento, desconto, observacao, valor_original
        ) = tokens

        pk = to_int(idcontaspagar)
        if pk is None:
            print("  [AVISO] contas_pagar: idcontaspagar vazio — linha ignorada.")
            continue

        records.append({
            "idcontaspagar":    pk,
            "vencimento":       to_date(vencimento),
            "valor":            to_decimal(valor),
            "valor_pago":       to_decimal(valor_pago),
            "situacao":         to_bool(situacao),
            "parcela":          to_str(parcela),
            "idcompras":        to_int(idcompras),
            "ultimo_pagamento": to_date(ultimo_pagamento),
            "desconto":         to_decimal(desconto),
            "observacao":       to_str(observacao),
            "valor_original":   to_decimal(valor_original),
        })
    return records


# ─── SQLs de upsert ───────────────────────────────────────────────────────────

UPSERT_COMPRAS = """
    INSERT INTO compras (
        idcompras, idfornecedor, valor, parcelas, emissao, frete, serie, ir,
        observacao, idfluxo, inss, vencimento, idempresa, situacao, data_quitacao,
        base_calculo, icms, base_icms, seguro, desconto, ipi, valor_produto,
        forma_pagamento, codigo_importado, nota
    )
    VALUES (
        %(idcompras)s, %(idfornecedor)s, %(valor)s, %(parcelas)s, %(emissao)s,
        %(frete)s, %(serie)s, %(ir)s, %(observacao)s, %(idfluxo)s,
        %(inss)s, %(vencimento)s, %(idempresa)s, %(situacao)s, %(data_quitacao)s,
        %(base_calculo)s, %(icms)s, %(base_icms)s, %(seguro)s, %(desconto)s,
        %(ipi)s, %(valor_produto)s, %(forma_pagamento)s, %(codigo_importado)s, %(nota)s
    )
    ON CONFLICT (idcompras) DO UPDATE SET
        idfornecedor     = EXCLUDED.idfornecedor,
        valor            = EXCLUDED.valor,
        parcelas         = EXCLUDED.parcelas,
        emissao          = EXCLUDED.emissao,
        frete            = EXCLUDED.frete,
        serie            = EXCLUDED.serie,
        ir               = EXCLUDED.ir,
        observacao       = EXCLUDED.observacao,
        idfluxo          = EXCLUDED.idfluxo,
        inss             = EXCLUDED.inss,
        vencimento       = EXCLUDED.vencimento,
        idempresa        = EXCLUDED.idempresa,
        situacao         = EXCLUDED.situacao,
        data_quitacao    = EXCLUDED.data_quitacao,
        base_calculo     = EXCLUDED.base_calculo,
        icms             = EXCLUDED.icms,
        base_icms        = EXCLUDED.base_icms,
        seguro           = EXCLUDED.seguro,
        desconto         = EXCLUDED.desconto,
        ipi              = EXCLUDED.ipi,
        valor_produto    = EXCLUDED.valor_produto,
        forma_pagamento  = EXCLUDED.forma_pagamento,
        codigo_importado = EXCLUDED.codigo_importado,
        nota             = EXCLUDED.nota
"""

UPSERT_ITENS = """
    INSERT INTO compra_itens (
        idcompras, idproduto, idequipamento,
        quantidade, valor_unitario, valor_total, km
    )
    VALUES (
        %(idcompras)s, %(idproduto)s, %(idequipamento)s,
        %(quantidade)s, %(valor_unitario)s, %(valor_total)s, %(km)s
    )
    ON CONFLICT (idcompras, idproduto, idequipamento) DO UPDATE SET
        quantidade     = EXCLUDED.quantidade,
        valor_unitario = EXCLUDED.valor_unitario,
        valor_total    = EXCLUDED.valor_total,
        km             = EXCLUDED.km
"""

UPSERT_CONTAS_PAGAR = """
    INSERT INTO contas_pagar (
        idcontaspagar, vencimento, valor, valor_pago, situacao,
        parcela, idcompras, ultimo_pagamento, desconto, observacao, valor_original
    )
    VALUES (
        %(idcontaspagar)s, %(vencimento)s, %(valor)s, %(valor_pago)s, %(situacao)s,
        %(parcela)s, %(idcompras)s, %(ultimo_pagamento)s, %(desconto)s,
        %(observacao)s, %(valor_original)s
    )
    ON CONFLICT (idcontaspagar) DO UPDATE SET
        vencimento       = EXCLUDED.vencimento,
        valor            = EXCLUDED.valor,
        valor_pago       = EXCLUDED.valor_pago,
        situacao         = EXCLUDED.situacao,
        parcela          = EXCLUDED.parcela,
        idcompras        = EXCLUDED.idcompras,
        ultimo_pagamento = EXCLUDED.ultimo_pagamento,
        desconto         = EXCLUDED.desconto,
        observacao       = EXCLUDED.observacao,
        valor_original   = EXCLUDED.valor_original
"""


# ─── Funções de importação ────────────────────────────────────────────────────

def import_compras(records: list[dict], cur,
                   valid_fornecedores: set, valid_fluxos: set, valid_empresas: set) -> tuple[int, int]:
    processados = 0
    pulados_fk  = 0

    for r in records:
        if r["idfornecedor"] is not None and r["idfornecedor"] not in valid_fornecedores:
            print(f"  [FK] compras id={r['idcompras']}: "
                  f"idfornecedor={r['idfornecedor']} não encontrado — registro pulado.")
            pulados_fk += 1
            continue

        if r["idempresa"] is not None and r["idempresa"] not in valid_empresas:
            print(f"  [FK] compras id={r['idcompras']}: "
                  f"idempresa={r['idempresa']} não encontrado — registro pulado.")
            pulados_fk += 1
            continue

        # idfluxo: anula ao invés de pular
        if r["idfluxo"] is not None and r["idfluxo"] not in valid_fluxos:
            print(f"  [FK] compras id={r['idcompras']}: "
                  f"idfluxo='{r['idfluxo']}' não encontrado — definido como NULL.")
            r = {**r, "idfluxo": None}

        cur.execute(UPSERT_COMPRAS, r)
        processados += 1

    return processados, pulados_fk


def import_itens(records: list[dict], cur,
                 valid_compras: set, valid_produtos: set, valid_equipamentos: set) -> tuple[int, int]:
    processados = 0
    pulados_fk  = 0

    for r in records:
        if r["idcompras"] not in valid_compras:
            print(f"  [FK] compra_itens compra={r['idcompras']} prod={r['idproduto']}: "
                  f"idcompras não encontrado — registro pulado.")
            pulados_fk += 1
            continue

        if r["idproduto"] not in valid_produtos:
            print(f"  [FK] compra_itens compra={r['idcompras']} prod={r['idproduto']}: "
                  f"idproduto não encontrado — registro pulado.")
            pulados_fk += 1
            continue

        if r["idequipamento"] not in valid_equipamentos:
            print(f"  [FK] compra_itens compra={r['idcompras']} equip={r['idequipamento']}: "
                  f"idequipamento não encontrado — registro pulado.")
            pulados_fk += 1
            continue

        cur.execute(UPSERT_ITENS, r)
        processados += 1

    return processados, pulados_fk


def import_contas_pagar(records: list[dict], cur, valid_compras: set) -> tuple[int, int]:
    processados = 0
    pulados_fk  = 0

    for r in records:
        if r["idcompras"] is not None and r["idcompras"] not in valid_compras:
            print(f"  [FK] contas_pagar id={r['idcontaspagar']}: "
                  f"idcompras={r['idcompras']} não encontrado — registro pulado.")
            pulados_fk += 1
            continue

        cur.execute(UPSERT_CONTAS_PAGAR, r)
        processados += 1

    return processados, pulados_fk


# ─── Auxiliar ─────────────────────────────────────────────────────────────────

def load_valid_ids(cur, table: str, pk_col: str) -> set:
    cur.execute(f"SELECT {pk_col} FROM {table}")
    return {row[0] for row in cur.fetchall()}


# ─── Orquestrador ─────────────────────────────────────────────────────────────

def run(compras_path: str, itens_path: str, contas_path: str, dry_run: bool = False):
    sep = "=" * 60

    # ── Leitura dos três arquivos ─────────────────────────────────
    print(sep)
    print("ETAPA 1 — Lendo compras.d")
    print(f"  Arquivo: {compras_path}")
    compras_records = parse_compras(read_d_file(compras_path, COMPRAS_COLS, "compras.d"))
    print(f"  {len(compras_records)} registro(s) lidos.")

    print()
    print("ETAPA 2 — Lendo itens_co.d")
    print(f"  Arquivo: {itens_path}")
    itens_records = parse_itens(read_d_file(itens_path, ITENS_COLS, "itens_co.d"))
    print(f"  {len(itens_records)} registro(s) lidos.")

    print()
    print("ETAPA 3 — Lendo contas_p.d")
    print(f"  Arquivo: {contas_path}")
    contas_records = parse_contas_pagar(read_d_file(contas_path, CONTAS_COLS, "contas_p.d"))
    print(f"  {len(contas_records)} registro(s) lidos.")

    # ── Dry-run ───────────────────────────────────────────────────
    if dry_run:
        print()
        print(sep)
        print("[DRY-RUN] Nenhum dado será gravado.\n")
        print("--- COMPRAS (primeiros 10) ---")
        for r in compras_records[:10]:
            print(f"  id={r['idcompras']:>5}  forn={str(r['idfornecedor']):>5}"
                  f"  valor={r['valor']}  emissao={r['emissao']}  nota={r['nota']}")
        if len(compras_records) > 10:
            print(f"  ... e mais {len(compras_records) - 10} registro(s).")
        print()
        print("--- ITENS (primeiros 10) ---")
        for r in itens_records[:10]:
            print(f"  compra={r['idcompras']:>5}  prod={r['idproduto']:>5}"
                  f"  equip={r['idequipamento']:>5}  qtd={r['quantidade']}  vl={r['valor_total']}")
        if len(itens_records) > 10:
            print(f"  ... e mais {len(itens_records) - 10} registro(s).")
        print()
        print("--- CONTAS A PAGAR (primeiros 10) ---")
        for r in contas_records[:10]:
            print(f"  id={r['idcontaspagar']:>5}  compra={str(r['idcompras']):>5}"
                  f"  parcela={r['parcela']}  valor={r['valor']}  venc={r['vencimento']}")
        if len(contas_records) > 10:
            print(f"  ... e mais {len(contas_records) - 10} registro(s).")
        return

    # ── Importação real ───────────────────────────────────────────
    print()
    print(sep)
    print(f"Conectando ao banco: {DB_URL.split('@')[-1]}")
    conn = psycopg2.connect(DB_URL)

    ins_c = skip_c = ins_i = skip_i = ins_cp = skip_cp = 0

    try:
        with conn:
            with conn.cursor() as cur:
                print("\nCarregando chaves estrangeiras do banco...")
                valid_fornecedores  = load_valid_ids(cur, "fornecedor",       "idfornecedor")
                valid_fluxos        = load_valid_ids(cur, "fluxo_financeiro", "idfluxo")
                valid_empresas      = load_valid_ids(cur, "empresa",          "idempresa")
                valid_produtos      = load_valid_ids(cur, "produtos_servicos","idproduto")
                valid_equipamentos  = load_valid_ids(cur, "equipamento",      "idequipamento")
                print(f"  fornecedor       : {len(valid_fornecedores)} registros")
                print(f"  fluxo_financeiro : {len(valid_fluxos)} registros")
                print(f"  empresa          : {len(valid_empresas)} registros")
                print(f"  produtos_servicos: {len(valid_produtos)} registros")
                print(f"  equipamento      : {len(valid_equipamentos)} registros")

                # Etapa 4: importa compras
                print()
                print("ETAPA 4 — Importando compras...")
                ins_c, skip_c = import_compras(
                    compras_records, cur,
                    valid_fornecedores, valid_fluxos, valid_empresas
                )
                print(f"  {ins_c} compra(s) importadas, {skip_c} puladas por FK inválida.")

                # Recarrega IDs de compras para validar itens e contas_pagar
                valid_compras = load_valid_ids(cur, "compras", "idcompras")
                print(f"  compras no banco: {len(valid_compras)}")

                # Etapa 5: importa itens da compra
                print()
                print("ETAPA 5 — Importando compra_itens...")
                ins_i, skip_i = import_itens(
                    itens_records, cur,
                    valid_compras, valid_produtos, valid_equipamentos
                )
                print(f"  {ins_i} item(ns) importados, {skip_i} pulados por FK inválida.")

                # Etapa 6: importa contas_pagar
                print()
                print("ETAPA 6 — Importando contas_pagar...")
                ins_cp, skip_cp = import_contas_pagar(
                    contas_records, cur, valid_compras
                )
                print(f"  {ins_cp} conta(s) a pagar importadas, {skip_cp} puladas por FK inválida.")

    finally:
        conn.close()

    print()
    print(sep)
    print("Concluído.")
    print(f"  Compras      : {ins_c:>5} importadas  |  {skip_c:>4} puladas")
    print(f"  Itens        : {ins_i:>5} importados  |  {skip_i:>4} pulados")
    print(f"  Contas Pagar : {ins_cp:>5} importadas  |  {skip_cp:>4} puladas")


# ─── Entry point ─────────────────────────────────────────────────────────────

def main():
    base = os.path.join(os.path.dirname(__file__), "EXTRACAO")

    parser = argparse.ArgumentParser(
        description="Importa compras.d + itens_co.d + contas_p.d → PostgreSQL (upsert por PK)"
    )
    parser.add_argument(
        "--compras",
        default=os.path.join(base, "compras.d"),
        help="Caminho para compras.d (padrão: EXTRACAO/compras.d)",
    )
    parser.add_argument(
        "--itens",
        default=os.path.join(base, "itens_co.d"),
        help="Caminho para itens_co.d (padrão: EXTRACAO/itens_co.d)",
    )
    parser.add_argument(
        "--contas",
        default=os.path.join(base, "contas_p.d"),
        help="Caminho para contas_p.d (padrão: EXTRACAO/contas_p.d)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Exibe os dados sem gravar no banco",
    )
    args = parser.parse_args()

    for label, path in [("compras", args.compras), ("itens", args.itens), ("contas", args.contas)]:
        if not os.path.exists(path):
            print(f"[ERRO] Arquivo não encontrado ({label}): {path}")
            sys.exit(1)

    print(f"Banco    : {DB_URL.split('@')[-1]}")
    print(f"Modo     : {'DRY-RUN' if args.dry_run else 'IMPORTAÇÃO (upsert)'}")
    print("-" * 60)

    run(args.compras, args.itens, args.contas, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
