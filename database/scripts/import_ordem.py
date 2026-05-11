"""
import_ordem.py — Importa tabela 'ordem' a partir de dump Progress 9.1E (.d)

Fonte: ordem.d
Colunas na ordem real da extração (41 campos):
   1  idordem
   2  sequencial
   3  idcliente
   4  data
   5  inicio_01
   6  termino_01
   7  inicio_02
   8  termino_02
   9  valor_hora
  10  valor_servicos
  11  valor_os
  12  local_servico
  13  local_entrega
  14  km_inicio
  15  km_final
  16  km_total
  17  valor_km
  18  pedagio
  19  desconto
  20  saida
  21  escolta
  22  valor_frete
  23  servico_prestado
  24  idequipamento
  25  idfuncionario
  26  situacao           (yes/no → boolean)
  27  valor_pago
  28  idfluxo
  29  idempresa
  30  empresa_nota
  31  total_horas
  32  cidade_servico
  33  idfechamento
  34  porcentagem
  35  numero_os          (campo "NUMERO-OS" no Progress)
  36  cidade_entrega
  37  valor_total_km
  38  idconhecimento
  39  funcionario_2      (campo "FUNCIONARIO-2" no Progress)
  40  funcionario_3      (campo "FUNCIONARIO-3" no Progress)
  41  seguro             (campo "SEGURO" no Progress)

FKs validadas (registro ignorado se FK não existe e campo não é NULL):
  idempresa     → empresa.idempresa
  idequipamento → equipamento.idequipamento
  idfuncionario → funcionario.idfuncionario
  idfluxo       → fluxo_financeiro.idfluxo
  idfechamento  → fechamento.idfechamento
  idconhecimento → conhecimento.idconhecimento

Uso:
    python import_ordem.py
    python import_ordem.py caminho/para/ordem.d
    python import_ordem.py ordem.d --dry-run
"""

import os
import re
import sys
import argparse
from decimal import Decimal, InvalidOperation
from datetime import date
import psycopg2
from psycopg2.extras import execute_values

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:r0nN1E@localhost:5433/DECISIUM_LOPA"
)
FILE_ENCODING = "latin-1"
EXPECTED_COLS = 41

_TOKEN_RE = re.compile(r'"((?:[^"\\]|\\.)*)"|(\?)|(\S+)')
_PG_INT_MAX = 2_147_483_647
_PG_INT_MIN = -2_147_483_648


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


def to_int(val) -> int | None:
    if val is None or val == "" or val == "0":
        return None
    try:
        v = int(val)
        if v < _PG_INT_MIN or v > _PG_INT_MAX:
            return None
        return v
    except ValueError:
        return None


def to_int_zero(val) -> int | None:
    """Preserva 0 como valor válido. Retorna None se fora do range INTEGER do PostgreSQL."""
    if val is None or val == "":
        return None
    try:
        v = int(val)
        if v < _PG_INT_MIN or v > _PG_INT_MAX:
            return None
        return v
    except ValueError:
        return None


def to_decimal(val) -> Decimal | None:
    if val is None or val == "" or val == "0":
        return None
    try:
        return Decimal(str(val).replace(",", "."))
    except InvalidOperation:
        return None


def to_date(val) -> date | None:
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


def to_bool(val) -> bool | None:
    if val is None or val == "":
        return None
    return val.lower() in ("yes", "true", "1", "t")


def read_d_file(path: str) -> list[dict]:
    records = []
    skipped = 0

    with open(path, encoding=FILE_ENCODING, errors="replace") as f:
        raw_lines = f.readlines()

    # Mescla linhas com strings multiline (aspas não fechadas)
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

        # Mapeamento posicional conforme ordem real da extração Progress
        (
            idordem,        sequencial,     idcliente,      data_val,
            inicio_01,      termino_01,     inicio_02,      termino_02,
            valor_hora,     valor_servicos, valor_os,       local_servico,
            local_entrega,  km_inicio,      km_final,       km_total,
            valor_km,       pedagio,        desconto,       saida,
            escolta,        valor_frete,    servico_prestado, idequipamento,
            idfuncionario,  situacao,       valor_pago,     idfluxo,
            idempresa,      empresa_nota,   total_horas,    cidade_servico,
            idfechamento,   porcentagem,    numero_os,      cidade_entrega,
            valor_total_km, idconhecimento, funcionario_2,  funcionario_3,
            seguro,
        ) = tokens[:41]

        if idordem is None:
            skipped += 1
            continue

        records.append({
            "idordem":          to_int_zero(idordem),
            "sequencial":       to_int_zero(sequencial),
            "idcliente":        to_int(idcliente),
            "data":             to_date(data_val),
            "inicio_01":        to_str(inicio_01),
            "termino_01":       to_str(termino_01),
            "inicio_02":        to_str(inicio_02),
            "termino_02":       to_str(termino_02),
            "valor_hora":       to_decimal(valor_hora),
            "valor_servicos":   to_decimal(valor_servicos),
            "valor_os":         to_decimal(valor_os),
            "local_servico":    to_str(local_servico),
            "local_entrega":    to_str(local_entrega),
            "km_inicio":        to_int(km_inicio),
            "km_final":         to_int(km_final),
            "km_total":         to_int(km_total),
            "valor_km":         to_decimal(valor_km),
            "pedagio":          to_decimal(pedagio),
            "desconto":         to_decimal(desconto),
            "saida":            to_decimal(saida),
            "escolta":          to_decimal(escolta),
            "valor_frete":      to_decimal(valor_frete),
            "servico_prestado": to_str(servico_prestado),
            "idequipamento":    to_int(idequipamento),
            "idfuncionario":    to_int(idfuncionario),
            "situacao":         to_bool(situacao),
            "valor_pago":       to_decimal(valor_pago),
            "idfluxo":          to_str(idfluxo),
            "idempresa":        to_int(idempresa),
            "empresa_nota":     to_int_zero(empresa_nota),
            "total_horas":      to_decimal(total_horas),
            "cidade_servico":   to_str(cidade_servico),
            "idfechamento":     to_int(idfechamento),
            "porcentagem":      to_decimal(porcentagem),
            "numero_os":        to_int_zero(numero_os),
            "cidade_entrega":   to_str(cidade_entrega),
            "valor_total_km":   to_decimal(valor_total_km),
            "idconhecimento":   to_int(idconhecimento),
            "funcionario_2":    to_int(funcionario_2),
            "funcionario_3":    to_int(funcionario_3),
            "seguro":           to_decimal(seguro),
        })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")

    return records


