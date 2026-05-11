"""
import_nota_fiscal.py — Importa tabela 'nota_fiscal' a partir de dump Progress 9.1E (.d)

Colunas esperadas (na ordem do dump) — 32 campos:
  idnota, idfechamento, idempresa, idcliente, data_emissao, serie, observacao,
  pis, cofins, inss, ir, csll, outras_retencoes, imposto, total_retencao,
  vencimento, sequencia, valor_nota, hora, dentro_pais, local_servico,
  resp_imposto, valor_servicos, valor_materiais, base_calculo, valor_liquido,
  iss, link, deducoes, numero, chave_nfe, dps

Uso:
    python import_nota_fiscal.py
    python import_nota_fiscal.py caminho/para/nota_fis.d
    python import_nota_fiscal.py nota_fis.d --dry-run
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
EXPECTED_COLS = 32

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


def to_str_max(val: str | None, maxlen: int) -> str | None:
    """Converte para string truncando em maxlen (evita erros de tamanho no banco)."""
    if val is None or val == "":
        return None
    return val[:maxlen] if len(val) > maxlen else val


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
            idnota, idfechamento, idempresa, idcliente, data_emissao, serie, observacao,
            pis, cofins, inss, ir, csll, outras_retencoes, imposto, total_retencao,
            vencimento, sequencia, valor_nota, hora, dentro_pais, local_servico,
            resp_imposto, valor_servicos, valor_materiais, base_calculo, valor_liquido,
            iss, link, deducoes, numero, chave_nfe, dps
        ) = tokens[:EXPECTED_COLS]

        if not idnota:
            print(f"  [AVISO] Linha {lineno} ignorada (idnota vazio): {raw.rstrip()[:80]}")
            skipped += 1
            continue

        records.append({
            "idnota":           int(idnota),
            "idfechamento":     to_int(idfechamento),
            "idempresa":        to_int(idempresa),
            "idcliente":        to_int(idcliente),
            "data_emissao":     to_date(data_emissao),
            "serie":            to_str_max(serie, 255),
            "observacao":       to_str(observacao),
            "pis":              to_numeric(pis),
            "cofins":           to_numeric(cofins),
            "inss":             to_numeric(inss),
            "ir":               to_numeric(ir),
            "csll":             to_numeric(csll),
            "outras_retencoes": to_numeric(outras_retencoes),
            "imposto":          to_numeric(imposto),
            "total_retencao":   to_numeric(total_retencao),
            "vencimento":       to_date(vencimento),
            "sequencia":        to_int_zero(sequencia),
            "valor_nota":       to_numeric(valor_nota),
            "hora":             to_str_max(hora, 255),
            "dentro_pais":      to_str_max(dentro_pais, 255),
            "local_servico":    to_str_max(local_servico, 255),
            "resp_imposto":     to_str_max(resp_imposto, 255),
            "valor_servicos":   to_numeric(valor_servicos),
            "valor_materiais":  to_numeric(valor_materiais),
            "base_calculo":     to_numeric(base_calculo),
            "valor_liquido":    to_numeric(valor_liquido),
            "iss":              to_numeric(iss),
            "link":             to_str_max(link, 200),
            "deducoes":         to_numeric(deducoes),
            "numero":           to_int_zero(numero),
            "chave_nfe":        to_str_max(chave_nfe, 255),
            "dps":              to_str_max(dps, 255) or "0",
        })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")

    return records


UPSERT_SQL = """
    INSERT INTO nota_fiscal (
        idnota, idfechamento, idempresa, valor_nota, data_emissao, serie, observacao,
        pis, cofins, inss, ir, csll, outras_retencoes, imposto, total_retencao,
        vencimento, idcliente, sequencia, hora, local_servico, dentro_pais,
        resp_imposto, valor_servicos, valor_materiais, base_calculo, valor_liquido,
        iss, link, deducoes, numero, chave_nfe, dps
    )
    VALUES %s
    ON CONFLICT (idnota) DO UPDATE SET
        idfechamento     = EXCLUDED.idfechamento,
        idempresa        = EXCLUDED.idempresa,
        valor_nota       = EXCLUDED.valor_nota,
        data_emissao     = EXCLUDED.data_emissao,
        serie            = EXCLUDED.serie,
        observacao       = EXCLUDED.observacao,
        pis              = EXCLUDED.pis,
        cofins           = EXCLUDED.cofins,
        inss             = EXCLUDED.inss,
        ir               = EXCLUDED.ir,
        csll             = EXCLUDED.csll,
        outras_retencoes = EXCLUDED.outras_retencoes,
        imposto          = EXCLUDED.imposto,
        total_retencao   = EXCLUDED.total_retencao,
        vencimento       = EXCLUDED.vencimento,
        idcliente        = EXCLUDED.idcliente,
        sequencia        = EXCLUDED.sequencia,
        hora             = EXCLUDED.hora,
        local_servico    = EXCLUDED.local_servico,
        dentro_pais      = EXCLUDED.dentro_pais,
        resp_imposto     = EXCLUDED.resp_imposto,
        valor_servicos   = EXCLUDED.valor_servicos,
        valor_materiais  = EXCLUDED.valor_materiais,
        base_calculo     = EXCLUDED.base_calculo,
        valor_liquido    = EXCLUDED.valor_liquido,
        iss              = EXCLUDED.iss,
        link             = EXCLUDED.link,
        deducoes         = EXCLUDED.deducoes,
        numero           = EXCLUDED.numero,
        chave_nfe        = EXCLUDED.chave_nfe,
        dps              = EXCLUDED.dps
