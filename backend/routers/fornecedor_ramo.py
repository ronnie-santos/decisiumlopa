from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

import models, schemas
from database import get_db

router = APIRouter(prefix="/fornecedor-ramo", tags=["fornecedor_ramo"])

@router.get("", response_model=List[schemas.FornecedorRamo])
def get_fornecedor_ramo(db: Session = Depends(get_db)):
    return db.query(models.FornecedorRamo).order_by(models.FornecedorRamo.descricao.asc()).all()

@router.post("", response_model=schemas.FornecedorRamo)
def create_fornecedor_ramo(ramo: schemas.FornecedorRamoCreate, db: Session = Depends(get_db)):
    db_item = models.FornecedorRamo(**ramo.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{idramo}", response_model=schemas.FornecedorRamo)
def update_fornecedor_ramo(idramo: int, ramo: schemas.FornecedorRamoCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.FornecedorRamo).filter(models.FornecedorRamo.idramo == idramo).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Ramo não encontrado")
    for key, value in ramo.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{idramo}")
def delete_fornecedor_ramo(idramo: int, db: Session = Depends(get_db)):
    db_item = db.query(models.FornecedorRamo).filter(models.FornecedorRamo.idramo == idramo).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Ramo não encontrado")
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Este ramo não pode ser excluído pois está em uso.")
    return {"ok": True, "message": "Ramo excluído com sucesso"}
