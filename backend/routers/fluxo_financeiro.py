from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional

import models, schemas
from database import get_db

router = APIRouter(prefix="/fluxo-financeiro", tags=["fluxo_financeiro"])

@router.get("", response_model=List[schemas.FluxoFinanceiro])
def get_fluxo_financeiro(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.FluxoFinanceiro)
    if status:
        s = status.upper()
        if s == 'ATIVO':
            q = q.filter(
                (models.FluxoFinanceiro.status == 'ATIVO') |
                (models.FluxoFinanceiro.status == None)
            )
        else:
            q = q.filter(models.FluxoFinanceiro.status == s)
    return q.order_by(models.FluxoFinanceiro.descricao.asc()).all()

@router.post("", response_model=schemas.FluxoFinanceiro)
def create_fluxo_financeiro(fluxo: schemas.FluxoFinanceiroCreate, db: Session = Depends(get_db)):
    # Verifica duplicata de codigo
    existing = db.query(models.FluxoFinanceiro).filter(
        models.FluxoFinanceiro.idfluxo == fluxo.idfluxo
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Já existe um serviço com o código '{fluxo.idfluxo}'.")
    db_item = models.FluxoFinanceiro(**fluxo.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{idfluxo}", response_model=schemas.FluxoFinanceiro)
def update_fluxo_financeiro(idfluxo: str, fluxo: schemas.FluxoFinanceiroCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.FluxoFinanceiro).filter(models.FluxoFinanceiro.idfluxo == idfluxo).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Fluxo financeiro não encontrado")
    update_data = fluxo.model_dump()
    update_data.pop("idfluxo", None)
    for key, value in update_data.items():
        setattr(db_item, key, value)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{idfluxo}")
def delete_fluxo_financeiro(idfluxo: str, db: Session = Depends(get_db)):
    db_item = db.query(models.FluxoFinanceiro).filter(models.FluxoFinanceiro.idfluxo == idfluxo).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Fluxo financeiro não encontrado")
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Este serviço não pode ser excluído pois está vinculado a outros registros.")
    return {"ok": True, "message": "Serviço excluído com sucesso"}
