from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

import models, schemas
from database import get_db

router = APIRouter(prefix="/formapagamento", tags=["forma_pagamento"])

@router.get("", response_model=List[schemas.FormaPagamento])
def get_forma_pagamento(db: Session = Depends(get_db)):
    return db.query(models.FormaPagamento).order_by(models.FormaPagamento.nome.asc()).all()

@router.post("", response_model=schemas.FormaPagamento)
def create_formapagamento(formapagamento: schemas.FormaPagamentoCreate, db: Session = Depends(get_db)):
    db_item = models.FormaPagamento(**formapagamento.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{idformapgto}", response_model=schemas.FormaPagamento)
def update_formapagamento(idformapgto: int, formapagamento: schemas.FormaPagamentoCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.FormaPagamento).filter(models.FormaPagamento.idformapgto == idformapgto).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Forma de pagamento não encontrada")
    for key, value in formapagamento.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{idformapgto}")
def delete_formapagamento(idformapgto: int, db: Session = Depends(get_db)):
    db_item = db.query(models.FormaPagamento).filter(models.FormaPagamento.idformapgto == idformapgto).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Forma de pagamento não encontrada")
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Esta forma de pagamento não pode ser excluída pois está em uso.")
    return {"ok": True, "message": "Forma de pagamento excluída com sucesso"}
