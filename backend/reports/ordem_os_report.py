"""
ordem_os_report.py — Impressão de Ordem de Serviço (layout moderno, portrait A4)

Seções:
  1. Identificação: Logo (esq) | Dados empresa (centro) | Nº OS / Data / Status (dir)
  2. Informações Gerais: Cliente, Empresa, Orçamento origem, Fechamento
  3. Descrição do Serviço: Tipo + Detalhes
  4. Localização: Local/Cidade serviço e entrega
  5. Frete: KM, valores, pedagio, escolta, seguro, desconto
  6. Dados do Serviço: horários, horas trabalhadas, valor/hora
  7. Equipamento e Equipe: equipamento + funcionários
  8. Fluxo de Caixa: item do fluxo financeiro
  9. Total Geral: resumo financeiro em rodapé escuro
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

# ── Paleta ─────────────────────────────────────────────────────────────────────
C_RED   = colors.HexColor("#B21212")
C_DARK  = colors.HexColor("#1E293B")
C_SLATE = colors.HexColor("#64748B")
C_LIGHT = colors.HexColor("#F1F5F9")
C_WHITE = colors.white
C_GRID  = colors.HexColor("#CBD5E1")
C_ALT   = colors.HexColor("#F8FAFC")
C_TOTAL = colors.HexColor("#111827")

SIT_COLORS = {
    True:  (colors.HexColor("#DCFCE7"), colors.HexColor("#166534")),
    False: (colors.HexColor("#DBEAFE"), colors.HexColor("#1D4ED8")),
}

F_NORMAL = "Helvetica"
F_BOLD   = "Helvetica-Bold"

MARGIN = 1.5 * cm


# ── Helpers tipográficos ────────────────────────────────────────────────────────

def _p(text, font=F_NORMAL, size=8, color=C_DARK, leading=11, **kwargs) -> Paragraph:
    style = ParagraphStyle("_dyn", fontName=font, fontSize=size,
                           textColor=color, leading=leading, **kwargs)
    safe = str(text or "—").replace("\r\n", "\n").replace("\r", "\n").replace("\n", "<br/>")
    return Paragraph(safe, style)


def _sec_header(text: str, available_w: float) -> Table:
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


def _fmt_time(t) -> str:
    if not t or t in ("0000", "00:00", ""):
        return "—"
    s = str(t).strip()
    if len(s) == 4 and s.isdigit():
        return f"{s[:2]}:{s[2:]}"
    return s


# ── Classe principal ────────────────────────────────────────────────────────────

class OrdemOSReport:
    """Gera o PDF de Ordem de Serviço no buffer fornecido."""

    def generate(self, ordem, func2, func3, tipo_servico, buf: BytesIO) -> None:
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

        empresa    = ordem.empresa_rel
        cliente    = ordem.cliente_rel
        equipamento = ordem.equipamento_rel
        func1      = ordem.funcionario_rel
        fluxo      = ordem.fluxo_rel

        # ── 1. IDENTIFICAÇÃO ──────────────────────────────────────────────────
        MAX_LOGO_H = 2.2 * cm
        logo_w_pt  = 0.0

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

                nat_w = px_w / dpi_x * 72
                nat_h = px_h / dpi_y * 72
                tgt_w = nat_w * 0.4
                tgt_h = nat_h * 0.4

                if tgt_h > MAX_LOGO_H:
                    ratio = MAX_LOGO_H / tgt_h
                    tgt_w *= ratio
                    tgt_h  = MAX_LOGO_H

                img = Image(BytesIO(logo_bytes), width=tgt_w, height=tgt_h)
                img.hAlign = "LEFT"
                logo_cell = img
                logo_w_pt = tgt_w
            except Exception:
                pass

        logo_col_w = max(logo_w_pt + 0.4 * cm, available_w * 0.18)
        rest_w     = available_w - logo_col_w

        # Dados da empresa (centro)
        co_lines: list[Paragraph] = []
        if empresa:
            co_lines.append(_p(empresa.nomefantasia or empresa.nome or "—",
                               font=F_BOLD, size=10, color=C_DARK, leading=13))
            if empresa.cnpj:
                co_lines.append(_p(f"CNPJ: {empresa.cnpj}", size=8, color=C_SLATE))
            if empresa.logradouro:
                addr = (
                    f"{empresa.tipo_logradouro or ''} {empresa.logradouro}, "
                    f"{empresa.numero or 's/n'}"
                ).strip().lstrip(", ")
                co_lines.append(_p(addr, size=8, color=C_SLATE))
            if empresa.ie:
                co_lines.append(_p(f"IE: {empresa.ie}", size=8, color=C_SLATE))

        co_inner = Table([[line] for line in co_lines], colWidths=[rest_w * 0.52])
        co_inner.setStyle(TableStyle([
            ("TOPPADDING",    (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ]))

        # Bloco OS (direita)
        numero_label = (
            f"#OS-{str(ordem.numero_os).zfill(4)}" if ordem.numero_os
            else f"ID #{ordem.idordem}"
        )
        os_items = [
            [_p("ORDEM DE SERVIÇO", font=F_BOLD, size=13, color=C_RED, leading=16, alignment=2)],
            [_p(numero_label, font=F_BOLD, size=10, color=C_DARK, leading=13, alignment=2)],
            [_p(f"Data: {_fmt_date(ordem.data)}", size=8, color=C_SLATE, alignment=2)],
            [_p(f"Emissão: {datetime.now().strftime('%d/%m/%Y %H:%M')}",
                size=8, color=C_SLATE, alignment=2)],
        ]
        os_tbl = Table(os_items, colWidths=[rest_w * 0.48])
        os_tbl.setStyle(TableStyle([
            ("TOPPADDING",    (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ]))

        header_tbl = Table(
            [[logo_cell, co_inner, os_tbl]],
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

        # Badge de status
        situacao = ordem.situacao
        sit_label = "FECHADA" if situacao else "ABERTA"
        sit_bg, sit_fg = SIT_COLORS.get(bool(situacao), SIT_COLORS[False])
        sit_badge = Table(
            [[_p(sit_label, font=F_BOLD, size=8, color=sit_fg)]],
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
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("TOPPADDING",    (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        elems.append(sit_row)
        elems.append(HRFlowable(
            width="100%", thickness=1.5, color=C_RED,
            spaceBefore=0.15 * cm, spaceAfter=0.2 * cm,
        ))

        # ── Helper: campo label + valor ───────────────────────────────────────
        _cell_style = TableStyle([
            ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING",   (0, 0), (-1, -1), 7),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 7),
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("LINEBELOW",     (0, 0), (-1, -1), 0.3, C_GRID),
            ("BOX",           (0, 0), (-1, -1), 0.5, C_GRID),
            ("BACKGROUND",    (0, 0), (-1, -1), C_WHITE),
        ])

        def _field(label: str, value, bold_value: bool = False) -> list:
            lbl = _p(label, font=F_BOLD, size=6, color=C_SLATE, leading=8)
            val = _p(value,
                     font=F_BOLD if bold_value else F_NORMAL,
                     size=8.5 if bold_value else 8,
                     color=C_DARK, leading=10)
            return [lbl, val]

        # ── 2. INFORMAÇÕES GERAIS ─────────────────────────────────────────────
        elems.append(_sec_header("INFORMAÇÕES GERAIS", available_w))
        elems.append(Spacer(1, 0.1 * cm))

        cli_nome = ""
        if cliente:
            cli_nome = cliente.nomefantasia or cliente.nome or ""
        emp_nome = ""
        if empresa:
            emp_nome = empresa.nomefantasia or empresa.nome or ""

        c2 = available_w / 2
        c3 = available_w / 3
        c4 = available_w / 4

        gi_rows = [
            [
                _field("CLIENTE", cli_nome, bold_value=True),
                _field("EMPRESA", emp_nome),
            ],
            [
                _field("Nº ORÇAMENTO ORIGEM",
                       str(ordem.idorcamento) if ordem.idorcamento else "—"),
                _field("Nº FECHAMENTO",
                       str(ordem.idfechamento) if ordem.idfechamento else "—"),
            ],
        ]
        gi_tbl = Table(gi_rows, colWidths=[c2, c2])
        gi_tbl.setStyle(_cell_style)
        elems.append(gi_tbl)
        elems.append(Spacer(1, 0.18 * cm))

        # ── 3. DESCRIÇÃO DO SERVIÇO ──────────────────────────────────────────
        elems.append(_sec_header("DESCRIÇÃO DO SERVIÇO", available_w))
        elems.append(Spacer(1, 0.1 * cm))

        tipo_desc = tipo_servico.descricao if tipo_servico else "—"
        ds_rows = [
            [_field("TIPO DE SERVIÇO", tipo_desc, bold_value=True)],
            [_field("DETALHES DA EXECUÇÃO", ordem.servico_prestado or "—")],
        ]
        ds_tbl = Table(ds_rows, colWidths=[available_w])
        ds_tbl.setStyle(_cell_style)
        elems.append(ds_tbl)
        elems.append(Spacer(1, 0.18 * cm))

        # ── 4. LOCALIZAÇÃO ───────────────────────────────────────────────────
        elems.append(_sec_header("LOCALIZAÇÃO DO SERVIÇO", available_w))
        elems.append(Spacer(1, 0.1 * cm))

        loc_rows = [
            [
                _field("LOCAL DO SERVIÇO",  ordem.local_servico or "—"),
                _field("CIDADE DO SERVIÇO", ordem.cidade_servico or "—"),
            ],
            [
                _field("LOCAL DE ENTREGA",  ordem.local_entrega or "—"),
                _field("CIDADE DE ENTREGA", ordem.cidade_entrega or "—"),
            ],
        ]
        loc_tbl = Table(loc_rows, colWidths=[c2, c2])
        loc_tbl.setStyle(_cell_style)
        elems.append(loc_tbl)
        elems.append(Spacer(1, 0.18 * cm))

        # ── 5. FRETE ─────────────────────────────────────────────────────────
        elems.append(_sec_header("INFORMAÇÕES DO FRETE", available_w))
        elems.append(Spacer(1, 0.1 * cm))

        km_inicio    = int(ordem.km_inicio or 0)
        km_final     = int(ordem.km_final or 0)
        km_total     = int(ordem.km_total or 0)
        valor_km     = float(ordem.valor_km or 0)
        valor_tkm    = float(ordem.valor_total_km or 0)
        pedagio      = float(ordem.pedagio or 0)
        saida        = float(ordem.saida or 0)
        escolta      = float(ordem.escolta or 0)
        seguro       = float(ordem.seguro or 0)
        desconto     = float(ordem.desconto or 0)
        valor_frete  = float(ordem.valor_frete or 0)

        frete_rows = [
            [
                _field("KM INICIAL",  str(km_inicio)),
                _field("KM FINAL",    str(km_final)),
                _field("KM TOTAL",    str(km_total)),
                _field("VALOR/KM",    _brl(valor_km)),
                _field("TOTAL KM",    _brl(valor_tkm)),
            ],
            [
                _field("PEDÁGIO",  _brl(pedagio)),
                _field("SAÍDA",    _brl(saida)),
                _field("ESCOLTA",  _brl(escolta)),
                _field("SEGURO",   _brl(seguro)),
                _field("DESCONTO", _brl(desconto)),
            ],
        ]
        frete_tbl = Table(frete_rows, colWidths=[c4 * 0.8] * 5)
        # Redefine colWidths para usar available_w dividido em 5
        frete_tbl = Table(frete_rows, colWidths=[available_w / 5] * 5)
        frete_tbl.setStyle(_cell_style)
        elems.append(frete_tbl)

        frete_total_row = Table(
            [[
                "",
                _p("VALOR TOTAL DO FRETE", font=F_BOLD, size=9, color=C_DARK, alignment=2),
                _p(_brl(valor_frete), font=F_BOLD, size=10, color=C_RED, alignment=2),
            ]],
            colWidths=[available_w * 0.54, available_w * 0.28, available_w * 0.18],
        )
        frete_total_row.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), colors.HexColor("#FFF7F7")),
            ("TOPPADDING",    (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING",   (0, 0), (-1, -1), 6),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
            ("LINEABOVE",     (0, 0), (-1, 0), 1.5, C_RED),
            ("BOX",           (0, 0), (-1, -1), 0.5, C_GRID),
        ]))
        elems.append(frete_total_row)
        elems.append(Spacer(1, 0.18 * cm))

        # ── 6. DADOS DO SERVIÇO ──────────────────────────────────────────────
        elems.append(_sec_header("DADOS DO SERVIÇO", available_w))
        elems.append(Spacer(1, 0.1 * cm))

        inicio_01  = _fmt_time(ordem.inicio_01)
        termino_01 = _fmt_time(ordem.termino_01)
        inicio_02  = _fmt_time(ordem.inicio_02)
        termino_02 = _fmt_time(ordem.termino_02)
        total_horas = float(ordem.total_horas or 0)
        valor_hora  = float(ordem.valor_hora or 0)
        valor_servicos = float(ordem.valor_servicos or 0)

        svc_rows = [
            [
                _field("HORA INICIAL 1",  inicio_01),
                _field("HORA FINAL 1",    termino_01),
                _field("HORA INICIAL 2",  inicio_02),
                _field("HORA FINAL 2",    termino_02),
            ],
        ]
        svc_tbl = Table(svc_rows, colWidths=[c4] * 4)
        svc_tbl.setStyle(_cell_style)
        elems.append(svc_tbl)

        svc_total_row = Table(
            [[
                _field("HORAS TRABALHADAS", f"{total_horas:.2f}h", bold_value=True),
                _field("VALOR POR HORA", _brl(valor_hora), bold_value=True),
                _p("VALOR TOTAL DO SERVIÇO", font=F_BOLD, size=9, color=C_DARK, alignment=2),
                _p(_brl(valor_servicos), font=F_BOLD, size=10, color=C_RED, alignment=2),
            ]],
            colWidths=[c4, c4, c4 * 0.9, c4 * 1.1],
        )
        svc_total_row.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), colors.HexColor("#F8FAFF")),
            ("TOPPADDING",    (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
            ("LINEABOVE",     (0, 0), (-1, 0), 1.5, C_RED),
            ("BOX",           (0, 0), (-1, -1), 0.5, C_GRID),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ]))
        elems.append(svc_total_row)
        elems.append(Spacer(1, 0.18 * cm))

        # ── 7. EQUIPAMENTO E EQUIPE ───────────────────────────────────────────
        elems.append(_sec_header("EQUIPAMENTO E EQUIPE", available_w))
        elems.append(Spacer(1, 0.1 * cm))

        equip_nome = "—"
        if equipamento:
            equip_nome = equipamento.nome or ""
            if equipamento.placa:
                equip_nome += f" — {equipamento.placa}"

        func1_nome = func1.nome if func1 else "—"
        func2_nome = func2.nome if func2 else "—"
        func3_nome = func3.nome if func3 else "—"

        eq_rows = [
            [
                _field("EQUIPAMENTO",   equip_nome, bold_value=True),
                _field("FUNCIONÁRIO 1", func1_nome),
                _field("FUNCIONÁRIO 2", func2_nome),
                _field("FUNCIONÁRIO 3", func3_nome),
            ],
        ]
        eq_tbl = Table(eq_rows, colWidths=[c4] * 4)
        eq_tbl.setStyle(_cell_style)
        elems.append(eq_tbl)
        elems.append(Spacer(1, 0.2 * cm))

        # ── 8. TOTAL GERAL ───────────────────────────────────────────────────
        valor_os = float(ordem.valor_os or 0)
        total_tbl = Table(
            [[
                _p("RESUMO DA ORDEM DE SERVIÇO  —  Frete + Serviços",
                   font=F_BOLD, size=8, color=colors.HexColor("#94A3B8"), leading=11),
                _p(_brl(valor_os), font=F_BOLD, size=14,
                   color=colors.HexColor("#34D399"), alignment=2, leading=18),
            ]],
            colWidths=[available_w * 0.6, available_w * 0.4],
        )
        total_tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), C_TOTAL),
            ("TOPPADDING",    (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ("LEFTPADDING",   (0, 0), (-1, -1), 16),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 16),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ]))
        elems.append(total_tbl)
        elems.append(Spacer(1, 0.35 * cm))

        # ── 9. OBSERVAÇÕES ───────────────────────────────────────────────────
        elems.append(_sec_header("OBSERVAÇÕES", available_w))
        elems.append(Spacer(1, 0.1 * cm))

        LINE_H = 0.75 * cm
        N_LINES = 2
        obs_rows = [[""] for _ in range(N_LINES)]
        obs_tbl = Table(obs_rows, colWidths=[available_w], rowHeights=[LINE_H] * N_LINES)
        obs_style = TableStyle([
            ("BOX",           (0, 0), (-1, -1), 0.5, C_GRID),
            ("LINEBELOW",     (0, 0), (-1, -2), 0.4, C_GRID),
            ("BACKGROUND",    (0, 0), (-1, -1), C_WHITE),
            ("TOPPADDING",    (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ])
        obs_tbl.setStyle(obs_style)
        elems.append(obs_tbl)

        # ── Rodapé de página ─────────────────────────────────────────────────
        def _add_footer(canvas, doc):
            canvas.saveState()
            canvas.setFont(F_NORMAL, 7)
            canvas.setFillColor(C_SLATE)
            page_w_pt, _ = A4
            y = 0.6 * cm
            canvas.drawString(MARGIN, y, datetime.now().strftime("%d/%m/%Y %H:%M"))
            canvas.drawCentredString(page_w_pt / 2, y, "DECISIUM Software")
            canvas.drawRightString(page_w_pt - MARGIN, y, f"Página {doc.page}")
            canvas.restoreState()

        doc.build(elems, onFirstPage=_add_footer, onLaterPages=_add_footer)
