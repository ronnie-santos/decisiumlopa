"""
analise_financeira_report.py — Relatório de Análise Financeira
Herda BaseReport. Layout retrato A4.
Seções: Resumo Geral | Top Clientes | Top Fornecedores |
        Equip. Receitas | Equip. Despesas
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
COLOR_SEC_DARK   = colors.HexColor("#1E293B")   # slate-800
COLOR_SEC_GREEN  = colors.HexColor("#14532D")   # green-900
COLOR_SEC_RED    = colors.HexColor("#7F1D1D")   # red-900
COLOR_POS        = colors.HexColor("#059669")   # emerald-600
COLOR_NEG        = colors.HexColor("#DC2626")   # red-600
COLOR_TOTAL_BG   = colors.HexColor("#111827")   # slate-900
COLOR_SUBTOTAL   = colors.HexColor("#E2E8F0")   # slate-200
COLOR_BAR_GREEN  = colors.HexColor("#10B981")   # emerald-500
COLOR_BAR_RED    = colors.HexColor("#EF4444")   # red-500


def _brl(v: float) -> str:
    neg = v < 0
    s = f"{abs(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"-R$ {s}" if neg else f"R$ {s}"


def _pct(numerator: float, denominator: float) -> str:
    if not denominator:
        return "—"
    return f"{min(numerator / denominator * 100, 100):.1f}%"


def _fmt_date(s: str | None) -> str:
    if not s:
        return "—"
    try:
        y, m, d = s.split("-")
        return f"{d}/{m}/{y}"
    except Exception:
        return str(s)


# ── Classe ────────────────────────────────────────────────────────────────────
class AnaliseFinanceiraReport(BaseReport):

    def __init__(self):
        super().__init__(
            title="ANÁLISE FINANCEIRA",
            orientation="portrait",
        )
        self._sc = ParagraphStyle("AFCell",  fontName=FONT_NORMAL, fontSize=7,  textColor=COLOR_TEXT, leading=9)
        self._sb = ParagraphStyle("AFBold",  fontName=FONT_BOLD,   fontSize=7,  textColor=COLOR_TEXT, leading=9)
        self._sh = ParagraphStyle("AFHdr",   fontName=FONT_BOLD,   fontSize=7,  textColor=COLOR_TEXT, leading=9)
        self._sw = ParagraphStyle("AFWhite", fontName=FONT_BOLD,   fontSize=8,  textColor=colors.white, leading=10)
        self._ss = ParagraphStyle("AFSub",   fontName=FONT_NORMAL, fontSize=8,  textColor=COLOR_TEXT, leading=10)
        self._st = ParagraphStyle("AFTotal", fontName=FONT_BOLD,   fontSize=8,  textColor=colors.white, leading=10)

    def _p(self, txt: str, style=None) -> Paragraph:
        return Paragraph(str(txt).replace("&", "&amp;"), style or self._sc)

    def _col_w(self) -> float:
        page_w, _ = self.pagesize
        return page_w - 2 * MARGIN

    # ── Cabeçalho de seção ────────────────────────────────────────────────────
    def _section_header(self, title: str, color=None) -> Table:
        w = self._col_w()
        color = color or COLOR_SEC_DARK
        row = [self._p(title.upper(), self._sw)]
        t = Table([row], colWidths=[w])
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (0, 0), color),
            ("TOPPADDING",    (0, 0), (0, 0), 6),
            ("BOTTOMPADDING", (0, 0), (0, 0), 6),
            ("LEFTPADDING",   (0, 0), (0, 0), 8),
        ]))
        return t

    # ── Tabela genérica de ranking ────────────────────────────────────────────
    def _ranking_table(
        self,
        headers: list[str],
        rows_data: list[list],
        col_widths: list[float],
        bar_col: int | None = None,
        bar_color=None,
        max_val: float = 1.0,
    ) -> Table:
        """
        Monta tabela de ranking.
        Se bar_col não for None, a coluna bar_col recebe uma barra visual simples.
        """
        bar_color = bar_color or COLOR_BAR_GREEN
        hdr_row = [self._p(h, self._sh) for h in headers]
        all_rows = [hdr_row]

        for rdata in rows_data:
            row = []
            for i, cell in enumerate(rdata):
                if i == bar_col and max_val > 0:
                    # mini barra + valor
                    pct = min(float(cell) / max_val, 1.0) * 100
                    bar_w = int(pct * 0.6)  # max ~60 chars width representation → use Table within cell
                    txt = _brl(float(cell))
                    row.append(self._p(txt, self._sb))
                else:
                    row.append(self._p(str(cell) if cell is not None else "—"))
            all_rows.append(row)

        t = Table(all_rows, colWidths=col_widths)
        style = [
            ("BACKGROUND",    (0, 0), (-1, 0), COLOR_HEADER_BG),
            ("TOPPADDING",    (0, 0), (-1, 0), 4),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
            ("TOPPADDING",    (0, 1), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 3),
            ("GRID",          (0, 0), (-1, -1), 0.3, COLOR_GRID),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN",         (0, 0), (-1, 0), "LEFT"),
        ]
        # Zebra
        for i in range(len(rows_data)):
            if i % 2 == 1:
                style.append(("BACKGROUND", (0, i + 1), (-1, i + 1), COLOR_ROW_ALT))

        t.setStyle(TableStyle(style))
        return t

    # ── Tabela Resumo ─────────────────────────────────────────────────────────
    def _resumo_table(self, resumo: dict) -> Table:
        w = self._col_w()
        cw = [w * 0.35, w * 0.22, w * 0.22, w * 0.21]

        def row(label, total, pago, pct_val):
            cor = COLOR_POS if pct_val >= 0 else COLOR_NEG
            pct_style = ParagraphStyle("pct", fontName=FONT_BOLD, fontSize=7,
                                       textColor=COLOR_POS if pct_val >= 80 else COLOR_NEG, leading=9)
            return [
                self._p(label, self._sb),
                self._p(_brl(total), self._sc),
                self._p(_brl(pago), self._sc),
                self._p(_pct(pago, total), pct_style),
            ]

        headers = ["Indicador", "Total Esperado", "Total Pago/Recebido", "% Realizado"]
        r = resumo
        rows_data = [
            row("Receitas (Contas a Receber)", r["total_receitas"], r["total_pago_receitas"], r["total_pago_receitas"] / max(r["total_receitas"], 1) * 100),
            row("Despesas (Contas a Pagar)",   r["total_despesas"], r["total_pago_despesas"], r["total_pago_despesas"] / max(r["total_despesas"], 1) * 100),
        ]

        saldo = r["saldo"]
        saldo_cx = r["saldo_caixa"]
        saldo_style = ParagraphStyle("saldo", fontName=FONT_BOLD, fontSize=7,
                                     textColor=COLOR_POS if saldo >= 0 else COLOR_NEG, leading=9)
        saldo_cx_style = ParagraphStyle("saldocx", fontName=FONT_BOLD, fontSize=7,
                                        textColor=COLOR_POS if saldo_cx >= 0 else COLOR_NEG, leading=9)

        rows_data.append([
            self._p("Saldo do Período", self._sb),
            self._p(_brl(saldo), saldo_style),
            self._p(_brl(saldo_cx), saldo_cx_style),
            self._p(f"{r['qtd_receitas']} CR · {r['qtd_despesas']} CP", self._sc),
        ])

        hdr_row = [self._p(h, self._sh) for h in headers]
        all_rows = [hdr_row] + rows_data

        t = Table(all_rows, colWidths=cw)
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), COLOR_HEADER_BG),
            ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING",   (0, 0), (-1, -1), 5),
            ("GRID",          (0, 0), (-1, -1), 0.3, COLOR_GRID),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("BACKGROUND",    (0, 3), (-1, 3), COLOR_SUBTOTAL),
            ("ALIGN",         (1, 0), (-1, -1), "RIGHT"),
        ]))
        return t

    # ── Tabela Top Clientes ───────────────────────────────────────────────────
    def _clientes_table(self, rows: list[dict]) -> Table:
        w = self._col_w()
        cw = [w * 0.06, w * 0.38, w * 0.08, w * 0.24, w * 0.24]
        headers = ["#", "Cliente", "Qtd", "Total Esperado", "Recebido"]
        max_v = max((r["total_valor"] for r in rows), default=1)

        rows_data = [
            [
                str(i + 1),
                rows[i]["nome"],
                str(rows[i]["qtd"]),
                rows[i]["total_valor"],          # float bruto para bar_col
                _brl(rows[i]["total_pago"]),
            ]
            for i in range(len(rows))
        ]
        return self._ranking_table(headers, rows_data, cw, bar_col=3, bar_color=COLOR_BAR_GREEN, max_val=max_v)

    # ── Tabela Top Fornecedores ───────────────────────────────────────────────
    def _fornecedores_table(self, rows: list[dict]) -> Table:
        w = self._col_w()
        cw = [w * 0.06, w * 0.38, w * 0.08, w * 0.24, w * 0.24]
        headers = ["#", "Fornecedor", "Qtd", "Total Esperado", "Pago"]
        max_v = max((r["total_valor"] for r in rows), default=1)

        rows_data = [
            [
                str(i + 1),
                rows[i]["nome"],
                str(rows[i]["qtd"]),
                rows[i]["total_valor"],          # float bruto para bar_col
                _brl(rows[i]["total_pago"]),
            ]
            for i in range(len(rows))
        ]
        return self._ranking_table(headers, rows_data, cw, bar_col=3, bar_color=COLOR_BAR_RED, max_val=max_v)

    # ── Tabela Top Equip Receitas ─────────────────────────────────────────────
    def _equip_rec_table(self, rows: list[dict]) -> Table:
        w = self._col_w()
        cw = [w * 0.06, w * 0.38, w * 0.14, w * 0.08, w * 0.17, w * 0.17]
        headers = ["#", "Equipamento", "Placa", "OS", "Total", "Recebido"]
        max_v = max((r["total_valor"] for r in rows), default=1)

        rows_data = [
            [
                str(i + 1),
                rows[i]["nome"],
                rows[i]["placa"],
                str(rows[i]["qtd"]),
                rows[i]["total_valor"],          # float bruto para bar_col
                _brl(rows[i]["total_pago"]),
            ]
            for i in range(len(rows))
        ]
        return self._ranking_table(headers, rows_data, cw, bar_col=4, bar_color=COLOR_BAR_GREEN, max_val=max_v)

    # ── Tabela Top Equip Despesas ─────────────────────────────────────────────
    def _equip_desp_table(self, rows: list[dict]) -> Table:
        w = self._col_w()
        cw = [w * 0.06, w * 0.42, w * 0.14, w * 0.10, w * 0.28]
        headers = ["#", "Equipamento", "Placa", "Compras", "Total Despesas"]
        max_v = max((r["total_valor"] for r in rows), default=1)

        rows_data = [
            [
                str(i + 1),
                rows[i]["nome"],
                rows[i]["placa"],
                str(rows[i]["qtd"]),
                rows[i]["total_valor"],          # float bruto para bar_col
            ]
            for i in range(len(rows))
        ]
        return self._ranking_table(headers, rows_data, cw, bar_col=4, bar_color=COLOR_BAR_RED, max_val=max_v)

    # ── Barra de totais final ─────────────────────────────────────────────────
    def _total_bar(self, resumo: dict) -> Table:
        w = self._col_w()
        cw = [w / 3, w / 3, w / 3]

        def cell(label, value):
            cor = "color='#059669'" if value >= 0 else "color='#DC2626'"
            return Paragraph(
                f"<b>{label}</b><br/><font size='9' {cor}><b>{_brl(value)}</b></font>",
                self._st,
            )

        row = [
            cell("TOTAL RECEITAS", resumo["total_receitas"]),
            cell("TOTAL DESPESAS", -resumo["total_despesas"]),
            cell("SALDO DO PERÍODO", resumo["saldo"]),
        ]
        t = Table([row], colWidths=cw)
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (2, 0), COLOR_TOTAL_BG),
            ("TOPPADDING",    (0, 0), (2, 0), 7),
            ("BOTTOMPADDING", (0, 0), (2, 0), 7),
            ("LEFTPADDING",   (0, 0), (2, 0), 8),
            ("ALIGN",         (0, 0), (2, 0), "CENTER"),
            ("VALIGN",        (0, 0), (2, 0), "MIDDLE"),
            ("LINEAFTER",     (0, 0), (1, 0), 0.5, colors.HexColor("#374151")),
        ]))
        return t

    def _empty_msg(self, msg: str) -> Table:
        w = self._col_w()
        t = Table([[self._p(msg, self._sc)]], colWidths=[w])
        t.setStyle(TableStyle([
            ("TOPPADDING",    (0, 0), (0, 0), 5),
            ("BOTTOMPADDING", (0, 0), (0, 0), 5),
            ("LEFTPADDING",   (0, 0), (0, 0), 8),
            ("GRID",          (0, 0), (0, 0), 0.3, COLOR_GRID),
        ]))
        return t

    # ── Método principal ──────────────────────────────────────────────────────
    def generate(
        self,
        dados: dict,
        data_de: str,
        data_ate: str,
        buf: BytesIO,
    ) -> None:
        page_w, page_h = self.pagesize
        sp = Spacer(1, 0.25 * cm)
        sp_sm = Spacer(1, 0.15 * cm)

        resumo = dados["resumo"]

        periodo = Paragraph(
            f"Período: {_fmt_date(data_de)} a {_fmt_date(data_ate)}  ·  "
            f"{resumo['qtd_receitas']} contas a receber  ·  {resumo['qtd_despesas']} contas a pagar",
            self._ss,
        )

        elements = [periodo, sp]

        # ── Resumo Geral ──────────────────────────────────────────────────────
        elements += [self._section_header("Resumo Geral"), sp_sm, self._resumo_table(resumo), sp]

        # ── Top Clientes ──────────────────────────────────────────────────────
        elements.append(self._section_header("Top 10 Clientes — Maior Receita"))
        elements.append(sp_sm)
        if dados["top_clientes"]:
            elements.append(self._clientes_table(dados["top_clientes"]))
        else:
            elements.append(self._empty_msg("Nenhum cliente encontrado no período."))
        elements.append(sp)

        # ── Top Fornecedores ──────────────────────────────────────────────────
        elements.append(self._section_header("Top 10 Fornecedores — Maior Despesa", COLOR_SEC_RED))
        elements.append(sp_sm)
        if dados["top_fornecedores"]:
            elements.append(self._fornecedores_table(dados["top_fornecedores"]))
        else:
            elements.append(self._empty_msg("Nenhum fornecedor encontrado no período."))
        elements.append(sp)

        # ── Equip Receitas ────────────────────────────────────────────────────
        elements.append(self._section_header("Equipamentos — Maiores Geradores de Receita", COLOR_SEC_GREEN))
        elements.append(sp_sm)
        if dados["top_equip_receitas"]:
            elements.append(self._equip_rec_table(dados["top_equip_receitas"]))
        else:
            elements.append(self._empty_msg("Nenhum equipamento associado a receitas no período."))
        elements.append(sp)

        # ── Equip Despesas ────────────────────────────────────────────────────
        elements.append(self._section_header("Equipamentos — Maiores Geradores de Despesa", COLOR_SEC_RED))
        elements.append(sp_sm)
        if dados["top_equip_despesas"]:
            elements.append(self._equip_desp_table(dados["top_equip_despesas"]))
        else:
            elements.append(self._empty_msg("Nenhum equipamento associado a despesas no período."))
        elements.append(sp)

        # ── Barra total ───────────────────────────────────────────────────────
        elements.append(self._total_bar(resumo))

        # ── Documento ─────────────────────────────────────────────────────────
        frame = Frame(
            x1=MARGIN,
            y1=MARGIN + FOOTER_HEIGHT,
            width=page_w - 2 * MARGIN,
            height=page_h - 2 * MARGIN - HEADER_HEIGHT - FOOTER_HEIGHT,
            leftPadding=0,
            rightPadding=0,
            topPadding=4,
            bottomPadding=4,
        )
        template = PageTemplate(id="main", frames=[frame], onPage=self._on_page)
        doc = BaseDocTemplate(
            buf,
            pagesize=self.pagesize,
            leftMargin=MARGIN,
            rightMargin=MARGIN,
            topMargin=MARGIN,
            bottomMargin=MARGIN,
        )
        doc.addPageTemplates([template])
        doc.build(elements)
