from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional

import models, schemas
from database import get_db

router = APIRouter(
    prefix="/logradouros",
    tags=["logradouros"]
)


def _load(db: Session, idlogradouro: int) -> models.Logradouro:
    item = db.query(models.Logradouro).filter(
        models.Logradouro.idlogradouro == idlogradouro
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Logradouro não encontrado")
    return item


@router.get("", response_model=List[schemas.Logradouro])
def list_logradouros(
    idbairro: Optional[int] = Query(None),
    cep: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.Logradouro).order_by(models.Logradouro.logradouro.asc())
    if idbairro:
        q = q.filter(models.Logradouro.idbairro == idbairro)
    if cep:
        q = q.filter(models.Logradouro.cep == cep)
    return q.all()


@router.get("/{idlogradouro}", response_model=schemas.Logradouro)
def get_logradouro(idlogradouro: int, db: Session = Depends(get_db)):
    return _load(db, idlogradouro)


@router.post("", response_model=schemas.Logradouro, status_code=201)
def create_logradouro(payload: schemas.LogradouroCreate, db: Session = Depends(get_db)):
    db_item = models.Logradouro(**payload.model_dump())
    db.add(db_item)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))
    return _load(db, db_item.idlogradouro)


@router.put("/{idlogradouro}", response_model=schemas.Logradouro)
def update_logradouro(idlogradouro: int, payload: schemas.LogradouroCreate, db: Session = Depends(get_db)):
    db_item = _load(db, idlogradouro)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))
    return _load(db, idlogradouro)


@router.delete("/{idlogradouro}")
def delete_logradouro(idlogradouro: int, db: Session = Depends(get_db)):
    db_item = _load(db, idlogradouro)
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Logradouro vinculado a outros registros.")
    return {"ok": True, "message": "Logradouro excluído com sucesso"}
