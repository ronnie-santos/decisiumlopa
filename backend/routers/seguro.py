from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

import models, schemas
from database import get_db

router = APIRouter(
    prefix="/seguro",
    tags=["seguros"]
)

@router.get("", response_model=List[schemas.Seguro])
def get_seguros(db: Session = Depends(get_db)):
    # Retorna todos os seguros ordenados alfabeticamente pelo titular
    seguros = db.query(models.Seguro).order_by(models.Seguro.titular.asc()).all()
    return seguros

@router.post("", response_model=schemas.Seguro)
def create_seguro(seguro: schemas.SeguroCreate, db: Session = Depends(get_db)):
    db_item = models.Seguro(**seguro.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{idseguro}", response_model=schemas.Seguro)
def update_seguro(idseguro: int, seguro: schemas.SeguroCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.Seguro).filter(models.Seguro.idseguro == idseguro).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Seguro não encontrado")
    
    for key, value in seguro.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{idseguro}")
def delete_seguro(idseguro: int, db: Session = Depends(get_db)):
    db_item = db.query(models.Seguro).filter(models.Seguro.idseguro == idseguro).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Seguro não encontrado")
        
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="Este seguro não pode ser excluído pois está sendo utilizado em outro local do sistema (ex: vinculado a funcionários)."
        )
    return {"ok": True, "message": "Seguro excluído com sucesso"}
