"""
orcamento_report.py — Proposta de Orçamento (layout moderno, portrait A4)

Seções:
  1. Identificação: Logo (esq) | Dados empresa (dir) | Nº Proposta / Data / Status
  2. Cliente: Nome, CNPJ/CPF, Contato, Endereço, Telefone, E-mail
  3. Detalhamento: Local serviço, Local entrega, Descrição
  4. Serviços: Grid de itens + Valor total + Forma de pagamento
  5. Cláusulas do contrato (condicional — omitido se não houver contrato)
  6. Assinatura: Empresa/Funcionário (esq) | Cliente/CNPJ (dir)
"""

from __future__ import annotations

from io import BytesIO
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ── Paleta ────────────────────────────────────────────────────────────────────
C_RED      = colors.HexColor("#B21212")
C_DARK     = colors.HexColor("#1E293B")
C_SLATE    = colors.HexColor("#64748B")
C_LIGHT    = colors.HexColor("#F1F5F9")
C_WHITE    = colors.white
C_GRID     = colors.HexColor("#CBD5E1")
C_ALT      = colors.HexColor("#F8FAFC")
C_TOTAL    = colors.HexColor("#FFF7F7")

SIT_COLORS = {
    "APROVADO":  (colors.HexColor("#DCFCE7"), colors.HexColor("#166534")),
    "REJEITADO": (colors.HexColor("#FEE2E2"), colors.HexColor("#991B1B")),
    "PENDENTE":  (colors.HexColor("#F1F5F9"), colors.HexColor("#475569")),
}

F_NORMAL = "Helvetica"
F_BOLD   = "Helvetica-Bold"

MARGIN = 1.5 * cm


# ── Helpers tipográficos ───────────────────────────────────────────────────────

def _p(text, font=F_NORMAL, size=8, color=C_DARK, leading=11, **kwargs) -> Paragraph:
    style = ParagraphStyle("_dyn", fontName=font, fontSize=size,
                           textColor=color, leading=leading, **kwargs)
    safe = str(text or "—").replace("\r\n", "\n").replace("\r", "\n").replace("\n", "<br/>")
    return Paragraph(safe, style)


def _sec_header(text: str, available_w: float) -> Table:
    """Barra de seção: fundo escuro, texto branco em negrito."""
    cell = _p(text, font=F_BOLD, size=8, color=C_WHITE, leading=12)
    tbl = Table([[cell]], colWidths=[available_w])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), C_DARK),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
    ]))
    return tbl


def _brl(v) -> str:
    try:
        val = float(v or 0)
    except Exception:
        val = 0.0
    s = f"{abs(val):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {s}"


def _fmt_date(d) -> str:
    if not d:
        return "—"
    try:
        if hasattr(d, "strftime"):
            return d.strftime("%d/%m/%Y")
        y, m, day = str(d).split("-")
        return f"{day}/{m}/{y}"
    except Exception:
        return str(d)


def _qty(v) -> str:
    try:
        f = float(v or 0)
        return f"{f:g}"
    except Exception:
        return "0"


# ── Classe principal ───────────────────────────────────────────────────────────

