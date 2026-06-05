"""
conciliacao.py — Relatório de Conciliação Bancária
Extrato de despesas pagas por período, via pagamentos_cp.
Fonte: pagamentos_cp → forma_pagamento, contas_pagar → compras → empresa, fornecedor.
"""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import date
from io import BytesIO
from itertools import groupby

import models
from database import get_db
from reports.conciliacao_report import ConciliacaoReport

router = APIRouter(prefix="/conciliacao", tags=["conciliacao"])


def _fmt_date(d) -> str | None:
    return str(d) if d else None


def _to_float(v) -> float:
    return float(v) if v is not None else 0.0


def _query_pagamentos(
    db: Session,
    data_de: date,
    data_ate: date,
    idempresa: Optional[int],
    idformapgto: Optional[int],
) -> list[dict]:
    q = (
        db.query(
            models.PagamentosCP.data,
            models.PagamentosCP.valor,
            models.FormaPagamento.nome.label("forma_pagamento"),
            func.coalesce(
                models.Fornecedor.nomefantasia,
                models.Fornecedor.nome,
            ).label("fornecedor"),
            models.Compra.nota,
            func.coalesce(
                models.Empresa.nomefantasia,
                models.Empresa.nome,
            ).label("empresa"),
        )
        .join(
            models.FormaPagamento,
            models.PagamentosCP.idformapgto == models.FormaPagamento.idformapgto,
        )
        .join(
            models.ContasPagar,
            models.PagamentosCP.idcontaspagar == models.ContasPagar.idcontaspagar,
        )
        .outerjoin(models.Compra, models.ContasPagar.idcompras == models.Compra.idcompras)
        .outerjoin(models.Empresa, models.Compra.idempresa == models.Empresa.idempresa)
        .outerjoin(
            models.Fornecedor,
            models.Compra.idfornecedor == models.Fornecedor.idfornecedor,
        )
        .filter(
            models.PagamentosCP.data >= data_de,
            models.PagamentosCP.data <= data_ate,
        )
    )

    if idempresa:
        q = q.filter(models.Compra.idempresa == idempresa)

    if idformapgto:
        q = q.filter(models.PagamentosCP.idformapgto == idformapgto)

    rows = q.order_by(
        models.PagamentosCP.data,
        models.FormaPagamento.nome,
        models.PagamentosCP.valor,
    ).all()

    return [
        {
            "data": _fmt_date(r.data),
            "forma_pagamento": r.forma_pagamento or "—",
            "fornecedor": r.fornecedor or "—",
            "documento": r.nota or "—",
            "empresa": r.empresa or "—",
            "valor": _to_float(r.valor),
        }
        for r in rows
    ]


def _compute(
    db: Session,
    data_de: date,
    data_ate: date,
    idempresa: Optional[int],
    idformapgto: Optional[int],
) -> dict:
    items = _query_pagamentos(db, data_de, data_ate, idempresa, idformapgto)

    grupos = []
    for (data_key, forma_key), grp_iter in groupby(
        items, key=lambda x: (x["data"], x["forma_pagamento"])
    ):
        grp = list(grp_iter)
        subtotal = round(sum(i["valor"] for i in grp), 2)
        grupos.append({
            "data": data_key,
            "forma_pagamento": forma_key,
            "items": grp,
            "subtotal": subtotal,
            "qtd": len(grp),
        })

    total_geral = round(sum(g["subtotal"] for g in grupos), 2)
    qtd_registros = sum(g["qtd"] for g in grupos)

    return {
        "grupos": grupos,
        "total_geral": total_geral,
        "qtd_registros": qtd_registros,
    }


@router.get("/relatorio")
def relatorio_conciliacao(
    data_de: date = Query(...),
    data_ate: date = Query(...),
    idempresa: Optional[int] = Query(None),
    idformapgto: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    return _compute(db, data_de, data_ate, idempresa, idformapgto)


@router.get("/relatorio/pdf")
def relatorio_conciliacao_pdf(
    data_de: date = Query(...),
    data_ate: date = Query(...),
    idempresa: Optional[int] = Query(None),
    idformapgto: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    data = _compute(db, data_de, data_ate, idempresa, idformapgto)

    buf = BytesIO()
    rpt = ConciliacaoReport()
    rpt.generate(
        grupos=data["grupos"],
        total_geral=data["total_geral"],
        qtd_registros=data["qtd_registros"],
        data_de=str(data_de),
        data_ate=str(data_ate),
        buf=buf,
    )
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=conciliacao_bancaria.pdf"},
    )
