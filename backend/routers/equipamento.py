from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_
from typing import List, Optional

import models, schemas
from database import get_db

router = APIRouter(
    prefix="/equipamentos",
    tags=["equipamentos"]
)

@router.get("", response_model=List[schemas.Equipamento])
def get_equipamentos(
    search: Optional[str] = Query(None),
    limit: int = Query(500),
    db: Session = Depends(get_db),
):
    q = db.query(models.Equipamento)
    if search:
        term = f"%{search}%"
        q = q.filter(
            or_(
                models.Equipamento.nome.ilike(term),
                models.Equipamento.placa.ilike(term),
            )
        )
    equipamentos = q.order_by(models.Equipamento.nome.asc()).limit(limit).all()
    return [schemas.Equipamento.model_validate(e) for e in equipamentos]

@router.post("", response_model=schemas.Equipamento)
def create_equipamento(equipamento: schemas.EquipamentoCreate, db: Session = Depends(get_db)):
    db_item = models.Equipamento(**equipamento.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{idequipamento}", response_model=schemas.Equipamento)
def update_equipamento(idequipamento: int, equipamento: schemas.EquipamentoCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.Equipamento).filter(models.Equipamento.idequipamento == idequipamento).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado")
    
    for key, value in equipamento.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{idequipamento}")
def delete_equipamento(idequipamento: int, db: Session = Depends(get_db)):
    db_item = db.query(models.Equipamento).filter(models.Equipamento.idequipamento == idequipamento).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado")
    
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="Este equipamento não pode ser excluído pois está sendo utilizado em outro local do sistema (ex: vinculado a Ordens de Serviço)."
        )
    return {"ok": True, "message": "Equipamento excluído com sucesso"}
