from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

import models, schemas
from database import get_db

router = APIRouter(prefix="/tipo-equipamento", tags=["tipo_equipamento"])

@router.get("", response_model=List[schemas.TipoEquipamento])
def get_tipo_equipamento(db: Session = Depends(get_db)):
    return db.query(models.TipoEquipamento).order_by(models.TipoEquipamento.nome.asc()).all()

@router.post("", response_model=schemas.TipoEquipamento)
def create_tipo_equipamento(tipo_equipamento: schemas.TipoEquipamentoCreate, db: Session = Depends(get_db)):
    db_item = models.TipoEquipamento(**tipo_equipamento.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{idtipoequipamento}", response_model=schemas.TipoEquipamento)
def update_tipo_equipamento(idtipoequipamento: int, tipo_equipamento: schemas.TipoEquipamentoCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.TipoEquipamento).filter(models.TipoEquipamento.idtipoequipamento == idtipoequipamento).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Tipo de equipamento não encontrado")
    for key, value in tipo_equipamento.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{idtipoequipamento}")
def delete_tipo_equipamento(idtipoequipamento: int, db: Session = Depends(get_db)):
    db_item = db.query(models.TipoEquipamento).filter(models.TipoEquipamento.idtipoequipamento == idtipoequipamento).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Tipo de equipamento não encontrado")
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Este tipo de equipamento não pode ser excluído pois está vinculado a equipamentos.")
    return {"ok": True, "message": "Tipo de equipamento excluído com sucesso"}
