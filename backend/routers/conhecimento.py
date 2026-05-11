from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import not_
from typing import List, Optional
import xml.etree.ElementTree as ET
from datetime import datetime, date

import models, schemas
from database import get_db

router = APIRouter(
    prefix="/conhecimentos",
    tags=["conhecimentos"]
)

_NS_CTE = {'cte': 'http://www.portalfiscal.inf.br/cte'}


# ── CT-e XML helpers ──────────────────────────────────────────────────────────

def _cte_find(elem, *tags):
    """Namespace-aware nested element find for CT-e."""
    current = elem
    for tag in tags:
        if current is None:
            return None
        result = current.find(f'cte:{tag}', _NS_CTE)
        if result is None:
            result = current.find(tag)
        current = result
    return current


def _cte_text(elem, *tags, default=''):
    if elem is None:
        return default
    if not tags:
        return elem.text or default
    node = _cte_find(elem, *tags)
    return (node.text or default) if node is not None else default


def _parse_cte_xml(content: bytes) -> dict:
    """Parse CT-e XML bytes and return a structured dict."""
    root = ET.fromstring(content)

    inf_cte = _cte_find(root, 'CTe', 'infCte')
    if inf_cte is None:
        raise ValueError("Elemento <infCte> não encontrado no XML")

    prot_cte = _cte_find(root, 'protCTe', 'infProt')

    # IDE
    ide = _cte_find(inf_cte, 'ide')
    numero_cte = _cte_text(ide, 'nCT')
    natureza_prestacao = _cte_text(ide, 'natOp')
    cfop = _cte_text(ide, 'CFOP')
    dh_emi = _cte_text(ide, 'dhEmi')
    x_mun_ini = _cte_text(ide, 'xMunIni')
    uf_ini = _cte_text(ide, 'UFIni')
    x_mun_fim = _cte_text(ide, 'xMunFim')
    uf_fim = _cte_text(ide, 'UFFim')

    data = None
    if dh_emi:
        try:
            dt = datetime.fromisoformat(dh_emi)
            data = dt.date()
        except ValueError:
            pass

    # COMPL
    compl = _cte_find(inf_cte, 'compl')
    observacao = _cte_text(compl, 'xObs') if compl is not None else ''

    previsao_entrega = None
    if compl is not None:
        entrega = _cte_find(compl, 'Entrega')
        if entrega is not None:
            com_data = _cte_find(entrega, 'comData')
            if com_data is not None:
                d_prog = _cte_text(com_data, 'dProg')
                if d_prog:
                    try:
                        previsao_entrega = datetime.strptime(d_prog, '%Y-%m-%d').date()
                    except ValueError:
                        pass

    # vPREST
    v_prest = _cte_find(inf_cte, 'vPrest')
    v_rec = float(_cte_text(v_prest, 'vRec', default='0') or '0') if v_prest is not None else 0.0

    # infCTeNorm
    inf_cte_norm = _cte_find(inf_cte, 'infCTeNorm')
    inf_carga = _cte_find(inf_cte_norm, 'infCarga') if inf_cte_norm is not None else None

    v_carga = 0.0
    pro_pred = ''
    x_out_cat = ''
    peso = 0.0
    quantidade = 0.0
    chave_nfe = ''

    if inf_carga is not None:
        v_carga = float(_cte_text(inf_carga, 'vCarga', default='0') or '0')
        pro_pred = _cte_text(inf_carga, 'proPred')
        x_out_cat = _cte_text(inf_carga, 'xOutCat')

        # infQ: cUnid=01 → Peso Bruto, cUnid=03 → Volumes
        inf_qs = inf_carga.findall('cte:infQ', _NS_CTE)
        if not inf_qs:
            inf_qs = inf_carga.findall('infQ')
        for inf_q in inf_qs:
            c_unid = _cte_text(inf_q, 'cUnid')
            q_carga = _cte_text(inf_q, 'qCarga')
            if c_unid == '01':
                try:
                    peso = float(q_carga)
                except (ValueError, TypeError):
                    pass
            elif c_unid == '03':
                try:
                    quantidade = float(q_carga)
                except (ValueError, TypeError):
                    pass

    # infDoc - chave NF-e referenciada
    if inf_cte_norm is not None:
        inf_doc = _cte_find(inf_cte_norm, 'infDoc')
        if inf_doc is not None:
            inf_nfe = _cte_find(inf_doc, 'infNFe')
            if inf_nfe is not None:
                chave_nfe = _cte_text(inf_nfe, 'chave')

    # protCTe - chave e protocolo
    id_cte = ''
    protocolo = ''
    if prot_cte is not None:
        id_cte = _cte_text(prot_cte, 'chCTe')
        protocolo = _cte_text(prot_cte, 'nProt')

    # remetente CNPJ (for matching later if needed)
    rem = _cte_find(inf_cte, 'rem')
    rem_cnpj = _cte_text(rem, 'CNPJ') if rem is not None else ''

    return {
        'numero_cte': int(numero_cte) if numero_cte else None,
        'natureza_prestacao': natureza_prestacao or None,
        'cfop': cfop or None,
        'data': str(data) if data else None,
        'local_coleta': f"{x_mun_ini}/{uf_ini}" if x_mun_ini else None,
        'local_entrega': f"{x_mun_fim}/{uf_fim}" if x_mun_fim else None,
        'observacao': observacao or None,
        'total_frete': round(v_rec, 2),
        'frete_valor': round(v_rec, 2),
        'base_calculo': round(v_rec, 2),
        'peso': int(peso) if peso else None,
        'valor_mercadoria': round(v_carga, 2) if v_carga else None,
        'natureza_carga': pro_pred or None,
        'quantidade': int(quantidade) if quantidade else None,
        'especie': x_out_cat or None,
        'chave': chave_nfe or None,
        'idcte': id_cte or None,
        'protocolo_cte': protocolo or None,
        'previsao_entrega': str(previsao_entrega) if previsao_entrega else None,
        'estado': 'SP',
        'local': 'ARAÇATUBA',
        'rem_cnpj': rem_cnpj,
    }


