from io import BytesIO
import traceback

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import exists, or_
from typing import List, Optional

import models, schemas
from database import get_db
from reports.orcamento_report import OrcamentoReport

router = APIRouter(
    prefix="/orcamentos",
    tags=["orcamentos"]
)


def _load_orcamento(db: Session, idorcamento: int) -> models.Orcamento:
    item = (
        db.query(models.Orcamento)
        .options(
            joinedload(models.Orcamento.itens).joinedload(models.OrcamentoItem.equipamento_rel),
            joinedload(models.Orcamento.empresa_rel),
            joinedload(models.Orcamento.funcionario_rel),
            joinedload(models.Orcamento.cliente_rel),
        )
        .filter(models.Orcamento.idorcamento == idorcamento)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return item


# ── Listar todos ────────────────────────────────────────────────────────────
@router.get("", response_model=None)
def list_orcamentos(
    situacao: Optional[str] = Query(None),
    busca: Optional[str] = Query(None),
    sem_os: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    q_base = db.query(models.Orcamento)
    if situacao:
        q_base = q_base.filter(models.Orcamento.situacao == situacao)
    if sem_os:
        q_base = q_base.filter(
            ~exists().where(models.Ordem.idorcamento == models.Orcamento.idorcamento)
        )
    if busca:
        like = f"%{busca}%"
        cliente_ids = (
            db.query(models.Cliente.idcliente)
            .filter(or_(
                models.Cliente.nome.ilike(like),
                models.Cliente.nomefantasia.ilike(like),
            ))
            .subquery()
        )
        try:
            orc_id = int(busca)
        except ValueError:
            orc_id = None
        conditions = [
            models.Orcamento.nome.ilike(like),
            models.Orcamento.idcliente.in_(cliente_ids),
        ]
        if orc_id is not None:
            conditions.append(models.Orcamento.idorcamento == orc_id)
        q_base = q_base.filter(or_(*conditions))

    total = q_base.count()

    items = (
        q_base.options(
            joinedload(models.Orcamento.itens).joinedload(models.OrcamentoItem.equipamento_rel),
            joinedload(models.Orcamento.empresa_rel),
            joinedload(models.Orcamento.funcionario_rel),
            joinedload(models.Orcamento.cliente_rel),
        )
        .order_by(models.Orcamento.data.desc(), models.Orcamento.idorcamento.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "data": [schemas.Orcamento.model_validate(o) for o in items],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


# ── Buscar por ID ────────────────────────────────────────────────────────────
@router.get("/{idorcamento}", response_model=schemas.Orcamento)
def get_orcamento(idorcamento: int, db: Session = Depends(get_db)):
    return _load_orcamento(db, idorcamento)


# ── Criar orçamento (com itens opcionais) ────────────────────────────────────
@router.post("", response_model=schemas.Orcamento, status_code=201)
def create_orcamento(payload: schemas.OrcamentoCreate, db: Session = Depends(get_db)):
    try:
        itens_data = payload.itens or []
        orc_data = payload.model_dump(exclude={"itens"})

        db_orc = models.Orcamento(**orc_data)
        db.add(db_orc)
        try:
            db.flush()
        except IntegrityError as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e.orig))

        for item in itens_data:
            db_item = models.OrcamentoItem(idorcamento=db_orc.idorcamento, **item.model_dump())
            db.add(db_item)

        try:
            db.commit()
        except IntegrityError as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e.orig))

        return _load_orcamento(db, db_orc.idorcamento)
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro interno: {type(e).__name__}: {e}")