def get_valid_ids(conn) -> dict:
    with conn.cursor() as cur:
        cur.execute("SELECT idempresa FROM empresa")
        empresas = {row[0] for row in cur.fetchall()}
        cur.execute("SELECT idequipamento FROM equipamento")
        equipamentos = {row[0] for row in cur.fetchall()}
        cur.execute("SELECT idfuncionario FROM funcionario")
        funcionarios = {row[0] for row in cur.fetchall()}
        cur.execute("SELECT idfluxo FROM fluxo_financeiro")
        fluxos = {row[0] for row in cur.fetchall()}
        cur.execute("SELECT idfechamento FROM fechamento")
        fechamentos = {row[0] for row in cur.fetchall()}
        cur.execute("SELECT idconhecimento FROM conhecimento")
        conhecimentos = {row[0] for row in cur.fetchall()}
    return {
        "empresas":      empresas,
        "equipamentos":  equipamentos,
        "funcionarios":  funcionarios,
        "fluxos":        fluxos,
        "fechamentos":   fechamentos,
        "conhecimentos": conhecimentos,
    }


def filter_records(records: list[dict], valid_ids: dict) -> tuple[list[dict], int, set, set]:
    filtered = []
    ignored = 0
    empresas_encontradas: set = set()
    fechamentos_encontrados: set = set()
    for r in records:
        if r["idempresa"] is not None and r["idempresa"] not in valid_ids["empresas"]:
            ignored += 1
            continue
        if r["idequipamento"] is not None and r["idequipamento"] not in valid_ids["equipamentos"]:
            ignored += 1
            continue
        if r["idfuncionario"] is not None and r["idfuncionario"] not in valid_ids["funcionarios"]:
            ignored += 1
            continue
        if r["idfluxo"] is not None and r["idfluxo"] not in valid_ids["fluxos"]:
            ignored += 1
            continue
        if r["idfechamento"] is not None and r["idfechamento"] not in valid_ids["fechamentos"]:
            ignored += 1
            continue
        if r["idconhecimento"] is not None and r["idconhecimento"] not in valid_ids["conhecimentos"]:
            ignored += 1
            continue
        if r["idempresa"] is not None:
            empresas_encontradas.add(r["idempresa"])
        if r["idfechamento"] is not None:
            fechamentos_encontrados.add(r["idfechamento"])
        filtered.append(r)
    return filtered, ignored, empresas_encontradas, fechamentos_encontrados


