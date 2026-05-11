"""
import_conhecimento.py — Importa tabela 'conhecimento' a partir de dump Progress 9.1E (.d)

Colunas esperadas (na ordem do dump) — 46 campos:
  idconhecimento, data, natureza_prestacao, codigo_natureza, remetente, destinatario,
  forma_pagamento, notas_fiscais, como_sera_pago, natureza_carga, quantidade, especie,
  peso, valor_mercadoria, marca, placa, local, estado, local_coleta, local_entrega,
  frete_valor, sec_cat, seguro, pedagio, outros, total_frete, base_calculo, aliquota,
  icms, idfuncionario, observacao, data_pagamento, vencimento, idfechamento, idempresa,
  cfop, previsao_entrega, idequipamento, chave, idcte, cancelado, protocolo_cte,
  justificativa, tomador, numero_cte, texto_outros

Uso:
    python import_conhecimento.py
    python import_conhecimento.py caminho/para/conhecim.d
    python import_conhecimento.py conhecim.d --dry-run
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
EXPECTED_COLS = 46

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


def to_str_trunc(val: str | None, maxlen: int) -> str | None:
    """Converte para str truncando ao limite da coluna no banco."""
    s = to_str(val)
    if s is None:
        return None
    return s[:maxlen] if len(s) > maxlen else s


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
            idconhecimento, data, natureza_prestacao, codigo_natureza,
            remetente, destinatario, forma_pagamento, notas_fiscais,
            como_sera_pago, natureza_carga, quantidade, especie,
            peso, valor_mercadoria, marca, placa, local, estado,
            local_coleta, local_entrega, frete_valor, sec_cat, seguro,
            pedagio, outros, total_frete, base_calculo, aliquota, icms,
            idfuncionario, observacao, data_pagamento, vencimento,
            idfechamento, idempresa, cfop, previsao_entrega, idequipamento,
            chave, idcte, cancelado, protocolo_cte, justificativa,
            tomador, numero_cte, texto_outros
        ) = tokens[:EXPECTED_COLS]

        if not idconhecimento:
            print(f"  [AVISO] Linha {lineno} ignorada (idconhecimento vazio): {raw.rstrip()[:80]}")
            skipped += 1
            continue

        records.append({
            "idconhecimento":    int(idconhecimento),
            "data":              to_date(data),
            "natureza_prestacao": to_str_trunc(natureza_prestacao, 50),
            "codigo_natureza":   to_int_zero(codigo_natureza),
            "remetente":         to_int(remetente),
            "destinatario":      to_int(destinatario),
            "forma_pagamento":   to_str_trunc(forma_pagamento, 20),
            "notas_fiscais":     to_str_trunc(notas_fiscais, 100),
            "como_sera_pago":    to_str_trunc(como_sera_pago, 15),
            "natureza_carga":    to_str_trunc(natureza_carga, 30),
            "quantidade":        to_int_zero(quantidade),
            "especie":           to_str_trunc(especie, 30),
            "peso":              to_numeric(peso),
            "valor_mercadoria":  to_numeric(valor_mercadoria),
            "marca":             to_str_trunc(marca, 30),
            "placa":             to_str_trunc(placa, 8),
            "local":             to_str_trunc(local, 30),
            "estado":            to_str_trunc(estado, 2),
            "local_coleta":      to_str_trunc(local_coleta, 50),
            "local_entrega":     to_str_trunc(local_entrega, 50),
            "frete_valor":       to_numeric(frete_valor),
            "sec_cat":           to_numeric(sec_cat),
            "seguro":            to_numeric(seguro),
            "pedagio":           to_numeric(pedagio),
            "outros":            to_numeric(outros),
            "total_frete":       to_numeric(total_frete),
            "base_calculo":      to_numeric(base_calculo),
            "aliquota":          to_numeric(aliquota),
            "icms":              to_numeric(icms),
            "idfuncionario":     to_int(idfuncionario),
            "observacao":        to_str(observacao),
            "data_pagamento":    to_date(data_pagamento),
            "vencimento":        to_date(vencimento),
            "idfechamento":      to_int(idfechamento),
            "idempresa":         to_int(idempresa),
            "cfop":              to_str_trunc(cfop, 10),
            "previsao_entrega":  to_date(previsao_entrega),
            "idequipamento":     to_int(idequipamento),
            "chave":             to_str_trunc(chave, 50),
            "idcte":             to_str_trunc(idcte, 50),
            "cancelado":         to_str_trunc(cancelado, 50),
            "protocolo_cte":     to_str_trunc(protocolo_cte, 50),
            "justificativa":     to_str_trunc(justificativa, 250),
            "tomador":           to_int(tomador),
            "numero_cte":        to_int_zero(numero_cte),
            "texto_outros":      to_str_trunc(texto_outros, 100),
        })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")

    return records


# Upsert para registros com idconhecimento > 0 (PK conhecida)
UPSERT_SQL = """
    INSERT INTO conhecimento (
        idconhecimento, data, natureza_prestacao, codigo_natureza,
        remetente, destinatario, forma_pagamento, notas_fiscais,
        como_sera_pago, natureza_carga, quantidade, especie,
        peso, valor_mercadoria, marca, placa, local, estado,
        local_coleta, local_entrega, frete_valor, sec_cat, seguro,
        pedagio, outros, total_frete, base_calculo, aliquota, icms,
        idfuncionario, observacao, data_pagamento, vencimento,
        idfechamento, idempresa, cfop, previsao_entrega, idequipamento,
        chave, idcte, cancelado, protocolo_cte, justificativa,
        tomador, numero_cte, texto_outros
    )
    VALUES %s
    ON CONFLICT (idconhecimento) DO UPDATE SET
        data              = EXCLUDED.data,
        natureza_prestacao = EXCLUDED.natureza_prestacao,
        codigo_natureza   = EXCLUDED.codigo_natureza,
        remetente         = EXCLUDED.remetente,
        destinatario      = EXCLUDED.destinatario,
        forma_pagamento   = EXCLUDED.forma_pagamento,
        notas_fiscais     = EXCLUDED.notas_fiscais,
        como_sera_pago    = EXCLUDED.como_sera_pago,
        natureza_carga    = EXCLUDED.natureza_carga,
        quantidade        = EXCLUDED.quantidade,
        especie           = EXCLUDED.especie,
        peso              = EXCLUDED.peso,
        valor_mercadoria  = EXCLUDED.valor_mercadoria,
        marca             = EXCLUDED.marca,
        placa             = EXCLUDED.placa,
        local             = EXCLUDED.local,
        estado            = EXCLUDED.estado,
        local_coleta      = EXCLUDED.local_coleta,
        local_entrega     = EXCLUDED.local_entrega,
        frete_valor       = EXCLUDED.frete_valor,
        sec_cat           = EXCLUDED.sec_cat,
        seguro            = EXCLUDED.seguro,
        pedagio           = EXCLUDED.pedagio,
        outros            = EXCLUDED.outros,
        total_frete       = EXCLUDED.total_frete,
        base_calculo      = EXCLUDED.base_calculo,
        aliquota          = EXCLUDED.aliquota,
        icms              = EXCLUDED.icms,
        idfuncionario     = EXCLUDED.idfuncionario,
        observacao        = EXCLUDED.observacao,
        data_pagamento    = EXCLUDED.data_pagamento,
        vencimento        = EXCLUDED.vencimento,
        idfechamento      = EXCLUDED.idfechamento,
        idempresa         = EXCLUDED.idempresa,
        cfop              = EXCLUDED.cfop,
        previsao_entrega  = EXCLUDED.previsao_entrega,
        idequipamento     = EXCLUDED.idequipamento,
        chave             = EXCLUDED.chave,
        idcte             = EXCLUDED.idcte,
        cancelado         = EXCLUDED.cancelado,
        protocolo_cte     = EXCLUDED.protocolo_cte,
        justificativa     = EXCLUDED.justificativa,
        tomador           = EXCLUDED.tomador,
        numero_cte        = EXCLUDED.numero_cte,
        texto_outros      = EXCLUDED.texto_outros
