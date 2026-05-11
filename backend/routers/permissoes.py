from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import models, schemas
from database import get_db

router = APIRouter(prefix="/admin/permissoes", tags=["admin-permissoes"])


@router.get("/{idperfil}", response_model=List[schemas.Permissao])
def get_permissoes(idperfil: int, db: Session = Depends(get_db)):
    perfil = db.query(models.Perfil).filter(models.Perfil.idperfil == idperfil).first()
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    return (
        db.query(models.Permissao)
        .filter(models.Permissao.idperfil == idperfil)
        .all()
    )


@router.put("/{idperfil}")
def save_permissoes(idperfil: int, items: List[schemas.PermissaoCreate], db: Session = Depends(get_db)):
    """
    Recebe array completo de permissões para o perfil.
    Faz upsert: cria se não existir, atualiza se existir.
    Remove permissões de módulos que não vieram no array.
    """
    perfil = db.query(models.Perfil).filter(models.Perfil.idperfil == idperfil).first()
    if not perfil:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")

    idmodulos_novos = {item.idmodulo for item in items}

    # Remove permissões que não estão mais no array
    db.query(models.Permissao).filter(
        models.Permissao.idperfil == idperfil,
        ~models.Permissao.idmodulo.in_(idmodulos_novos)
    ).delete(synchronize_session=False)

    for item in items:
        perm = db.query(models.Permissao).filter(
            models.Permissao.idperfil == idperfil,
            models.Permissao.idmodulo == item.idmodulo,
        ).first()
        if perm:
            perm.pode_ler      = item.pode_ler
            perm.pode_criar    = item.pode_criar
            perm.pode_editar   = item.pode_editar
            perm.pode_excluir  = item.pode_excluir
            perm.pode_exportar = item.pode_exportar
        else:
            db.add(models.Permissao(
                idperfil=idperfil,
                idmodulo=item.idmodulo,
                pode_ler=item.pode_ler,
                pode_criar=item.pode_criar,
                pode_editar=item.pode_editar,
                pode_excluir=item.pode_excluir,
                pode_exportar=item.pode_exportar,
            ))

    db.commit()
    return {"ok": True, "message": "Permissões salvas com sucesso"}
