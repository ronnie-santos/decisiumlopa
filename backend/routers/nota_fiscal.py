from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload, noload, selectinload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import not_, or_
from typing import List, Optional
from io import BytesIO
import xml.etree.ElementTree as ET
from datetime import datetime, date as date_type

import models, schemas
from database import get_db

router = APIRouter(
    prefix="/notas-fiscais",
    tags=["notas-fiscais"]
)

_NS = {'n': 'http://www.sped.fazenda.gov.br/nfse'}


# ── XML helpers ───────────────────────────────────────────────────────────────

def _find(elem, *tags):
    """Namespace-aware nested element find with fallback."""
    current = elem
    for tag in tags:
        if current is None:
            return None
        result = current.find(f'n:{tag}', _NS)
        if result is None:
            result = current.find(tag)
        current = result
    return current


def _text(elem, *tags, default=''):
    if elem is None:
        return default
    if not tags:
        return elem.text or default
    node = _find(elem, *tags)
    return (node.text or default) if node is not None else default


def _parse_xml_content(content: bytes) -> dict:
    """Parse NFSe XML bytes and return a structured dict."""
    root = ET.fromstring(content)

    inf = _find(root, 'infNFSe')
    if inf is None:
        raise ValueError("Elemento <infNFSe> não encontrado no XML")

    link = inf.get('Id', '')
    n_nfse = _text(inf, 'nNFSe')
    dh_proc = _text(inf, 'dhProc')

    emit = _find(inf, 'emit')
    emit_cnpj = _text(emit, 'CNPJ') if emit is not None else ''
    emit_cmun = _text(_find(emit, 'enderNac'), 'cMun') if emit is not None else ''

    vals_nfse = _find(inf, 'valores')
    v_liq = float(_text(vals_nfse, 'vLiq', default='0') or '0') if vals_nfse is not None else 0.0

    dps_el = _find(inf, 'DPS')
    if dps_el is None:
        raise ValueError("Elemento <DPS> não encontrado no XML")
    inf_dps = _find(dps_el, 'infDPS')
    if inf_dps is None:
        raise ValueError("Elemento <infDPS> não encontrado no XML")

    dh_emi = _text(inf_dps, 'dhEmi')
    serie = _text(inf_dps, 'serie')
    n_dps = _text(inf_dps, 'nDPS')

    data_emissao = None
    hora = None
    vencimento = None
    if dh_emi:
        try:
            dt = datetime.fromisoformat(dh_emi)
            data_emissao = dt.date()
            hora = dt.strftime('%H:%M:%S')
            vencimento = dt.date()
        except ValueError:
            pass

    toma = _find(inf_dps, 'toma')
    toma_cnpj = _text(toma, 'CNPJ') if toma is not None else ''
    toma_nome = _text(toma, 'xNome') if toma is not None else ''

    serv = _find(inf_dps, 'serv')
    c_loc_prestacao = c_trib_nac = x_desc_serv = ''
    if serv is not None:
        c_loc_prestacao = _text(_find(serv, 'locPrest'), 'cLocPrestacao')
        c_serv = _find(serv, 'cServ')
        if c_serv is not None:
            c_trib_nac = _text(c_serv, 'cTribNac')
            x_desc_serv = _text(c_serv, 'xDescServ')

    vals_dps = _find(inf_dps, 'valores')
    v_serv = 0.0
    cst = '0'
    tp_ret_issqn = ''
    p_tot_trib_sn = 0.0
    ret_cp = 0.0
    if vals_dps is not None:
        vsp = _find(vals_dps, 'vServPrest')
        if vsp is not None:
            v_serv = float(_text(vsp, 'vServ', default='0') or '0')
        trib = _find(vals_dps, 'trib')
        if trib is not None:
            trib_fed = _find(trib, 'tribFed')
            if trib_fed is not None:
                pf = _find(trib_fed, 'piscofins')
                if pf is not None:
                    cst = _text(pf, 'CST') or '0'
                ret_cp = float(_text(trib_fed, 'vRetCP', default='0') or '0')
            trib_mun = _find(trib, 'tribMun')
            if trib_mun is not None:
                tp_ret_issqn = _text(trib_mun, 'tpRetISSQN') or ''
            tot_trib = _find(trib, 'totTrib')
            if tot_trib is not None:
                p_tot_trib_sn = float(_text(tot_trib, 'pTotTribSN', default='0') or '0')

    local_servico = 'D' if (c_loc_prestacao and c_loc_prestacao == emit_cmun) else 'F'
    inss = round(ret_cp, 2)
    iss= round(v_serv * (p_tot_trib_sn / 100), 2) if tp_ret_issqn == '2' else 0.0

    try:
        pis_val = float(cst)
    except ValueError:
        pis_val = 0.0

    return {
        'numero': int(n_nfse) if n_nfse else None,
        'dps': n_dps,
        'data_emissao': data_emissao,
        'hora': hora,
        'serie': serie,
        'observacao': x_desc_serv,
        'valor_nota': v_serv,
        'valor_liquido': v_liq,
        'iss': iss,
        'inss': inss,
        'base_calculo': v_serv,
        'valor_servicos': v_serv,
        'total_retencao': v_serv,
        'pis': pis_val,
        'local_servico': local_servico,
        'dentro_pais': 'S',
        'resp_imposto': 'S' if tp_ret_issqn == '2' else 'N',
        'vencimento': vencimento,
        'link': link,
        'dh_proc': dh_proc,
        'c_trib_nac': int(c_trib_nac) if c_trib_nac else None,
        'x_desc_serv': x_desc_serv,
        'emit_cnpj': emit_cnpj,
        'toma_cnpj': toma_cnpj,
        'toma_nome': toma_nome,
    }


