"""
fluxo_caixa_report.py — Relatório de Fluxo de Caixa
Layout: paisagem A4.
Duas seções: ENTRADAS (Contas a Receber) e SAÍDAS (Contas a Pagar).
Rodapé com totais e saldo.
"""

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from reports.base_report import (
    BaseReport,
    MARGIN,
    HEADER_HEIGHT,
    FOOTER_HEIGHT,
    FONT_BOLD,
    FONT_NORMAL,
    COLOR_HEADER_BG,
    COLOR_ROW_ALT,
    COLOR_GRID,
    COLOR_TEXT,
)

# ── Cores ─────────────────────────────────────────────────────────────────────
COLOR_ENTRADA_BG  = colors.HexColor("#14532D")   # green-900
COLOR_SAIDA_BG    = colors.HexColor("#7F1D1D")   # red-900
COLOR_SALDO_POS   = colors.HexColor("#1E3A5F")   # blue-900
COLOR_SALDO_NEG   = colors.HexColor("#7C2D12")   # orange-900
COLOR_TOTAL_BG    = colors.HexColor("#1E293B")   # slate-800
COLOR_ABERTA      = colors.HexColor("#FFFBEB")   # amber-50
COLOR_QUITADA     = colors.HexColor("#F0FDF4")   # green-50


# ── Helpers ───────────────────────────────────────────────────────────────────
def _brl(v: float) -> str:
    neg = v < 0
    s = f"{abs(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"-R$ {s}" if neg else f"R$ {s}"


def _fmt_date(s: str | None) -> str:
    if not s:
        return "—"
    try:
        y, m, d = s.split("-")
        return f"{d}/{m}/{y}"
    except Exception:
        return str(s)


def _fmt_situacao(s) -> str:
    if s is True:
        return "Quitada"
    elif s is False:
        return "Aberta"
    return "—"


