from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional

import models, schemas
from database import get_db

router = APIRouter(
    prefix="/funcionarios",
    tags=["funcionarios"]
)

@router.get("", response_model=List[schemas.Funcionario])
def get_funcionarios(
    situacao: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.Funcionario)
    if situacao:
        q = q.filter(models.Funcionario.status == situacao.upper())
    funcionarios = q.order_by(models.Funcionario.nome.asc()).all()
    return [schemas.Funcionario.model_validate(f) for f in funcionarios]

@router.post("", response_model=schemas.Funcionario)
def create_funcionario(funcionario: schemas.FuncionarioCreate, db: Session = Depends(get_db)):
    data = funcionario.model_dump()
    # Tratamento defensivo: FK 0 → None
    for fk_field in ("idcargo", "idcidade", "idbairro"):
        if data.get(fk_field) == 0:
            data[fk_field] = None
    db_item = models.Funcionario(**data)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{idfuncionario}", response_model=schemas.Funcionario)
def update_funcionario(idfuncionario: int, funcionario: schemas.FuncionarioCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.Funcionario).filter(models.Funcionario.idfuncionario == idfuncionario).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado")
    
    data = funcionario.model_dump(exclude_unset=True)
    # Tratamento defensivo: FK 0 → None
    for fk_field in ("idcargo", "idcidade", "idbairro"):
        if data.get(fk_field) == 0:
            data[fk_field] = None
    
    for key, value in data.items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{idfuncionario}")
def delete_funcionario(idfuncionario: int, db: Session = Depends(get_db)):
    db_item = db.query(models.Funcionario).filter(models.Funcionario.idfuncionario == idfuncionario).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado")
        
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="Este funcionário não pode ser excluído pois está sendo utilizado em outro local do sistema (ex: vinculado a Ordens de Serviço)."
        )
    return {"ok": True, "message": "Funcionário excluído com sucesso"}


# ── Descontos dos Funcionários ──────────────────────────────────────────────

@router.get("/{idfuncionario}/descontos", response_model=List[schemas.Desconto])
def get_descontos(idfuncionario: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Desconto)
        .filter(models.Desconto.idfuncionario == idfuncionario)
        .order_by(models.Desconto.data.desc())
        .all()
    )

@router.post("/{idfuncionario}/descontos", response_model=schemas.Desconto)
def create_desconto(idfuncionario: int, item: schemas.DescontoCreate, db: Session = Depends(get_db)):
    db_item = models.Desconto(**{**item.model_dump(), "idfuncionario": idfuncionario})
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{idfuncionario}/descontos/{iddesconto}", response_model=schemas.Desconto)
def update_desconto(idfuncionario: int, iddesconto: int, item: schemas.DescontoCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.Desconto).filter(
        models.Desconto.iddesconto == iddesconto,
        models.Desconto.idfuncionario == idfuncionario
    ).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Desconto não encontrado")
    for key, value in item.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{idfuncionario}/descontos/{iddesconto}")
def delete_desconto(idfuncionario: int, iddesconto: int, db: Session = Depends(get_db)):
    db_item = db.query(models.Desconto).filter(
        models.Desconto.iddesconto == iddesconto,
        models.Desconto.idfuncionario == idfuncionario
    ).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Desconto não encontrado")
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Desconto vinculado a outros registros.")
    return {"ok": True, "message": "Desconto excluído com sucesso"}