# ── Load helpers ──────────────────────────────────────────────────────────────

def _load(db: Session, idnota: int) -> models.NotaFiscal:
    item = (
        db.query(models.NotaFiscal)
        .options(
            selectinload(models.NotaFiscal.servicos).joinedload(models.NotaFiscalServico.servico_rel),
        )
        .filter(models.NotaFiscal.idnota == idnota)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Nota Fiscal não encontrada")
    return item


# ── Fechamentos sem nota (static path — must come before /{idnota}) ───────────
@router.get("/fechamentos-sem-nota")
def get_fechamentos_sem_nota(idcliente: Optional[int] = None, db: Session = Depends(get_db)):
    q = (
        db.query(models.Fechamento)
        .outerjoin(models.NotaFiscal, models.NotaFiscal.idfechamento == models.Fechamento.idfechamento)
        .filter(models.NotaFiscal.idnota.is_(None))
        .options(joinedload(models.Fechamento.cliente_rel))
    )
    if idcliente:
        q = q.filter(models.Fechamento.idcliente == idcliente)
    rows = q.order_by(models.Fechamento.data.desc()).all()
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


# ── Parse XML — preview only ──────────────────────────────────────────────────
@router.post("/parse-xml")
async def parse_xml(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    try:
        data = _parse_xml_content(content)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Erro ao processar XML: {e}")

    idempresa, empresa_nome = None, None
    if data['emit_cnpj']:
        emp = db.query(models.Empresa).filter(
            models.Empresa.cnpj == data['emit_cnpj']
        ).first()
        if emp:
            idempresa = emp.idempresa
            empresa_nome = emp.nomefantasia or emp.nome

    idcliente, cliente_nome = None, None
    if data['toma_cnpj']:
        cli = db.query(models.Cliente).filter(
            models.Cliente.cnpj_cpf == data['toma_cnpj']
        ).first()
        if cli:
            idcliente = cli.idcliente
            cliente_nome = cli.nomefantasia or cli.nome

    return {
        **data,
        'data_emissao': data['data_emissao'].isoformat() if data['data_emissao'] else None,
        'vencimento': data['vencimento'].isoformat() if data['vencimento'] else None,
        'idempresa': idempresa,
        'empresa_nome': empresa_nome,
        'idcliente': idcliente,
        'cliente_nome': cliente_nome,
    }


# ── Importar XML — salva tudo ─────────────────────────────────────────────────
@router.post("/importar-xml", response_model=schemas.NotaFiscal, status_code=201)
async def importar_xml(
    file: UploadFile = File(...),
    idfechamento: int = Form(...),
    idempresa: int = Form(...),
    idcliente: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
    content = await file.read()
    try:
        data = _parse_xml_content(content)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Erro ao processar XML: {e}")

    # Find or create tipo_servico
    c_trib_nac = data.get('c_trib_nac')
    if c_trib_nac:
        tipo_svc = db.query(models.TipoServico).filter(
            models.TipoServico.idservico == c_trib_nac
        ).first()
        if not tipo_svc:
            db.add(models.TipoServico(
                idservico=c_trib_nac,
                descricao=(data.get('x_desc_serv') or '')[:200],
            ))
            try:
                db.flush()
            except IntegrityError:
                db.rollback()

    # Create nota fiscal
    db_nota = models.NotaFiscal(
        idfechamento=idfechamento,
        idempresa=idempresa,
        idcliente=idcliente,
        numero=data.get('numero'),
        dps=data.get('dps'),
        data_emissao=data.get('data_emissao'),
        hora=data.get('hora'),
        serie=data.get('serie'),
        observacao=data.get('observacao'),
        valor_nota=data.get('valor_nota'),
        valor_servicos=data.get('valor_servicos'),
        valor_materiais=0,
        base_calculo=data.get('base_calculo'),
        valor_liquido=data.get('valor_liquido'),
        iss=data.get('iss'),
        pis=data.get('pis'),
        total_retencao=data.get('total_retencao'),
        local_servico=data.get('local_servico'),
        dentro_pais=data.get('dentro_pais'),
        resp_imposto=data.get('resp_imposto'),
        vencimento=data.get('vencimento'),
        link=data.get('link'),
    )
    db.add(db_nota)
    try:
        db.flush()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))

    # Create nota_fiscal_servico
    if c_trib_nac:
        v_serv = data.get('valor_nota') or 0
        db.add(models.NotaFiscalServico(
            idnota=db_nota.idnota,
            sequencial=1,
            idservico=c_trib_nac,
            valor_unitario=v_serv,
            quantidade=1,
            desconto=0,
            valor_total=v_serv,
            idempresa=idempresa,
        ))

    # Update fechamento.data_geracao_nf
    dh_proc = data.get('dh_proc')
    if dh_proc:
        fech = db.query(models.Fechamento).filter(
            models.Fechamento.idfechamento == idfechamento
        ).first()
        if fech:
            try:
                fech.data_geracao_nf = datetime.fromisoformat(dh_proc).date()
            except ValueError:
                pass

    # Update empresa: ultima_nf, serie, sequencia+1
    emp = db.query(models.Empresa).filter(
        models.Empresa.idempresa == idempresa
    ).first()
    if emp:
        emp.ultima_nf = db_nota.idnota
        emp.serie = data.get('serie')
        emp.sequencia = (emp.sequencia or 0) + 1

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))

    return _load(db, db_nota.idnota)


