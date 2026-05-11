from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

import models, schemas
from database import get_db

router = APIRouter(
    prefix="/tipo_servico",
    tags=["tipos_servicos"]
)

@router.get("", response_model=List[schemas.TipoServico])
def get_tipos_servicos(db: Session = Depends(get_db)):
    tipos = db.query(models.TipoServico).order_by(models.TipoServico.descricao.asc()).all()
    return tipos

@router.post("", response_model=schemas.TipoServico)
def create_tipo_servico(tipo: schemas.TipoServicoCreate, db: Session = Depends(get_db)):
    db_item = models.TipoServico(**tipo.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{idservico}", response_model=schemas.TipoServico)
def update_tipo_servico(idservico: int, tipo: schemas.TipoServicoCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.TipoServico).filter(models.TipoServico.idservico == idservico).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Tipo de Serviço não encontrado")
    
    for key, value in tipo.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{idservico}")
def delete_tipo_servico(idservico: int, db: Session = Depends(get_db)):
    db_item = db.query(models.TipoServico).filter(models.TipoServico.idservico == idservico).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Tipo de Serviço não encontrado")
        
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="Este Tipo de Serviço não pode ser excluído pois está sendo utilizado em outro local do sistema."
        )
    return {"ok": True, "message": "Tipo de Serviço excluído com sucesso"}
