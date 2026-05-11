from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session, undefer
from sqlalchemy.exc import IntegrityError
from typing import List

import models, schemas
from database import get_db

router = APIRouter(
    prefix="/empresas",
    tags=["empresas"]
)

_ALLOWED_MIME = {"image/png", "image/jpeg", "image/gif", "image/webp"}
_MAX_SIZE     = 2 * 1024 * 1024  # 2 MB


def _detect_media_type(data: bytes) -> str:
    """Detecta o tipo de imagem pelos magic bytes."""
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return "image/png"
    if data[:3] == b'\xff\xd8\xff':
        return "image/jpeg"
    if data[:6] in (b'GIF87a', b'GIF89a'):
        return "image/gif"
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return "image/webp"
    return "image/png"  # fallback


def _empresa_to_dict(e: models.Empresa) -> dict:
    d = schemas.EmpresaCreate.model_validate(e).model_dump()
    d['idempresa'] = e.idempresa
    d['id']        = e.idempresa
    d['has_logo']  = e.logo is not None
    return d


# ── CRUD ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=None)
def get_empresas(db: Session = Depends(get_db)):
    empresas = (
        db.query(models.Empresa)
        .options(undefer(models.Empresa.logo))
        .order_by(models.Empresa.nome.asc())
        .all()
    )
    return [_empresa_to_dict(e) for e in empresas]


@router.post("", response_model=None)
def create_empresa(empresa: schemas.EmpresaCreate, db: Session = Depends(get_db)):
    data = empresa.model_dump()
    for fk_field in ("idcidade", "idbairro"):
        if data.get(fk_field) == 0:
            data[fk_field] = None
    db_item = models.Empresa(**data)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return _empresa_to_dict(db_item)


@router.put("/{idempresa}", response_model=None)
def update_empresa(idempresa: int, empresa: schemas.EmpresaCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.Empresa).filter(models.Empresa.idempresa == idempresa).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")

    data = empresa.model_dump(exclude_unset=True)
    for fk_field in ("idcidade", "idbairro"):
        if data.get(fk_field) == 0:
            data[fk_field] = None

    for key, value in data.items():
        setattr(db_item, key, value)

    db.commit()
    db.refresh(db_item)
    return _empresa_to_dict(db_item)


@router.delete("/{idempresa}")
def delete_empresa(idempresa: int, db: Session = Depends(get_db)):
    db_item = db.query(models.Empresa).filter(models.Empresa.idempresa == idempresa).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")

    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Esta empresa não pode ser excluída pois está sendo utilizada em outro local do sistema (ex: vinculado a funcionários ou equipamentos)."
        )
    return {"ok": True, "message": "Empresa excluída com sucesso"}


# ── Logo ──────────────────────────────────────────────────────────────────────

@router.get("/{idempresa}/logo")
def get_empresa_logo(idempresa: int, db: Session = Depends(get_db)):
    """Serve a logo da empresa como imagem binária."""
    empresa = (
        db.query(models.Empresa)
        .options(undefer(models.Empresa.logo))
        .filter(models.Empresa.idempresa == idempresa)
        .first()
    )
    if not empresa or not empresa.logo:
        raise HTTPException(status_code=404, detail="Logo não encontrada")
    media_type = _detect_media_type(empresa.logo)
    return Response(
        content=empresa.logo,
        media_type=media_type,
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )


@router.post("/{idempresa}/logo")
async def upload_empresa_logo(
    idempresa: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Faz upload da logo (multipart/form-data). Máx 2 MB. PNG/JPEG/WebP/GIF."""
    empresa = db.query(models.Empresa).filter(models.Empresa.idempresa == idempresa).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")

    if file.content_type not in _ALLOWED_MIME:
        raise HTTPException(
            status_code=400,
            detail=f"Formato inválido ({file.content_type}). Use PNG, JPEG, WebP ou GIF."
        )

    content = await file.read()
    if len(content) > _MAX_SIZE:
        raise HTTPException(status_code=400, detail="Arquivo muito grande. Tamanho máximo: 2 MB.")

    empresa.logo = content
    db.commit()
    return {"ok": True, "message": "Logo atualizada com sucesso"}


@router.delete("/{idempresa}/logo")
def delete_empresa_logo(idempresa: int, db: Session = Depends(get_db)):
    """Remove a logo da empresa do banco de dados."""
    empresa = db.query(models.Empresa).filter(models.Empresa.idempresa == idempresa).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    empresa.logo = None
    db.commit()
    return {"ok": True, "message": "Logo removida com sucesso"}
