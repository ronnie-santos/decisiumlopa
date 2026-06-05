from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, or_, select as sa_select
from typing import List, Optional
from datetime import date
from collections import defaultdict
from io import BytesIO

import models, schemas
from database import get_db

router = APIRouter(prefix="/contas-receber", tags=["contas-receber"])


def _load_conta(db: Session, idcontasreceber: int) -> models.ContasReceber:
    item = db.query(models.ContasReceber).filter(
        models.ContasReceber.idcontasreceber == idcontasreceber
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Conta a receber não encontrada")
    return item


# ── Listar ───────────────────────────────────────────────────────────────────
@router.get("", response_model=None)
def list_contas_receber(
    idfechamento: Optional[int] = Query(None),
    situacao: Optional[bool] = Query(None),
    cliente: Optional[str] = Query(None),
    venc_de: Optional[date] = Query(None),
    venc_ate: Optional[date] = Query(None),
    status: Optional[str] = Query(None),   # PENDENTE | PAGO | ATRASADO
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    today = date.today()

    # ── base query com JOIN em fechamento + cliente ───────────────────────────
    q = (
        db.query(
            models.ContasReceber,
            func.coalesce(models.Cliente.nomefantasia, models.Cliente.nome).label("cliente_nome"),
        )
        .outerjoin(models.Fechamento, models.ContasReceber.idfechamento == models.Fechamento.idfechamento)
        .outerjoin(models.Cliente, models.Fechamento.idcliente == models.Cliente.idcliente)
    )

    # ── filtros ───────────────────────────────────────────────────────────────
    if idfechamento is not None:
        q = q.filter(models.ContasReceber.idfechamento == idfechamento)
    if situacao is not None:
        q = q.filter(models.ContasReceber.situacao == situacao)
    if cliente:
        like = f"%{cliente}%"
        q = q.filter(or_(
            models.Cliente.nome.ilike(like),
            models.Cliente.nomefantasia.ilike(like),
        ))
    if venc_de:
        q = q.filter(models.ContasReceber.vencimento >= venc_de)
    if venc_ate:
        q = q.filter(models.ContasReceber.vencimento <= venc_ate)
    if status == "PAGO":
        q = q.filter(models.ContasReceber.situacao == True)
    elif status == "PENDENTE":
        q = q.filter(
            models.ContasReceber.situacao == False,
            or_(models.ContasReceber.vencimento == None, models.ContasReceber.vencimento >= today),
        )
    elif status == "ATRASADO":
        q = q.filter(
            models.ContasReceber.situacao == False,
            models.ContasReceber.vencimento < today,
        )

    total = q.count()

    # ── stats globais (sem filtros de paginação) ──────────────────────────────
    q_stats = db.query(models.ContasReceber)
    if idfechamento is not None:
        q_stats = q_stats.filter(models.ContasReceber.idfechamento == idfechamento)

    stats = q_stats.with_entities(
        func.coalesce(func.sum(models.ContasReceber.valor_pago).filter(
            models.ContasReceber.situacao == True), 0).label("total_pago"),
        func.coalesce(func.sum(models.ContasReceber.valor).filter(
            models.ContasReceber.situacao == False,
            models.ContasReceber.vencimento >= today), 0).label("total_pendente"),
        func.coalesce(func.sum(models.ContasReceber.valor).filter(
            models.ContasReceber.situacao == False,
            models.ContasReceber.vencimento < today), 0).label("total_atrasado"),
        func.count(models.ContasReceber.idcontasreceber).filter(
            models.ContasReceber.situacao == False,
            models.ContasReceber.vencimento >= today).label("qtd_pendente"),
        func.count(models.ContasReceber.idcontasreceber).filter(
            models.ContasReceber.situacao == False,
            models.ContasReceber.vencimento < today).label("qtd_atrasado"),
    ).one()

    rows = q.order_by(models.ContasReceber.vencimento.asc()).offset(skip).limit(limit).all()

    data = []
    for cr, cliente_nome in rows:
        item = schemas.ContasReceber.model_validate(cr).model_dump()
        item["cliente_nome"] = cliente_nome
        data.append(item)

    return {
        "data": data,
        "total": total,
        "skip": skip,
        "limit": limit,
        "total_pago":     float(stats.total_pago or 0),
        "total_pendente": float(stats.total_pendente or 0),
        "total_atrasado": float(stats.total_atrasado or 0),
        "qtd_pendente":   stats.qtd_pendente,
        "qtd_atrasado":   stats.qtd_atrasado,
    }


# ── Lógica compartilhada de relatório ────────────────────────────────────────
def _compute_contasreceber_relatorio(
    data_de: date,
    data_ate: date,
    db: Session,
    idcliente: Optional[int] = None,
    idempresa: Optional[int] = None,
    situacao: Optional[bool] = None,
    grupo: int = 1,
) -> dict:
    q = (
        db.query(
            models.ContasReceber,
            func.coalesce(models.Cliente.nomefantasia, models.Cliente.nome).label("cliente_nome"),
            func.coalesce(models.Empresa.nomefantasia, models.Empresa.nome).label("empresa_nome"),
        )
        .outerjoin(models.Fechamento, models.ContasReceber.idfechamento == models.Fechamento.idfechamento)
        .outerjoin(models.Cliente,    models.Fechamento.idcliente      == models.Cliente.idcliente)
        .outerjoin(models.Empresa,    models.Fechamento.idempresa      == models.Empresa.idempresa)
        .filter(
            models.ContasReceber.vencimento >= data_de,
            models.ContasReceber.vencimento <= data_ate,
        )
    )

    if idcliente is not None:
        q = q.filter(models.Fechamento.idcliente == idcliente)
    if idempresa is not None:
        q = q.filter(models.Fechamento.idempresa == idempresa)
    if situacao is not None:
        q = q.filter(models.ContasReceber.situacao == situacao)

    rows_raw = q.order_by(models.ContasReceber.vencimento, models.Cliente.nome).all()

    # Coleta ordens de serviço agrupadas por idfechamento
    fechamento_ids = list({cr.idfechamento for cr, _, _ in rows_raw if cr.idfechamento})
    ordens_map: dict[int, list[str]] = defaultdict(list)
    if fechamento_ids:
        ordens_rows = (
            db.query(models.Ordem.idfechamento, models.Ordem.numero_os)
            .filter(models.Ordem.idfechamento.in_(fechamento_ids))
            .filter(models.Ordem.numero_os.isnot(None))
            .order_by(models.Ordem.idfechamento, models.Ordem.numero_os)
            .all()
        )
        for fid, nos in ordens_rows:
            ordens_map[fid].append(str(nos))

    rows: list[dict] = []
    for cr, cliente_nome, empresa_nome in rows_raw:
        cn = cliente_nome or ""
        en = empresa_nome or ""
        ordens_str = " - ".join(ordens_map.get(cr.idfechamento or 0, []))

        quebra = ""
        if grupo == 2:
            quebra = cn
        elif grupo == 3:
            quebra = en

        rows.append({
            "vencimento":       str(cr.vencimento) if cr.vencimento else None,
            "cliente_nome":     cn,
            "ordens":           ordens_str,
            "valor":            float(cr.valor or 0),
            "empresa_nome":     en,
            "valor_pago":       float(cr.valor_pago or 0),
            "situacao":         cr.situacao,
            "parcela":          cr.parcela or "",
            "idcontasreceber":  cr.idcontasreceber,
            "quebra":           quebra,
        })

    # Agrupar
    if grupo == 1:
        result = [{
            "quebra":         "",
            "rows":           rows,
            "subtotal_valor": round(sum(r["valor"]      for r in rows), 2),
            "subtotal_pago":  round(sum(r["valor_pago"] for r in rows), 2),
            "count":          len(rows),
        }]
    else:
        grupos_map: dict[str, dict] = {}
        for row in rows:
            key = row["quebra"]
            if key not in grupos_map:
                grupos_map[key] = {"quebra": key, "rows": [], "subtotal_valor": 0.0, "subtotal_pago": 0.0, "count": 0}
            grupos_map[key]["rows"].append(row)
            grupos_map[key]["subtotal_valor"] = round(grupos_map[key]["subtotal_valor"] + row["valor"], 2)
            grupos_map[key]["subtotal_pago"]  = round(grupos_map[key]["subtotal_pago"]  + row["valor_pago"], 2)
            grupos_map[key]["count"] += 1
        result = sorted(grupos_map.values(), key=lambda g: g["quebra"])

    total_valor     = round(sum(g["subtotal_valor"] for g in result), 2)
    total_pago      = round(sum(g["subtotal_pago"]  for g in result), 2)
    total_registros = sum(g["count"] for g in result)

    return {
        "grupos":          result,
        "total_valor":     total_valor,
        "total_pago":      total_pago,
        "total_registros": total_registros,
        "grupo_tipo":      grupo,
    }


# ── GET /contas-receber/relatorio — JSON ──────────────────────────────────────
@router.get("/relatorio")
def relatorio_contas_receber(
    data_de:   date           = Query(...),
    data_ate:  date           = Query(...),
    idcliente: Optional[int]  = Query(None),
    idempresa: Optional[int]  = Query(None),
    situacao:  Optional[bool] = Query(None),
    grupo:     int            = Query(1, ge=1, le=3),
    db: Session = Depends(get_db),
):
    return _compute_contasreceber_relatorio(data_de, data_ate, db, idcliente, idempresa, situacao, grupo)


# ── GET /contas-receber/relatorio/pdf — PDF ───────────────────────────────────
@router.get("/relatorio/pdf")
def relatorio_contas_receber_pdf(
    data_de:   date           = Query(...),
    data_ate:  date           = Query(...),
    idcliente: Optional[int]  = Query(None),
    idempresa: Optional[int]  = Query(None),
    situacao:  Optional[bool] = Query(None),
    grupo:     int            = Query(1, ge=1, le=3),
    db: Session = Depends(get_db),
):
    from reports.contasreceber_report import ContasReceberReport

    dados = _compute_contasreceber_relatorio(data_de, data_ate, db, idcliente, idempresa, situacao, grupo)

    buf = BytesIO()
    ContasReceberReport().generate(
        grupos=dados["grupos"],
        total_valor=dados["total_valor"],
        total_pago=dados["total_pago"],
        total_registros=dados["total_registros"],
        grupo_tipo=dados["grupo_tipo"],
        data_de=str(data_de),
        data_ate=str(data_ate),
        buf=buf,
    )
    buf.seek(0)

    filename = f"contas_receber_{data_de}_{data_ate}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


# ── Análise Financeira ────────────────────────────────────────────────────────
def _apply_status_cr(q, status: str):
    if status == "pagas":
        return q.filter(models.ContasReceber.situacao == True)
    if status == "abertas":
        return q.filter(models.ContasReceber.situacao == False)
    return q


def _apply_status_cp(q, status: str):
    if status == "pagas":
        return q.filter(models.ContasPagar.situacao == True)
    if status == "abertas":
        return q.filter(models.ContasPagar.situacao == False)
    return q


def _compute_analise(
    data_de: date,
    data_ate: date,
    db: Session,
    idempresa: Optional[int] = None,
    status: str = "ambas",
) -> dict:
    from sqlalchemy import func as F

    # ── 1. Resumo CR ─────────────────────────────────────────────────────────
    q_cr_base = (
        db.query(models.ContasReceber)
        .join(models.Fechamento, models.ContasReceber.idfechamento == models.Fechamento.idfechamento)
        .filter(
            models.ContasReceber.vencimento >= data_de,
            models.ContasReceber.vencimento <= data_ate,
        )
    )
    if idempresa is not None:
        q_cr_base = q_cr_base.filter(models.Fechamento.idempresa == idempresa)
    q_cr_base = _apply_status_cr(q_cr_base, status)

    cr_agg = q_cr_base.with_entities(
        F.coalesce(F.sum(models.ContasReceber.valor), 0).label("total_receitas"),
        F.coalesce(F.sum(models.ContasReceber.valor_pago).filter(models.ContasReceber.situacao == True), 0).label("total_pago_receitas"),
        F.count(models.ContasReceber.idcontasreceber).label("qtd_receitas"),
    ).one()

    # ── 2. Resumo CP ─────────────────────────────────────────────────────────
    q_cp_base = (
        db.query(models.ContasPagar)
        .join(models.Compra, models.ContasPagar.idcompras == models.Compra.idcompras)
        .filter(
            models.ContasPagar.vencimento >= data_de,
            models.ContasPagar.vencimento <= data_ate,
        )
    )
    if idempresa is not None:
        q_cp_base = q_cp_base.filter(models.Compra.idempresa == idempresa)
    q_cp_base = _apply_status_cp(q_cp_base, status)

    cp_agg = q_cp_base.with_entities(
        F.coalesce(F.sum(models.ContasPagar.valor), 0).label("total_despesas"),
        F.coalesce(F.sum(models.ContasPagar.valor_pago).filter(models.ContasPagar.situacao == True), 0).label("total_pago_despesas"),
        F.count(models.ContasPagar.idcontaspagar).label("qtd_despesas"),
    ).one()

    resumo = {
        "total_receitas":      float(cr_agg.total_receitas or 0),
        "total_pago_receitas": float(cr_agg.total_pago_receitas or 0),
        "qtd_receitas":        cr_agg.qtd_receitas,
        "total_despesas":      float(cp_agg.total_despesas or 0),
        "total_pago_despesas": float(cp_agg.total_pago_despesas or 0),
        "qtd_despesas":        cp_agg.qtd_despesas,
        "saldo":               float((cr_agg.total_receitas or 0) - (cp_agg.total_despesas or 0)),
        "saldo_caixa":         float((cr_agg.total_pago_receitas or 0) - (cp_agg.total_pago_despesas or 0)),
    }

    # ── 3. Top 10 Clientes ────────────────────────────────────────────────────
    q_cli = (
        db.query(
            models.Cliente.idcliente,
            F.coalesce(models.Cliente.nomefantasia, models.Cliente.nome).label("nome"),
            F.coalesce(F.sum(models.ContasReceber.valor), 0).label("total_valor"),
            F.coalesce(F.sum(models.ContasReceber.valor_pago).filter(models.ContasReceber.situacao == True), 0).label("total_pago"),
            F.count(models.ContasReceber.idcontasreceber).label("qtd"),
        )
        .join(models.Fechamento, models.ContasReceber.idfechamento == models.Fechamento.idfechamento)
        .join(models.Cliente, models.Fechamento.idcliente == models.Cliente.idcliente)
        .filter(
            models.ContasReceber.vencimento >= data_de,
            models.ContasReceber.vencimento <= data_ate,
        )
    )
    if idempresa is not None:
        q_cli = q_cli.filter(models.Fechamento.idempresa == idempresa)
    q_cli = _apply_status_cr(q_cli, status)

    top_clientes = [
        {
            "idcliente":   row.idcliente,
            "nome":        row.nome or f"Cliente #{row.idcliente}",
            "total_valor": float(row.total_valor or 0),
            "total_pago":  float(row.total_pago or 0),
            "qtd":         row.qtd,
        }
        for row in q_cli
            .group_by(models.Cliente.idcliente, models.Cliente.nomefantasia, models.Cliente.nome)
            .order_by(F.sum(models.ContasReceber.valor).desc())
            .limit(10)
            .all()
    ]

    # ── 4. Top 10 Fornecedores ────────────────────────────────────────────────
    q_forn = (
        db.query(
            models.Fornecedor.idfornecedor,
            F.coalesce(models.Fornecedor.nomefantasia, models.Fornecedor.nome).label("nome"),
            F.coalesce(F.sum(models.ContasPagar.valor), 0).label("total_valor"),
            F.coalesce(F.sum(models.ContasPagar.valor_pago).filter(models.ContasPagar.situacao == True), 0).label("total_pago"),
            F.count(models.ContasPagar.idcontaspagar).label("qtd"),
        )
        .join(models.Compra, models.ContasPagar.idcompras == models.Compra.idcompras)
        .join(models.Fornecedor, models.Compra.idfornecedor == models.Fornecedor.idfornecedor)
        .filter(
            models.ContasPagar.vencimento >= data_de,
            models.ContasPagar.vencimento <= data_ate,
        )
    )
    if idempresa is not None:
        q_forn = q_forn.filter(models.Compra.idempresa == idempresa)
    q_forn = _apply_status_cp(q_forn, status)

    top_fornecedores = [
        {
            "idfornecedor": row.idfornecedor,
            "nome":         row.nome or f"Fornecedor #{row.idfornecedor}",
            "total_valor":  float(row.total_valor or 0),
            "total_pago":   float(row.total_pago or 0),
            "qtd":          row.qtd,
        }
        for row in q_forn
            .group_by(models.Fornecedor.idfornecedor, models.Fornecedor.nomefantasia, models.Fornecedor.nome)
            .order_by(F.sum(models.ContasPagar.valor).desc())
            .limit(10)
            .all()
    ]

    # ── 5. Top Equipamentos por Receita (two-query) ───────────────────────────
    cr_rows_full = (
        db.query(models.ContasReceber, models.Fechamento)
        .join(models.Fechamento, models.ContasReceber.idfechamento == models.Fechamento.idfechamento)
        .filter(
            models.ContasReceber.vencimento >= data_de,
            models.ContasReceber.vencimento <= data_ate,
        )
    )
    if idempresa is not None:
        cr_rows_full = cr_rows_full.filter(models.Fechamento.idempresa == idempresa)
    cr_rows_full = _apply_status_cr(cr_rows_full, status).all()

    fech_ids_full = list({fech.idfechamento for _, fech in cr_rows_full if fech})
    fech_equip_map: dict[int, dict] = {}
    if fech_ids_full:
        eq_rows = (
            db.query(
                models.Ordem.idfechamento,
                models.Equipamento.idequipamento,
                models.Equipamento.nome,
                models.Equipamento.placa,
            )
            .join(models.Equipamento, models.Ordem.idequipamento == models.Equipamento.idequipamento)
            .filter(
                models.Ordem.idfechamento.in_(fech_ids_full),
                models.Ordem.idequipamento.isnot(None),
            )
            .all()
        )
        for fid, eid, ename, eplaca in eq_rows:
            if fid not in fech_equip_map:
                fech_equip_map[fid] = {"idequipamento": eid, "nome": ename or "—", "placa": eplaca or "—"}

    equip_rec: dict[int, dict] = {}
    for cr, fech in cr_rows_full:
        equip = fech_equip_map.get(fech.idfechamento if fech else 0)
        if not equip:
            continue
        eid = equip["idequipamento"]
        if eid not in equip_rec:
            equip_rec[eid] = {"idequipamento": eid, "nome": equip["nome"], "placa": equip["placa"],
                              "total_valor": 0.0, "total_pago": 0.0, "qtd": 0}
        equip_rec[eid]["total_valor"] += float(cr.valor or 0)
        if cr.situacao:
            equip_rec[eid]["total_pago"] += float(cr.valor_pago or 0)
        equip_rec[eid]["qtd"] += 1

    top_equip_receitas = sorted(equip_rec.values(), key=lambda x: x["total_valor"], reverse=True)[:10]
    for e in top_equip_receitas:
        e["total_valor"] = round(e["total_valor"], 2)
        e["total_pago"]  = round(e["total_pago"], 2)

    # ── 6. Top Equipamentos por Despesa ──────────────────────────────────────
    q_ed = (
        db.query(
            models.Equipamento.idequipamento,
            models.Equipamento.nome.label("equip_nome"),
            models.Equipamento.placa.label("equip_placa"),
            F.coalesce(F.sum(models.CompraItem.valor_total), 0).label("total_valor"),
            F.count(F.distinct(models.Compra.idcompras)).label("qtd"),
        )
        .join(models.CompraItem, models.Equipamento.idequipamento == models.CompraItem.idequipamento)
        .join(models.Compra, models.CompraItem.idcompras == models.Compra.idcompras)
        .join(models.ContasPagar, models.ContasPagar.idcompras == models.Compra.idcompras)
        .filter(
            models.ContasPagar.vencimento >= data_de,
            models.ContasPagar.vencimento <= data_ate,
        )
    )
    if idempresa is not None:
        q_ed = q_ed.filter(models.Compra.idempresa == idempresa)
    q_ed = _apply_status_cp(q_ed, status)

    top_equip_despesas = [
        {
            "idequipamento": row.idequipamento,
            "nome":          row.equip_nome or f"Equip. #{row.idequipamento}",
            "placa":         row.equip_placa or "—",
            "total_valor":   float(row.total_valor or 0),
            "qtd":           row.qtd,
        }
        for row in q_ed
            .group_by(models.Equipamento.idequipamento, models.Equipamento.nome, models.Equipamento.placa)
            .order_by(F.sum(models.CompraItem.valor_total).desc())
            .limit(10)
            .all()
    ]

    return {
        "resumo":            resumo,
        "top_clientes":      top_clientes,
        "top_fornecedores":  top_fornecedores,
        "top_equip_receitas": top_equip_receitas,
        "top_equip_despesas": top_equip_despesas,
    }


# ── GET /contas-receber/relatorio/analise — JSON ──────────────────────────────
@router.get("/relatorio/analise")
def relatorio_analise(
    data_de:   date          = Query(...),
    data_ate:  date          = Query(...),
    idempresa: Optional[int] = Query(None),
    status:    str           = Query("ambas"),
    db: Session = Depends(get_db),
):
    return _compute_analise(data_de, data_ate, db, idempresa, status)


# ── GET /contas-receber/relatorio/analise/pdf — PDF ───────────────────────────
@router.get("/relatorio/analise/pdf")
def relatorio_analise_pdf(
    data_de:   date          = Query(...),
    data_ate:  date          = Query(...),
    idempresa: Optional[int] = Query(None),
    status:    str           = Query("ambas"),
    db: Session = Depends(get_db),
):
    from reports.analise_financeira_report import AnaliseFinanceiraReport

    dados = _compute_analise(data_de, data_ate, db, idempresa, status)

    buf = BytesIO()
    AnaliseFinanceiraReport().generate(
        dados=dados,
        data_de=str(data_de),
        data_ate=str(data_ate),
        buf=buf,
    )
    buf.seek(0)

    filename = f"analise_financeira_{data_de}_{data_ate}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


# ── DRE helpers ───────────────────────────────────────────────────────────────
def _ordena_dre(idfluxo: str) -> str:
    """Converte idfluxo dotted ('1.2.3') em chave de ordenação numérica ('001002003')."""
    try:
        return "".join(f"{int(p):03d}" for p in idfluxo.split("."))
    except Exception:
        return idfluxo


def _propagate(nodes: dict, idfluxo: str, delta: float) -> None:
    """Soma delta ao nó e a todos os ancestrais recursivamente."""
    node = nodes.get(idfluxo)
    if not node:
        return
    node["valor"] += delta
    pai = node.get("fluxo_pai") or ""
    if pai and pai in nodes:
        _propagate(nodes, pai, delta)


def _compute_dre(
    data_de: date,
    data_ate: date,
    db: Session,
    idempresa: Optional[int] = None,
    status_cp: str = "ambas",
    status_cr: str = "ambas",
) -> dict:
    # 1. Carrega toda a árvore do FluxoFinanceiro
    all_fluxos = db.query(models.FluxoFinanceiro).all()
    nodes: dict[str, dict] = {
        ff.idfluxo: {
            "idfluxo":   ff.idfluxo,
            "descricao": ff.descricao or "",
            "nivel":     ff.nivel if ff.nivel is not None else 0,
            "fluxo_pai": ff.fluxo_pai or "",
            "tipo":      ff.tipo or "",
            "movimento": ff.movimento or "",
            "valor":     0.0,
        }
        for ff in all_fluxos
    }

    # 2. ContasPagar → despesas (valores negativos no DRE)
    q_cp = (
        db.query(models.ContasPagar, models.Compra)
        .join(models.Compra, models.ContasPagar.idcompras == models.Compra.idcompras)
        .filter(
            models.ContasPagar.vencimento >= data_de,
            models.ContasPagar.vencimento <= data_ate,
            models.Compra.idfluxo.isnot(None),
        )
    )
    if idempresa is not None:
        q_cp = q_cp.filter(models.Compra.idempresa == idempresa)
    if status_cp == "pagas":
        q_cp = q_cp.filter(models.ContasPagar.situacao == True)
    elif status_cp == "abertas":
        q_cp = q_cp.filter(models.ContasPagar.situacao == False)

    total_saidas = 0.0
    for cp, compra in q_cp.all():
        idfluxo_cp = (compra.idfluxo or '').strip()
        if not idfluxo_cp or idfluxo_cp not in nodes:
            continue
        v = float(cp.valor_pago or cp.valor or 0) if cp.situacao else float(cp.valor or 0)
        if v == 0:
            continue
        total_saidas += v
        _propagate(nodes, idfluxo_cp, -v)

    # 3. ContasReceber → receitas (valores positivos)
    # Cadeia: ContasReceber.idfechamento → Fechamento → Ordem.idfechamento → Ordem.idfluxo
    idfluxo_sq = (
        sa_select(models.Ordem.idfluxo)
        .where(
            models.Ordem.idfechamento == models.Fechamento.idfechamento,
            models.Ordem.idfluxo.isnot(None),
        )
        .order_by(models.Ordem.idordem)
        .limit(1)
        .correlate(models.Fechamento)
        .scalar_subquery()
    )

    q_cr = (
        db.query(
            models.ContasReceber,
            idfluxo_sq.label("idfluxo"),
        )
        .join(models.Fechamento, models.ContasReceber.idfechamento == models.Fechamento.idfechamento)
        .filter(
            models.ContasReceber.vencimento >= data_de,
            models.ContasReceber.vencimento <= data_ate,
            idfluxo_sq.isnot(None),
        )
    )
    if idempresa is not None:
        q_cr = q_cr.filter(models.Fechamento.idempresa == idempresa)
    if status_cr == "pagas":
        q_cr = q_cr.filter(models.ContasReceber.situacao == True)   # noqa: E712
    elif status_cr == "abertas":
        q_cr = q_cr.filter(models.ContasReceber.situacao == False)  # noqa: E712

    total_entradas = 0.0
    for cr, idfluxo_raw in q_cr.all():
        idfluxo_cr = (idfluxo_raw or '').strip()
        if not idfluxo_cr or idfluxo_cr not in nodes:
            continue
        v = float(cr.valor_pago or cr.valor or 0) if cr.situacao else float(cr.valor or 0)
        if v == 0:
            continue
        total_entradas += v
        _propagate(nodes, idfluxo_cr, v)

    # 4. Filtra nós com valor != 0, ordena, arredonda
    resultado_nodes = [n for n in nodes.values() if n["valor"] != 0.0]
    resultado_nodes.sort(key=lambda n: _ordena_dre(n["idfluxo"]))
    for n in resultado_nodes:
        n["valor"] = round(n["valor"], 2)

    return {
        "nodes":          resultado_nodes,
        "total_entradas": round(total_entradas, 2),
        "total_saidas":   round(total_saidas, 2),
        "resultado":      round(total_entradas - total_saidas, 2),
    }


# ── GET /contas-receber/relatorio/dre — JSON ──────────────────────────────────
@router.get("/relatorio/dre")
def relatorio_dre(
    data_de:   date           = Query(...),
    data_ate:  date           = Query(...),
    idempresa: Optional[int]  = Query(None),
    status_cp: str            = Query("ambas"),
    status_cr: str            = Query("ambas"),
    db: Session = Depends(get_db),
):
    return _compute_dre(data_de, data_ate, db, idempresa, status_cp, status_cr)


# ── GET /contas-receber/relatorio/dre/pdf — PDF ───────────────────────────────
@router.get("/relatorio/dre/pdf")
def relatorio_dre_pdf(
    data_de:   date           = Query(...),
    data_ate:  date           = Query(...),
    idempresa: Optional[int]  = Query(None),
    status_cp: str            = Query("ambas"),
    status_cr: str            = Query("ambas"),
    db: Session = Depends(get_db),
):
    from reports.dre_report import DREReport

    dados = _compute_dre(data_de, data_ate, db, idempresa, status_cp, status_cr)

    buf = BytesIO()
    DREReport().generate(
        nodes=dados["nodes"],
        total_entradas=dados["total_entradas"],
        total_saidas=dados["total_saidas"],
        resultado=dados["resultado"],
        data_de=str(data_de),
        data_ate=str(data_ate),
        buf=buf,
    )
    buf.seek(0)

    filename = f"dre_{data_de}_{data_ate}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


# ── Buscar por ID ─────────────────────────────────────────────────────────────
@router.get("/{idcontasreceber}", response_model=schemas.ContasReceber)
def get_conta_receber(idcontasreceber: int, db: Session = Depends(get_db)):
    return _load_conta(db, idcontasreceber)


# ── Criar ─────────────────────────────────────────────────────────────────────
@router.post("", response_model=schemas.ContasReceber, status_code=201)
def create_conta_receber(payload: schemas.ContasReceberCreate, db: Session = Depends(get_db)):
    db_item = models.ContasReceber(**payload.model_dump(exclude_unset=True))
    db.add(db_item)
    try:
        db.commit()
        db.refresh(db_item)
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))
    return db_item


