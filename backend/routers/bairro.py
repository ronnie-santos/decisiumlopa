from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional

import models, schemas
from database import get_db

router = APIRouter(
    prefix="/bairros",
    tags=["bairros"]
)


def _load(db: Session, idbairro: int) -> models.Bairro:
    item = db.query(models.Bairro).filter(models.Bairro.idbairro == idbairro).first()
    if not item:
        raise HTTPException(status_code=404, detail="Bairro não encontrado")
    return item


@router.get("", response_model=List[schemas.Bairro])
def list_bairros(
    idcidade: Optional[int] = Query(None),
    nome: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.Bairro).order_by(models.Bairro.nome.asc())
    if idcidade:
        q = q.filter(models.Bairro.idcidade == idcidade)
    if nome:
        q = q.filter(models.Bairro.nome.ilike(f"%{nome}%"))
    return q.all()


@router.get("/{idbairro}", response_model=schemas.Bairro)
def get_bairro(idbairro: int, db: Session = Depends(get_db)):
    return _load(db, idbairro)


@router.post("", response_model=schemas.Bairro, status_code=201)
def create_bairro(payload: schemas.BairroCreate, db: Session = Depends(get_db)):
    db_item = models.Bairro(**payload.model_dump())
    db.add(db_item)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))
    return _load(db, db_item.idbairro)


@router.put("/{idbairro}", response_model=schemas.Bairro)
def update_bairro(idbairro: int, payload: schemas.BairroCreate, db: Session = Depends(get_db)):
    db_item = _load(db, idbairro)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))
    return _load(db, idbairro)


@router.delete("/{idbairro}")
def delete_bairro(idbairro: int, db: Session = Depends(get_db)):
    db_item = _load(db, idbairro)
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Bairro vinculado a outros registros.")
    return {"ok": True, "message": "Bairro excluído com sucesso"}
