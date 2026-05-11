from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_
from typing import List, Optional
import io

import models, schemas
from database import get_db
from reports.cliente_report import ClienteReport

router = APIRouter(
    prefix="/clientes",
    tags=["clientes"]
)

@router.get("/relatorio/pdf")
def relatorio_clientes_pdf(
    nome: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = (
        db.query(models.Cliente)
        .options(
            selectinload(models.Cliente.enderecos),
            selectinload(models.Cliente.contatos),
        )
        .order_by(models.Cliente.nome.asc())
    )
    if status:
        q = q.filter(models.Cliente.status == status)
    if tipo:
        q = q.filter(models.Cliente.tipo == tipo)
    if nome:
        like = f"%{nome}%"
        q = q.filter(or_(
            models.Cliente.nome.ilike(like),
            models.Cliente.nomefantasia.ilike(like),
        ))
    clientes = q.all()

    formas   = {r.idformacontato: r.nome for r in db.query(models.FormaContato).all()}
    cidades  = {r.idcidade: r.nome       for r in db.query(models.Cidade).all()}

    def _contatos_str(c) -> str:
        partes = [
            f"{formas.get(ct.idformacontato, 'Contato')}: {ct.valor}"
            for ct in (c.contatos or [])
            if ct.valor
        ]
        return '\n'.join(partes) if partes else '—'

    def _enderecos_str(c) -> str:
        partes = []
        for e in (c.enderecos or []):
            logradouro_fmt = ' '.join(filter(None, [e.tipo_logradouro, e.logradouro, e.numero]))
            cidade_nome    = cidades.get(e.idcidade, '')
            loc_fmt        = ' '.join(filter(None, [cidade_nome, e.idestado, e.cep]))
            linha          = '\n'.join(filter(None, [logradouro_fmt, loc_fmt]))
            if linha:
                partes.append(linha)
        return '\n\n'.join(partes) if partes else '—'

    rows = [
        [
            str(i + 1),
            c.nomefantasia or c.nome or '—',
            c.cnpj_cpf or '—',
            c.ie_rg or '—',
            _enderecos_str(c),
            _contatos_str(c),
            c.status or '—',
        ]
        for i, c in enumerate(clientes)
    ]

    buf = io.BytesIO()
    ClienteReport().generate(rows, buf)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type='application/pdf',
        headers={'Content-Disposition': 'inline; filename="relatorio_clientes.pdf"'},
    )


