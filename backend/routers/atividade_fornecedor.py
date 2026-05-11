from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

import models, schemas
from database import get_db

router = APIRouter(prefix="/atividade-fornecedor", tags=["fornecedor_atividade"])

@router.get("", response_model=List[schemas.FornecedorAtividade])
def get_fornecedor_atividade(db: Session = Depends(get_db)):
    return db.query(models.FornecedorAtividade).order_by(models.FornecedorAtividade.descricao.asc()).all()

@router.post("", response_model=schemas.FornecedorAtividade)
def create_atividade_fornecedor(atividade: schemas.FornecedorAtividadeCreate, db: Session = Depends(get_db)):
    db_item = models.FornecedorAtividade(**atividade.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{idatividade}", response_model=schemas.FornecedorAtividade)
def update_atividade_fornecedor(idatividade: int, atividade: schemas.FornecedorAtividadeCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.FornecedorAtividade).filter(models.FornecedorAtividade.idatividade == idatividade).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    for key, value in atividade.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{idatividade}")
def delete_atividade_fornecedor(idatividade: int, db: Session = Depends(get_db)):
    db_item = db.query(models.FornecedorAtividade).filter(models.FornecedorAtividade.idatividade == idatividade).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Esta atividade não pode ser excluída pois está em uso.")
    return {"ok": True, "message": "Atividade excluída com sucesso"}
