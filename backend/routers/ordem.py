from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload, undefer
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, case, text, or_
from typing import List, Optional
from datetime import date
from io import BytesIO

import models, schemas
from database import get_db

router = APIRouter(
    prefix="/ordens",
    tags=["ordens"]
)


def _load_ordem(db: Session, idordem: int) -> models.Ordem:
    item = (
        db.query(models.Ordem)
        .options(
            joinedload(models.Ordem.empresa_rel),
            joinedload(models.Ordem.equipamento_rel),
            joinedload(models.Ordem.funcionario_rel),
            joinedload(models.Ordem.fluxo_rel),
            joinedload(models.Ordem.cliente_rel),
        )
        .filter(models.Ordem.idordem == idordem)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Ordem não encontrada")
    return item


# ── Listar ───────────────────────────────────────────────────────────────────
@router.get("", response_model=None)
def list_ordens(
    situacao: Optional[bool] = Query(None),
    idordem: Optional[int] = Query(None),
    idcliente: Optional[int] = Query(None),
    idempresa: Optional[int] = Query(None),
    idequipamento: Optional[int] = Query(None),
    idfechamento: Optional[int] = Query(None),
    numero_os: Optional[int] = Query(None),
    data_de: Optional[date] = Query(None),
    data_ate: Optional[date] = Query(None),
    nome_cliente: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    # Subquery de IDs de clientes que batem com nome_cliente (calculada uma vez)
    cliente_ids_sub = None
    if nome_cliente:
        like = f"%{nome_cliente}%"
        cliente_ids_sub = (
            db.query(models.Cliente.idcliente)
            .filter(or_(
                models.Cliente.nome.ilike(like),
                models.Cliente.nomefantasia.ilike(like),
            ))
            .subquery()
        )

    # Query base para contagem (sem joinedload)
    def _apply_filters(q):
        if situacao is not None:
            q = q.filter(models.Ordem.situacao == situacao)
        if idordem is not None and numero_os is not None:
            q = q.filter(or_(models.Ordem.idordem == idordem, models.Ordem.numero_os == numero_os))
        elif idordem is not None:
            q = q.filter(models.Ordem.idordem == idordem)
        elif numero_os is not None:
            q = q.filter(models.Ordem.numero_os == numero_os)
        if idcliente is not None:
            q = q.filter(models.Ordem.idcliente == idcliente)
        if idempresa is not None:
            q = q.filter(models.Ordem.idempresa == idempresa)
        if idequipamento is not None:
            q = q.filter(models.Ordem.idequipamento == idequipamento)
        if idfechamento is not None:
            q = q.filter(models.Ordem.idfechamento == idfechamento)
        if data_de is not None:
            q = q.filter(models.Ordem.data >= data_de)
        if data_ate is not None:
            q = q.filter(models.Ordem.data <= data_ate)
        if cliente_ids_sub is not None:
            q = q.filter(models.Ordem.idcliente.in_(cliente_ids_sub))
        return q

    # Consolidado: stats globais em 1 query, total filtrado em outra
    stats = db.query(
        func.sum(case((models.Ordem.situacao == False, 1), else_=0)).label("total_abertas"),
        func.sum(case((models.Ordem.situacao == True,  1), else_=0)).label("total_fechadas"),
    ).first()
    total = _apply_filters(db.query(func.count(models.Ordem.idordem))).scalar()
    total_abertas = int(stats.total_abertas or 0) if stats else 0
    total_fechadas = int(stats.total_fechadas or 0) if stats else 0

    items = (
        _apply_filters(
            db.query(models.Ordem).options(
                joinedload(models.Ordem.empresa_rel),
                joinedload(models.Ordem.equipamento_rel),
                joinedload(models.Ordem.funcionario_rel),
                joinedload(models.Ordem.fluxo_rel),
                joinedload(models.Ordem.cliente_rel),
            )
        )
        .order_by(models.Ordem.data.desc(), models.Ordem.idordem.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "data": [schemas.Ordem.model_validate(o) for o in items],
        "total": total,
        "skip": skip,
        "limit": limit,
        "total_abertas": total_abertas,
        "total_fechadas": total_fechadas,
    }


# ── Buscar por ID ─────────────────────────────────────────────────────────────
@router.get("/{idordem}", response_model=schemas.Ordem)
def get_ordem(idordem: int, db: Session = Depends(get_db)):
    return _load_ordem(db, idordem)


# ── Imprimir OS — PDF ──────────────────────────────────────────────────────────
@router.get("/{idordem}/pdf")
def get_ordem_pdf(idordem: int, db: Session = Depends(get_db)):
    from reports.ordem_os_report import OrdemOSReport

    item = (
        db.query(models.Ordem)
        .options(
            joinedload(models.Ordem.empresa_rel).options(undefer(models.Empresa.logo)),
            joinedload(models.Ordem.equipamento_rel),
            joinedload(models.Ordem.funcionario_rel),
            joinedload(models.Ordem.fluxo_rel),
            joinedload(models.Ordem.cliente_rel),
        )
        .filter(models.Ordem.idordem == idordem)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Ordem não encontrada")

    func2 = (
        db.query(models.Funcionario)
        .filter(models.Funcionario.idfuncionario == item.funcionario_2)
        .first()
    ) if item.funcionario_2 else None

    func3 = (
        db.query(models.Funcionario)
        .filter(models.Funcionario.idfuncionario == item.funcionario_3)
        .first()
    ) if item.funcionario_3 else None

    tipo_servico = (
        db.query(models.TipoServico)
        .filter(models.TipoServico.idservico == item.idservico)
        .first()
    ) if item.idservico else None

    buf = BytesIO()
    OrdemOSReport().generate(
        ordem=item,
        func2=func2,
        func3=func3,
        tipo_servico=tipo_servico,
        buf=buf,
    )
    buf.seek(0)

    num = item.numero_os or item.idordem
    filename = f"os_{num}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


# ── Criar ─────────────────────────────────────────────────────────────────────
@router.post("", response_model=schemas.Ordem, status_code=201)
def create_ordem(payload: schemas.OrdemCreate, db: Session = Depends(get_db)):
    db_item = models.Ordem(**payload.model_dump())
    db.add(db_item)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))
    return _load_ordem(db, db_item.idordem)


# ── Atualizar ─────────────────────────────────────────────────────────────────
@router.put("/{idordem}", response_model=schemas.Ordem)
def update_ordem(idordem: int, payload: schemas.OrdemCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.Ordem).filter(models.Ordem.idordem == idordem).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Ordem não encontrada")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig))

    return _load_ordem(db, idordem)


# ── Excluir ───────────────────────────────────────────────────────────────────
@router.delete("/{idordem}")
def delete_ordem(idordem: int, db: Session = Depends(get_db)):
    db_item = db.query(models.Ordem).filter(models.Ordem.idordem == idordem).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Ordem não encontrada")

    try:
        db.delete(db_item)
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Ordem não pode ser excluída pois possui vínculos no sistema.")

    return {"ok": True, "message": "Ordem excluída com sucesso"}


# ── Atualizar situação (abrir/fechar) ─────────────────────────────────────────
@router.patch("/{idordem}/situacao", response_model=schemas.Ordem)
def update_situacao(idordem: int, situacao: bool, db: Session = Depends(get_db)):
    db_item = db.query(models.Ordem).filter(models.Ordem.idordem == idordem).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Ordem não encontrada")

    db_item.situacao = situacao
    db.commit()
    return _load_ordem(db, idordem)


# ── Lógica compartilhada de comissão (JSON + PDF) ────────────────────────────
def _compute_comissao(data_de: date, data_ate: date, db: Session) -> dict:
    # ── Dicionário de funcionários (id → nome) ────────────────────────────────
    funcs = db.query(models.Funcionario.idfuncionario, models.Funcionario.nome).all()
    func_map: dict[int, str] = {f.idfuncionario: f.nome or "" for f in funcs}

    # ── Dicionário de clientes (id → nome exibição) ───────────────────────────
    clientes = db.query(models.Cliente.idcliente, models.Cliente.nome, models.Cliente.nomefantasia).all()
    cliente_map: dict[int, str] = {
        c.idcliente: (c.nomefantasia or c.nome or "") for c in clientes
    }

    # ── Dicionário de empresas (id → nomefantasia) ────────────────────────────
    empresas = db.query(models.Empresa.idempresa, models.Empresa.nome, models.Empresa.nomefantasia).all()
    empresa_map: dict[int, str] = {
        e.idempresa: (e.nomefantasia or e.nome or "") for e in empresas
    }

    # ── Dicionário de equipamentos (id → nome) ────────────────────────────────
    equips = db.query(models.Equipamento.idequipamento, models.Equipamento.nome).all()
    equip_map: dict[int, str] = {e.idequipamento: (e.nome or "") for e in equips}

    # ── Ordens no período ─────────────────────────────────────────────────────
    ordens = (
        db.query(models.Ordem)
        .filter(
            models.Ordem.data >= data_de,
            models.Ordem.data <= data_ate,
            models.Ordem.idfuncionario != None,
            models.Ordem.idfuncionario != 0,
        )
        .order_by(models.Ordem.data, models.Ordem.idordem)
        .all()
    )

    def fmt_horario(o: models.Ordem) -> str:
        partes = []
        if o.inicio_01 and o.inicio_01 not in ("0000", ""):
            partes.append(f"{o.inicio_01} às {o.termino_01 or ''}")
        if o.inicio_02 and o.inicio_02 not in ("0000", ""):
            partes.append(f"{o.inicio_02} às {o.termino_02 or ''}")
        return "\n".join(partes)

    rows: list[dict] = []

    for o in ordens:
        participantes: list[int] = []
        if o.idfuncionario and o.idfuncionario != 0:
            participantes.append(o.idfuncionario)
        if o.funcionario_2 and o.funcionario_2 != 0:
            participantes.append(o.funcionario_2)
        if o.funcionario_3 and o.funcionario_3 != 0:
            participantes.append(o.funcionario_3)

        num = len(participantes) or 1
        valor_os = float(o.valor_os or 0)
        comissao = round((valor_os / num) * 0.025, 2)
        observacao = "compartilhada" if num > 1 else ""

        base = {
            "tipo": "os",
            "data": str(o.data) if o.data else None,
            "idordem": o.idordem,
            "numero_os": o.numero_os,
            "cliente_nome": cliente_map.get(o.idcliente or 0, ""),
            "cidade_servico": o.cidade_servico or "",
            "equipamento_nome": equip_map.get(o.idequipamento or 0, ""),
            "empresa_fantasia": empresa_map.get(o.idempresa or 0, ""),
            "horario": fmt_horario(o),
            "km_total": float(o.km_total or 0),
            "valor_os": valor_os,
            "comissao": comissao,
            "observacao": observacao,
        }

        for fid in participantes:
            rows.append({**base, "funcionario_id": fid, "funcionario_nome": func_map.get(fid, str(fid))})

    # ── Descontos no período ──────────────────────────────────────────────────
    descontos = db.execute(
        text(
            "SELECT iddesconto, idfuncionario, valor, descricao, data "
            "FROM descontos "
            "WHERE data >= :d1 AND data <= :d2 "
            "ORDER BY data"
        ),
        {"d1": data_de, "d2": data_ate},
    ).fetchall()

    for d in descontos:
        fid = d.idfuncionario
        rows.append({
            "tipo": "desconto",
            "data": str(d.data) if d.data else None,
            "idordem": None,
            "numero_os": None,
            "cliente_nome": d.descricao or "",
            "cidade_servico": "",
            "equipamento_nome": "",
            "empresa_fantasia": "",
            "horario": "",
            "km_total": 0.0,
            "valor_os": 0.0,
            "comissao": round(float(d.valor or 0) * -1, 2),
            "observacao": "desconto",
            "funcionario_id": fid,
            "funcionario_nome": func_map.get(fid, str(fid)) if fid else "",
        })

    # ── Agrupar por funcionário ───────────────────────────────────────────────
    grupos: dict[int, dict] = {}
    for row in rows:
        fid = row["funcionario_id"] or 0
        if fid not in grupos:
            grupos[fid] = {
                "funcionario_id": fid,
                "funcionario_nome": row["funcionario_nome"],
                "rows": [],
                "subtotal": 0.0,
            }
        grupos[fid]["rows"].append(row)
        grupos[fid]["subtotal"] = round(grupos[fid]["subtotal"] + row["comissao"], 2)

    result = sorted(grupos.values(), key=lambda g: g["funcionario_nome"])
    total_geral = round(sum(g["subtotal"] for g in result), 2)

    return {"grupos": result, "total_geral": total_geral}


# ── GET /relatorio/comissao — JSON ────────────────────────────────────────────
@router.get("/relatorio/comissao")
def relatorio_comissao(
    data_de: date = Query(...),
    data_ate: date = Query(...),
    db: Session = Depends(get_db),
):
    return _compute_comissao(data_de, data_ate, db)


# ── GET /relatorio/comissao/pdf — PDF ─────────────────────────────────────────
@router.get("/relatorio/comissao/pdf")
def relatorio_comissao_pdf(
    data_de: date = Query(...),
    data_ate: date = Query(...),
    db: Session = Depends(get_db),
):
    from reports.comissao_report import ComissaoReport

    dados = _compute_comissao(data_de, data_ate, db)

    buf = BytesIO()
    ComissaoReport().generate(
        grupos=dados["grupos"],
        total_geral=dados["total_geral"],
        data_de=str(data_de),
        data_ate=str(data_ate),
        buf=buf,
    )
    buf.seek(0)

    filename = f"comissao_{data_de}_{data_ate}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


# ── Lógica compartilhada de relatório de ordens ───────────────────────────────
def _compute_ordens_relatorio(
    data_de: date,
    data_ate: date,
    db: Session,
    idcliente: Optional[int] = None,
    idempresa: Optional[int] = None,
    idequipamento: Optional[int] = None,
    situacao: Optional[bool] = None,
    grupo: int = 1,
) -> dict:
    # ── Dicionários de lookup ─────────────────────────────────────────────────
    clientes = db.query(models.Cliente.idcliente, models.Cliente.nome, models.Cliente.nomefantasia).all()
    cliente_map: dict[int, str] = {c.idcliente: (c.nomefantasia or c.nome or "") for c in clientes}

    empresas = db.query(models.Empresa.idempresa, models.Empresa.nome, models.Empresa.nomefantasia).all()
    empresa_map: dict[int, str] = {e.idempresa: (e.nomefantasia or e.nome or "") for e in empresas}

    equips = db.query(models.Equipamento.idequipamento, models.Equipamento.nome).all()
    equip_map: dict[int, str] = {e.idequipamento: (e.nome or "") for e in equips}

    funcs = db.query(models.Funcionario.idfuncionario, models.Funcionario.nome).all()
    func_map: dict[int, str] = {f.idfuncionario: f.nome or "" for f in funcs}

    # ── Query com filtros ─────────────────────────────────────────────────────
    q = db.query(models.Ordem).filter(
        models.Ordem.data >= data_de,
        models.Ordem.data <= data_ate,
    )
    if idcliente is not None:
        q = q.filter(models.Ordem.idcliente == idcliente)
    if idempresa is not None:
        q = q.filter(models.Ordem.idempresa == idempresa)
    if idequipamento is not None:
        q = q.filter(models.Ordem.idequipamento == idequipamento)
    if situacao is not None:
        q = q.filter(models.Ordem.situacao == situacao)

    ordens = q.order_by(models.Ordem.data, models.Ordem.idordem).all()

    def fmt_horario(o: models.Ordem) -> str:
        partes = []
        if o.inicio_01 and o.inicio_01 not in ("0000", ""):
            partes.append(f"{o.inicio_01} às {o.termino_01 or ''}")
        if o.inicio_02 and o.inicio_02 not in ("0000", ""):
            partes.append(f"{o.inicio_02} às {o.termino_02 or ''}")
        return "\n".join(partes)

    # ── Montar linhas ─────────────────────────────────────────────────────────
    rows: list[dict] = []
    for o in ordens:
        cliente_nome    = cliente_map.get(o.idcliente or 0, "")
        empresa_fantasia = empresa_map.get(o.idempresa or 0, "")
        equipamento_nome = equip_map.get(o.idequipamento or 0, "")
        funcionario_nome = func_map.get(o.idfuncionario or 0, "")

        quebra = ""
        if grupo == 2:
            quebra = cliente_nome
        elif grupo == 3:
            quebra = empresa_fantasia

        rows.append({
            "data":             str(o.data) if o.data else None,
            "idordem":          o.idordem,
            "numero_os":        o.numero_os,
            "cliente_nome":     cliente_nome,
            "empresa_fantasia": empresa_fantasia,
            "equipamento_nome": equipamento_nome,
            "funcionario_nome": funcionario_nome,
            "cidade_servico":   o.cidade_servico or "",
            "cidade_entrega":   o.cidade_entrega or "",
            "horario":          fmt_horario(o),
            "total_horas":      float(o.total_horas or 0),
            "valor_hora":       float(o.valor_hora or 0),
            "km_total":         int(o.km_total or 0),
            "valor_km":         float(o.valor_km or 0),
            "saida":            float(o.saida or 0),
            "pedagio":          float(o.pedagio or 0),
            "escolta":          float(o.escolta or 0),
            "desconto":         float(o.desconto or 0),
            "seguro":           float(o.seguro or 0),
            "valor_os":         float(o.valor_os or 0),
            "situacao":         o.situacao,
            "quebra":           quebra,
        })

    # ── Agrupar ───────────────────────────────────────────────────────────────
    if grupo == 1:
        result = [{
            "quebra":            "",
            "rows":              rows,
            "subtotal_valor_os": round(sum(r["valor_os"] for r in rows), 2),
            "subtotal_horas":    round(sum(r["total_horas"] for r in rows), 2),
            "count":             len(rows),
        }]
    else:
        grupos_map: dict[str, dict] = {}
        for row in rows:
            key = row["quebra"]
            if key not in grupos_map:
                grupos_map[key] = {"quebra": key, "rows": [], "subtotal_valor_os": 0.0, "subtotal_horas": 0.0, "count": 0}
            grupos_map[key]["rows"].append(row)
            grupos_map[key]["subtotal_valor_os"] = round(grupos_map[key]["subtotal_valor_os"] + row["valor_os"], 2)
            grupos_map[key]["subtotal_horas"]    = round(grupos_map[key]["subtotal_horas"] + row["total_horas"], 2)
            grupos_map[key]["count"] += 1
        result = sorted(grupos_map.values(), key=lambda g: g["quebra"])

    total_valor_os  = round(sum(g["subtotal_valor_os"] for g in result), 2)
    total_horas     = round(sum(g["subtotal_horas"]    for g in result), 2)
    total_registros = sum(g["count"] for g in result)

    return {
        "grupos":           result,
        "total_valor_os":   total_valor_os,
        "total_horas":      total_horas,
        "total_registros":  total_registros,
        "grupo_tipo":       grupo,
    }


# ── GET /relatorio/ordens — JSON ──────────────────────────────────────────────
@router.get("/relatorio/ordens")
def relatorio_ordens(
    data_de:       date           = Query(...),
    data_ate:      date           = Query(...),
    idcliente:     Optional[int]  = Query(None),
    idempresa:     Optional[int]  = Query(None),
    idequipamento: Optional[int]  = Query(None),
    situacao:      Optional[bool] = Query(None),
    grupo:         int            = Query(1, ge=1, le=3),
    db: Session = Depends(get_db),
):
    return _compute_ordens_relatorio(data_de, data_ate, db, idcliente, idempresa, idequipamento, situacao, grupo)


# ── GET /relatorio/ordens/pdf — PDF ──────────────────────────────────────────
@router.get("/relatorio/ordens/pdf")
def relatorio_ordens_pdf(
    data_de:       date           = Query(...),
    data_ate:      date           = Query(...),
    idcliente:     Optional[int]  = Query(None),
    idempresa:     Optional[int]  = Query(None),
    idequipamento: Optional[int]  = Query(None),
    situacao:      Optional[bool] = Query(None),
    grupo:         int            = Query(1, ge=1, le=3),
    db: Session = Depends(get_db),
):
    from reports.ordens_report import OrdensReport

    dados = _compute_ordens_relatorio(data_de, data_ate, db, idcliente, idempresa, idequipamento, situacao, grupo)

    buf = BytesIO()
    OrdensReport().generate(
        grupos=dados["grupos"],
        total_valor_os=dados["total_valor_os"],
        total_horas=dados["total_horas"],
        total_registros=dados["total_registros"],
        grupo_tipo=dados["grupo_tipo"],
        data_de=str(data_de),
        data_ate=str(data_ate),
        buf=buf,
    )
    buf.seek(0)

    filename = f"ordens_{data_de}_{data_ate}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
