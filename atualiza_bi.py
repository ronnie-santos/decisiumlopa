"""
atualiza_bi.py — Exportação de dados para BI via CSV + FTP
Replica a lógica do script Progress 9.1 (extracao.txt), lendo o PostgreSQL
e gerando os mesmos 5 arquivos CSV, depois enviando via FTP.

Uso:
    python atualiza_bi.py
"""

import csv
import glob
import os
import sys
from datetime import date, datetime
from ftplib import FTP, error_perm
from io import StringIO

import psycopg2
from psycopg2.extras import RealDictCursor

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

DB = dict(
    host="localhost",
    port=5433,
    dbname="DECISIUM_LOPA",
    user="postgres",
    password="r0nN1E",
)

FTP_HOST = "lopa.com.br"
FTP_USER = "decision@lopa.com.br"
FTP_PASS = "v_mVVQ,YF0_W"
FTP_DIR  = "/"

FTP_LOCAL = r"F:\DECISIUM\LOPA\FTP"
DATA_INICIO = date(2023, 1, 1)

TODAY = date.today()
SUFFIX = TODAY.strftime("%Y%m%d")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _conn():
    return psycopg2.connect(**DB)


def _fmt_date(d) -> str:
    if d is None:
        return ""
    if isinstance(d, (date, datetime)):
        return d.strftime("%Y-%m-%d")
    return str(d)


def _fmt_horario(inicio_01, termino_01, inicio_02, termino_02) -> str:
    """Formata string de horário igual ao Progress (HH:MM as HH:MM)."""
    partes = []
    if inicio_01 and inicio_01 not in ("0000", ""):
        i = str(inicio_01).zfill(4)
        t = str(termino_01).zfill(4)
        partes.append(f"{i[:2]}:{i[2:]} as {t[:2]}:{t[2:]}")
    if inicio_02 and inicio_02 not in ("0000", ""):
        i = str(inicio_02).zfill(4)
        t = str(termino_02).zfill(4)
        partes.append(f"{i[:2]}:{i[2:]} as {t[:2]}:{t[2:]}")
    return "\n".join(partes)


def _write_csv(filename: str, header: list, rows) -> str:
    path = os.path.join(FTP_LOCAL, filename)
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";", quoting=csv.QUOTE_MINIMAL)
        w.writerow(header)
        for row in rows:
            w.writerow([("" if v is None else v) for v in row])
    print(f"  OK  {filename}  ({_line_count(path)} linhas)")
    return path


def _line_count(path: str) -> int:
    with open(path, encoding="utf-8-sig") as f:
        return sum(1 for _ in f) - 1  # menos cabeçalho


# ---------------------------------------------------------------------------
# Geração dos CSVs
# ---------------------------------------------------------------------------


def gerar_ordens_servico(conn) -> str:
    """Replica FOR EACH ORDEM + CLIENTE + EMPRESA + EQUIPAMENTO."""
    sql = """
        SELECT
            o.data,
            o.idordem,
            o.numero_os,
            e.nome          AS equipamento,
            c.nome          AS cliente,
            o.inicio_01, o.termino_01,
            o.inicio_02, o.termino_02,
            o.total_horas,
            o.valor_hora,
            o.km_total,
            o.valor_km,
            o.saida,
            o.pedagio,
            o.escolta,
            o.desconto,
            o.seguro,
            o.valor_os,
            o.cidade_servico,
            o.cidade_entrega,
            emp.nomefantasia AS empresa,
            o.situacao
        FROM ordem o
        JOIN cliente    c   ON c.idcliente   = o.idcliente
        JOIN empresa    emp ON emp.idempresa = o.idempresa
        JOIN equipamento e  ON e.idequipamento = o.idequipamento
        WHERE o.data >= %s
        ORDER BY o.data, c.nome
    """
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, (DATA_INICIO,))
        rows = cur.fetchall()

    data = []
    for r in rows:
        horario  = _fmt_horario(r["inicio_01"], r["termino_01"], r["inicio_02"], r["termino_02"])
        situacao = "Faturada" if r["situacao"] else "Aberta"
        data.append([
            _fmt_date(r["data"]),
            r["idordem"],
            r["numero_os"],
            r["equipamento"],
            r["cliente"],
            horario,
            r["total_horas"],
            r["valor_hora"],
            r["km_total"],
            r["valor_km"],
            r["saida"],
            r["pedagio"],
            r["escolta"],
            r["desconto"],
            r["seguro"],
            r["valor_os"],
            r["cidade_servico"],
            r["cidade_entrega"],
            r["empresa"],
            situacao,
        ])

    header = [
        "DATA", "IDLANCAMENTO", "OS", "EQUIPAMENTO", "CLIENTE", "HORARIO",
        "TOTAL HORAS", "VALOR HORA", "TOTAL KM", "VALOR KM",
        "SAIDA", "PEDAGIO", "ESCOLTA", "DESCONTO", "SEGURO",
        "VALO DA ORDEM", "CIDADE SERVICO", "CIDADE ENTREGA", "EMPRESA", "SITUACAO",
    ]
    return _write_csv(f"ORDENS_SERVICO_{SUFFIX}.CSV", header, data)