@router.get("", response_model=None)
def get_clientes(
    nome: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    q = (
        db.query(models.Cliente)
        .options(
            selectinload(models.Cliente.enderecos),
            selectinload(models.Cliente.contatos),
        )
        .order_by(models.Cliente.nome.asc())
    )
    if nome:
        like = f"%{nome}%"
        q = q.filter(or_(
            models.Cliente.nome.ilike(like),
            models.Cliente.nomefantasia.ilike(like),
        ))
    if tipo:
        q = q.filter(models.Cliente.tipo == tipo)
    if status:
        q = q.filter(models.Cliente.status == status)
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return {
        "data": [schemas.Cliente.model_validate(c) for c in items],
        "total": total,
        "skip": skip,
        "limit": limit,
    }

@router.get("/options", response_model=None)
def get_clientes_options(
    nome: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Endpoint leve para selects de FK — retorna apenas id, nome, nomefantasia."""
    q = db.query(
        models.Cliente.idcliente,
        models.Cliente.nome,
        models.Cliente.nomefantasia,
        models.Cliente.cnpj_cpf,
    ).order_by(models.Cliente.nome.asc())
    if nome:
        like = f"%{nome}%"
        q = q.filter(or_(
            models.Cliente.nome.ilike(like),
            models.Cliente.nomefantasia.ilike(like),
        ))
    rows = q.limit(500).all()
    return [
        {"idcliente": r.idcliente, "nome": r.nome, "nomefantasia": r.nomefantasia, "cnpj_cpf": r.cnpj_cpf}
        for r in rows
    ]

@router.get("/{idcliente}", response_model=schemas.Cliente)
def get_cliente(idcliente: int, db: Session = Depends(get_db)):
    cliente = (
        db.query(models.Cliente)
        .options(
            selectinload(models.Cliente.enderecos),
            selectinload(models.Cliente.contatos),
        )
        .filter(models.Cliente.idcliente == idcliente)
        .first()
    )
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return cliente

@router.post("", response_model=schemas.Cliente)
def create_cliente(cliente: schemas.ClienteCreate, db: Session = Depends(get_db)):
    cliente_data = cliente.model_dump(exclude={"enderecos", "contatos"})
    db_item = models.Cliente(**cliente_data)
    
    # Processar endereços
    if cliente.enderecos:
        for addr in cliente.enderecos:
            db_addr = models.ClienteEndereco(**addr.model_dump(exclude={"idcliend", "idcliente"}))
            db_item.enderecos.append(db_addr)
            
    # Processar contatos
    if cliente.contatos:
        for cont in cliente.contatos:
            db_cont = models.ClienteContato(**cont.model_dump(exclude={"idclienteforma", "idcliente"}))
            db_item.contatos.append(db_cont)
            
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{idcliente}", response_model=schemas.Cliente)
def update_cliente(idcliente: int, cliente: schemas.ClienteCreate, db: Session = Depends(get_db)):
    db_item = (
        db.query(models.Cliente)
        .options(
            selectinload(models.Cliente.enderecos),
            selectinload(models.Cliente.contatos),
        )
        .filter(models.Cliente.idcliente == idcliente)
        .first()
    )
    if not db_item:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    
    # Atualizar campos básicos
    cliente_data = cliente.model_dump(exclude={"enderecos", "contatos"}, exclude_unset=True)
    for key, value in cliente_data.items():
        setattr(db_item, key, value)
        
    # Sincronizar Endereços
    if cliente.enderecos is not None:
        # Mapear endereços atuais por ID
        current_addrs = {a.idcliend: a for a in db_item.enderecos}
        new_addrs = []
        keep_ids = set()
        
        for addr in cliente.enderecos:
            addr_data = addr.model_dump(exclude={"idcliente"})
            
            # Tratamento defensivo para FK 0
            if addr_data.get("idcidade") == 0: addr_data["idcidade"] = None
            if addr_data.get("idbairro") == 0: addr_data["idbairro"] = None
            
            aid = addr_data.get("idcliend")
            
            if aid and aid in current_addrs:
                # Atualizar existente
                for k, v in addr_data.items():
                    setattr(current_addrs[aid], k, v)
                keep_ids.add(aid)
            else:
                # Novo endereço
                # Remover idcliend se for string temporária do frontend ou None
                if isinstance(aid, str) or aid is None:
                    addr_data.pop("idcliend", None)
                new_addrs.append(models.ClienteEndereco(**addr_data))
        
        # Remover os que não estão no payload
        for aid in list(current_addrs.keys()):
            if aid not in keep_ids:
                db_item.enderecos.remove(current_addrs[aid])
        
        # Adicionar novos
        db_item.enderecos.extend(new_addrs)

    # Sincronizar Contatos
    if cliente.contatos is not None:
        current_conts = {c.idclienteforma: c for c in db_item.contatos}
        new_conts = []
        keep_cont_ids = set()
        
        for cont in cliente.contatos:
            cont_data = cont.model_dump(exclude={"idcliente"})
            cid = cont_data.get("idclienteforma")
            
            if cid and cid in current_conts:
                for k, v in cont_data.items():
                    setattr(current_conts[cid], k, v)
                keep_cont_ids.add(cid)
            else:
                if isinstance(cid, str) or cid is None:
                    cont_data.pop("idclienteforma", None)
                new_conts.append(models.ClienteContato(**cont_data))
                
        for cid in list(current_conts.keys()):
            if cid not in keep_cont_ids:
                db_item.contatos.remove(current_conts[cid])
        
        db_item.contatos.extend(new_conts)

    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{idcliente}")
def delete_cliente(idcliente: int, db: Session = Depends(get_db)):
    db_item = db.query(models.Cliente).filter(models.Cliente.idcliente == idcliente).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
        
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="Este cliente não pode ser excluído pois está sendo utilizado em outro local do sistema (ex: vinculado a Orçamentos ou Ordens de Serviço)."
        )
    return {"ok": True, "message": "Cliente excluído com sucesso"}