# ── Atualizar ─────────────────────────────────────────────────────────────────
@router.put("/{idcontasreceber}", response_model=schemas.ContasReceber)
def update_conta_receber(
    idcontasreceber: int, payload: schemas.ContasReceberCreate, db: Session = Depends(get_db)
):
    db_item = _load_conta(db, idcontasreceber)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)
    try:
        db.commit()
        db.refresh(db_item)
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))
    return db_item


# ── Excluir ───────────────────────────────────────────────────────────────────
@router.delete("/{idcontasreceber}")
def delete_conta_receber(idcontasreceber: int, db: Session = Depends(get_db)):
    db_item = _load_conta(db, idcontasreceber)
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Conta a receber não pode ser excluída pois possui vínculos.")
    return {"ok": True, "message": "Conta a receber excluída com sucesso"}


# ── Registrar pagamento ───────────────────────────────────────────────────────
@router.patch("/{idcontasreceber}/pagar", response_model=schemas.ContasReceber)
def registrar_pagamento(
    idcontasreceber: int,
    payload: schemas.RegistrarPagamentoPayload,
    db: Session = Depends(get_db),
):
    """Registra o pagamento de uma conta a receber e persiste em pagamentos_cr."""
    db_item = _load_conta(db, idcontasreceber)
    db_item.valor_pago       = payload.valor_pago
    db_item.ultimo_pagamento = payload.data_pagamento
    db_item.situacao         = True

    # Upsert em pagamentos_cr
    if payload.idformapgto:
        pgto = db.query(models.PagamentosCR).filter(
            models.PagamentosCR.idcontasreceber == idcontasreceber
        ).first()
        if pgto:
            pgto.idformapgto = payload.idformapgto
            pgto.valor       = payload.valor_pago
            pgto.data        = payload.data_pagamento
        else:
            pgto = models.PagamentosCR(
                idcontasreceber = idcontasreceber,
                idformapgto     = payload.idformapgto,
                valor           = payload.valor_pago,
                data            = payload.data_pagamento,
            )
            db.add(pgto)

    db.commit()
    db.refresh(db_item)
    return db_item


# ── Cancelar baixa ────────────────────────────────────────────────────────────
@router.patch("/{idcontasreceber}/cancelar-baixa", response_model=schemas.ContasReceber)
def cancelar_baixa(idcontasreceber: int, db: Session = Depends(get_db)):
    """Cancela a baixa: zera valor_pago, limpa data, reabre parcela e remove pagamentos_cr."""
    db_item = _load_conta(db, idcontasreceber)
    db_item.valor_pago       = 0
    db_item.ultimo_pagamento = None
    db_item.situacao         = False

    pgto = db.query(models.PagamentosCR).filter(
        models.PagamentosCR.idcontasreceber == idcontasreceber
    ).first()
    if pgto:
        db.delete(pgto)

    db.commit()
    db.refresh(db_item)
    return db_item