"""


def get_valid_fechamentos(conn) -> set:
    with conn.cursor() as cur:
        cur.execute("SELECT idfechamento FROM fechamento")
        return {row[0] for row in cur.fetchall()}


def import_records(records: list[dict], dry_run: bool = False):
    if dry_run:
        print(f"\n[DRY-RUN] {len(records)} registro(s) seriam importados:")
        for r in records[:20]:
            print(f"  id={r['idnota']:>6}  data={r['data_emissao']}  "
                  f"cliente={r['idcliente']}  valor={r['valor_nota']}")
        if len(records) > 20:
            print(f"  ... e mais {len(records) - 20} registro(s).")
        return

    conn = psycopg2.connect(DB_URL)
    try:
        with conn:
            fechamentos = get_valid_fechamentos(conn)
            filtered = [r for r in records if r["idfechamento"] in fechamentos]
            ignored = len(records) - len(filtered)
            if ignored:
                print(f"  {ignored} registro(s) ignorados (idfechamento não existe em fechamento).")
            if not filtered:
                print("  Nenhum registro válido para importar.")
                return
            values = [
                (
                    r["idnota"], r["idfechamento"], r["idempresa"], r["valor_nota"],
                    r["data_emissao"], r["serie"], r["observacao"],
                    r["pis"], r["cofins"], r["inss"], r["ir"], r["csll"],
                    r["outras_retencoes"], r["imposto"], r["total_retencao"],
                    r["vencimento"], r["idcliente"], r["sequencia"], r["hora"],
                    r["local_servico"], r["dentro_pais"], r["resp_imposto"],
                    r["valor_servicos"], r["valor_materiais"], r["base_calculo"],
                    r["valor_liquido"], r["iss"], r["link"], r["deducoes"],
                    r["numero"], r["chave_nfe"], r["dps"],
                )
                for r in filtered
            ]
            with conn.cursor() as cur:
                execute_values(cur, UPSERT_SQL, values)
                print(f"  {cur.rowcount} linha(s) afetadas no banco "
                      f"(INSERT + UPDATE via ON CONFLICT).")
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Importa nota_fis.d (Progress 9.1E) → PostgreSQL (upsert por idnota)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "nota_fis.d"),
        help="Caminho para o arquivo .d (padrão: EXTRACAO/nota_fis.d)",
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
