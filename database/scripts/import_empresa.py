"""
import_empresa.py — Importa tabela 'empresa' a partir de dump Progress 9.1E (.d)

Formato .d do Progress:
  - Um registro por linha
  - Strings entre aspas duplas
  - Campos separados por espaço
  - Valor desconhecido/nulo representado por ?
  - Encoding padrão: latin-1 (cp1252)

Colunas esperadas (na ordem do dump):
  idempresa, nome, cnpj, ie, cep, idcidade, idbairro, logradouro,
  tipo_logradouro, idestado, numero, ultima_nf, serie, pis, cofins,
  inss, ir, csll, inscricao_municipal, sequencia, atividade,
  aliquota_aplicada, deducao, imposto, retencao, nomefantasia

Uso:
    python import_empresa.py                          # usa EXTRACAO/empresa.d relativo ao script
    python import_empresa.py caminho/para/empresa.d
    python import_empresa.py empresa.d --dry-run      # apenas exibe sem gravar
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
EXPECTED_COLS = 26

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
    """Converte string para int. None ou '0' vira None."""
    if val is None or val == "":
        return None
    try:
        n = int(val)
        return n if n != 0 else None
    except ValueError:
        return None


def to_int_zero(val: str | None) -> int | None:
    """Converte string para int mantendo zeros (ex: ultima_nf, sequencia)."""
    if val is None or val == "":
        return None
    try:
        return int(val)
    except ValueError:
        return None


def to_float(val: str | None) -> float | None:
    if val is None or val == "":
        return None
    try:
        return float(val)
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
                idempresa, nome, cnpj, ie, cep,
                idcidade, idbairro, logradouro, tipo_logradouro, idestado,
                numero, ultima_nf, serie,
                pis, cofins, inss, ir, csll,
                inscricao_municipal, sequencia, atividade,
                aliquota_aplicada, deducao, imposto, retencao,
                nomefantasia
            ) = tokens[:EXPECTED_COLS]

            if not idempresa:
                print(f"  [AVISO] Linha {lineno} ignorada (idempresa vazio): {raw.rstrip()}")
                skipped += 1
                continue

            records.append({
                "idempresa":          int(idempresa),
                "nome":               to_str(nome),
                "nomefantasia":       to_str(nomefantasia),
                "cnpj":               to_str(cnpj),
                "ie":                 to_str(ie),
                "cep":                to_str(cep),
                "idcidade":           to_int(idcidade),
                "idbairro":           to_int(idbairro),
                "logradouro":         to_str(logradouro),
                "tipo_logradouro":    to_str(tipo_logradouro),
                "idestado":           to_str(idestado),
                "numero":             to_int_zero(numero),
                "ultima_nf":          to_int_zero(ultima_nf),
                "serie":              to_str(serie),
                "pis":                to_float(pis),
                "cofins":             to_float(cofins),
                "inss":               to_float(inss),
                "ir":                 to_float(ir),
                "csll":               to_float(csll),
                "inscricao_municipal": to_str(inscricao_municipal),
                "sequencia":          to_int_zero(sequencia),
                "atividade":          to_str(atividade),
                "aliquota_aplicada":  to_float(aliquota_aplicada),
                "deducao":            to_float(deducao),
                "imposto":            to_float(imposto),
                "retencao":           to_float(retencao),
            })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")

    return records


# ── Importação (UPSERT) ───────────────────────────────────────────────────────
UPSERT_SQL = """
    INSERT INTO empresa (
        idempresa, nome, nomefantasia, cnpj, ie, cep,
        idcidade, idbairro, logradouro, tipo_logradouro, idestado, numero,
        ultima_nf, serie, pis, cofins, inss, ir, csll,
        inscricao_municipal, sequencia, atividade,
        aliquota_aplicada, deducao, imposto, retencao
    )
    VALUES %s
    ON CONFLICT (idempresa) DO UPDATE SET
        nome               = EXCLUDED.nome,
        nomefantasia       = EXCLUDED.nomefantasia,
        cnpj               = EXCLUDED.cnpj,
        ie                 = EXCLUDED.ie,
        cep                = EXCLUDED.cep,
        idcidade           = EXCLUDED.idcidade,
        idbairro           = EXCLUDED.idbairro,
        logradouro         = EXCLUDED.logradouro,
        tipo_logradouro    = EXCLUDED.tipo_logradouro,
        idestado           = EXCLUDED.idestado,
        numero             = EXCLUDED.numero,
        ultima_nf          = EXCLUDED.ultima_nf,
        serie              = EXCLUDED.serie,
        pis                = EXCLUDED.pis,
        cofins             = EXCLUDED.cofins,
        inss               = EXCLUDED.inss,
        ir                 = EXCLUDED.ir,
        csll               = EXCLUDED.csll,
        inscricao_municipal = EXCLUDED.inscricao_municipal,
        sequencia          = EXCLUDED.sequencia,
        atividade          = EXCLUDED.atividade,
        aliquota_aplicada  = EXCLUDED.aliquota_aplicada,
        deducao            = EXCLUDED.deducao,
        imposto            = EXCLUDED.imposto,
        retencao           = EXCLUDED.retencao
"""


def import_records(records: list[dict], dry_run: bool = False):
    values = [
        (
            r["idempresa"], r["nome"], r["nomefantasia"], r["cnpj"], r["ie"], r["cep"],
            r["idcidade"], r["idbairro"], r["logradouro"], r["tipo_logradouro"],
            r["idestado"], r["numero"],
            r["ultima_nf"], r["serie"], r["pis"], r["cofins"], r["inss"],
            r["ir"], r["csll"],
            r["inscricao_municipal"], r["sequencia"], r["atividade"],
            r["aliquota_aplicada"], r["deducao"], r["imposto"], r["retencao"],
        )
        for r in records
    ]

    if dry_run:
        print(f"\n[DRY-RUN] {len(values)} registro(s) seriam importados:")
        for v in values[:20]:
            print(f"  id={v[0]:>4}  nome={str(v[1])[:40]:<40}  fantasia={str(v[2])[:20]}")
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
        description="Importa empresa.d (Progress 9.1E) → PostgreSQL (upsert por idempresa)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "empresa.d"),
        help="Caminho para o arquivo .d (padrão: EXTRACAO/empresa.d na mesma pasta do script)",
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