# ── Atualizar orçamento (substitui todos os itens) ───────────────────────────
@router.put("/{idorcamento}", response_model=schemas.Orcamento)
def update_orcamento(idorcamento: int, payload: schemas.OrcamentoCreate, db: Session = Depends(get_db)):
    try:
        db_orc = db.query(models.Orcamento).filter(models.Orcamento.idorcamento == idorcamento).first()
        if not db_orc:
            raise HTTPException(status_code=404, detail="Orçamento não encontrado")

        itens_data = payload.itens or []
        orc_data = payload.model_dump(exclude={"itens"}, exclude_unset=True)

        for key, value in orc_data.items():
            setattr(db_orc, key, value)

        existing = db.query(models.OrcamentoItem).filter(
            models.OrcamentoItem.idorcamento == idorcamento
        ).all()
        for old_item in existing:
            db.delete(old_item)

        db.flush()

        for item in itens_data:
            db_item = models.OrcamentoItem(idorcamento=idorcamento, **item.model_dump())
            db.add(db_item)

        try:
            db.commit()
        except IntegrityError as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e.orig))

        return _load_orcamento(db, idorcamento)
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro interno: {type(e).__name__}: {e}")


# ── Atualizar situação do orçamento ──────────────────────────────────────────
@router.patch("/{idorcamento}/situacao")
def patch_situacao(idorcamento: int, body: dict, db: Session = Depends(get_db)):
    db_orc = db.query(models.Orcamento).filter(models.Orcamento.idorcamento == idorcamento).first()
    if not db_orc:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    if "situacao" in body:
        db_orc.situacao = body["situacao"]
    db.commit()
    return {"ok": True}


# ── Imprimir orçamento (PDF) ─────────────────────────────────────────────────
@router.get("/{idorcamento}/print")
def print_orcamento(idorcamento: int, db: Session = Depends(get_db)):
    orc = _load_orcamento(db, idorcamento)
    buf = BytesIO()
    OrcamentoReport().generate(orc, buf)
    buf.seek(0)
    filename = f"orcamento_{idorcamento:04d}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


# ── Excluir orçamento ────────────────────────────────────────────────────────
@router.delete("/{idorcamento}")
def delete_orcamento(idorcamento: int, db: Session = Depends(get_db)):
    db_orc = db.query(models.Orcamento).filter(models.Orcamento.idorcamento == idorcamento).first()
    if not db_orc:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    db.delete(db_orc)
    db.commit()
    return {"ok": True, "message": "Orçamento excluído com sucesso"}


# ── Adicionar item ao orçamento ──────────────────────────────────────────────
@router.post("/{idorcamento}/itens", response_model=schemas.OrcamentoItem, status_code=201)
def add_item(idorcamento: int, item: schemas.OrcamentoItemCreate, db: Session = Depends(get_db)):
    # Verifica se orçamento existe
    if not db.query(models.Orcamento).filter(models.Orcamento.idorcamento == idorcamento).first():
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")

    existing = db.query(models.OrcamentoItem).filter(
        models.OrcamentoItem.idorcamento == idorcamento,
        models.OrcamentoItem.idequipamento == item.idequipamento,
        models.OrcamentoItem.idservico == item.idservico,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Item com este equipamento e serviço já existe no orçamento")

    db_item = models.OrcamentoItem(idorcamento=idorcamento, **item.model_dump())
    db.add(db_item)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))

    return (
        db.query(models.OrcamentoItem)
        .options(
            joinedload(models.OrcamentoItem.equipamento_rel),
        )
        .filter(
            models.OrcamentoItem.idorcamento == idorcamento,
            models.OrcamentoItem.idequipamento == item.idequipamento,
            models.OrcamentoItem.idservico == item.idservico,
        )
        .first()
    )


# ── Remover item do orçamento ────────────────────────────────────────────────
@router.delete("/{idorcamento}/itens/{idequipamento}/{idservico}")
def remove_item(idorcamento: int, idequipamento: int, idservico: int, db: Session = Depends(get_db)):
    db_item = db.query(models.OrcamentoItem).filter(
        models.OrcamentoItem.idorcamento == idorcamento,
        models.OrcamentoItem.idequipamento == idequipamento,
        models.OrcamentoItem.idservico == idservico,
    ).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    db.delete(db_item)
    db.commit()
    return {"ok": True, "message": "Item removido com sucesso"}