UPSERT_SQL = """
    INSERT INTO ordem (
        idordem, sequencial, idcliente, data,
        inicio_01, termino_01, inicio_02, termino_02,
        valor_hora, valor_servicos, valor_os,
        local_servico, local_entrega,
        km_inicio, km_final, km_total,
        valor_km, pedagio, desconto, saida, escolta, valor_frete,
        servico_prestado, idequipamento, idfuncionario, situacao,
        valor_pago, idfluxo, idempresa, empresa_nota,
        total_horas, cidade_servico, idfechamento, porcentagem,
        numero_os, cidade_entrega, valor_total_km, idconhecimento,
        funcionario_2, funcionario_3, seguro
    )
    VALUES %s
    ON CONFLICT (idordem) DO UPDATE SET
        sequencial       = EXCLUDED.sequencial,
        idcliente        = EXCLUDED.idcliente,
        data             = EXCLUDED.data,
        inicio_01        = EXCLUDED.inicio_01,
        termino_01       = EXCLUDED.termino_01,
        inicio_02        = EXCLUDED.inicio_02,
        termino_02       = EXCLUDED.termino_02,
        valor_hora       = EXCLUDED.valor_hora,
        valor_servicos   = EXCLUDED.valor_servicos,
        valor_os         = EXCLUDED.valor_os,
        local_servico    = EXCLUDED.local_servico,
        local_entrega    = EXCLUDED.local_entrega,
        km_inicio        = EXCLUDED.km_inicio,
        km_final         = EXCLUDED.km_final,
        km_total         = EXCLUDED.km_total,
        valor_km         = EXCLUDED.valor_km,
        pedagio          = EXCLUDED.pedagio,
        desconto         = EXCLUDED.desconto,
        saida            = EXCLUDED.saida,
        escolta          = EXCLUDED.escolta,
        valor_frete      = EXCLUDED.valor_frete,
        servico_prestado = EXCLUDED.servico_prestado,
        idequipamento    = EXCLUDED.idequipamento,
        idfuncionario    = EXCLUDED.idfuncionario,
        situacao         = EXCLUDED.situacao,
        valor_pago       = EXCLUDED.valor_pago,
        idfluxo          = EXCLUDED.idfluxo,
        idempresa        = EXCLUDED.idempresa,
        empresa_nota     = EXCLUDED.empresa_nota,
        total_horas      = EXCLUDED.total_horas,
        cidade_servico   = EXCLUDED.cidade_servico,
        idfechamento     = EXCLUDED.idfechamento,
        porcentagem      = EXCLUDED.porcentagem,
        numero_os        = EXCLUDED.numero_os,
        cidade_entrega   = EXCLUDED.cidade_entrega,
        valor_total_km   = EXCLUDED.valor_total_km,
        idconhecimento   = EXCLUDED.idconhecimento,
        funcionario_2    = EXCLUDED.funcionario_2,
        funcionario_3    = EXCLUDED.funcionario_3,
        seguro           = EXCLUDED.seguro
"""


def import_records(records: list[dict], dry_run: bool = False):
    if dry_run:
        print(f"\n[DRY-RUN] {len(records)} registro(s) seriam importados:")
        for r in records[:20]:
            print(f"  idordem={str(r['idordem']):>6}  seq={str(r['sequencial']):>4}  "
                  f"os={str(r['numero_os']):>5}  data={r['data']}  "
                  f"equip={str(r['idequipamento']):>5}  valor_os={r['valor_os']}")
        if len(records) > 20:
            print(f"  ... e mais {len(records) - 20} registro(s).")
        return

    conn = psycopg2.connect(DB_URL)
    try:
        with conn:
            valid_ids = get_valid_ids(conn)
            filtered, ignored, empresas_enc, fechamentos_enc = filter_records(records, valid_ids)
            if ignored:
                print(f"  {ignored} registro(s) ignorados (FK não existe).")
            if not filtered:
                print("  Nenhum registro válido para importar.")
                return
            values = [
                (
                    r["idordem"],         r["sequencial"],      r["idcliente"],
                    r["data"],            r["inicio_01"],       r["termino_01"],
                    r["inicio_02"],       r["termino_02"],      r["valor_hora"],
                    r["valor_servicos"],  r["valor_os"],        r["local_servico"],
                    r["local_entrega"],   r["km_inicio"],       r["km_final"],
                    r["km_total"],        r["valor_km"],        r["pedagio"],
                    r["desconto"],        r["saida"],           r["escolta"],
                    r["valor_frete"],     r["servico_prestado"], r["idequipamento"],
                    r["idfuncionario"],   r["situacao"],        r["valor_pago"],
                    r["idfluxo"],         r["idempresa"],       r["empresa_nota"],
                    r["total_horas"],     r["cidade_servico"],  r["idfechamento"],
                    r["porcentagem"],     r["numero_os"],       r["cidade_entrega"],
                    r["valor_total_km"],  r["idconhecimento"],  r["funcionario_2"],
                    r["funcionario_3"],   r["seguro"],
                )
                for r in filtered
            ]
            with conn.cursor() as cur:
                execute_values(cur, UPSERT_SQL, values)
                print(f"  {cur.rowcount} linha(s) afetadas no banco "
                      f"(INSERT + UPDATE via ON CONFLICT).")

            # Relatório de empresas e fechamentos encontrados nos registros válidos
            print(f"\n--- Empresas encontradas ({len(empresas_enc)}) ---")
            if empresas_enc:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT idempresa, nome FROM empresa WHERE idempresa = ANY(%s) ORDER BY idempresa",
                        (list(empresas_enc),)
                    )
                    for row in cur.fetchall():
                        print(f"  idempresa={row[0]:>4}  {row[1]}")
            else:
                print("  (nenhuma)")

            print(f"\n--- Fechamentos encontrados ({len(fechamentos_enc)}) ---")
            if fechamentos_enc:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT idfechamento, data, idcliente FROM fechamento WHERE idfechamento = ANY(%s) ORDER BY idfechamento",
                        (list(fechamentos_enc),)
                    )
                    for row in cur.fetchall():
                        print(f"  idfechamento={row[0]:>6}  data={row[1]}  idcliente={row[2]}")
            else:
                print("  (nenhum)")
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Importa ordem.d (Progress 9.1E) → PostgreSQL (upsert por idordem)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "ordem.d"),
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
