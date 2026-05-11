from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

import models, schemas
from database import get_db

router = APIRouter(prefix="/admin/modulos", tags=["admin-modulos"])


@router.get("", response_model=List[schemas.Modulo])
def get_modulos(db: Session = Depends(get_db)):
    return (
        db.query(models.Modulo)
        .filter(models.Modulo.ativo == True)
        .order_by(models.Modulo.nome.asc())
        .all()
    )
