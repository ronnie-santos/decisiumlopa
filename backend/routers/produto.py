from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional

import models, schemas
from database import get_db

router = APIRouter(prefix="/produtos", tags=["produtos"])


def _load_produto(db: Session, idproduto: int) -> models.ProdutoServico:
    item = db.query(models.ProdutoServico).filter(
        models.ProdutoServico.idproduto == idproduto
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return item


# ── Listar ───────────────────────────────────────────────────────────────────
@router.get("", response_model=List[schemas.ProdutoServico])
def list_produtos(
    descricao: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.ProdutoServico)
    if descricao:
        q = q.filter(models.ProdutoServico.descricao.ilike(f"%{descricao}%"))
    return q.order_by(models.ProdutoServico.descricao).all()


# ── Buscar por ID ─────────────────────────────────────────────────────────────
@router.get("/{idproduto}", response_model=schemas.ProdutoServico)
def get_produto(idproduto: int, db: Session = Depends(get_db)):
    return _load_produto(db, idproduto)


# ── Criar ─────────────────────────────────────────────────────────────────────
@router.post("", response_model=schemas.ProdutoServico, status_code=201)
def create_produto(payload: schemas.ProdutoServicoCreate, db: Session = Depends(get_db)):
    db_item = models.ProdutoServico(**payload.model_dump(exclude_unset=True))
    db.add(db_item)
    try:
        db.commit()
        db.refresh(db_item)
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))
    return db_item


# ── Atualizar ─────────────────────────────────────────────────────────────────
@router.put("/{idproduto}", response_model=schemas.ProdutoServico)
def update_produto(idproduto: int, payload: schemas.ProdutoServicoCreate, db: Session = Depends(get_db)):
    db_item = _load_produto(db, idproduto)
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
@router.delete("/{idproduto}")
def delete_produto(idproduto: int, db: Session = Depends(get_db)):
    db_item = _load_produto(db, idproduto)
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Produto não pode ser excluído pois possui vínculos no sistema.")
    return {"ok": True, "message": "Produto excluído com sucesso"}
