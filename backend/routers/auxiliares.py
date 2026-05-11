from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

import models, schemas
from database import get_db

router = APIRouter(
    tags=["auxiliares"]
)

@router.get("/tipos-equipamento", response_model=List[schemas.TipoEquipamentoBase])
def get_tipos_equipamento(db: Session = Depends(get_db)):
    return db.query(models.TipoEquipamento).order_by(models.TipoEquipamento.nome.asc()).all()
