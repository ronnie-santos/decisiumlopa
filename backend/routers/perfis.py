from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

import models, schemas
from database import get_db

router = APIRouter(prefix="/admin/perfis", tags=["admin-perfis"])


@router.get("", response_model=List[schemas.Perfil])
def get_perfis(db: Session = Depends(get_db)):
    return db.query(models.Perfil).order_by(models.Perfil.nome.asc()).all()


@router.get("/{idperfil}", response_model=schemas.Perfil)
def get_perfil(idperfil: int, db: Session = Depends(get_db)):
    p = db.query(models.Perfil).filter(models.Perfil.idperfil == idperfil).first()
    if not p:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    return p


@router.post("", response_model=schemas.Perfil)
def create_perfil(item: schemas.PerfilCreate, db: Session = Depends(get_db)):
    p = models.Perfil(**item.model_dump())
    db.add(p)
    try:
        db.commit()
        db.refresh(p)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Já existe um perfil com esse nome.")
    return p


@router.put("/{idperfil}", response_model=schemas.Perfil)
def update_perfil(idperfil: int, item: schemas.PerfilCreate, db: Session = Depends(get_db)):
    p = db.query(models.Perfil).filter(models.Perfil.idperfil == idperfil).first()
    if not p:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    for key, value in item.model_dump(exclude_unset=True).items():
        setattr(p, key, value)
    try:
        db.commit()
        db.refresh(p)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Já existe um perfil com esse nome.")
    return p


@router.delete("/{idperfil}")
def delete_perfil(idperfil: int, db: Session = Depends(get_db)):
    p = db.query(models.Perfil).filter(models.Perfil.idperfil == idperfil).first()
    if not p:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    try:
        db.delete(p)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Perfil está vinculado a usuários. Remova os usuários antes.")
    return {"ok": True, "message": "Perfil excluído com sucesso"}
