"""
fluxo_caixa.py — Relatório de Fluxo de Caixa
Combina Contas a Receber (entradas) e Contas a Pagar (saídas).
Filtros: empresa, equipamento, status receber, status pagar, período.
"""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import date
from io import BytesIO

import models
from database import get_db
from reports.fluxo_caixa_report import FluxoCaixaReport

router = APIRouter(prefix="/fluxo-caixa", tags=["fluxo-caixa"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fmt_date(d) -> str | None:
    return str(d) if d else None


def _to_float(v) -> float:
    return float(v) if v is not None else 0.0


# ── Receitas ──────────────────────────────────────────────────────────────────

def _query_receitas(
    db: Session,
    data_de: date,
    data_ate: date,
    idempresa: Optional[int],
    idequipamento: Optional[int],
    status_receber: str,
) -> list[dict]:
    q = (
        db.query(
            models.ContasReceber.idcontasreceber,
            models.ContasReceber.idfechamento,
            models.ContasReceber.vencimento,
            models.ContasReceber.valor,
            models.ContasReceber.valor_pago,
            models.ContasReceber.situacao,
            models.ContasReceber.parcela,
            func.coalesce(models.Cliente.nomefantasia, models.Cliente.nome).label("cliente_nome"),
            func.coalesce(models.Empresa.nomefantasia, models.Empresa.nome).label("empresa_nome"),
        )
        .join(models.Fechamento, models.ContasReceber.idfechamento == models.Fechamento.idfechamento)
        .outerjoin(models.Cliente, models.Fechamento.idcliente == models.Cliente.idcliente)
        .outerjoin(models.Empresa, models.Fechamento.idempresa == models.Empresa.idempresa)
        .filter(
            models.ContasReceber.vencimento >= data_de,
            models.ContasReceber.vencimento <= data_ate,
        )
    )

    if idempresa:
        q = q.filter(models.Fechamento.idempresa == idempresa)

    if idequipamento:
        exists_q = (
            db.query(models.Ordem)
            .filter(
                models.Ordem.idfechamento == models.Fechamento.idfechamento,
                models.Ordem.idequipamento == idequipamento,
            )
            .exists()
        )
        q = q.filter(exists_q)

    if status_receber == "pagas":
        q = q.filter(models.ContasReceber.situacao == True)   # noqa: E712
    elif status_receber == "abertas":
        q = q.filter(models.ContasReceber.situacao == False)  # noqa: E712

    rows_raw = q.order_by(models.ContasReceber.vencimento).all()

    # ── Buscar equipamento + numero_os por idfechamento (1 query extra) ────────
    fech_ids = list({r.idfechamento for r in rows_raw if r.idfechamento})
    equip_map: dict = {}
    if fech_ids:
        eq_rows = (
            db.query(
                models.Ordem.idfechamento,
                models.Equipamento.nome.label("equipamento_nome"),
                models.Ordem.numero_os,
            )
            .join(models.Equipamento, models.Ordem.idequipamento == models.Equipamento.idequipamento)
            .filter(models.Ordem.idfechamento.in_(fech_ids))
            .order_by(models.Ordem.idfechamento, models.Ordem.numero_os)
            .all()
        )
        for er in eq_rows:
            if er.idfechamento not in equip_map:
                equip_map[er.idfechamento] = {
                    "equipamento_nome": er.equipamento_nome or "—",
                    "numero_os": er.numero_os,
                }

    return [
        {
            "vencimento": _fmt_date(r.vencimento),
            "valor": _to_float(r.valor),
            "valor_pago": _to_float(r.valor_pago),
            "situacao": r.situacao,
            "parcela": r.parcela or "",
            "cliente_nome": r.cliente_nome or "—",
            "empresa_nome": r.empresa_nome or "—",
            "equipamento_nome": equip_map.get(r.idfechamento, {}).get("equipamento_nome", "—"),
            "numero_os": equip_map.get(r.idfechamento, {}).get("numero_os"),
        }
        for r in rows_raw
    ]


# ── Despesas ──────────────────────────────────────────────────────────────────

def _query_despesas(
    db: Session,
    data_de: date,
    data_ate: date,
    idempresa: Optional[int],
    idequipamento: Optional[int],
    status_pagar: str,
) -> list[dict]:
    q = (
        db.query(
            models.ContasPagar.idcontaspagar,
            models.ContasPagar.idcompras,
            models.ContasPagar.vencimento,
            models.ContasPagar.valor,
            models.ContasPagar.valor_pago,
            models.ContasPagar.situacao,
            models.ContasPagar.parcela,
            models.Compra.nota,
            func.coalesce(models.Fornecedor.nomefantasia, models.Fornecedor.nome).label("fornecedor_nome"),
            func.coalesce(models.Empresa.nomefantasia, models.Empresa.nome).label("empresa_nome"),
        )
        .outerjoin(models.Compra, models.ContasPagar.idcompras == models.Compra.idcompras)
        .outerjoin(models.Fornecedor, models.Compra.idfornecedor == models.Fornecedor.idfornecedor)
        .outerjoin(models.Empresa, models.Compra.idempresa == models.Empresa.idempresa)
        .filter(
            models.ContasPagar.vencimento >= data_de,
            models.ContasPagar.vencimento <= data_ate,
        )
    )

    if idempresa:
        q = q.filter(models.Compra.idempresa == idempresa)

    if idequipamento:
        exists_q = (
            db.query(models.CompraItem)
            .filter(
                models.CompraItem.idcompras == models.ContasPagar.idcompras,
                models.CompraItem.idequipamento == idequipamento,
            )
            .exists()
        )
        q = q.filter(models.ContasPagar.idcompras.isnot(None), exists_q)

    if status_pagar == "pagas":
        q = q.filter(models.ContasPagar.situacao == True)   # noqa: E712
    elif status_pagar == "abertas":
        q = q.filter(models.ContasPagar.situacao == False)  # noqa: E712

    rows_raw = q.order_by(models.ContasPagar.vencimento).all()

    return [
        {
            "vencimento": _fmt_date(r.vencimento),
            "valor": _to_float(r.valor),
            "valor_pago": _to_float(r.valor_pago),
            "situacao": r.situacao,
            "parcela": r.parcela or "",
            "nota": r.nota or "—",
            "fornecedor_nome": r.fornecedor_nome or "—",
            "empresa_nome": r.empresa_nome or "—",
        }
        for r in rows_raw
    ]


# ── Cálculo combinado ─────────────────────────────────────────────────────────

def _compute(
    db: Session,
    data_de: date,
    data_ate: date,
    idempresa: Optional[int],
    idequipamento: Optional[int],
    status_receber: str,
    status_pagar: str,
) -> dict:
    receitas = _query_receitas(db, data_de, data_ate, idempresa, idequipamento, status_receber)
    despesas = _query_despesas(db, data_de, data_ate, idempresa, idequipamento, status_pagar)

    total_receitas = sum(r["valor"] for r in receitas)
    total_despesas = sum(r["valor"] for r in despesas)
    total_recebido = sum(r["valor_pago"] for r in receitas)
    total_pago     = sum(r["valor_pago"] for r in despesas)

    return {
        "receitas": receitas,
        "despesas": despesas,
        "total_receitas": total_receitas,
        "total_despesas": total_despesas,
        "total_recebido": total_recebido,
        "total_pago": total_pago,
        "saldo": total_receitas - total_despesas,
        "saldo_caixa": total_recebido - total_pago,
        "qtd_receitas": len(receitas),
        "qtd_despesas": len(despesas),
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/relatorio")
def relatorio_fluxo_caixa(
    data_de: date = Query(...),
    data_ate: date = Query(...),
    idempresa: Optional[int] = Query(None),
    idequipamento: Optional[int] = Query(None),
    status_receber: str = Query("ambas"),   # ambas | abertas | pagas
    status_pagar: str = Query("ambas"),     # ambas | abertas | pagas
    db: Session = Depends(get_db),
):
    return _compute(db, data_de, data_ate, idempresa, idequipamento, status_receber, status_pagar)


@router.get("/relatorio/pdf")
def relatorio_fluxo_caixa_pdf(
    data_de: date = Query(...),
    data_ate: date = Query(...),
    idempresa: Optional[int] = Query(None),
    idequipamento: Optional[int] = Query(None),
    status_receber: str = Query("ambas"),
    status_pagar: str = Query("ambas"),
    db: Session = Depends(get_db),
):
    data = _compute(db, data_de, data_ate, idempresa, idequipamento, status_receber, status_pagar)

    buf = BytesIO()
    rpt = FluxoCaixaReport()
    rpt.generate(
        receitas=data["receitas"],
        despesas=data["despesas"],
        total_receitas=data["total_receitas"],
        total_despesas=data["total_despesas"],
        total_recebido=data["total_recebido"],
        total_pago=data["total_pago"],
        saldo=data["saldo"],
        data_de=str(data_de),
        data_ate=str(data_ate),
        buf=buf,
    )
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=fluxo_caixa.pdf"},
    )


# ── Despesas vs Receita (DRE) ─────────────────────────────────────────────────

def _ordem_key(idfluxo: str) -> str:
    """Converts '1.2.3' → '001003004' for hierarchical sorting."""
    parts = idfluxo.split('.')
    return ''.join(p.zfill(4) for p in parts)


@router.get("/despesas-receita")
def relatorio_despesas_receita(
    data_de: date = Query(...),
    data_ate: date = Query(...),
    idempresa: Optional[int] = Query(None),
    tipo_receita: str = Query("ordens"),    # ordens | fat_gerados | fat_recebidos
    tipo_despesa: str = Query("vencidas"),  # vencidas | pagas
    db: Session = Depends(get_db),
):
    # 1. Load all FluxoFinanceiro into DRE structure
    # idfluxo and fluxo_pai are stripped to guard against legacy trailing spaces
    all_fluxo = db.query(models.FluxoFinanceiro).all()
    dre: dict[str, dict] = {
        f.idfluxo.strip(): {
            "idfluxo":   f.idfluxo.strip(),
            "descricao": f.descricao or "",
            "nivel":     f.nivel or 0,
            "fluxo_pai": (f.fluxo_pai or "").strip(),
            "valor":     0.0,
        }
        for f in all_fluxo
    }

    def add_value(leaf_idfluxo: str, valor: float) -> None:
        current = leaf_idfluxo.strip() if leaf_idfluxo else ""
        visited: set[str] = set()
        while current and current in dre and current not in visited:
            visited.add(current)
            dre[current]["valor"] += valor
            current = dre[current]["fluxo_pai"]

    total_receitas = 0.0
    total_despesas = 0.0

    # 2. Despesas — via contas_pagar → compras → fluxo
    if tipo_despesa == "vencidas":
        # Todas as contas a pagar com vencimento no período, independente do status
        q = (
            db.query(models.ContasPagar.valor, models.Compra.idfluxo)
            .join(models.Compra, models.ContasPagar.idcompras == models.Compra.idcompras)
            .filter(
                models.ContasPagar.vencimento >= data_de,
                models.ContasPagar.vencimento <= data_ate,
                models.Compra.idfluxo.isnot(None),
            )
        )
        if idempresa:
            q = q.filter(models.Compra.idempresa == idempresa)
        for row in q.all():
            key = (row.idfluxo or "").strip()
            if not key or key not in dre:
                continue
            v = float(row.valor or 0)
            add_value(key, -v)
            total_despesas += v
    else:  # pagas
        # Contas a pagar com vencimento no período e status PAGO (situacao=True)
        q = (
            db.query(models.ContasPagar.valor_pago, models.Compra.idfluxo)
            .join(models.Compra, models.ContasPagar.idcompras == models.Compra.idcompras)
            .filter(
                models.ContasPagar.vencimento >= data_de,
                models.ContasPagar.vencimento <= data_ate,
                models.ContasPagar.situacao == True,   # noqa: E712
                models.ContasPagar.valor_pago.isnot(None),
                models.Compra.idfluxo.isnot(None),
            )
        )
        if idempresa:
            q = q.filter(models.Compra.idempresa == idempresa)
        for row in q.all():
            key = (row.idfluxo or "").strip()
            if not key or key not in dre:
                continue
            v = float(row.valor_pago or 0)
            add_value(key, -v)
            total_despesas += v

    # 3. Receitas
    if tipo_receita == "ordens":
        q = (
            db.query(models.Ordem.valor_os, models.Ordem.idfluxo)
            .filter(
                models.Ordem.data >= data_de,
                models.Ordem.data <= data_ate,
                models.Ordem.idfluxo.isnot(None),
            )
        )
        if idempresa:
            q = q.filter(models.Ordem.idempresa == idempresa)
        for row in q.all():
            key = (row.idfluxo or "").strip()
            if not key or key not in dre:
                continue
            v = float(row.valor_os or 0)
            add_value(key, v)
            total_receitas += v
    elif tipo_receita == "fat_gerados":
        # Subquery: one idfluxo per fechamento (first ordem by idordem) — mirrors Progress "FIND FIRST ORDEM"
        fluxo_por_fech = (
            db.query(models.Ordem.idfechamento, models.Ordem.idfluxo)
            .filter(
                models.Ordem.idfechamento.isnot(None),
                models.Ordem.idfluxo.isnot(None),
            )
            .order_by(models.Ordem.idfechamento, models.Ordem.idordem)
            .distinct(models.Ordem.idfechamento)
            .subquery()
        )
        q = (
            db.query(models.ContasReceber.valor, fluxo_por_fech.c.idfluxo)
            .join(fluxo_por_fech, models.ContasReceber.idfechamento == fluxo_por_fech.c.idfechamento)
            .filter(
                models.ContasReceber.vencimento >= data_de,
                models.ContasReceber.vencimento <= data_ate,
            )
        )
        if idempresa:
            q = q.join(
                models.Fechamento,
                models.ContasReceber.idfechamento == models.Fechamento.idfechamento,
            ).filter(models.Fechamento.idempresa == idempresa)
        for row in q.all():
            key = (row.idfluxo or "").strip()
            if not key or key not in dre:
                continue
            v = float(row.valor or 0)
            add_value(key, v)
            total_receitas += v
    else:  # fat_recebidos
        fluxo_por_fech = (
            db.query(models.Ordem.idfechamento, models.Ordem.idfluxo)
            .filter(
                models.Ordem.idfechamento.isnot(None),
                models.Ordem.idfluxo.isnot(None),
            )
            .order_by(models.Ordem.idfechamento, models.Ordem.idordem)
            .distinct(models.Ordem.idfechamento)
            .subquery()
        )
        q = (
            db.query(models.ContasReceber.valor_pago, fluxo_por_fech.c.idfluxo)
            .join(fluxo_por_fech, models.ContasReceber.idfechamento == fluxo_por_fech.c.idfechamento)
            .filter(
                models.ContasReceber.ultimo_pagamento >= data_de,
                models.ContasReceber.ultimo_pagamento <= data_ate,
                models.ContasReceber.valor_pago.isnot(None),
            )
        )
        if idempresa:
            q = q.join(
                models.Fechamento,
                models.ContasReceber.idfechamento == models.Fechamento.idfechamento,
            ).filter(models.Fechamento.idempresa == idempresa)
        for row in q.all():
            key = (row.idfluxo or "").strip()
            if not key or key not in dre:
                continue
            v = float(row.valor_pago or 0)
            add_value(key, v)
            total_receitas += v

    # 4. Build sorted list of non-zero items
    items = [
        {
            "idfluxo":  v["idfluxo"],
            "descricao": v["descricao"],
            "nivel":    v["nivel"],
            "valor":    round(v["valor"], 2),
            "ordem":    _ordem_key(v["idfluxo"]),
        }
        for v in dre.values()
        if round(v["valor"], 2) != 0.0
    ]
    items.sort(key=lambda x: x["ordem"])

    return {
        "items":          items,
        "total_receitas": round(total_receitas, 2),
        "total_despesas": round(total_despesas, 2),
        "resultado":      round(total_receitas - total_despesas, 2),
    }
