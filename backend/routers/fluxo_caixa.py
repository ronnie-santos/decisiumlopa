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
