from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session, joinedload, noload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, distinct, or_
from typing import List, Optional
from datetime import date as date_type

import models, schemas
from database import get_db

router = APIRouter(prefix="/compras", tags=["compras"])


def _load_compra(db: Session, idcompras: int) -> models.Compra:
    item = (
        db.query(models.Compra)
        .options(
            joinedload(models.Compra.empresa_rel),
            joinedload(models.Compra.fornecedor_rel),
            joinedload(models.Compra.fluxo_rel),
            joinedload(models.Compra.itens).joinedload(models.CompraItem.produto_rel),
            joinedload(models.Compra.itens).joinedload(models.CompraItem.equipamento_rel),
            joinedload(models.Compra.contas_pagar),
        )
        .filter(models.Compra.idcompras == idcompras)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Compra não encontrada")
    return item


# ── Listar (paginado, server-side) ───────────────────────────────────────────
@router.get("", response_model=List[schemas.Compra])
def list_compras(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    idfornecedor: Optional[int] = Query(None),
    idempresa: Optional[int] = Query(None),
    situacao: Optional[bool] = Query(None),
    emissao_de: Optional[date_type] = Query(None),
    emissao_ate: Optional[date_type] = Query(None),
    fornecedor_nome: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    # ── Query base (sem opções de loading, para reutilizar nos stats) ──────────
    base_q = db.query(models.Compra)

    if idfornecedor is not None:
        base_q = base_q.filter(models.Compra.idfornecedor == idfornecedor)
    if idempresa is not None:
        base_q = base_q.filter(models.Compra.idempresa == idempresa)
    if situacao is not None:
        base_q = base_q.filter(models.Compra.situacao == situacao)
    if emissao_de is not None:
        base_q = base_q.filter(models.Compra.emissao >= emissao_de)
    if emissao_ate is not None:
        base_q = base_q.filter(models.Compra.emissao <= emissao_ate)
    if fornecedor_nome:
        base_q = base_q.join(
            models.Fornecedor,
            models.Compra.idfornecedor == models.Fornecedor.idfornecedor,
            isouter=True,
        )
        like = f"%{fornecedor_nome}%"
        base_q = base_q.filter(
            or_(
                models.Fornecedor.nomefantasia.ilike(like),
                models.Fornecedor.nome.ilike(like),
            )
        )

    # ── Totais para os headers (sem carregar objetos) ─────────────────────────
    stats = base_q.with_entities(
        func.count(models.Compra.idcompras),
        func.coalesce(func.sum(models.Compra.valor), 0),
        func.count(distinct(models.Compra.idfornecedor)),
    ).one()
    response.headers["X-Total-Count"]        = str(stats[0])
    response.headers["X-Total-Valor"]        = str(float(stats[1]))
    response.headers["X-Total-Fornecedores"] = str(stats[2])
    response.headers["Access-Control-Expose-Headers"] = (
        "X-Total-Count, X-Total-Valor, X-Total-Fornecedores"
    )

    # ── Dados paginados (apenas empresa_rel e fornecedor_rel; itens/contas não
    #    são exibidos na grade e causariam N+1 para 60 k registros) ─────────────
    items = (
        base_q
        .options(
            joinedload(models.Compra.empresa_rel),
            joinedload(models.Compra.fornecedor_rel),
            noload(models.Compra.itens),
            noload(models.Compra.contas_pagar),
        )
        .order_by(models.Compra.emissao.desc(), models.Compra.idcompras.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return items


# ── Buscar por ID ─────────────────────────────────────────────────────────────
@router.get("/{idcompras}", response_model=schemas.Compra)
def get_compra(idcompras: int, db: Session = Depends(get_db)):
    return _load_compra(db, idcompras)


# ── Criar (atômico: compra + itens + contas_pagar) ───────────────────────────
@router.post("", response_model=schemas.Compra, status_code=201)
def create_compra(payload: schemas.CompraCreate, db: Session = Depends(get_db)):
    data = payload.model_dump(exclude_unset=True)
    itens_data = data.pop("itens", []) or []
    contas_data = data.pop("contas_pagar", []) or []

    db_compra = models.Compra(**data)
    db.add(db_compra)
    try:
        db.flush()

        for item in itens_data:
            item["idcompras"] = db_compra.idcompras
            db.add(models.CompraItem(**item))

        for i, conta in enumerate(contas_data, 1):
            conta["idcompras"] = db_compra.idcompras
            if not conta.get("parcela"):
                conta["parcela"] = f"{i}/{len(contas_data)}"
            db.add(models.ContasPagar(**conta))

        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))

    return _load_compra(db, db_compra.idcompras)


# ── Atualizar (apenas cabeçalho da compra) ────────────────────────────────────
@router.put("/{idcompras}", response_model=schemas.Compra)
def update_compra(idcompras: int, payload: schemas.CompraCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.Compra).filter(models.Compra.idcompras == idcompras).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Compra não encontrada")
    data = payload.model_dump(exclude_unset=True)
    data.pop("itens", None)
    data.pop("contas_pagar", None)
    for key, value in data.items():
        setattr(db_item, key, value)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))
    return _load_compra(db, idcompras)


# ── Excluir ───────────────────────────────────────────────────────────────────
@router.delete("/{idcompras}")
def delete_compra(idcompras: int, db: Session = Depends(get_db)):
    db_item = db.query(models.Compra).filter(models.Compra.idcompras == idcompras).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Compra não encontrada")

    contas_pagas = [c for c in db_item.contas_pagar if c.situacao is True]
    if contas_pagas:
        raise HTTPException(
            status_code=400,
            detail="Esta compra possui parcelas já pagas e não pode ser excluída."
        )

    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))
    return {"ok": True, "message": "Compra excluída com sucesso"}


# ── Itens: adicionar item à compra ────────────────────────────────────────────
@router.post("/{idcompras}/itens", response_model=schemas.Compra)
def add_item(idcompras: int, payload: schemas.CompraItemCreate, db: Session = Depends(get_db)):
    db.query(models.Compra).filter(models.Compra.idcompras == idcompras).first() or (
        (_ for _ in ()).throw(HTTPException(status_code=404, detail="Compra não encontrada"))
    )
    # Validate compra exists
    compra = db.query(models.Compra).filter(models.Compra.idcompras == idcompras).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra não encontrada")
    data = payload.model_dump()
    data["idcompras"] = idcompras
    db.add(models.CompraItem(**data))
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))
    return _load_compra(db, idcompras)


# ── Itens: remover item da compra ─────────────────────────────────────────────
@router.delete("/{idcompras}/itens/{idproduto}/{idequipamento}", response_model=schemas.Compra)
def remove_item(idcompras: int, idproduto: int, idequipamento: int, db: Session = Depends(get_db)):
    db_item = (
        db.query(models.CompraItem)
        .filter(
            models.CompraItem.idcompras == idcompras,
            models.CompraItem.idproduto == idproduto,
            models.CompraItem.idequipamento == idequipamento,
        )
        .first()
    )
    if not db_item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    db.delete(db_item)
    db.commit()
    return _load_compra(db, idcompras)