# ── Load helpers ──────────────────────────────────────────────────────────────

def _load(db: Session, idconhecimento: int) -> models.Conhecimento:
    item = (
        db.query(models.Conhecimento)
        .options(
            joinedload(models.Conhecimento.empresa_rel),
            joinedload(models.Conhecimento.funcionario_rel),
            joinedload(models.Conhecimento.equipamento_rel),
            joinedload(models.Conhecimento.fechamento_rel).joinedload(models.Fechamento.cliente_rel),
        )
        .filter(models.Conhecimento.idconhecimento == idconhecimento)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Conhecimento não encontrado")
    return item


def _query_all(db: Session):
    return (
        db.query(models.Conhecimento)
        .options(
            joinedload(models.Conhecimento.empresa_rel),
            joinedload(models.Conhecimento.funcionario_rel),
            joinedload(models.Conhecimento.equipamento_rel),
            joinedload(models.Conhecimento.fechamento_rel).joinedload(models.Fechamento.cliente_rel),
        )
    )


# ── Fechamentos sem conhecimento (static path — before /{idconhecimento}) ─────
@router.get("/fechamentos-sem-conhecimento")
def get_fechamentos_sem_conhecimento(db: Session = Depends(get_db)):
    """Returns fechamentos that don't have an associated conhecimento."""
    used = (
        db.query(models.Conhecimento.idfechamento)
        .filter(models.Conhecimento.idfechamento.isnot(None))
        .subquery()
    )
    rows = (
        db.query(models.Fechamento)
        .options(
            joinedload(models.Fechamento.cliente_rel),
            joinedload(models.Fechamento.empresa_rel),
        )
        .filter(not_(models.Fechamento.idfechamento.in_(used)))
        .order_by(models.Fechamento.data.desc())
        .all()
    )
    return [
        {
            'idfechamento': r.idfechamento,
            'data': r.data.isoformat() if r.data else None,
            'valor': float(r.valor) if r.valor else None,
            'idcliente': r.idcliente,
            'cliente_nome': (
                (r.cliente_rel.nomefantasia or r.cliente_rel.nome)
                if r.cliente_rel else None
            ),
        }
        for r in rows
    ]


# ── Parse CT-e XML ────────────────────────────────────────────────────────────
@router.post("/parse-xml")
async def parse_cte_xml(file: UploadFile = File(...)):
    """Parse CT-e XML file and return structured data for preview."""
    content = await file.read()
    try:
        result = _parse_cte_xml(content)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao processar XML: {e}")
    return result


# ── Listar ───────────────────────────────────────────────────────────────────
@router.get("", response_model=None)
def list_conhecimentos(
    idempresa: Optional[int] = Query(None),
    data_de: Optional[date] = Query(None),
    data_ate: Optional[date] = Query(None),
    numero_cte: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    def _apply_filters(q):
        if idempresa is not None:
            q = q.filter(models.Conhecimento.idempresa == idempresa)
        if data_de is not None:
            q = q.filter(models.Conhecimento.data >= data_de)
        if data_ate is not None:
            q = q.filter(models.Conhecimento.data <= data_ate)
        if numero_cte is not None:
            q = q.filter(models.Conhecimento.numero_cte == numero_cte)
        return q

    total = _apply_filters(db.query(models.Conhecimento)).count()

    items = (
        _apply_filters(_query_all(db))
        .order_by(models.Conhecimento.data.desc(), models.Conhecimento.idconhecimento.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "data": [schemas.Conhecimento.model_validate(o) for o in items],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


# ── Buscar por ID ─────────────────────────────────────────────────────────────
@router.get("/{idconhecimento}", response_model=schemas.Conhecimento)
def get_conhecimento(idconhecimento: int, db: Session = Depends(get_db)):
    return _load(db, idconhecimento)


# ── Criar ─────────────────────────────────────────────────────────────────────
@router.post("", response_model=schemas.Conhecimento, status_code=201)
def create_conhecimento(payload: schemas.ConhecimentoCreate, db: Session = Depends(get_db)):
    db_item = models.Conhecimento(**payload.model_dump())
    db.add(db_item)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))
    return _load(db, db_item.idconhecimento)


# ── Atualizar ─────────────────────────────────────────────────────────────────
@router.put("/{idconhecimento}", response_model=schemas.Conhecimento)
def update_conhecimento(idconhecimento: int, payload: schemas.ConhecimentoCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.Conhecimento).filter(
        models.Conhecimento.idconhecimento == idconhecimento
    ).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Conhecimento não encontrado")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))
    return _load(db, idconhecimento)


# ── Excluir ───────────────────────────────────────────────────────────────────
@router.delete("/{idconhecimento}")
def delete_conhecimento(idconhecimento: int, db: Session = Depends(get_db)):
    db_item = db.query(models.Conhecimento).filter(
        models.Conhecimento.idconhecimento == idconhecimento
    ).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Conhecimento não encontrado")
    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Conhecimento vinculado a outros registros.")
    return {"ok": True, "message": "Conhecimento excluído com sucesso"}
