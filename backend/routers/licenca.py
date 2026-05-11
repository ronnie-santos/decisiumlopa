from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

import models, schemas
from database import get_db

router = APIRouter(
    prefix="/licenca",
    tags=["licencas"]
)

@router.get("", response_model=List[schemas.Licenca])
def get_licencas(db: Session = Depends(get_db)):
    # Retorna todos os licencas ordenados pelo id
    licencas = db.query(models.Licenca).order_by(models.Licenca.idlicenca.desc()).all()
    return licencas

@router.post("", response_model=schemas.Licenca)
def create_licenca(licenca: schemas.LicencaCreate, db: Session = Depends(get_db)):
    db_item = models.Licenca(**licenca.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{idlicenca}", response_model=schemas.Licenca)
def update_licenca(idlicenca: int, licenca: schemas.LicencaCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.Licenca).filter(models.Licenca.idlicenca == idlicenca).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Licenca não encontrado")
    
    for key, value in licenca.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{idlicenca}")
def delete_licenca(idlicenca: int, db: Session = Depends(get_db)):
    db_item = db.query(models.Licenca).filter(models.Licenca.idlicenca == idlicenca).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Licenca não encontrado")
        
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="Este licenca não pode ser excluído pois está sendo utilizado em outro local do sistema (ex: vinculado a funcionários)."
        )
    return {"ok": True, "message": "Licenca excluído com sucesso"}