"""

# Insert simples para registros com idconhecimento=0 (PK gerada pela sequence)
INSERT_SQL = """
    INSERT INTO conhecimento (
        data, natureza_prestacao, codigo_natureza,
        remetente, destinatario, forma_pagamento, notas_fiscais,
        como_sera_pago, natureza_carga, quantidade, especie,
        peso, valor_mercadoria, marca, placa, local, estado,
        local_coleta, local_entrega, frete_valor, sec_cat, seguro,
        pedagio, outros, total_frete, base_calculo, aliquota, icms,
        idfuncionario, observacao, data_pagamento, vencimento,
        idfechamento, idempresa, cfop, previsao_entrega, idequipamento,
        chave, idcte, cancelado, protocolo_cte, justificativa,
        tomador, numero_cte, texto_outros
    )
    VALUES %s
"""


def _make_tuple(r: dict, include_id: bool) -> tuple:
    base = (
        r["data"], r["natureza_prestacao"], r["codigo_natureza"],
        r["remetente"], r["destinatario"], r["forma_pagamento"], r["notas_fiscais"],
        r["como_sera_pago"], r["natureza_carga"], r["quantidade"], r["especie"],
        r["peso"], r["valor_mercadoria"], r["marca"], r["placa"],
        r["local"], r["estado"], r["local_coleta"], r["local_entrega"],
        r["frete_valor"], r["sec_cat"], r["seguro"], r["pedagio"], r["outros"],
        r["total_frete"], r["base_calculo"], r["aliquota"], r["icms"],
        r["idfuncionario"], r["observacao"], r["data_pagamento"], r["vencimento"],
        r["idfechamento"], r["idempresa"], r["cfop"], r["previsao_entrega"],
        r["idequipamento"], r["chave"], r["idcte"], r["cancelado"],
        r["protocolo_cte"], r["justificativa"], r["tomador"],
        r["numero_cte"], r["texto_outros"],
    )
    return (r["idconhecimento"],) + base if include_id else base


def import_records(records: list[dict], dry_run: bool = False):
    # Separar registros com PK real dos sem PK (id=0 no legado)
    seen_ids: set[int] = set()
    with_id: list[dict] = []
    without_id: list[dict] = []
    skipped_invalid = 0

    for r in records:
        # Registros sem idempresa não podem ser inseridos (NOT NULL no banco)
        if r["idempresa"] is None:
            skipped_invalid += 1
            continue
        pk = r["idconhecimento"]
        if pk and pk > 0:
            if pk not in seen_ids:
                seen_ids.add(pk)
                with_id.append(r)
            # duplicatas com mesma PK: último vence — ignoramos as anteriores
        else:
            without_id.append(r)

    if skipped_invalid:
        print(f"  [AVISO] {skipped_invalid} registro(s) ignorados por idempresa=NULL (obrigatorio).")

    values_upsert = [_make_tuple(r, include_id=True)  for r in with_id]
    values_insert = [_make_tuple(r, include_id=False) for r in without_id]

    if dry_run:
        total = len(values_upsert) + len(values_insert)
        print(f"\n[DRY-RUN] {total} registro(s) seriam importados:")
        print(f"  - {len(values_upsert)} com idconhecimento definido (upsert)")
        print(f"  - {len(values_insert)} com idconhecimento=0  (insert, PK gerada automaticamente)")
        sample = [(r["idconhecimento"], r["data"], r["placa"], r["total_frete"]) for r in with_id[:10]]
        for pk, dt, placa, total in sample:
            print(f"  id={pk:>6}  data={dt}  placa={str(placa):<12}  total={total}")
        if len(with_id) > 10:
            print(f"  ... e mais {len(with_id) - 10} com PK + {len(without_id)} sem PK.")
        return

    conn = psycopg2.connect(DB_URL)
    try:
        with conn:
            with conn.cursor() as cur:
                affected = 0
                if values_upsert:
                    execute_values(cur, UPSERT_SQL, values_upsert)
                    affected += cur.rowcount
                    print(f"  {cur.rowcount} linha(s) upsert (PK conhecida).")
                    # Sincronizar sequence para evitar conflito de PK ao inserir sem id
                    cur.execute("""
                        SELECT setval(
                            pg_get_serial_sequence('conhecimento', 'idconhecimento'),
                            GREATEST((SELECT MAX(idconhecimento) FROM conhecimento), 1)
                        )
                    """)
                if values_insert:
                    execute_values(cur, INSERT_SQL, values_insert)
                    affected += cur.rowcount
                    print(f"  {cur.rowcount} linha(s) inseridas (PK=0, sequence gerada).")
                print(f"  Total: {affected} linha(s) afetadas.")
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Importa conhecim.d (Progress 9.1E) → PostgreSQL (upsert por idconhecimento)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "conhecim.d"),
        help="Caminho para o arquivo .d (padrão: EXTRACAO/conhecim.d)",
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
