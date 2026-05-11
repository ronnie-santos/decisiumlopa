"""
import_funcionario.py — Importa tabela 'funcionario' a partir de dump Progress 9.1E (.d)

Colunas esperadas (na ordem do dump):
  idfuncionario, nome, apelido, observacao, cpf, rg, ctpf, serie, pis,
  idcargo, admissao, demissao, nascimento, cbo, cep, idcidade, idbairro,
  logradouro, tipo_logradouro, idestado, numero, cnh, validade_cnh,
  categoria, complemento, pe, validade_exame, data_toxicologico

Notas:
  - Datas no formato DD/MM/YY (dois dígitos): ano < 50 → 20XX, ano >= 50 → 19XX
  - status não está no dump: definido como 'ATIVO' por padrão

Uso:
    python import_funcionario.py
    python import_funcionario.py caminho/para/funciona.d
    python import_funcionario.py funciona.d --dry-run
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
    """Mantém zeros (ex: numero de endereço)."""
    if val is None or val == "":
        return None
    try:
        return int(val)
    except ValueError:
        return None


def to_date(val: str | None) -> date | None:
    """
    Converte data Progress DD/MM/YY ou DD/MM/YYYY para date Python.
    Regra de dois dígitos: ano < 50 → 2000+ano, ano >= 50 → 1900+ano.
    """
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
                idfuncionario, nome, apelido, observacao, cpf, rg, ctpf, serie, pis,
                idcargo, admissao, demissao, nascimento,
                cbo, cep, idcidade, idbairro, logradouro, tipo_logradouro, idestado, numero,
                cnh, validade_cnh, categoria, complemento, pe, validade_exame, data_toxicologico
            ) = tokens[:EXPECTED_COLS]

            if not idfuncionario:
                print(f"  [AVISO] Linha {lineno} ignorada (idfuncionario vazio): {raw.rstrip()}")
                skipped += 1
                continue

            records.append({
                "idfuncionario":    int(idfuncionario),
                "nome":             to_str(nome),
                "apelido":          to_str(apelido),
                "observacao":       to_str(observacao),
                "cpf":              to_str(cpf),
                "rg":               to_str(rg),
                "ctpf":             to_str(ctpf),
                "serie":            to_str(serie),
                "pis":              to_str(pis),
                "idcargo":          to_int(idcargo),
                "admissao":         to_date(admissao),
                "demissao":         to_date(demissao),
                "nascimento":       to_date(nascimento),
                "cbo":              to_str(cbo),
                "cep":              to_str(cep),
                "idcidade":         to_int(idcidade),
                "idbairro":         to_int(idbairro),
                "logradouro":       to_str(logradouro),
                "tipo_logradouro":  to_str(tipo_logradouro),
                "idestado":         to_str(idestado),
                "numero":           to_int_zero(numero),
                "cnh":              to_str(cnh),
                "validade_cnh":     to_date(validade_cnh),
                "categoria":        to_str(categoria),
                "complemento":      to_str(complemento),
                "pe":               to_int_zero(pe),
                "validade_exame":   to_date(validade_exame),
                "data_toxicologico": to_date(data_toxicologico),
                "status":           "ATIVO",
            })

    if skipped:
        print(f"  {skipped} linha(s) ignoradas.")

    return records


UPSERT_SQL = """
    INSERT INTO funcionario (
        idfuncionario, nome, apelido, observacao, cpf, rg, ctpf, serie, pis,
        idcargo, admissao, demissao, nascimento,
        cbo, cep, idcidade, idbairro, logradouro, tipo_logradouro, idestado, numero,
        cnh, validade_cnh, categoria, complemento, pe, validade_exame, data_toxicologico, status
    )
    VALUES %s
    ON CONFLICT (idfuncionario) DO UPDATE SET
        nome             = EXCLUDED.nome,
        apelido          = EXCLUDED.apelido,
        observacao       = EXCLUDED.observacao,
        cpf              = EXCLUDED.cpf,
        rg               = EXCLUDED.rg,
        ctpf             = EXCLUDED.ctpf,
        serie            = EXCLUDED.serie,
        pis              = EXCLUDED.pis,
        idcargo          = EXCLUDED.idcargo,
        admissao         = EXCLUDED.admissao,
        demissao         = EXCLUDED.demissao,
        nascimento       = EXCLUDED.nascimento,
        cbo              = EXCLUDED.cbo,
        cep              = EXCLUDED.cep,
        idcidade         = EXCLUDED.idcidade,
        idbairro         = EXCLUDED.idbairro,
        logradouro       = EXCLUDED.logradouro,
        tipo_logradouro  = EXCLUDED.tipo_logradouro,
        idestado         = EXCLUDED.idestado,
        numero           = EXCLUDED.numero,
        cnh              = EXCLUDED.cnh,
        validade_cnh     = EXCLUDED.validade_cnh,
        categoria        = EXCLUDED.categoria,
        complemento      = EXCLUDED.complemento,
        pe               = EXCLUDED.pe,
        validade_exame   = EXCLUDED.validade_exame,
        data_toxicologico = EXCLUDED.data_toxicologico,
        status           = EXCLUDED.status
"""


def import_records(records: list[dict], dry_run: bool = False):
    values = [
        (
            r["idfuncionario"], r["nome"], r["apelido"], r["observacao"],
            r["cpf"], r["rg"], r["ctpf"], r["serie"], r["pis"],
            r["idcargo"], r["admissao"], r["demissao"], r["nascimento"],
            r["cbo"], r["cep"], r["idcidade"], r["idbairro"],
            r["logradouro"], r["tipo_logradouro"], r["idestado"], r["numero"],
            r["cnh"], r["validade_cnh"], r["categoria"], r["complemento"],
            r["pe"], r["validade_exame"], r["data_toxicologico"], r["status"],
        )
        for r in records
    ]

    if dry_run:
        print(f"\n[DRY-RUN] {len(values)} registro(s) seriam importados:")
        for v in values[:20]:
            print(f"  id={v[0]:>4}  nome={str(v[1]):<35}  "
                  f"cpf={str(v[4]):<15}  admissao={v[10]}")
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
        description="Importa funciona.d (Progress 9.1E) → PostgreSQL (upsert por idfuncionario)"
    )
    parser.add_argument(
        "arquivo",
        nargs="?",
        default=os.path.join(os.path.dirname(__file__), "EXTRACAO", "funciona.d"),
        help="Caminho para o arquivo .d (padrão: EXTRACAO/funciona.d na mesma pasta do script)",
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