def gerar_comissoes(conn) -> str:
    """
    Replica FOR EACH ORDEM (idfuncionario <> 0) + joins.
    Gera uma linha por funcionário atribuído (até 3 por ordem).
    """
    sql = """
        SELECT
            o.data,
            o.idordem,
            o.numero_os,
            c.nome          AS cliente,
            o.cidade_servico,
            e.nome          AS equipamento,
            emp.nomefantasia AS empresa,
            o.inicio_01, o.termino_01,
            o.inicio_02, o.termino_02,
            o.km_total,
            o.valor_os,
            o.idfuncionario,
            o.funcionario_2,
            o.funcionario_3
        FROM ordem o
        JOIN cliente    c   ON c.idcliente    = o.idcliente
        JOIN empresa    emp ON emp.idempresa  = o.idempresa
        JOIN equipamento e  ON e.idequipamento = o.idequipamento
        WHERE o.data >= %s
          AND o.idfuncionario IS NOT NULL
          AND o.idfuncionario <> 0
        ORDER BY o.data, c.nome
    """

    # Carrega todos os funcionários de uma vez para evitar N+1
    func_map = {}
    with conn.cursor() as cur:
        cur.execute("SELECT idfuncionario, nome FROM funcionario")
        for idf, nome in cur.fetchall():
            func_map[idf] = nome

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, (DATA_INICIO,))
        rows = cur.fetchall()

    header = [
        "DATA", "IDORDEM", "OS", "CLIENTE", "CIDADE ONDE FOI REALIZADO",
        "EQUIPAMENTO", "EMPRESA", "HORARIO", "TOTAL KM",
        "VALOR DA ORDEM", "COMISSAO", "FUNCIONARIO", "OBSERVACAO",
    ]

    data = []
    for r in rows:
        func_ids = [fid for fid in [r["idfuncionario"], r["funcionario_2"], r["funcionario_3"]] if fid]
        num_func  = len(func_ids)
        horario   = _fmt_horario(r["inicio_01"], r["termino_01"], r["inicio_02"], r["termino_02"])
        obs       = "compartilhada" if num_func > 1 else ""
        valor_os  = float(r["valor_os"] or 0)
        comissao  = round((valor_os / num_func) * 0.025, 2)

        for fid in func_ids:
            data.append([
                _fmt_date(r["data"]),
                r["idordem"],
                r["numero_os"],
                r["cliente"],
                r["cidade_servico"],
                r["equipamento"],
                r["empresa"],
                horario,
                r["km_total"],
                valor_os,
                comissao,
                func_map.get(fid, ""),
                obs,
            ])

    return _write_csv(f"COMISSOES_{SUFFIX}.CSV", header, data)


