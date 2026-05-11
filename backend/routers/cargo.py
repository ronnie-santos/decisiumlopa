from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

import models, schemas
from database import get_db

router = APIRouter(
    prefix="/cargos",
    tags=["cargos"]
)

@router.get("", response_model=List[schemas.Cargo])
def get_cargos(db: Session = Depends(get_db)):
    # Retorna todos os cargos ordenados alfabeticamente pelo nome
    cargos = db.query(models.Cargo).order_by(models.Cargo.nome.asc()).all()
    return cargos

@router.post("", response_model=schemas.Cargo)
def create_cargo(cargo: schemas.CargoCreate, db: Session = Depends(get_db)):
    db_item = models.Cargo(**cargo.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{idcargo}", response_model=schemas.Cargo)
def update_cargo(idcargo: int, cargo: schemas.CargoCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.Cargo).filter(models.Cargo.idcargo == idcargo).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Cargo não encontrado")
    
    for key, value in cargo.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{idcargo}")
def delete_cargo(idcargo: int, db: Session = Depends(get_db)):
    db_item = db.query(models.Cargo).filter(models.Cargo.idcargo == idcargo).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Cargo não encontrado")
        
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="Este cargo não pode ser excluído pois está sendo utilizado em outro local do sistema (ex: vinculado a funcionários)."
        )
    return {"ok": True, "message": "Cargo excluído com sucesso"}
