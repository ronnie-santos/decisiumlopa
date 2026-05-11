from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional

import models, schemas
from database import get_db

router = APIRouter(
    prefix="/estados",
    tags=["estados"]
)


def _load(db: Session, idestado: str) -> models.Estado:
    item = db.query(models.Estado).filter(models.Estado.idestado == idestado).first()
    if not item:
        raise HTTPException(status_code=404, detail="Estado não encontrado")
    return item


@router.get("", response_model=List[schemas.Estado])
def list_estados(
    idpais: Optional[str] = Query(None),
    nome: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.Estado).order_by(models.Estado.nome.asc())
    if idpais:
        q = q.filter(models.Estado.idpais == idpais)
    if nome:
        q = q.filter(models.Estado.nome.ilike(f"%{nome}%"))
    return q.all()


@router.get("/{idestado}", response_model=schemas.Estado)
def get_estado(idestado: str, db: Session = Depends(get_db)):
    return _load(db, idestado)


@router.post("", response_model=schemas.Estado, status_code=201)
def create_estado(payload: schemas.EstadoCreate, db: Session = Depends(get_db)):
    db_item = models.Estado(**payload.model_dump())
    db.add(db_item)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))
    db.refresh(db_item)
    return db_item


@router.put("/{idestado}", response_model=schemas.Estado)
def update_estado(idestado: str, payload: schemas.EstadoCreate, db: Session = Depends(get_db)):
    db_item = _load(db, idestado)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))
    db.refresh(db_item)
    return db_item


@router.delete("/{idestado}")
def delete_estado(idestado: str, db: Session = Depends(get_db)):
    db_item = _load(db, idestado)
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Estado vinculado a outros registros.")
    return {"ok": True, "message": "Estado excluído com sucesso"}