def gerar_compras(conn) -> str:
    """
    Replica FOR EACH COMPRAS + COMPRA_ITENS + PRODUTOS_SERVICOS +
    EQUIPAMENTO + EMPRESA + FLUXO_FINANCEIRO + FORNECEDOR.
    Busca primeiro/último vencimento das CONTAS_PAGAR para D1/D2.
    """
    sql = """
        SELECT
            cp.emissao,
            cp.situacao,
            emp.idempresa,
            emp.nome        AS empresa_nome,
            f.idfornecedor,
            f.nome          AS fornecedor_nome,
            cp.nota,
            cp.valor        AS valor_nf,
            cp.parcelas,
            cp.idcompras,
            cp.idfluxo,
            ff.descricao    AS fluxo_desc,
            ci.idproduto,
            ps.descricao    AS produto_desc,
            ci.quantidade,
            ci.valor_unitario,
            ci.valor_total  AS valor_total_item,
            eq.idequipamento,
            eq.nome         AS equipamento_nome
        FROM compras cp
        JOIN fornecedor       f   ON f.idfornecedor  = cp.idfornecedor
        JOIN empresa          emp ON emp.idempresa   = cp.idempresa
        LEFT JOIN fluxo_financeiro ff ON ff.idfluxo  = cp.idfluxo
        JOIN compra_itens     ci  ON ci.idcompras    = cp.idcompras
        LEFT JOIN produtos_servicos ps ON ps.idproduto = ci.idproduto
        LEFT JOIN equipamento eq  ON eq.idequipamento = ci.idequipamento
        WHERE cp.emissao >= %s
        ORDER BY cp.emissao, ps.descricao
    """

    # vencimentos min/max por compra
    vc_sql = """
        SELECT idcompras,
               MIN(vencimento) AS d1,
               MAX(vencimento) AS d2
        FROM contas_pagar
        GROUP BY idcompras
    """
    vc_map = {}
    with conn.cursor() as cur:
        cur.execute(vc_sql)
        for idcompras, d1, d2 in cur.fetchall():
            vc_map[idcompras] = (d1, d2)

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, (DATA_INICIO,))
        rows = cur.fetchall()

    header = [
        "DATA INICIAL", "DATA FINAL", "SITUACAO", "DATA EMISSAO",
        "CODEMP", "EMPRESA", "IDFORNECEDOR", "FORNECEDOR",
        "NOTA FISCAL", "VALOR NF", "PARCELAS",
        "VENCIMENTO INICIAL", "VENCIMENTO FINAL",
        "CC", "EQUIPAMENTO",
        "COD.FLUXO", "FLUXO FINANCEIRO",
        "PRODUTO", "NOME PRODUTO",
        "QTD", "VALOR UNITARIO", "VALOR TOTAL",
    ]

    data = []
    for r in rows:
        d1, d2   = vc_map.get(r["idcompras"], (None, None))
        situacao = "Quitado" if r["situacao"] else "Aberto"
        data.append([
            _fmt_date(d1),
            _fmt_date(d2),
            situacao,
            _fmt_date(r["emissao"]),
            r["idempresa"],
            r["empresa_nome"],
            r["idfornecedor"],
            r["fornecedor_nome"],
            r["nota"],
            r["valor_nf"],
            r["parcelas"],
            _fmt_date(d1),
            _fmt_date(d2),
            r["idequipamento"],
            r["equipamento_nome"],
            r["idfluxo"],
            r["fluxo_desc"],
            r["idproduto"],
            r["produto_desc"],
            r["quantidade"],
            r["valor_unitario"],
            r["valor_total_item"],
        ])

    return _write_csv(f"COMPRAS_{SUFFIX}.CSV", header, data)


def gerar_contas_receber(conn) -> str:
    """
    Replica FOR EACH CONTAS_RECEBER + FECHAMENTO + CLIENTE + EMPRESA.
    Monta string de OS concatenadas.
    """
    sql = """
        SELECT
            cr.idcontasreceber,
            cr.vencimento,
            cr.valor,
            cr.valor_pago,
            cr.situacao,
            cr.idfechamento,
            cl.nome  AS cliente_nome,
            emp.nomefantasia AS empresa
        FROM contas_receber cr
        JOIN fechamento f   ON f.idfechamento = cr.idfechamento
        JOIN cliente    cl  ON cl.idcliente   = f.idcliente
        JOIN empresa    emp ON emp.idempresa  = f.idempresa
        WHERE cr.vencimento >= %s
        ORDER BY cr.vencimento
    """

    # Busca todas as OS agrupadas por fechamento
    os_sql = """
        SELECT idfechamento, array_agg(numero_os ORDER BY numero_os) AS os_list
        FROM ordem
        WHERE idfechamento IS NOT NULL
        GROUP BY idfechamento
    """
    os_map = {}
    with conn.cursor() as cur:
        cur.execute(os_sql)
        for idf, os_list in cur.fetchall():
            os_map[idf] = "  -  ".join(str(n) for n in os_list if n)

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, (DATA_INICIO,))
        rows = cur.fetchall()

    header = [
        "VENCIMENTO", "CLIENTE", "ORDENS SERVICO",
        "VALOR", "EMPRESA", "VALOR PAGO", "SITUACAO", "IDRECEBER",
    ]

    data = []
    for r in rows:
        situacao = "Quitada" if r["situacao"] else "Aberta"
        ordens   = os_map.get(r["idfechamento"], "")
        data.append([
            _fmt_date(r["vencimento"]),
            r["cliente_nome"],
            ordens,
            r["valor"],
            r["empresa"],
            r["valor_pago"],
            situacao,
            r["idcontasreceber"],
        ])

    return _write_csv(f"CONTAS_RECEBER_{SUFFIX}.CSV", header, data)


