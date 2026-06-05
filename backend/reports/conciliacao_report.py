"""
conciliacao_report.py — Relatório de Conciliação Bancária
Extrato de Despesas Pagas agrupado por Data de Pagamento + Forma de Pagamento.
Layout: paisagem A4, 6 colunas.
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
    COLOR_ROW_MAIN,
    COLOR_GRID,
    COLOR_TEXT,
)

COLOR_GROUP_BG   = colors.HexColor("#334155")   # slate-700 — cabeçalho do grupo
COLOR_SUBTOTAL   = colors.HexColor("#E2E8F0")   # slate-200 — linha subtotal
COLOR_TOTAL_BG   = colors.HexColor("#1E293B")   # slate-800 — linha total geral


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


class ConciliacaoReport(BaseReport):
    """Relatório de Conciliação Bancária — Extrato de Despesas Pagas."""

    COLS = ["Data Pagamento", "Forma Pagamento", "Fornecedor", "Documento", "Empresa", "Valor"]
    N_COLS = len(COLS)

    def __init__(self):
        super().__init__(
            title="CONCILIAÇÃO BANCÁRIA — EXTRATO DE DESPESAS PAGAS",
            orientation="landscape",
        )
        self._style_cell = ParagraphStyle(
            "CBCell",
            fontName=FONT_NORMAL,
            fontSize=7,
            textColor=COLOR_TEXT,
            leading=9,
            wordWrap="CJK",
        )
        self._style_header = ParagraphStyle(
            "CBHdr",
            fontName=FONT_BOLD,
            fontSize=7,
            textColor=COLOR_TEXT,
            leading=9,
        )
        self._style_group = ParagraphStyle(
            "CBGroup",
            fontName=FONT_BOLD,
            fontSize=7.5,
            textColor=colors.white,
            leading=10,
        )
        self._style_subtotal = ParagraphStyle(
            "CBSub",
            fontName=FONT_BOLD,
            fontSize=7,
            textColor=COLOR_TEXT,
            leading=9,
        )
        self._style_total = ParagraphStyle(
            "CBTotal",
            fontName=FONT_BOLD,
            fontSize=8,
            textColor=colors.white,
            leading=10,
        )

    def _col_widths(self) -> list[float]:
        page_w, _ = self.pagesize
        w = page_w - 2 * MARGIN
        return [
            w * 0.11,   # Data Pagamento
            w * 0.14,   # Forma Pagamento
            w * 0.27,   # Fornecedor
            w * 0.10,   # Documento
            w * 0.24,   # Empresa
            w * 0.14,   # Valor
        ]

    def _p(self, text: str, style=None) -> Paragraph:
        style = style or self._style_cell
        return Paragraph(str(text).replace("\n", "<br/>"), style)

    def _build_grouped_table(
        self, grupos: list[dict], col_widths: list[float]
    ) -> Table:
        n = self.N_COLS

        # ── Monta todas as linhas e rastreia índices especiais ────────────────
        all_rows: list[list] = []
        group_header_indices: list[int] = []
        subtotal_indices: list[int] = []
        data_row_indices: list[tuple[int, int]] = []   # (row_idx, pos_within_group)

        # Linha de cabeçalho das colunas
        col_header_row = [self._p(h, self._style_header) for h in self.COLS]
        all_rows.append(col_header_row)

        for grupo in grupos:
            # ── Cabeçalho do grupo (data + forma pagamento) ───────────────────
            grp_label = f"{_fmt_date(grupo['data'])}  ·  {grupo['forma_pagamento']}  ·  {grupo['qtd']} item(ns)"
            grp_row = [self._p(grp_label, self._style_group)] + [self._p("") for _ in range(n - 1)]
            group_header_indices.append(len(all_rows))
            all_rows.append(grp_row)

            # ── Linhas de dados do grupo ──────────────────────────────────────
            for pos, item in enumerate(grupo["items"]):
                data_row = [
                    self._p(_fmt_date(item["data"])),
                    self._p(item["forma_pagamento"]),
                    self._p(item["fornecedor"]),
                    self._p(item["documento"]),
                    self._p(item["empresa"]),
                    self._p(_brl(item["valor"])),
                ]
                data_row_indices.append((len(all_rows), pos))
                all_rows.append(data_row)

            # ── Linha de subtotal ─────────────────────────────────────────────
            sub_row = [self._p("") for _ in range(n)]
            sub_row[3] = self._p("SUBTOTAL", self._style_subtotal)
            sub_row[5] = self._p(_brl(grupo["subtotal"]), self._style_subtotal)
            subtotal_indices.append(len(all_rows))
            all_rows.append(sub_row)

        # ── Linha de total geral ──────────────────────────────────────────────
        total_qtd = sum(g["qtd"] for g in grupos)
        total_val = sum(g["subtotal"] for g in grupos)
        total_row = [self._p("") for _ in range(n)]
        total_row[0] = self._p(
            f"TOTAL GERAL  ·  {total_qtd} registro(s)", self._style_total
        )
        total_row[5] = self._p(_brl(total_val), self._style_total)
        total_idx = len(all_rows)
        all_rows.append(total_row)

        # ── Monta estilos ─────────────────────────────────────────────────────
        last = len(all_rows) - 1
        style_cmds = [
            # Cabeçalho das colunas
            ("BACKGROUND",    (0, 0), (n - 1, 0), COLOR_HEADER_BG),
            ("TOPPADDING",    (0, 0), (n - 1, 0), 3),
            ("BOTTOMPADDING", (0, 0), (n - 1, 0), 3),
            # Grade geral
            ("GRID",          (0, 0), (n - 1, last), 0.3, COLOR_GRID),
            ("VALIGN",        (0, 0), (n - 1, last), "MIDDLE"),
            # Valor alinhado à direita em todas as linhas
            ("ALIGN",         (5, 0), (5, last), "RIGHT"),
            # Subtotal "SUBTOTAL" label alinhado à direita
            ("ALIGN",         (3, 1), (3, last), "RIGHT"),
        ]

        # Cabeçalhos de grupo
        for idx in group_header_indices:
            style_cmds += [
                ("SPAN",          (0, idx), (n - 1, idx)),
                ("BACKGROUND",    (0, idx), (n - 1, idx), COLOR_GROUP_BG),
                ("TOPPADDING",    (0, idx), (n - 1, idx), 4),
                ("BOTTOMPADDING", (0, idx), (n - 1, idx), 4),
                ("LEFTPADDING",   (0, idx), (0, idx), 6),
            ]

        # Linhas de dados com zebra alternada dentro do grupo
        for row_idx, pos in data_row_indices:
            style_cmds += [
                ("TOPPADDING",    (0, row_idx), (n - 1, row_idx), 2),
                ("BOTTOMPADDING", (0, row_idx), (n - 1, row_idx), 2),
            ]
            if pos % 2 == 1:
                style_cmds.append(
                    ("BACKGROUND", (0, row_idx), (n - 1, row_idx), COLOR_ROW_ALT)
                )

        # Linhas de subtotal
        for idx in subtotal_indices:
            style_cmds += [
                ("BACKGROUND",    (0, idx), (n - 1, idx), COLOR_SUBTOTAL),
                ("TOPPADDING",    (0, idx), (n - 1, idx), 4),
                ("BOTTOMPADDING", (0, idx), (n - 1, idx), 4),
            ]

        # Linha de total geral
        style_cmds += [
            ("BACKGROUND",    (0, total_idx), (n - 1, total_idx), COLOR_TOTAL_BG),
            ("TOPPADDING",    (0, total_idx), (n - 1, total_idx), 5),
            ("BOTTOMPADDING", (0, total_idx), (n - 1, total_idx), 5),
            ("LEFTPADDING",   (0, total_idx), (0, total_idx), 6),
        ]

        table = Table(all_rows, colWidths=col_widths, repeatRows=1)
        table.setStyle(TableStyle(style_cmds))
        return table

    def generate(
        self,
        grupos: list[dict],
        total_geral: float,
        qtd_registros: int,
        data_de: str,
        data_ate: str,
        buf: BytesIO,
    ) -> None:
        col_widths = self._col_widths()
        page_w, page_h = self.pagesize

        periodo_style = ParagraphStyle(
            "Periodo",
            fontName=FONT_NORMAL,
            fontSize=8,
            textColor=COLOR_TEXT,
            leading=10,
        )

        periodo = Paragraph(
            f"Período de pagamento: {_fmt_date(data_de)} a {_fmt_date(data_ate)}  ·  "
            f"{qtd_registros} registro(s)  ·  Total: {_brl(total_geral)}",
            periodo_style,
        )

        elements: list = [periodo, Spacer(1, 0.25 * cm)]

        if qtd_registros == 0:
            elements.append(
                Paragraph(
                    "Nenhum pagamento encontrado para o período e filtros selecionados.",
                    periodo_style,
                )
            )
        else:
            elements.append(self._build_grouped_table(grupos, col_widths))

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
