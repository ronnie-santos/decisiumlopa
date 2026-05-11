from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

import models, schemas
from database import get_db

router = APIRouter(
    prefix="/formacontato",
    tags=["forma_contato"]
)

@router.get("", response_model=List[schemas.FormaContato])
def get_forma_contato(db: Session = Depends(get_db)):
    # Retorna todos os forma_contato ordenados alfabeticamente pelo nome
    forma_contato = db.query(models.FormaContato).order_by(models.FormaContato.nome.asc()).all()
    return forma_contato

@router.post("", response_model=schemas.FormaContato)
def create_formacontato(formacontato: schemas.FormaContatoCreate, db: Session = Depends(get_db)):
    db_item = models.FormaContato(**formacontato.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{idformacontato}", response_model=schemas.FormaContato)
def update_formacontato(idformacontato: int, formacontato: schemas.FormaContatoCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.FormaContato).filter(models.FormaContato.idformacontato == idformacontato).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="FormaContato não encontrado")
    
    for key, value in formacontato.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{idformacontato}")
def delete_formacontato(idformacontato: int, db: Session = Depends(get_db)):
    db_item = db.query(models.FormaContato).filter(models.FormaContato.idformacontato == idformacontato).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="FormaContato não encontrado")
        
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="Este formacontato não pode ser excluído pois está sendo utilizado em outro local do sistema (ex: vinculado a funcionários)."
        )
    return {"ok": True, "message": "FormaContato excluído com sucesso"}
