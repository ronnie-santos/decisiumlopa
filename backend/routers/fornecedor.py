from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_
from typing import List, Optional

import models, schemas
from database import get_db

router = APIRouter(
    prefix="/fornecedores",
    tags=["fornecedores"]
)

@router.get("", response_model=None)
def get_fornecedores(
    nome: Optional[str] = Query(None),
    idramo: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    q = db.query(models.Fornecedor).order_by(models.Fornecedor.nome.asc())
    if nome:
        like = f"%{nome}%"
        q = q.filter(or_(
            models.Fornecedor.nome.ilike(like),
            models.Fornecedor.nomefantasia.ilike(like),
        ))
    if idramo:
        subq = (
            db.query(models.ForRamo.idfornecedor)
            .filter(models.ForRamo.idramo == idramo)
            .subquery()
        )
        q = q.filter(models.Fornecedor.idfornecedor.in_(subq))
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return {
        "data": [schemas.Fornecedor.model_validate(f) for f in items],
        "total": total,
        "skip": skip,
        "limit": limit,
    }

@router.get("/options", response_model=None)
def get_fornecedores_options(
    nome: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Endpoint leve para selects de FK — retorna apenas id, nome, nomefantasia."""
    q = db.query(
        models.Fornecedor.idfornecedor,
        models.Fornecedor.nome,
        models.Fornecedor.nomefantasia,
    ).order_by(models.Fornecedor.nome.asc())
    if nome:
        like = f"%{nome}%"
        q = q.filter(or_(
            models.Fornecedor.nome.ilike(like),
            models.Fornecedor.nomefantasia.ilike(like),
        ))
    rows = q.limit(200).all()
    return [
        {"idfornecedor": r.idfornecedor, "nome": r.nome, "nomefantasia": r.nomefantasia}
        for r in rows
    ]

@router.post("", response_model=schemas.Fornecedor)
def create_fornecedor(fornecedor: schemas.FornecedorCreate, db: Session = Depends(get_db)):
    data = fornecedor.model_dump()
    # Tratamento defensivo: FK 0 → None
    for fk_field in ("idcidade", "idbairro"):
        if data.get(fk_field) == 0:
            data[fk_field] = None
    db_item = models.Fornecedor(**data)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{idfornecedor}", response_model=schemas.Fornecedor)
def update_fornecedor(idfornecedor: int, fornecedor: schemas.FornecedorCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.Fornecedor).filter(models.Fornecedor.idfornecedor == idfornecedor).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
    
    data = fornecedor.model_dump(exclude_unset=True)
    # Tratamento defensivo: FK 0 → None
    for fk_field in ("idcidade", "idbairro"):
        if data.get(fk_field) == 0:
            data[fk_field] = None
    
    for key, value in data.items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    return db_item

@router.get("/{idfornecedor}/compras-count")
def get_compras_count(idfornecedor: int, db: Session = Depends(get_db)):
    count = db.query(models.Compra).filter(models.Compra.idfornecedor == idfornecedor).count()
    return {"count": count}

@router.delete("/{idfornecedor}")
def delete_fornecedor(idfornecedor: int, db: Session = Depends(get_db)):
    count = db.query(models.Compra).filter(models.Compra.idfornecedor == idfornecedor).count()
    if count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Fornecedor não pode ser excluído pois possui {count} compra(s) vinculada(s)."
        )
    db_item = db.query(models.Fornecedor).filter(models.Fornecedor.idfornecedor == idfornecedor).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
        
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="Este fornecedor não pode ser excluído pois está sendo utilizado em outro local do sistema (ex: vinculado a compras ou equipamentos)."
        )
    return {"ok": True, "message": "Fornecedor excluído com sucesso"}

# =============================================
# RAMOS DO FORNECEDOR
# =============================================
@router.get("/{idfornecedor}/ramos", response_model=List[schemas.ForRamo])
def get_fornecedor_ramos(idfornecedor: int, db: Session = Depends(get_db)):
    return db.query(models.ForRamo).options(joinedload(models.ForRamo.ramo)).filter(models.ForRamo.idfornecedor == idfornecedor).all()

@router.post("/{idfornecedor}/ramos", response_model=schemas.ForRamo)
def add_fornecedor_ramo(idfornecedor: int, ramo: schemas.ForRamoCreate, db: Session = Depends(get_db)):
    db_item = models.ForRamo(**ramo.model_dump())
    db_item.idfornecedor = idfornecedor
    db.add(db_item)
    db.commit()
    # Fetch with joined relationship to return to frontend
    return db.query(models.ForRamo).options(joinedload(models.ForRamo.ramo)).filter(models.ForRamo.idforramo == db_item.idforramo).first()

@router.delete("/ramos/{idforramo}")
def delete_fornecedor_ramo(idforramo: int, db: Session = Depends(get_db)):
    db_item = db.query(models.ForRamo).filter(models.ForRamo.idforramo == idforramo).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Relacionamento não encontrado")
    db.delete(db_item)
    db.commit()
    return {"ok": True}

# =============================================
# ATIVIDADES DO FORNECEDOR
# =============================================
@router.get("/{idfornecedor}/atividades", response_model=List[schemas.ForAtividade])
def get_fornecedor_atividades(idfornecedor: int, db: Session = Depends(get_db)):
    return db.query(models.ForAtividade).options(joinedload(models.ForAtividade.atividade)).filter(models.ForAtividade.idfornecedor == idfornecedor).all()

@router.post("/{idfornecedor}/atividades", response_model=schemas.ForAtividade)
def add_fornecedor_atividade(idfornecedor: int, atividade: schemas.ForAtividadeCreate, db: Session = Depends(get_db)):
    db_item = models.ForAtividade(**atividade.model_dump())
    db_item.idfornecedor = idfornecedor
    db.add(db_item)
    db.commit()
    # Fetch with joined relationship to return to frontend
    return db.query(models.ForAtividade).options(joinedload(models.ForAtividade.atividade)).filter(models.ForAtividade.idforatividade == db_item.idforatividade).first()

@router.delete("/atividades/{idforatividade}")
def delete_fornecedor_atividade(idforatividade: int, db: Session = Depends(get_db)):
    db_item = db.query(models.ForAtividade).filter(models.ForAtividade.idforatividade == idforatividade).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Relacionamento não encontrado")
    db.delete(db_item)
    db.commit()
    return {"ok": True}
