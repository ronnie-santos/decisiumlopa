from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional

import models, schemas
from database import get_db

router = APIRouter(
    prefix="/cidades",
    tags=["cidades"]
)


def _load(db: Session, idcidade: int) -> models.Cidade:
    item = db.query(models.Cidade).filter(models.Cidade.idcidade == idcidade).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cidade não encontrada")
    return item


@router.get("", response_model=List[schemas.Cidade])
def list_cidades(
    idestado: Optional[str] = Query(None),
    idpais: Optional[str] = Query(None),
    nome: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.Cidade).order_by(models.Cidade.nome.asc())
    if idestado:
        q = q.filter(models.Cidade.idestado == idestado)
    if idpais:
        q = q.filter(models.Cidade.idpais == idpais)
    if nome:
        q = q.filter(models.Cidade.nome.ilike(f"%{nome}%"))
    return q.all()


@router.get("/{idcidade}", response_model=schemas.Cidade)
def get_cidade(idcidade: int, db: Session = Depends(get_db)):
    return _load(db, idcidade)


@router.post("", response_model=schemas.Cidade, status_code=201)
def create_cidade(payload: schemas.CidadeCreate, db: Session = Depends(get_db)):
    db_item = models.Cidade(**payload.model_dump())
    db.add(db_item)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))
    return _load(db, db_item.idcidade)


@router.put("/{idcidade}", response_model=schemas.Cidade)
def update_cidade(idcidade: int, payload: schemas.CidadeCreate, db: Session = Depends(get_db)):
    db_item = _load(db, idcidade)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))
    return _load(db, idcidade)


@router.delete("/{idcidade}")
def delete_cidade(idcidade: int, db: Session = Depends(get_db)):
    db_item = _load(db, idcidade)
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Cidade vinculada a outros registros.")
    return {"ok": True, "message": "Cidade excluída com sucesso"}