# ── Relatório ─────────────────────────────────────────────────────────────────
class FluxoCaixaReport(BaseReport):
    """Relatório de Fluxo de Caixa — Entradas e Saídas."""

    # Colunas ENTRADAS (Contas a Receber)
    COLS_E = ["Vencimento", "Cliente", "Empresa", "Equipamento", "Nº OS", "Parcela", "Valor", "Status"]
    N_COLS_E = len(COLS_E)

    # Colunas SAÍDAS (Contas a Pagar)
    COLS_S = ["Vencimento", "Fornecedor", "Empresa", "Nota", "Parcela", "Valor", "Status"]
    N_COLS_S = len(COLS_S)

    def __init__(self):
        super().__init__(title="RELATÓRIO DE FLUXO DE CAIXA", orientation="landscape")

        self._style_cell = ParagraphStyle(
            "FCCell", fontName=FONT_NORMAL, fontSize=6.5,
            textColor=COLOR_TEXT, leading=8.5, wordWrap="CJK",
        )
        self._style_hdr = ParagraphStyle(
            "FCHdr", fontName=FONT_BOLD, fontSize=6.5,
            textColor=COLOR_TEXT, leading=8.5,
        )
        self._style_section = ParagraphStyle(
            "FCSection", fontName=FONT_BOLD, fontSize=8,
            textColor=colors.white, leading=10,
        )
        self._style_total = ParagraphStyle(
            "FCTotal", fontName=FONT_BOLD, fontSize=7.5,
            textColor=colors.white, leading=10,
        )
        self._style_saldo = ParagraphStyle(
            "FCSaldo", fontName=FONT_BOLD, fontSize=9,
            textColor=colors.white, leading=12,
        )

    def _col_widths_e(self) -> list[float]:
        page_w, _ = self.pagesize
        w = page_w - 2 * MARGIN
        return [
            w * 0.08,   # Vencimento
            w * 0.22,   # Cliente
            w * 0.13,   # Empresa
            w * 0.18,   # Equipamento
            w * 0.06,   # Nº OS
            w * 0.06,   # Parcela
            w * 0.14,   # Valor
            w * 0.13,   # Status
        ]

    def _col_widths_s(self) -> list[float]:
        page_w, _ = self.pagesize
        w = page_w - 2 * MARGIN
        return [
            w * 0.08,   # Vencimento
            w * 0.26,   # Fornecedor
            w * 0.15,   # Empresa
            w * 0.12,   # Nota
            w * 0.06,   # Parcela
            w * 0.16,   # Valor
            w * 0.17,   # Status
        ]

    def _p(self, text: str, style=None) -> Paragraph:
        style = style or self._style_cell
        return Paragraph(str(text).replace("\n", "<br/>"), style)

    # ── Seção header ───────────────────────────────────────────────────────────
    def _section_header(self, label: str, bg_color, col_widths: list[float]) -> Table:
        n = len(col_widths)
        row = [self._p(label, self._style_section)] + [""] * (n - 1)
        t = Table([row], colWidths=col_widths)
        t.setStyle(TableStyle([
            ("SPAN",          (0, 0), (n - 1, 0)),
            ("BACKGROUND",    (0, 0), (n - 1, 0), bg_color),
            ("TOPPADDING",    (0, 0), (n - 1, 0), 5),
            ("BOTTOMPADDING", (0, 0), (n - 1, 0), 5),
            ("LEFTPADDING",   (0, 0), (n - 1, 0), 8),
            ("VALIGN",        (0, 0), (n - 1, 0), "MIDDLE"),
        ]))
        return t

    # ── Tabela de dados ────────────────────────────────────────────────────────
    def _entradas_table(self, rows: list[dict], col_widths: list[float]) -> Table:
        n = self.N_COLS_E
        header = [self._p(h, self._style_hdr) for h in self.COLS_E]
        data_rows = [
            [
                self._p(_fmt_date(r.get("vencimento"))),
                self._p(r.get("cliente_nome") or "—"),
                self._p(r.get("empresa_nome") or "—"),
                self._p(r.get("equipamento_nome") or "—"),
                self._p(str(r.get("numero_os") or "—")),
                self._p(r.get("parcela") or "—"),
                self._p(_brl(r.get("valor", 0))),
                self._p(_fmt_situacao(r.get("situacao"))),
            ]
            for r in rows
        ]

        table = Table([header] + data_rows, colWidths=col_widths, repeatRows=1)

        style_cmds = [
            ("BACKGROUND",    (0, 0), (n - 1, 0), COLOR_HEADER_BG),
            ("TOPPADDING",    (0, 0), (n - 1, 0), 3),
            ("BOTTOMPADDING", (0, 0), (n - 1, 0), 3),
            ("TOPPADDING",    (0, 1), (n - 1, -1), 2),
            ("BOTTOMPADDING", (0, 1), (n - 1, -1), 2),
            ("GRID",          (0, 0), (n - 1, -1), 0.3, COLOR_GRID),
            ("VALIGN",        (0, 0), (n - 1, -1), "TOP"),
            ("ALIGN",         (6, 1), (6, -1), "RIGHT"),   # Valor
        ]
        for i, row in enumerate(rows):
            row_idx = i + 1
            if row.get("situacao") is False:
                style_cmds.append(("BACKGROUND", (0, row_idx), (n - 1, row_idx), COLOR_ABERTA))
            elif row.get("situacao") is True:
                style_cmds.append(("BACKGROUND", (0, row_idx), (n - 1, row_idx), COLOR_QUITADA))
            elif i % 2 == 1:
                style_cmds.append(("BACKGROUND", (0, row_idx), (n - 1, row_idx), COLOR_ROW_ALT))

        table.setStyle(TableStyle(style_cmds))
        return table

    def _saidas_table(self, rows: list[dict], col_widths: list[float]) -> Table:
        n = self.N_COLS_S
        header = [self._p(h, self._style_hdr) for h in self.COLS_S]
        data_rows = [
            [
                self._p(_fmt_date(r.get("vencimento"))),
                self._p(r.get("fornecedor_nome") or "—"),
                self._p(r.get("empresa_nome") or "—"),
                self._p(r.get("nota") or "—"),
                self._p(r.get("parcela") or "—"),
                self._p(_brl(r.get("valor", 0))),
                self._p(_fmt_situacao(r.get("situacao"))),
            ]
            for r in rows
        ]

        table = Table([header] + data_rows, colWidths=col_widths, repeatRows=1)

        style_cmds = [
            ("BACKGROUND",    (0, 0), (n - 1, 0), COLOR_HEADER_BG),
            ("TOPPADDING",    (0, 0), (n - 1, 0), 3),
            ("BOTTOMPADDING", (0, 0), (n - 1, 0), 3),
            ("TOPPADDING",    (0, 1), (n - 1, -1), 2),
            ("BOTTOMPADDING", (0, 1), (n - 1, -1), 2),
            ("GRID",          (0, 0), (n - 1, -1), 0.3, COLOR_GRID),
            ("VALIGN",        (0, 0), (n - 1, -1), "TOP"),
            ("ALIGN",         (5, 1), (5, -1), "RIGHT"),   # Valor
        ]
        for i, row in enumerate(rows):
            row_idx = i + 1
            if row.get("situacao") is False:
                style_cmds.append(("BACKGROUND", (0, row_idx), (n - 1, row_idx), COLOR_ABERTA))
            elif row.get("situacao") is True:
                style_cmds.append(("BACKGROUND", (0, row_idx), (n - 1, row_idx), COLOR_QUITADA))
            elif i % 2 == 1:
                style_cmds.append(("BACKGROUND", (0, row_idx), (n - 1, row_idx), COLOR_ROW_ALT))

        table.setStyle(TableStyle(style_cmds))
        return table

    # ── Barra de total por seção ───────────────────────────────────────────────
    def _total_bar(
        self, label: str, total_valor: float, qtd: int,
        col_widths: list[float], valor_col: int,
    ) -> Table:
        n = len(col_widths)
        row = [self._p("") for _ in range(n)]
        row[0] = self._p(f"{label}  ·  {qtd} registro(s)", self._style_total)
        row[valor_col] = self._p(_brl(total_valor), self._style_total)

        t = Table([row], colWidths=col_widths)
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (n - 1, 0), COLOR_TOTAL_BG),
            ("TOPPADDING",    (0, 0), (n - 1, 0), 4),
            ("BOTTOMPADDING", (0, 0), (n - 1, 0), 4),
            ("LEFTPADDING",   (0, 0), (0, 0), 6),
            ("ALIGN",         (valor_col, 0), (valor_col, 0), "RIGHT"),
            ("GRID",          (0, 0), (n - 1, 0), 0.3, COLOR_GRID),
            ("VALIGN",        (0, 0), (n - 1, 0), "MIDDLE"),
        ]))
        return t

    # ── Barra de saldo final ───────────────────────────────────────────────────
    def _saldo_bar(
        self,
        total_receitas: float,
        total_despesas: float,
        total_recebido: float,
        total_pago: float,
        saldo: float,
        col_widths: list[float],
    ) -> Table:
        n = len(col_widths)
        page_w, _ = self.pagesize
        w = page_w - 2 * MARGIN

        # Barra única com 3 colunas: Entradas | Saídas | Saldo
        saldo_bg = COLOR_SALDO_POS if saldo >= 0 else COLOR_SALDO_NEG
        row = [
            self._p(
                f"TOTAL ENTRADAS: {_brl(total_receitas)}\nRecebido: {_brl(total_recebido)}",
                self._style_saldo,
            ),
            self._p(
                f"TOTAL SAÍDAS: {_brl(total_despesas)}\nPago: {_brl(total_pago)}",
                self._style_saldo,
            ),
            self._p(
                f"SALDO: {_brl(saldo)}",
                self._style_saldo,
            ),
        ]

        bar = Table([row], colWidths=[w * 0.36, w * 0.36, w * 0.28])
        bar.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (0, 0), COLOR_ENTRADA_BG),
            ("BACKGROUND",    (1, 0), (1, 0), COLOR_SAIDA_BG),
            ("BACKGROUND",    (2, 0), (2, 0), saldo_bg),
            ("TOPPADDING",    (0, 0), (2, 0), 6),
            ("BOTTOMPADDING", (0, 0), (2, 0), 6),
            ("LEFTPADDING",   (0, 0), (2, 0), 10),
            ("GRID",          (0, 0), (2, 0), 0.5, colors.white),
            ("VALIGN",        (0, 0), (2, 0), "MIDDLE"),
        ]))
        return bar

    # ── generate ──────────────────────────────────────────────────────────────
    def generate(
        self,
        receitas: list[dict],
        despesas: list[dict],
        total_receitas: float,
        total_despesas: float,
        total_recebido: float,
        total_pago: float,
        saldo: float,
        data_de: str,
        data_ate: str,
        buf: BytesIO,
    ) -> None:
        col_w_e = self._col_widths_e()
        col_w_s = self._col_widths_s()
        page_w, page_h = self.pagesize
        w = page_w - 2 * MARGIN

        periodo_style = ParagraphStyle(
            "Periodo", fontName=FONT_NORMAL, fontSize=8,
            textColor=COLOR_TEXT, leading=10,
        )
        periodo = Paragraph(
            f"Período (vencimento): {_fmt_date(data_de)} a {_fmt_date(data_ate)}  ·  "
            f"Entradas: {len(receitas)} registro(s)  ·  Saídas: {len(despesas)} registro(s)",
            periodo_style,
        )

        elements: list = [periodo, Spacer(1, 0.25 * cm)]

        # ── Seção ENTRADAS ─────────────────────────────────────────────────────
        elements.append(self._section_header("ENTRADAS  —  CONTAS A RECEBER", COLOR_ENTRADA_BG, col_w_e))
        if receitas:
            elements.append(self._entradas_table(receitas, col_w_e))
        else:
            elements.append(Paragraph("Nenhuma entrada encontrada.", periodo_style))
        elements.append(
            self._total_bar("TOTAL ENTRADAS", total_receitas, len(receitas), col_w_e, valor_col=6)
        )

        elements.append(Spacer(1, 0.4 * cm))

        # ── Seção SAÍDAS ───────────────────────────────────────────────────────
        elements.append(self._section_header("SAÍDAS  —  CONTAS A PAGAR", COLOR_SAIDA_BG, col_w_s))
        if despesas:
            elements.append(self._saidas_table(despesas, col_w_s))
        else:
            elements.append(Paragraph("Nenhuma saída encontrada.", periodo_style))
        elements.append(
            self._total_bar("TOTAL SAÍDAS", total_despesas, len(despesas), col_w_s, valor_col=5)
        )

        elements.append(Spacer(1, 0.4 * cm))

        # ── Barra de saldo ─────────────────────────────────────────────────────
        elements.append(self._saldo_bar(
            total_receitas, total_despesas, total_recebido, total_pago, saldo, col_w_e
        ))

        frame = Frame(
            x1=MARGIN,
            y1=MARGIN + FOOTER_HEIGHT,
            width=w,
            height=page_h - 2 * MARGIN - HEADER_HEIGHT - FOOTER_HEIGHT,
            leftPadding=0, rightPadding=0, topPadding=4, bottomPadding=4,
        )
        template = PageTemplate(id="main", frames=[frame], onPage=self._on_page)

        doc = BaseDocTemplate(
            buf,
            pagesize=self.pagesize,
            leftMargin=MARGIN, rightMargin=MARGIN,
            topMargin=MARGIN,  bottomMargin=MARGIN,
        )
        doc.addPageTemplates([template])
        doc.build(elements)
