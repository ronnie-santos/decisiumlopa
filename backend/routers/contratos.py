from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional

import models, schemas
from database import get_db

router = APIRouter(
    prefix="/contratos",
    tags=["contratos"]
)

@router.get("", response_model=List[schemas.Contrato])
def get_contratos(
    ativo: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db)
):
    q = db.query(models.Contrato)
    if ativo is not None:
        q = q.filter(models.Contrato.ativo == ativo)
    return q.order_by(models.Contrato.descricao.asc()).all()

@router.get("/{idcontrato}", response_model=schemas.Contrato)
def get_contrato(idcontrato: int, db: Session = Depends(get_db)):
    item = db.query(models.Contrato).filter(models.Contrato.idcontrato == idcontrato).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cláusula não encontrada")
    return item

@router.post("", response_model=schemas.Contrato)
def create_contrato(contrato: schemas.ContratoCreate, db: Session = Depends(get_db)):
    db_item = models.Contrato(**contrato.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{idcontrato}", response_model=schemas.Contrato)
def update_contrato(idcontrato: int, contrato: schemas.ContratoCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.Contrato).filter(models.Contrato.idcontrato == idcontrato).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Cláusula não encontrada")
    for key, value in contrato.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{idcontrato}")
def delete_contrato(idcontrato: int, db: Session = Depends(get_db)):
    db_item = db.query(models.Contrato).filter(models.Contrato.idcontrato == idcontrato).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Cláusula não encontrada")
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Esta cláusula não pode ser excluída pois está vinculada a outros registros."
        )
    return {"ok": True, "message": "Cláusula excluída com sucesso"}