def gerar_contas_pagar(conn) -> str:
    """Replica FOR EACH CONTAS_PAGAR + COMPRAS + FORNECEDOR + EMPRESA."""
    sql = """
        SELECT
            cp.vencimento,
            f.nome          AS fornecedor,
            cp.valor,
            cp.valor_pago,
            cp.situacao,
            comp.nota,
            comp.idcompras,
            emp.nomefantasia AS empresa
        FROM contas_pagar cp
        JOIN compras  comp ON comp.idcompras  = cp.idcompras
        JOIN fornecedor f  ON f.idfornecedor  = comp.idfornecedor
        JOIN empresa   emp ON emp.idempresa   = comp.idempresa
        WHERE cp.vencimento >= %s
        ORDER BY cp.vencimento
    """
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, (DATA_INICIO,))
        rows = cur.fetchall()

    header = [
        "VENCIMENTO", "FORNECEDOR", "DOCUMENTO",
        "VALOR", "EMPRESA", "VALOR PAGO", "SITUACAO",
    ]

    data = []
    for r in rows:
        situacao  = "Quitada" if r["situacao"] else "Aberta"
        documento = str(r["nota"] or "") + str(r["idcompras"] or "")
        data.append([
            _fmt_date(r["vencimento"]),
            r["fornecedor"],
            documento,
            r["valor"],
            r["valor_pago"],
            r["empresa"],
            situacao,
        ])

    return _write_csv(f"CONTAS_PAGAR_{SUFFIX}.CSV", header, data)


# ---------------------------------------------------------------------------
# Envio FTP
# ---------------------------------------------------------------------------


def enviar_ftp(arquivos: list[str]) -> None:
    print(f"\nConectando FTP  {FTP_HOST} ...")
    with FTP() as ftp:
        ftp.connect(FTP_HOST, 21)
        ftp.login(FTP_USER, FTP_PASS)
        ftp.set_pasv(True)
        try:
            ftp.cwd(FTP_DIR)
        except error_perm:
            pass

        for path in arquivos:
            nome = os.path.basename(path)
            with open(path, "rb") as f:
                ftp.storbinary(f"STOR {nome}", f)
            print(f"  FTP OK  {nome}")

    print("FTP concluído.")


# ---------------------------------------------------------------------------
# Limpeza de CSVs anteriores
# ---------------------------------------------------------------------------


def limpar_csvs() -> None:
    for f in glob.glob(os.path.join(FTP_LOCAL, "*.CSV")):
        try:
            os.remove(f)
        except OSError:
            pass
    print(f"CSVs anteriores removidos de {FTP_LOCAL}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    os.makedirs(FTP_LOCAL, exist_ok=True)

    print(f"=== ATUALIZA BI  {TODAY:%d/%m/%Y} ===\n")
    limpar_csvs()
    print()

    try:
        conn = _conn()
    except Exception as exc:
        print(f"ERRO ao conectar no banco: {exc}", file=sys.stderr)
        sys.exit(1)

    arquivos = []
    try:
        print("Gerando CSVs ...")
        arquivos.append(gerar_ordens_servico(conn))
        arquivos.append(gerar_comissoes(conn))
        arquivos.append(gerar_compras(conn))
        arquivos.append(gerar_contas_receber(conn))
        arquivos.append(gerar_contas_pagar(conn))
    finally:
        conn.close()

    print(f"\n{len(arquivos)} arquivo(s) gerado(s).")

    #try:
    #    enviar_ftp(arquivos)
    #except Exception as exc:
    #    print(f"\nERRO no envio FTP: {exc}", file=sys.stderr)
    #    sys.exit(1)

    print("\n=== Concluído com sucesso ===")


if __name__ == "__main__":
    main()