# ── Relatório: Notas Fiscais Emitidas ─────────────────────────────────────────
@router.get("/relatorio/notas-emitidas", response_model=None)
def relatorio_notas_emitidas(
    data_ini: str = Query(...),
    data_fim: str = Query(...),
    idempresa: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    try:
        d_ini = date_type.fromisoformat(data_ini)
        d_fim = date_type.fromisoformat(data_fim)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de data inválido. Use YYYY-MM-DD.")

    q = (
        db.query(models.NotaFiscal)
        .filter(
            models.NotaFiscal.data_emissao >= d_ini,
            models.NotaFiscal.data_emissao <= d_fim,
        )
        .options(
            noload(models.NotaFiscal.servicos),
        )
        .order_by(
            models.NotaFiscal.idempresa,
            models.NotaFiscal.data_emissao,
            models.NotaFiscal.numero,
        )
    )

    if idempresa:
        q = q.filter(models.NotaFiscal.idempresa == idempresa)

    notas = q.all()

    grupos: dict = {}
    for n in notas:
        emp = n.empresa_rel
        chave = n.idempresa or 0
        if chave not in grupos:
            grupos[chave] = {
                "idempresa": chave,
                "empresa_nome": (emp.nome if emp else ""),
                "empresa_fantasia": (emp.nomefantasia if emp else ""),
                "rows": [],
                "subtotal_valor": 0.0,
                "subtotal_iss": 0.0,
                "subtotal_inss": 0.0,
                "count": 0,
            }

        cli = n.cliente_rel
        cliente_nome = ""
        if cli:
            cliente_nome = cli.nomefantasia or cli.nome or ""

        valor_nota = float(n.valor_nota or 0)
        inss       = float(n.inss or 0)
        iss_val    = float(n.iss or 0)

        grupos[chave]["rows"].append({
            "idnota":        n.idnota,
            "numero":        n.numero,
            "data_emissao":  n.data_emissao.isoformat() if n.data_emissao else None,
            "cliente_nome":  cliente_nome,
            "valor_nota":    valor_nota,
            "iss":           iss_val,
            "inss":          inss,
            "resp_imposto":  n.resp_imposto or "",
        })

        grupos[chave]["subtotal_valor"] += valor_nota
        grupos[chave]["subtotal_iss"]   += iss_val
        grupos[chave]["subtotal_inss"]  += inss
        grupos[chave]["count"]          += 1

    lista_grupos = sorted(grupos.values(), key=lambda g: g["empresa_nome"])

    total_valor = sum(g["subtotal_valor"] for g in lista_grupos)
    total_iss   = sum(g["subtotal_iss"]   for g in lista_grupos)
    total_inss  = sum(g["subtotal_inss"]  for g in lista_grupos)
    total_notas = sum(g["count"]          for g in lista_grupos)

    return {
        "grupos":      lista_grupos,
        "total_valor": total_valor,
        "total_iss":   total_iss,
        "total_inss":  total_inss,
        "total_notas": total_notas,
    }


# ── Relatório PDF: Notas Fiscais Emitidas ─────────────────────────────────────
@router.get("/relatorio/notas-emitidas/pdf")
def relatorio_notas_emitidas_pdf(
    data_ini: str = Query(...),
    data_fim: str = Query(...),
    idempresa: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    from reports.notas_fiscais_report import NotasFiscaisReport

    try:
        d_ini = date_type.fromisoformat(data_ini)
        d_fim = date_type.fromisoformat(data_fim)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de data inválido. Use YYYY-MM-DD.")

    q = (
        db.query(models.NotaFiscal)
        .filter(
            models.NotaFiscal.data_emissao >= d_ini,
            models.NotaFiscal.data_emissao <= d_fim,
        )
        .options(noload(models.NotaFiscal.servicos))
        .order_by(
            models.NotaFiscal.idempresa,
            models.NotaFiscal.data_emissao,
            models.NotaFiscal.numero,
        )
    )
    if idempresa:
        q = q.filter(models.NotaFiscal.idempresa == idempresa)

    notas = q.all()

    grupos: dict = {}
    for n in notas:
        emp   = n.empresa_rel
        chave = n.idempresa or 0
        if chave not in grupos:
            grupos[chave] = {
                "idempresa":       chave,
                "empresa_nome":    (emp.nome if emp else ""),
                "empresa_fantasia":(emp.nomefantasia if emp else ""),
                "rows":            [],
                "subtotal_valor":  0.0,
                "subtotal_iss":    0.0,
                "subtotal_inss":   0.0,
                "count":           0,
            }
        cli          = n.cliente_rel
        cliente_nome = (cli.nomefantasia or cli.nome or "") if cli else ""
        valor_nota   = float(n.valor_nota or 0)
        iss_val      = float(n.iss or 0)
        inss_val     = float(n.inss or 0)

        grupos[chave]["rows"].append({
            "idnota":       n.idnota,
            "numero":       n.numero,
            "data_emissao": n.data_emissao.isoformat() if n.data_emissao else None,
            "cliente_nome": cliente_nome,
            "valor_nota":   valor_nota,
            "iss":          iss_val,
            "inss":         inss_val,
        })
        grupos[chave]["subtotal_valor"] += valor_nota
        grupos[chave]["subtotal_iss"]   += iss_val
        grupos[chave]["subtotal_inss"]  += inss_val
        grupos[chave]["count"]          += 1

    lista_grupos = sorted(grupos.values(), key=lambda g: g["empresa_nome"])
    total_valor  = sum(g["subtotal_valor"] for g in lista_grupos)
    total_iss    = sum(g["subtotal_iss"]   for g in lista_grupos)
    total_inss   = sum(g["subtotal_inss"]  for g in lista_grupos)
    total_notas  = sum(g["count"]          for g in lista_grupos)

    buf = BytesIO()
    NotasFiscaisReport().generate(
        grupos=lista_grupos,
        total_valor=total_valor,
        total_iss=total_iss,
        total_inss=total_inss,
        total_notas=total_notas,
        data_ini=data_ini,
        data_fim=data_fim,
        buf=buf,
    )
    buf.seek(0)

    filename = f"notas_fiscais_{data_ini}_{data_fim}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


# ── Listar com paginação e filtros ────────────────────────────────────────────
@router.get("", response_model=None)
def list_notas(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    cliente: Optional[str] = Query(None),
    empresa: Optional[str] = Query(None),
    data_ini: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    # base_q sem joins — usada para COUNT (muito mais rápido)
    base_q = db.query(models.NotaFiscal)

    if cliente:
        like = f"%{cliente}%"
        subq = (
            db.query(models.Cliente.idcliente)
            .filter(or_(
                models.Cliente.nome.ilike(like),
                models.Cliente.nomefantasia.ilike(like),
            ))
            .subquery()
        )
        base_q = base_q.filter(models.NotaFiscal.idcliente.in_(subq))

    if empresa:
        like = f"%{empresa}%"
        subq = (
            db.query(models.Empresa.idempresa)
            .filter(or_(
                models.Empresa.nome.ilike(like),
                models.Empresa.nomefantasia.ilike(like),
            ))
            .subquery()
        )
        base_q = base_q.filter(models.NotaFiscal.idempresa.in_(subq))

    if data_ini:
        base_q = base_q.filter(models.NotaFiscal.data_emissao >= date_type.fromisoformat(data_ini))
    if data_fim:
        base_q = base_q.filter(models.NotaFiscal.data_emissao <= date_type.fromisoformat(data_fim))

    total = base_q.count()

    items = (
        base_q
        .options(
            noload(models.NotaFiscal.servicos),
        )
        .order_by(models.NotaFiscal.data_emissao.desc(), models.NotaFiscal.idnota.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "data": [schemas.NotaFiscal.model_validate(n) for n in items],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


# ── Buscar por ID ─────────────────────────────────────────────────────────────
@router.get("/{idnota}", response_model=schemas.NotaFiscal)
def get_nota(idnota: int, db: Session = Depends(get_db)):
    return _load(db, idnota)


# ── Criar (com serviços opcionais) ────────────────────────────────────────────
@router.post("", response_model=schemas.NotaFiscal, status_code=201)
def create_nota(payload: schemas.NotaFiscalCreate, db: Session = Depends(get_db)):
    servicos_data = payload.servicos or []
    nota_data = payload.model_dump(exclude={"servicos"})

    db_nota = models.NotaFiscal(**nota_data)
    db.add(db_nota)
    try:
        db.flush()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))

    for svc in servicos_data:
        db.add(models.NotaFiscalServico(idnota=db_nota.idnota, **svc.model_dump()))

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))

    return _load(db, db_nota.idnota)


# ── Atualizar (substitui serviços) ────────────────────────────────────────────
@router.put("/{idnota}", response_model=schemas.NotaFiscal)
def update_nota(idnota: int, payload: schemas.NotaFiscalCreate, db: Session = Depends(get_db)):
    db_nota = db.query(models.NotaFiscal).filter(models.NotaFiscal.idnota == idnota).first()
    if not db_nota:
        raise HTTPException(status_code=404, detail="Nota Fiscal não encontrada")

    servicos_data = payload.servicos or []
    for key, value in payload.model_dump(exclude={"servicos"}, exclude_unset=True).items():
        setattr(db_nota, key, value)

    db.query(models.NotaFiscalServico).filter(
        models.NotaFiscalServico.idnota == idnota
    ).delete(synchronize_session=False)

    for svc in servicos_data:
        db.add(models.NotaFiscalServico(idnota=idnota, **svc.model_dump()))

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))

    return _load(db, idnota)


