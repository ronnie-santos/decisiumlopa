from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, or_
from typing import List, Optional
from datetime import date
from io import BytesIO

import models, schemas
from database import get_db

router = APIRouter(prefix="/contas-pagar", tags=["contas-pagar"])


def _load_conta(db: Session, idcontaspagar: int) -> models.ContasPagar:
    item = db.query(models.ContasPagar).filter(
        models.ContasPagar.idcontaspagar == idcontaspagar
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Conta a pagar não encontrada")
    return item


# ── Listar ───────────────────────────────────────────────────────────────────
@router.get("", response_model=None)
def list_contas_pagar(
    idcompras: Optional[int] = Query(None),
    situacao: Optional[bool] = Query(None),
    fornecedor: Optional[str] = Query(None),
    venc_de: Optional[date] = Query(None),
    venc_ate: Optional[date] = Query(None),
    status: Optional[str] = Query(None),   # PENDENTE | PAGO | ATRASADO
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    today = date.today()

    # ── base query com JOIN opcional em compras + fornecedor ──────────────────
    q = (
        db.query(
            models.ContasPagar,
            func.coalesce(models.Fornecedor.nomefantasia, models.Fornecedor.nome).label("fornecedor_nome"),
            models.Compra.nota.label("nota_numero"),
        )
        .outerjoin(models.Compra, models.ContasPagar.idcompras == models.Compra.idcompras)
        .outerjoin(models.Fornecedor, models.Compra.idfornecedor == models.Fornecedor.idfornecedor)
    )

    # ── filtros ───────────────────────────────────────────────────────────────
    if idcompras is not None:
        q = q.filter(models.ContasPagar.idcompras == idcompras)
    if situacao is not None:
        q = q.filter(models.ContasPagar.situacao == situacao)
    if fornecedor:
        like = f"%{fornecedor}%"
        q = q.filter(or_(
            models.Fornecedor.nome.ilike(like),
            models.Fornecedor.nomefantasia.ilike(like),
        ))
    if venc_de:
        q = q.filter(models.ContasPagar.vencimento >= venc_de)
    if venc_ate:
        q = q.filter(models.ContasPagar.vencimento <= venc_ate)
    if status == "PAGO":
        q = q.filter(models.ContasPagar.situacao == True)
    elif status == "PENDENTE":
        q = q.filter(
            models.ContasPagar.situacao == False,
            or_(models.ContasPagar.vencimento == None, models.ContasPagar.vencimento >= today),
        )
    elif status == "ATRASADO":
        q = q.filter(
            models.ContasPagar.situacao == False,
            models.ContasPagar.vencimento < today,
        )

    total = q.count()

    # ── stats: mesma base + joins, mas SEM filtro de status/situacao ─────────
    q_stats = (
        db.query(models.ContasPagar)
        .outerjoin(models.Compra,      models.ContasPagar.idcompras    == models.Compra.idcompras)
        .outerjoin(models.Fornecedor,  models.Compra.idfornecedor      == models.Fornecedor.idfornecedor)
    )
    if idcompras is not None:
        q_stats = q_stats.filter(models.ContasPagar.idcompras == idcompras)
    if fornecedor:
        like = f"%{fornecedor}%"
        q_stats = q_stats.filter(or_(
            models.Fornecedor.nome.ilike(like),
            models.Fornecedor.nomefantasia.ilike(like),
        ))
    if venc_de:
        q_stats = q_stats.filter(models.ContasPagar.vencimento >= venc_de)
    if venc_ate:
        q_stats = q_stats.filter(models.ContasPagar.vencimento <= venc_ate)

    stats = q_stats.with_entities(
        func.coalesce(func.sum(models.ContasPagar.valor_pago).filter(
            models.ContasPagar.situacao == True), 0).label("total_pago"),
        func.coalesce(func.sum(models.ContasPagar.valor).filter(
            models.ContasPagar.situacao == False,
            models.ContasPagar.vencimento >= today), 0).label("total_pendente"),
        func.coalesce(func.sum(models.ContasPagar.valor).filter(
            models.ContasPagar.situacao == False,
            models.ContasPagar.vencimento < today), 0).label("total_atrasado"),
        func.count(models.ContasPagar.idcontaspagar).filter(
            models.ContasPagar.situacao == True).label("qtd_pago"),
        func.count(models.ContasPagar.idcontaspagar).filter(
            models.ContasPagar.situacao == False,
            models.ContasPagar.vencimento >= today).label("qtd_pendente"),
        func.count(models.ContasPagar.idcontaspagar).filter(
            models.ContasPagar.situacao == False,
            models.ContasPagar.vencimento < today).label("qtd_atrasado"),
    ).one()

    rows = q.order_by(models.ContasPagar.vencimento.asc().nulls_last()).offset(skip).limit(limit).all()

    data = []
    for cp, fornecedor_nome, nota_numero in rows:
        item = schemas.ContasPagar.model_validate(cp).model_dump()
        item["fornecedor_nome"] = fornecedor_nome
        item["nota_numero"] = nota_numero
        data.append(item)

    return {
        "data": data,
        "total": total,
        "skip": skip,
        "limit": limit,
        "total_pago":     float(stats.total_pago or 0),
        "total_pendente": float(stats.total_pendente or 0),
        "total_atrasado": float(stats.total_atrasado or 0),
        "qtd_pago":       stats.qtd_pago,
        "qtd_pendente":   stats.qtd_pendente,
        "qtd_atrasado":   stats.qtd_atrasado,
    }


# ── GET /contas-pagar/relatorio — JSON ────────────────────────────────────────
@router.get("/relatorio")
def relatorio_contas_pagar(
    data_de:      date           = Query(...),
    data_ate:     date           = Query(...),
    idfornecedor: Optional[int]  = Query(None),
    idempresa:    Optional[int]  = Query(None),
    situacao:     Optional[bool] = Query(None),
    grupo:        int            = Query(1, ge=1, le=3),
    db: Session = Depends(get_db),
):
    return _compute_contaspagar_relatorio(data_de, data_ate, db, idfornecedor, idempresa, situacao, grupo)


# ── GET /contas-pagar/relatorio/pdf — PDF ────────────────────────────────────
@router.get("/relatorio/pdf")
def relatorio_contas_pagar_pdf(
    data_de:      date           = Query(...),
    data_ate:     date           = Query(...),
    idfornecedor: Optional[int]  = Query(None),
    idempresa:    Optional[int]  = Query(None),
    situacao:     Optional[bool] = Query(None),
    grupo:        int            = Query(1, ge=1, le=3),
    db: Session = Depends(get_db),
):
    from reports.contaspagar_report import ContasPagarReport

    dados = _compute_contaspagar_relatorio(data_de, data_ate, db, idfornecedor, idempresa, situacao, grupo)

    buf = BytesIO()
    ContasPagarReport().generate(
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

    filename = f"contas_pagar_{data_de}_{data_ate}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


# ── Lógica compartilhada: Compras + Produtos ──────────────────────────────────
def _compute_compras_produtos_relatorio(
    data_de: date,
    data_ate: date,
    db: Session,
    idfornecedor: Optional[int] = None,
    idempresa: Optional[int] = None,
    idproduto: Optional[int] = None,
) -> dict:
    q = (
        db.query(
            models.CompraItem.idcompras.label("idcompras"),
            models.CompraItem.quantidade,
            models.CompraItem.valor_unitario,
            models.CompraItem.valor_total,
            models.Compra.emissao,
            models.Compra.nota,
            models.Compra.situacao.label("compra_situacao"),
            func.coalesce(models.Fornecedor.nomefantasia, models.Fornecedor.nome).label("fornecedor_nome"),
            func.coalesce(models.Empresa.nomefantasia, models.Empresa.nome).label("empresa_nome"),
            models.ProdutoServico.descricao.label("produto_descricao"),
            models.Equipamento.nome.label("equipamento_nome"),
            func.coalesce(models.FluxoFinanceiro.descricao, "").label("fluxo_descricao"),
        )
        .join(models.Compra, models.CompraItem.idcompras == models.Compra.idcompras)
        .outerjoin(models.Fornecedor,      models.Compra.idfornecedor     == models.Fornecedor.idfornecedor)
        .outerjoin(models.Empresa,         models.Compra.idempresa        == models.Empresa.idempresa)
        .outerjoin(models.FluxoFinanceiro, models.Compra.idfluxo          == models.FluxoFinanceiro.idfluxo)
        .outerjoin(models.ProdutoServico,  models.CompraItem.idproduto    == models.ProdutoServico.idproduto)
        .outerjoin(models.Equipamento,     models.CompraItem.idequipamento == models.Equipamento.idequipamento)
        .filter(
            models.Compra.emissao >= data_de,
            models.Compra.emissao <= data_ate,
        )
    )

    if idfornecedor is not None:
        q = q.filter(models.Compra.idfornecedor == idfornecedor)
    if idempresa is not None:
        q = q.filter(models.Compra.idempresa == idempresa)
    if idproduto is not None:
        q = q.filter(models.CompraItem.idproduto == idproduto)

    rows_raw = q.order_by(models.Compra.emissao.asc(), models.ProdutoServico.descricao.asc()).all()

    # Sub-consulta: 1ª e última data de vencimento das contas a pagar por compra
    compra_ids = list({row.idcompras for row in rows_raw})
    venc_map: dict[int, tuple] = {}
    if compra_ids:
        venc_rows = (
            db.query(
                models.ContasPagar.idcompras,
                func.min(models.ContasPagar.vencimento).label("v_min"),
                func.max(models.ContasPagar.vencimento).label("v_max"),
            )
            .filter(models.ContasPagar.idcompras.in_(compra_ids))
            .group_by(models.ContasPagar.idcompras)
            .all()
        )
        for vrow in venc_rows:
            venc_map[vrow.idcompras] = (
                str(vrow.v_min) if vrow.v_min else None,
                str(vrow.v_max) if vrow.v_max else None,
            )

    rows: list[dict] = []
    total_valor = 0.0
    for row in rows_raw:
        v_min, v_max = venc_map.get(row.idcompras, (None, None))
        rows.append({
            "emissao":           str(row.emissao) if row.emissao else None,
            "fornecedor_nome":   row.fornecedor_nome or "",
            "nota":              row.nota or "",
            "empresa_nome":      row.empresa_nome or "",
            "produto_descricao": row.produto_descricao or "",
            "equipamento_nome":  row.equipamento_nome or "",
            "quantidade":        float(row.quantidade or 0),
            "valor_unitario":    float(row.valor_unitario or 0),
            "valor_total":       float(row.valor_total or 0),
            "situacao":          row.compra_situacao,
            "vencimento_de":     v_min,
            "vencimento_ate":    v_max,
        })
        total_valor += float(row.valor_total or 0)

    return {
        "rows":             rows,
        "total_valor":      round(total_valor, 2),
        "total_registros":  len(rows),
    }


# ── GET /contas-pagar/relatorio-compras — JSON ────────────────────────────────
@router.get("/relatorio-compras")
def relatorio_compras_produtos(
    data_de:      date          = Query(...),
    data_ate:     date          = Query(...),
    idfornecedor: Optional[int] = Query(None),
    idempresa:    Optional[int] = Query(None),
    idproduto:    Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    return _compute_compras_produtos_relatorio(data_de, data_ate, db, idfornecedor, idempresa, idproduto)


# ── GET /contas-pagar/relatorio-compras/pdf — PDF ─────────────────────────────
@router.get("/relatorio-compras/pdf")
def relatorio_compras_produtos_pdf(
    data_de:      date          = Query(...),
    data_ate:     date          = Query(...),
    idfornecedor: Optional[int] = Query(None),
    idempresa:    Optional[int] = Query(None),
    idproduto:    Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    from reports.compras_produtos_report import ComprasProdutosReport

    dados = _compute_compras_produtos_relatorio(data_de, data_ate, db, idfornecedor, idempresa, idproduto)

    buf = BytesIO()
    ComprasProdutosReport().generate(
        rows=dados["rows"],
        total_valor=dados["total_valor"],
        total_registros=dados["total_registros"],
        data_de=str(data_de),
        data_ate=str(data_ate),
        buf=buf,
    )
    buf.seek(0)

    filename = f"compras_produtos_{data_de}_{data_ate}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


# ── Buscar por ID ─────────────────────────────────────────────────────────────
@router.get("/{idcontaspagar}", response_model=schemas.ContasPagar)
def get_conta_pagar(idcontaspagar: int, db: Session = Depends(get_db)):
    return _load_conta(db, idcontaspagar)


# ── Criar ─────────────────────────────────────────────────────────────────────
@router.post("", response_model=schemas.ContasPagar, status_code=201)
def create_conta_pagar(payload: schemas.ContasPagarCreate, db: Session = Depends(get_db)):
    db_item = models.ContasPagar(**payload.model_dump(exclude_unset=True))
    db.add(db_item)
    try:
        db.commit()
        db.refresh(db_item)
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))
    return db_item


# ── Atualizar ─────────────────────────────────────────────────────────────────
@router.put("/{idcontaspagar}", response_model=schemas.ContasPagar)
def update_conta_pagar(
    idcontaspagar: int, payload: schemas.ContasPagarCreate, db: Session = Depends(get_db)
):
    db_item = _load_conta(db, idcontaspagar)
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
@router.delete("/{idcontaspagar}")
def delete_conta_pagar(idcontaspagar: int, db: Session = Depends(get_db)):
    db_item = _load_conta(db, idcontaspagar)
    if db_item.situacao is True:
        raise HTTPException(status_code=400, detail="Conta já paga não pode ser excluída.")
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Conta a pagar não pode ser excluída pois possui vínculos.")
    return {"ok": True, "message": "Conta a pagar excluída com sucesso"}


# ── Registrar pagamento ───────────────────────────────────────────────────────
@router.patch("/{idcontaspagar}/pagar", response_model=schemas.ContasPagar)
def registrar_pagamento(
    idcontaspagar: int,
    payload: schemas.RegistrarPagamentoPagarPayload,
    db: Session = Depends(get_db),
):
    """Registra o pagamento de uma conta a pagar e persiste em pagamentos_cp."""
    db_item = _load_conta(db, idcontaspagar)
    db_item.valor_pago      = payload.valor_pago
    db_item.ultimo_pagamento = payload.data_pagamento
    db_item.situacao        = True
    if payload.observacao is not None:
        db_item.observacao = payload.observacao

    # Upsert em pagamentos_cp
    if payload.idformapgto:
        pgto = db.query(models.PagamentosCP).filter(
            models.PagamentosCP.idcontaspagar == idcontaspagar
        ).first()
        if pgto:
            pgto.idformapgto = payload.idformapgto
            pgto.valor       = payload.valor_pago
            pgto.data        = payload.data_pagamento
        else:
            pgto = models.PagamentosCP(
                idcontaspagar = idcontaspagar,
                idformapgto   = payload.idformapgto,
                valor         = payload.valor_pago,
                data          = payload.data_pagamento,
            )
            db.add(pgto)

    db.commit()
    db.refresh(db_item)
    return db_item


# ── Cancelar baixa ────────────────────────────────────────────────────────────
@router.patch("/{idcontaspagar}/cancelar-baixa", response_model=schemas.ContasPagar)
def cancelar_baixa(idcontaspagar: int, db: Session = Depends(get_db)):
    """Cancela a baixa: zera valor_pago, limpa data, reabre parcela e remove pagamentos_cp."""
    db_item = _load_conta(db, idcontaspagar)
    db_item.valor_pago       = 0
    db_item.ultimo_pagamento = None
    db_item.situacao         = False

    pgto = db.query(models.PagamentosCP).filter(
        models.PagamentosCP.idcontaspagar == idcontaspagar
    ).first()
    if pgto:
        db.delete(pgto)

    db.commit()
    db.refresh(db_item)
    return db_item


# ── Lógica compartilhada de relatório ────────────────────────────────────────
def _compute_contaspagar_relatorio(
    data_de: date,
    data_ate: date,
    db: Session,
    idfornecedor: Optional[int] = None,
    idempresa: Optional[int] = None,
    situacao: Optional[bool] = None,
    grupo: int = 1,
) -> dict:
    q = (
        db.query(
            models.ContasPagar,
            func.coalesce(models.Fornecedor.nomefantasia, models.Fornecedor.nome).label("fornecedor_nome"),
            func.coalesce(models.Empresa.nomefantasia, models.Empresa.nome).label("empresa_nome"),
            models.Compra.nota.label("nota"),
        )
        .outerjoin(models.Compra,     models.ContasPagar.idcompras    == models.Compra.idcompras)
        .outerjoin(models.Fornecedor, models.Compra.idfornecedor      == models.Fornecedor.idfornecedor)
        .outerjoin(models.Empresa,    models.Compra.idempresa         == models.Empresa.idempresa)
        .filter(
            models.ContasPagar.vencimento >= data_de,
            models.ContasPagar.vencimento <= data_ate,
        )
    )

    if idfornecedor is not None:
        q = q.filter(models.Compra.idfornecedor == idfornecedor)
    if idempresa is not None:
        q = q.filter(models.Compra.idempresa == idempresa)
    if situacao is not None:
        q = q.filter(models.ContasPagar.situacao == situacao)

    rows_raw = q.order_by(models.ContasPagar.vencimento, models.Fornecedor.nome).all()

    rows: list[dict] = []
    for cp, fornecedor_nome, empresa_nome, nota in rows_raw:
        fn = fornecedor_nome or ""
        en = empresa_nome or ""

        quebra = ""
        if grupo == 2:
            quebra = fn
        elif grupo == 3:
            quebra = en

        rows.append({
            "vencimento":      str(cp.vencimento) if cp.vencimento else None,
            "fornecedor_nome": fn,
            "nota":            nota or "",
            "valor":           float(cp.valor or 0),
            "empresa_nome":    en,
            "valor_pago":      float(cp.valor_pago or 0),
            "situacao":        cp.situacao,
            "parcela":         cp.parcela or "",
            "quebra":          quebra,
        })

    # ── Agrupar ───────────────────────────────────────────────────────────────
    if grupo == 1:
        result = [{
            "quebra":           "",
            "rows":             rows,
            "subtotal_valor":   round(sum(r["valor"]      for r in rows), 2),
            "subtotal_pago":    round(sum(r["valor_pago"] for r in rows), 2),
            "count":            len(rows),
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
        "grupos":           result,
        "total_valor":      total_valor,
        "total_pago":       total_pago,
        "total_registros":  total_registros,
        "grupo_tipo":       grupo,
    }