class OrcamentoReport:
    """Gera o PDF de proposta de orçamento no buffer fornecido."""

    def generate(self, orc, buf: BytesIO) -> None:
        page_w, _ = A4
        available_w = page_w - 2 * MARGIN

        doc = SimpleDocTemplate(
            buf,
            pagesize=A4,
            leftMargin=MARGIN,
            rightMargin=MARGIN,
            topMargin=MARGIN,
            bottomMargin=MARGIN,
        )

        elems = []

        empresa    = orc.empresa_rel
        cliente    = orc.cliente_rel
        funcionario = orc.funcionario_rel
        contrato   = orc.contrato_rel

        # ── 1. IDENTIFICAÇÃO ─────────────────────────────────────────────────
        # -- Logo: 40% do tamanho físico real (usando DPI da imagem)
        MAX_LOGO_H = 2.2 * cm   # altura máxima no cabeçalho
        logo_w_pt  = 0.0        # será preenchido se houver logo

        logo_cell: object = _p(
            empresa.nomefantasia or empresa.nome if empresa else "EMPRESA",
            font=F_BOLD, size=13, color=C_RED, leading=15,
        )
        if empresa and empresa.logo:
            try:
                from PIL import Image as PILImage
                logo_bytes = bytes(empresa.logo)
                pil_img = PILImage.open(BytesIO(logo_bytes))
                px_w, px_h = pil_img.size
                raw_dpi = pil_img.info.get("dpi", (72, 72))
                dpi_x   = max(float(raw_dpi[0]), 1.0)
                dpi_y   = max(float(raw_dpi[1]), 1.0)

                # Tamanho físico em pontos ReportLab (72pt = 1 polegada)
                nat_w = px_w / dpi_x * 72
                nat_h = px_h / dpi_y * 72

                # 40% do tamanho original impresso
                tgt_w = nat_w * 0.4
                tgt_h = nat_h * 0.4

                # Limita pela altura máxima do cabeçalho preservando proporção
                if tgt_h > MAX_LOGO_H:
                    ratio = MAX_LOGO_H / tgt_h
                    tgt_w *= ratio
                    tgt_h  = MAX_LOGO_H

                img = Image(BytesIO(logo_bytes), width=tgt_w, height=tgt_h)
                img.hAlign = "LEFT"
                logo_cell = img
                logo_w_pt = tgt_w
            except Exception:
                pass  # fallback: nome da empresa em texto

        # Largura dinâmica da coluna do logo (garante encaixe)
        logo_col_w = max(logo_w_pt + 0.4 * cm, available_w * 0.18)
        rest_w     = available_w - logo_col_w

        # -- Dados da empresa
        co_lines: list[Paragraph] = []
        if empresa:
            co_lines.append(_p(empresa.nome or "—", font=F_BOLD, size=10, color=C_DARK, leading=13))
            if empresa.nomefantasia:
                co_lines.append(_p(empresa.nomefantasia, size=8, color=C_SLATE))
            if empresa.cnpj:
                co_lines.append(_p(f"CNPJ: {empresa.cnpj}", size=8, color=C_SLATE))
            if empresa.logradouro:
                addr = (
                    f"{empresa.tipo_logradouro or ''} {empresa.logradouro}, "
                    f"{empresa.numero or 's/n'}"
                ).strip().lstrip(", ")
                co_lines.append(_p(addr, size=8, color=C_SLATE))

        co_inner = Table(
            [[line] for line in co_lines],
            colWidths=[rest_w * 0.52],
        )
        co_inner.setStyle(TableStyle([
            ("TOPPADDING",    (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ]))

        # -- Bloco proposta (direita)
        situacao = (orc.situacao or "PENDENTE").upper()
        sit_bg, sit_fg = SIT_COLORS.get(situacao, SIT_COLORS["PENDENTE"])

        prop_items = [
            [_p("PROPOSTA DE ORÇAMENTO", font=F_BOLD, size=13, color=C_RED,
                leading=16, alignment=2)],
            [_p(f"Nº {orc.idorcamento:04d}", font=F_BOLD, size=10, color=C_DARK,
                leading=13, alignment=2)],
            [_p(f"Data: {_fmt_date(orc.data)}", size=8, color=C_SLATE, alignment=2)],
            [_p(f"Emissão: {datetime.now().strftime('%d/%m/%Y %H:%M')}",
                size=8, color=C_SLATE, alignment=2)],
        ]
        prop_tbl = Table(prop_items, colWidths=[rest_w * 0.48])
        prop_tbl.setStyle(TableStyle([
            ("TOPPADDING",    (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ]))

        # -- Linha de cabeçalho (coluna do logo tem largura dinâmica)
        header_tbl = Table(
            [[logo_cell, co_inner, prop_tbl]],
            colWidths=[logo_col_w, rest_w * 0.52, rest_w * 0.48],
        )
        header_tbl.setStyle(TableStyle([
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
            ("TOPPADDING",    (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        elems.append(header_tbl)
        elems.append(Spacer(1, 0.25 * cm))

        # -- Badge de status
        sit_badge = Table(
            [[_p(situacao, font=F_BOLD, size=8, color=sit_fg)]],
            colWidths=[3.2 * cm],
        )
        sit_badge.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), sit_bg),
            ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
            ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ]))
        sit_row = Table(
            [[sit_badge, ""]],
            colWidths=[3.5 * cm, available_w - 3.5 * cm],
        )
        sit_row.setStyle(TableStyle([
            ("LEFTPADDING",  (0, 0), (-1, -1), 0),
            ("TOPPADDING",   (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 0),
        ]))
        elems.append(sit_row)
        elems.append(HRFlowable(
            width="100%", thickness=1.5, color=C_RED,
            spaceBefore=0.25 * cm, spaceAfter=0.3 * cm,
        ))

        # ── helper: célula com label em cima e valor embaixo ─────────────────
        def _field(label: str, value, bold_value: bool = False, col_w=None) -> list:
            """Retorna lista de Paragraphs [label, valor] para empilhar na célula.
            Usar lista em vez de Table aninhada garante que o Paragraph herde
            a largura da célula externa (inclusive células com SPAN)."""
            lbl = _p(label, font=F_BOLD, size=6.5, color=C_SLATE, leading=9)
            val = _p(value,
                     font=F_BOLD if bold_value else F_NORMAL,
                     size=9 if bold_value else 8,
                     color=C_DARK,
                     leading=12)
            return [lbl, val]

        _cell_style = TableStyle([
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("LINEBELOW",     (0, 0), (-1, -1), 0.3, C_GRID),
            ("BOX",           (0, 0), (-1, -1), 0.5, C_GRID),
            ("BACKGROUND",    (0, 0), (-1, -1), C_WHITE),
        ])

        # ── 2. CLIENTE ────────────────────────────────────────────────────────
        elems.append(_sec_header("CLIENTE", available_w))
        elems.append(Spacer(1, 0.15 * cm))

        c3 = available_w / 3   # largura de cada uma das 3 colunas

        cli_nome   = orc.nome or (cliente.nome if cliente else None)
        cli_cnpj   = orc.cnpj_cpf or (cliente.cnpj_cpf if cliente else None)
        cli_contato = orc.contato or (cliente.contato if cliente else None)

        cli_rows = [
            [
                _field("NOME", cli_nome, bold_value=True),
                _field("CNPJ / CPF", cli_cnpj),
                _field("CONTATO", cli_contato),
            ],
            [
                _field("ENDEREÇO", orc.endereco),
                _field("CIDADE / ESTADO", orc.cidade),
                _field("CEP", orc.cep),
            ],
            [
                _field("TELEFONE", orc.fone),
                _field("E-MAIL", orc.email),
                "",
            ],
        ]

        cli_tbl = Table(cli_rows, colWidths=[c3, c3, c3])
        cli_tbl.setStyle(_cell_style)
        elems.append(cli_tbl)
        elems.append(Spacer(1, 0.3 * cm))

        # ── 3. DETALHAMENTO ───────────────────────────────────────────────────
        elems.append(_sec_header("DETALHAMENTO", available_w))
        elems.append(Spacer(1, 0.15 * cm))

        half = available_w / 2

        det_rows = [
            [
                _field("LOCAL DO SERVIÇO", orc.local_servico),
                _field("LOCAL DE ENTREGA", orc.local_entrega),
            ],
            [
                _field("DESCRIÇÃO DO SERVIÇO", orc.descricao),
                "",
            ],
        ]

        det_tbl = Table(det_rows, colWidths=[half, half])
        det_style = TableStyle([
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("LINEBELOW",     (0, 0), (-1, -1), 0.3, C_GRID),
            ("BOX",           (0, 0), (-1, -1), 0.5, C_GRID),
            ("BACKGROUND",    (0, 0), (-1, -1), C_WHITE),
            ("SPAN",          (0, 1), (1, 1)),   # descrição ocupa linha inteira
        ])
        det_tbl.setStyle(det_style)
        elems.append(det_tbl)
        elems.append(Spacer(1, 0.3 * cm))

        # ── 4. SERVIÇOS ───────────────────────────────────────────────────────
        elems.append(_sec_header("SERVIÇOS", available_w))
        elems.append(Spacer(1, 0.15 * cm))

        itens = orc.itens or []

        svc_headers = [
            "DESCRIÇÃO DO SERVIÇO", "UNIDADE", "QUANTIDADE",
            "VALOR UNITÁRIO", "VALOR TOTAL",
        ]
        svc_col_w = [
            available_w * 0.40,
            available_w * 0.11,
            available_w * 0.13,
            available_w * 0.18,
            available_w * 0.18,
        ]

        def _svc_row(item, bg):
            nome = (
                item.nome_item
                or (item.servico_rel.descricao if item.servico_rel else None)
                or "—"
            )
            return [
                Paragraph(nome, ParagraphStyle("sc", fontName=F_NORMAL, fontSize=8,
                                               textColor=C_DARK, leading=11)),
                _p(item.unidade or "—", size=8, alignment=1),
                _p(_qty(item.quantidade), size=8, alignment=1),
                _p(_brl(item.valor_unitario), size=8, alignment=2),
                _p(_brl(item.valor_total), size=8, alignment=2),
            ], bg

        svc_data_rows = []
        if itens:
            for i, item in enumerate(itens):
                row, bg = _svc_row(item, C_ALT if i % 2 == 1 else C_WHITE)
                svc_data_rows.append((row, bg))
        else:
            svc_data_rows.append(([
                _p("Nenhum item cadastrado", size=8, color=C_SLATE),
                "", "", "", "",
            ], C_WHITE))

        header_row = [
            Paragraph(f"<b>{h}</b>", ParagraphStyle(
                "sh", fontName=F_BOLD, fontSize=8,
                textColor=C_WHITE, leading=11,
            ))
            for h in svc_headers
        ]

        svc_table_data = [header_row] + [r for r, _ in svc_data_rows]
        svc_tbl = Table(svc_table_data, colWidths=svc_col_w, repeatRows=1)

        svc_style_cmds = [
            # Cabeçalho
            ("BACKGROUND",    (0, 0), (-1, 0), C_RED),
            ("TOPPADDING",    (0, 0), (-1, 0), 6),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
            ("LEFTPADDING",   (0, 0), (-1, 0), 6),
            ("RIGHTPADDING",  (0, 0), (-1, 0), 6),
            ("ALIGN",         (1, 0), (-1, 0), "CENTER"),
            # Dados
            ("TOPPADDING",    (0, 1), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
            ("LEFTPADDING",   (0, 1), (-1, -1), 6),
            ("RIGHTPADDING",  (0, 1), (-1, -1), 6),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("GRID",          (0, 0), (-1, -1), 0.3, C_GRID),
        ]
        for i, (_, bg) in enumerate(svc_data_rows):
            svc_style_cmds.append(("BACKGROUND", (0, i + 1), (-1, i + 1), bg))

        svc_tbl.setStyle(TableStyle(svc_style_cmds))
        elems.append(svc_tbl)

        # Total geral
        total_val = sum(float(i.valor_total or 0) for i in itens)
        total_row = Table(
            [[
                "",
                _p("VALOR TOTAL DO SERVIÇO", font=F_BOLD, size=9, color=C_DARK, alignment=2),
                _p(_brl(total_val), font=F_BOLD, size=10, color=C_RED, alignment=2),
            ]],
            colWidths=[
                available_w * 0.54,
                available_w * 0.28,
                available_w * 0.18,
            ],
        )
        total_row.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), C_TOTAL),
            ("TOPPADDING",    (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING",   (0, 0), (-1, -1), 6),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
            ("LINEABOVE",     (0, 0), (-1, 0), 1.5, C_RED),
            ("LINEBELOW",     (0, 0), (-1, 0), 0.5, C_GRID),
            ("BOX",           (0, 0), (-1, -1), 0.5, C_GRID),
        ]))
        elems.append(total_row)

        # Forma de pagamento — sempre exibida, vem do registro do orçamento
        pgto_row = Table(
            [
                [_p("FORMA DE PAGAMENTO", font=F_BOLD, size=9, color=C_DARK, leading=12)],
                [_p(orc.forma_pagamento, font=F_BOLD, size=13, color=C_RED, leading=16)],
            ],
            colWidths=[available_w],
        )
        pgto_row.setStyle(TableStyle([
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
            ("BOX",           (0, 0), (-1, -1), 0.5, C_GRID),
            ("BACKGROUND",    (0, 0), (-1, -1), C_LIGHT),
        ]))
        elems.append(Spacer(1, 0.1 * cm))
        elems.append(pgto_row)

        elems.append(Spacer(1, 0.35 * cm))

        # ── 5. CLÁUSULAS (condicional) ────────────────────────────────────────
        if contrato and contrato.clausulas:
            title = f"CLÁUSULAS DO CONTRATO  —  {contrato.descricao or ''}"
            elems.append(_sec_header(title, available_w))
            elems.append(Spacer(1, 0.15 * cm))

            cls_style = ParagraphStyle(
                "cls",
                fontName=F_NORMAL,
                fontSize=8,
                textColor=C_DARK,
                leading=12,
                leftIndent=6,
                rightIndent=6,
                alignment=4,   # TA_JUSTIFY
            )

            raw = str(contrato.clausulas).replace("\r\n", "\n").replace("\r", "\n")
            for line in raw.split("\n"):
                stripped = line.strip()
                if stripped:
                    elems.append(Paragraph(stripped, cls_style))
                else:
                    elems.append(Spacer(1, 0.15 * cm))

            elems.append(Spacer(1, 0.4 * cm))
        else:
            elems.append(Spacer(1, 0.1 * cm))

        # ── 6. ASSINATURA ────────────────────────────────────────────────────
        sec_num = 6 if (contrato and contrato.clausulas) else 5
        elems.append(_sec_header(f"ASSINATURA E ACEITE", available_w))
        elems.append(Spacer(1, 3 * 0.423 * cm))   # 3 linhas (~12pt cada)

        empresa_nome = (empresa.nomefantasia or empresa.nome) if empresa else "—"
        func_nome    = funcionario.nome if funcionario else "—"
        cli_nome     = orc.nome or (cliente.nome if cliente else "—")
        cli_cnpj     = orc.cnpj_cpf or (cliente.cnpj_cpf if cliente else "—")

        sig_half = available_w * 0.48
        sig_gap  = available_w * 0.04

        sig_data = [
            [
                _p(empresa_nome, font=F_BOLD, size=9, color=C_DARK, alignment=1),
                _p(cli_nome, font=F_BOLD, size=9, color=C_DARK, alignment=1),
            ],
            [
                _p(func_nome, font=F_NORMAL, size=8, color=C_SLATE, alignment=1),
                _p(f"CNPJ / CPF: {cli_cnpj}", font=F_NORMAL, size=8, color=C_SLATE, alignment=1),
            ],
        ]

        sig_tbl = Table(
            sig_data,
            colWidths=[sig_half, sig_half],
        )
        sig_tbl.setStyle(TableStyle([
            ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
            ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("RIGHTPADDING",  (0, 0), (0, -1), sig_gap / 2),
            ("LEFTPADDING",   (1, 0), (1, -1), sig_gap / 2),
        ]))

        # Centraliza na largura disponível com gap visual
        outer_sig = Table(
            [[sig_tbl]],
            colWidths=[available_w],
            hAlign="CENTER",
        )
        outer_sig.setStyle(TableStyle([
            ("LEFTPADDING",  (0, 0), (-1, -1), sig_gap / 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), sig_gap / 2),
        ]))
        elems.append(outer_sig)

        # ── Rodapé de página ──────────────────────────────────────────────────
        def _add_footer(canvas, doc):
            canvas.saveState()
            canvas.setFont(F_NORMAL, 7)
            canvas.setFillColor(C_SLATE)
            page_w_pt, _ = A4
            y = 0.6 * cm
            canvas.drawString(MARGIN, y,
                              datetime.now().strftime("%d/%m/%Y %H:%M"))
            canvas.drawCentredString(page_w_pt / 2, y, "DECISIUM Software")
            canvas.drawRightString(page_w_pt - MARGIN, y,
                                   f"Página {doc.page}")
            canvas.restoreState()

        doc.build(elems, onFirstPage=_add_footer, onLaterPages=_add_footer)