# ── Excluir ───────────────────────────────────────────────────────────────────
@router.delete("/{idnota}")
def delete_nota(idnota: int, db: Session = Depends(get_db)):
    db_nota = db.query(models.NotaFiscal).filter(models.NotaFiscal.idnota == idnota).first()
    if not db_nota:
        raise HTTPException(status_code=404, detail="Nota Fiscal não encontrada")
    try:
        # Exclui compras vinculadas via número da NF (Compra.nota == str(NotaFiscal.numero)).
        # O cascade do model Compra já remove CompraItem e ContasPagar automaticamente.
        if db_nota.numero is not None:
            compras_vinculadas = (
                db.query(models.Compra)
                .filter(
                    models.Compra.nota == str(db_nota.numero),
                    models.Compra.idempresa == db_nota.idempresa,
                )
                .all()
            )
            for compra in compras_vinculadas:
                db.delete(compra)
            db.flush()

        # Exclui a nota fiscal (cascade remove NotaFiscalServico)
        db.delete(db_nota)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Nota Fiscal vinculada a outros registros.")
    return {"ok": True, "message": "Nota Fiscal excluída com sucesso"}


# ── Serviços: adicionar ───────────────────────────────────────────────────────
@router.post("/{idnota}/servicos", response_model=schemas.NotaFiscalServico, status_code=201)
def add_servico(idnota: int, item: schemas.NotaFiscalServicoCreate, db: Session = Depends(get_db)):
    if not db.query(models.NotaFiscal).filter(models.NotaFiscal.idnota == idnota).first():
        raise HTTPException(status_code=404, detail="Nota Fiscal não encontrada")

    existing = db.query(models.NotaFiscalServico).filter(
        models.NotaFiscalServico.idnota == idnota,
        models.NotaFiscalServico.sequencial == item.sequencial,
        models.NotaFiscalServico.idservico == item.idservico,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Serviço com este sequencial já existe nesta nota")

    db_svc = models.NotaFiscalServico(idnota=idnota, **item.model_dump())
    db.add(db_svc)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))

    return (
        db.query(models.NotaFiscalServico)
        .options(joinedload(models.NotaFiscalServico.servico_rel))
        .filter(
            models.NotaFiscalServico.idnota == idnota,
            models.NotaFiscalServico.sequencial == item.sequencial,
            models.NotaFiscalServico.idservico == item.idservico,
        )
        .first()
    )


# ── Serviços: remover ─────────────────────────────────────────────────────────
@router.delete("/{idnota}/servicos/{sequencial}/{idservico}")
def remove_servico(idnota: int, sequencial: int, idservico: int, db: Session = Depends(get_db)):
    db_svc = db.query(models.NotaFiscalServico).filter(
        models.NotaFiscalServico.idnota == idnota,
        models.NotaFiscalServico.sequencial == sequencial,
        models.NotaFiscalServico.idservico == idservico,
    ).first()
    if not db_svc:
        raise HTTPException(status_code=404, detail="Serviço não encontrado")
    db.delete(db_svc)
    db.commit()
    return {"ok": True, "message": "Serviço removido com sucesso"}
