from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

import models, schemas
from database import get_db

router = APIRouter(
    prefix="/servico",
    tags=["servicos"]
)

@router.get("", response_model=List[schemas.Servico])
def get_servicos(db: Session = Depends(get_db)):
    servicos = db.query(models.Servico).order_by(models.Servico.nome.asc()).all()
    return servicos

@router.post("", response_model=schemas.Servico)
def create_servico(servico: schemas.ServicoCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.Servico).filter(models.Servico.nome == servico.nome).first()
    if db_item:
        raise HTTPException(status_code=400, detail="Serviço com este nome já existe")
        
    db_item = models.Servico(**servico.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{nome}", response_model=schemas.Servico)
def update_servico(nome: str, servico: schemas.ServicoCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.Servico).filter(models.Servico.nome == nome).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Serviço não encontrado")
    
    for key, value in servico.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{nome}")
def delete_servico(nome: str, db: Session = Depends(get_db)):
    db_item = db.query(models.Servico).filter(models.Servico.nome == nome).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Serviço não encontrado")
        
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="Este Serviço não pode ser excluído pois está sendo utilizado em outro local do sistema."
        )
    return {"ok": True, "message": "Serviço excluído com sucesso"}
