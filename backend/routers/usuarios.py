from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
import bcrypt as _bcrypt

import models, schemas
from database import get_db

router = APIRouter(prefix="/admin/usuarios", tags=["admin-usuarios"])


def _hash(senha: str) -> str:
    return _bcrypt.hashpw(senha.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")


def _to_schema(u: models.Usuario) -> schemas.Usuario:
    return schemas.Usuario(
        idusuario=u.idusuario,
        id=u.idusuario,
        nome=u.nome,
        username=u.username,
        idperfil=u.idperfil,
        ativo=u.ativo,
        ultimo_acesso=u.ultimo_acesso,
        perfil_nome=(u.perfil_rel.nome if u.perfil_rel else None),
    )


@router.get("", response_model=List[schemas.Usuario])
def get_usuarios(db: Session = Depends(get_db)):
    rows = db.query(models.Usuario).order_by(models.Usuario.nome.asc()).all()
    return [_to_schema(u) for u in rows]


@router.get("/{idusuario}", response_model=schemas.Usuario)
def get_usuario(idusuario: int, db: Session = Depends(get_db)):
    u = db.query(models.Usuario).filter(models.Usuario.idusuario == idusuario).first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return _to_schema(u)


@router.post("", response_model=schemas.Usuario)
def create_usuario(item: schemas.UsuarioCreate, db: Session = Depends(get_db)):
    existe = db.query(models.Usuario).filter(models.Usuario.username == item.username).first()
    if existe:
        raise HTTPException(status_code=400, detail="Username já está em uso.")
    u = models.Usuario(
        nome=item.nome,
        username=item.username,
        senha_hash=_hash(item.senha),
        idperfil=item.idperfil,
        ativo=item.ativo if item.ativo is not None else True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return _to_schema(u)


@router.put("/{idusuario}", response_model=schemas.Usuario)
def update_usuario(idusuario: int, item: schemas.UsuarioUpdate, db: Session = Depends(get_db)):
    u = db.query(models.Usuario).filter(models.Usuario.idusuario == idusuario).first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if item.username != u.username:
        existe = db.query(models.Usuario).filter(models.Usuario.username == item.username).first()
        if existe:
            raise HTTPException(status_code=400, detail="Username já está em uso.")
    u.nome     = item.nome
    u.username = item.username
    u.idperfil = item.idperfil
    u.ativo    = item.ativo if item.ativo is not None else u.ativo
    if item.senha:
        u.senha_hash = _hash(item.senha)
    db.commit()
    db.refresh(u)
    return _to_schema(u)


@router.patch("/{idusuario}/toggle-ativo", response_model=schemas.Usuario)
def toggle_ativo(idusuario: int, db: Session = Depends(get_db)):
    u = db.query(models.Usuario).filter(models.Usuario.idusuario == idusuario).first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    u.ativo = not u.ativo
    db.commit()
    db.refresh(u)
    return _to_schema(u)


@router.delete("/{idusuario}")
def delete_usuario(idusuario: int, db: Session = Depends(get_db)):
    u = db.query(models.Usuario).filter(models.Usuario.idusuario == idusuario).first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    try:
        db.delete(u)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Usuário vinculado a outros registros.")
    return {"ok": True, "message": "Usuário excluído com sucesso"}
