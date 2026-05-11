from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import date as date_type

import models, schemas
from database import get_db

router = APIRouter(prefix="/fechamento", tags=["fechamento"])


def _load_fechamento(db: Session, idfechamento: int) -> models.Fechamento:
    item = (
        db.query(models.Fechamento)
        .options(
            joinedload(models.Fechamento.empresa_rel),
            joinedload(models.Fechamento.cliente_rel),
            joinedload(models.Fechamento.contas),
        )
        .filter(models.Fechamento.idfechamento == idfechamento)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Fechamento não encontrado")
    return item


# ── Listar ───────────────────────────────────────────────────────────────────
@router.get("", response_model=None)
def list_fechamentos(
    idcliente: Optional[int] = Query(None),
    idempresa: Optional[int] = Query(None),
    situacao: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    def _apply_filters(q):
        if idcliente is not None:
            q = q.filter(models.Fechamento.idcliente == idcliente)
        if idempresa is not None:
            q = q.filter(models.Fechamento.idempresa == idempresa)
        if situacao is not None:
            q = q.filter(models.Fechamento.situacao == situacao)
        return q

    total = _apply_filters(db.query(models.Fechamento)).count()

    items = (
        _apply_filters(
            db.query(models.Fechamento).options(
                joinedload(models.Fechamento.empresa_rel),
                joinedload(models.Fechamento.cliente_rel),
                joinedload(models.Fechamento.contas),
            )
        )
        .order_by(models.Fechamento.data.desc(), models.Fechamento.idfechamento.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "data": [schemas.Fechamento.model_validate(o) for o in items],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


# ── Buscar por ID ─────────────────────────────────────────────────────────────
@router.get("/{idfechamento}", response_model=schemas.Fechamento)
def get_fechamento(idfechamento: int, db: Session = Depends(get_db)):
    return _load_fechamento(db, idfechamento)


# ── Criar ─────────────────────────────────────────────────────────────────────
@router.post("", response_model=schemas.Fechamento, status_code=201)
def create_fechamento(payload: schemas.FechamentoCreate, db: Session = Depends(get_db)):
    data = payload.model_dump(exclude_unset=True)
    contas_data = data.pop("contas", []) or []
    db_item = models.Fechamento(**data)
    db.add(db_item)
    try:
        db.flush()
        for conta in contas_data:
            conta["idfechamento"] = db_item.idfechamento
            db.add(models.ContasReceber(**conta))
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))
    return _load_fechamento(db, db_item.idfechamento)


# ── Atualizar ─────────────────────────────────────────────────────────────────
@router.put("/{idfechamento}", response_model=schemas.Fechamento)
def update_fechamento(idfechamento: int, payload: schemas.FechamentoCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.Fechamento).filter(models.Fechamento.idfechamento == idfechamento).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Fechamento não encontrado")
    data = payload.model_dump(exclude_unset=True)
    data.pop("contas", None)
    for key, value in data.items():
        setattr(db_item, key, value)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))
    return _load_fechamento(db, idfechamento)


# ── Excluir ───────────────────────────────────────────────────────────────────
@router.delete("/{idfechamento}")
def delete_fechamento(idfechamento: int, db: Session = Depends(get_db)):
    db_item = db.query(models.Fechamento).filter(models.Fechamento.idfechamento == idfechamento).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Fechamento não encontrado")
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Fechamento não pode ser excluído pois possui vínculos no sistema.")
    return {"ok": True, "message": "Fechamento excluído com sucesso"}


# ── Desfazer Fechamento ───────────────────────────────────────────────────────
@router.post("/desfazer/{idfechamento}")
def desfazer_fechamento(idfechamento: int, db: Session = Depends(get_db)):
    """Desfaz um fechamento: reverte as OS para abertas e exclui parcelas e o fechamento."""
    db_item = db.query(models.Fechamento).filter(models.Fechamento.idfechamento == idfechamento).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Fechamento não encontrado")

    parcelas_pagas = [c for c in db_item.contas if c.situacao is True]
    if parcelas_pagas:
        raise HTTPException(
            status_code=400,
            detail="Este fechamento possui parcelas já pagas e não pode ser excluído."
        )

    ordens = db.query(models.Ordem).filter(models.Ordem.idfechamento == idfechamento).all()
    for ordem in ordens:
        ordem.situacao = False
        ordem.idfechamento = None

    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))

    return {"ok": True, "message": "Fechamento desfeito com sucesso"}


# ── Fechar OS (operação atômica) ──────────────────────────────────────────────
@router.post("/fechar-os", response_model=schemas.Fechamento, status_code=201)
def fechar_os(payload: schemas.FecharOSPayload, db: Session = Depends(get_db)):
    """Fecha um conjunto de Ordens de Serviço, criando o Fechamento e as parcelas de Contas a Receber."""
    ordens = db.query(models.Ordem).filter(models.Ordem.idordem.in_(payload.ids_ordens)).all()
    if len(ordens) != len(payload.ids_ordens):
        raise HTTPException(status_code=400, detail="Uma ou mais ordens não foram encontradas.")

    fechadas = [o for o in ordens if o.situacao is True]
    if fechadas:
        ids_str = ", ".join(str(o.idordem) for o in fechadas)
        raise HTTPException(status_code=400, detail=f"As seguintes ordens já estão fechadas: {ids_str}")

    valor_total = sum(float(o.valor_os or 0) for o in ordens)

    db_fechamento = models.Fechamento(
        data=date_type.today(),
        valor=valor_total,
        total_itens=len(ordens),
        parcelas=len(payload.parcelas),
        gerar_nf=payload.gerar_nf,
        idempresa=payload.idempresa,
        idcliente=payload.idcliente,
        situacao=False,
    )
    db.add(db_fechamento)
    try:
        db.flush()

        for i, parcela in enumerate(payload.parcelas, 1):
            db.add(models.ContasReceber(
                idfechamento=db_fechamento.idfechamento,
                vencimento=parcela.vencimento,
                valor=parcela.valor,
                situacao=False,
                parcela=parcela.parcela or f"{i}/{len(payload.parcelas)}",
            ))

        for ordem in ordens:
            ordem.situacao = True
            ordem.idfechamento = db_fechamento.idfechamento

        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))

    return _load_fechamento(db, db_fechamento.idfechamento)
