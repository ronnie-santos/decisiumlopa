from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional

import models, schemas
from database import get_db

router = APIRouter(
    prefix="/paises",
    tags=["paises"]
)


def _load(db: Session, idpais: str) -> models.Pais:
    item = db.query(models.Pais).filter(models.Pais.idpais == idpais).first()
    if not item:
        raise HTTPException(status_code=404, detail="País não encontrado")
    return item


@router.get("", response_model=List[schemas.Pais])
def list_paises(
    nome: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.Pais).order_by(models.Pais.nome.asc())
    if nome:
        q = q.filter(models.Pais.nome.ilike(f"%{nome}%"))
    return q.all()


@router.get("/{idpais}", response_model=schemas.Pais)
def get_pais(idpais: str, db: Session = Depends(get_db)):
    return _load(db, idpais)


@router.post("", response_model=schemas.Pais, status_code=201)
def create_pais(payload: schemas.PaisCreate, db: Session = Depends(get_db)):
    db_item = models.Pais(**payload.model_dump())
    db.add(db_item)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))
    db.refresh(db_item)
    return db_item


@router.put("/{idpais}", response_model=schemas.Pais)
def update_pais(idpais: str, payload: schemas.PaisCreate, db: Session = Depends(get_db)):
    db_item = _load(db, idpais)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))
    db.refresh(db_item)
    return db_item


@router.delete("/{idpais}")
def delete_pais(idpais: str, db: Session = Depends(get_db)):
    db_item = _load(db, idpais)
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="País vinculado a outros registros.")
    return {"ok": True, "message": "País excluído com sucesso"}
