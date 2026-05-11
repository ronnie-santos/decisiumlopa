from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

import models, schemas
from database import get_db

router = APIRouter(prefix="/textopadrao", tags=["texto_padrao"])

@router.get("", response_model=List[schemas.TextoPadrao])
def get_texto_padrao(db: Session = Depends(get_db)):
    return db.query(models.TextoPadrao).order_by(models.TextoPadrao.texto.asc()).all()

@router.post("", response_model=schemas.TextoPadrao)
def create_textopadrao(textopadrao: schemas.TextoPadraoCreate, db: Session = Depends(get_db)):
    db_item = models.TextoPadrao(**textopadrao.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{idtexto}", response_model=schemas.TextoPadrao)
def update_textopadrao(idtexto: int, textopadrao: schemas.TextoPadraoCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.TextoPadrao).filter(models.TextoPadrao.idtexto == idtexto).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Texto padrão não encontrado")
    for key, value in textopadrao.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{idtexto}")
def delete_textopadrao(idtexto: int, db: Session = Depends(get_db)):
    db_item = db.query(models.TextoPadrao).filter(models.TextoPadrao.idtexto == idtexto).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Texto padrão não encontrado")
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Este texto padrão não pode ser excluído pois está em uso.")
    return {"ok": True, "message": "Texto padrão excluído com sucesso"}
