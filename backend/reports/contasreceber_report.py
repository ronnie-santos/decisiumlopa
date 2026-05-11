"""
contasreceber_report.py — Relatório de Contas a Receber
Herda BaseReport para layout padrão (cabeçalho, rodapé).
Layout: retrato A4, 7 colunas, com suporte a agrupamento por cliente ou empresa.
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
COLOR_GROUP_BG = colors.HexColor("#1E293B")   # slate-800
COLOR_SUBTOTAL = colors.HexColor("#E2E8F0")   # slate-200
COLOR_ABERTA   = colors.HexColor("#FFFBEB")   # amber-50
COLOR_QUITADA  = colors.HexColor("#F0FDF4")   # green-50


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
class ContasReceberReport(BaseReport):
    """
    Relatório de Contas a Receber.
    Colunas: Vencimento | Cliente | Ordens | Valor | Empresa | Valor Pago | Situação
    """

    COLS = ["Vencimento", "Cliente", "Ordens OS", "Valor", "Empresa", "Valor Pago", "Situação"]
    N_COLS = len(COLS)

    def __init__(self):
        super().__init__(
            title="RELATÓRIO DE CONTAS A RECEBER",
            orientation="portrait",
        )
        self._style_cell = ParagraphStyle(
            "CRCell", fontName=FONT_NORMAL, fontSize=7,
            textColor=COLOR_TEXT, leading=9, wordWrap="CJK",
        )
        self._style_header = ParagraphStyle(
            "CRHdr", fontName=FONT_BOLD, fontSize=7,
            textColor=COLOR_TEXT, leading=9,
        )
        self._style_group = ParagraphStyle(
            "CRGroup", fontName=FONT_BOLD, fontSize=8,
            textColor=colors.white, leading=10,
        )
        self._style_subtotal = ParagraphStyle(
            "CRSub", fontName=FONT_BOLD, fontSize=7,
            textColor=COLOR_TEXT, leading=9,
        )
        self._style_total = ParagraphStyle(
            "CRTotal", fontName=FONT_BOLD, fontSize=8,
            textColor=colors.white, leading=10,
        )

    def _col_widths(self) -> list[float]:
        page_w, _ = self.pagesize
        w = page_w - 2 * MARGIN
        return [
            w * 0.10,   # Vencimento
            w * 0.22,   # Cliente
            w * 0.18,   # Ordens OS
            w * 0.12,   # Valor
            w * 0.18,   # Empresa
            w * 0.12,   # Valor Pago
            w * 0.08,   # Situação
        ]

    def _p(self, text: str, style=None) -> Paragraph:
        style = style or self._style_cell
        return Paragraph(str(text).replace("\n", "<br/>"), style)

    def _row_from(self, row: dict) -> list:
        parcela = row.get("parcela") or ""
        return [
            self._p(_fmt_date(row.get("vencimento"))),
            self._p(row.get("cliente_nome") or "—"),
            self._p(row.get("ordens") or "—"),
            self._p(_brl(row.get("valor", 0))),
            self._p(row.get("empresa_nome") or "—"),
            self._p(_brl(row.get("valor_pago", 0)) if row.get("valor_pago") else "—"),
            self._p(_fmt_situacao(row.get("situacao"))),
        ]

    def _build_flat_table(self, rows: list[dict], col_widths: list[float]) -> Table:
        n = self.N_COLS
        header_row = [self._p(h, self._style_header) for h in self.COLS]
        data_rows  = [self._row_from(r) for r in rows]

        table = Table([header_row] + data_rows, colWidths=col_widths, repeatRows=1)

        style_cmds = [
            ("BACKGROUND",    (0, 0), (n - 1, 0), COLOR_HEADER_BG),
            ("TOPPADDING",    (0, 0), (n - 1, 0), 3),
            ("BOTTOMPADDING", (0, 0), (n - 1, 0), 3),
            ("TOPPADDING",    (0, 1), (n - 1, -1), 2),
            ("BOTTOMPADDING", (0, 1), (n - 1, -1), 2),
            ("GRID",          (0, 0), (n - 1, -1), 0.3, COLOR_GRID),
            ("VALIGN",        (0, 0), (n - 1, -1), "TOP"),
            ("ALIGN",         (3, 1), (3, -1), "RIGHT"),
            ("ALIGN",         (5, 1), (5, -1), "RIGHT"),
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

    def _build_group_table(self, grupo: dict, col_widths: list[float]) -> Table:
        n = self.N_COLS
        nome = grupo["quebra"] or "Sem grupo"

        row_group = [self._p(nome.upper(), self._style_group)] + [""] * (n - 1)
        row_cols  = [self._p(h, self._style_header) for h in self.COLS]
        data_rows = [self._row_from(r) for r in grupo["rows"]]

        row_sub = [self._p("") for _ in range(n)]
        row_sub[2] = self._p("SUBTOTAL", self._style_subtotal)
        row_sub[3] = self._p(_brl(grupo["subtotal_valor"]), self._style_subtotal)
        row_sub[5] = self._p(_brl(grupo["subtotal_pago"]),  self._style_subtotal)

        all_rows = [row_group, row_cols] + data_rows + [row_sub]
        n_total  = len(all_rows)
        sub_idx  = n_total - 1

        table = Table(all_rows, colWidths=col_widths, repeatRows=0)

        style_cmds = [
            ("SPAN",            (0, 0), (n - 1, 0)),
            ("BACKGROUND",      (0, 0), (n - 1, 0), COLOR_GROUP_BG),
            ("TOPPADDING",      (0, 0), (n - 1, 0), 5),
            ("BOTTOMPADDING",   (0, 0), (n - 1, 0), 5),
            ("LEFTPADDING",     (0, 0), (n - 1, 0), 6),
            ("BACKGROUND",      (0, 1), (n - 1, 1), COLOR_HEADER_BG),
            ("TOPPADDING",      (0, 1), (n - 1, 1), 3),
            ("BOTTOMPADDING",   (0, 1), (n - 1, 1), 3),
            ("TOPPADDING",      (0, 2), (n - 1, sub_idx - 1), 2),
            ("BOTTOMPADDING",   (0, 2), (n - 1, sub_idx - 1), 2),
            ("BACKGROUND",      (0, sub_idx), (n - 1, sub_idx), COLOR_SUBTOTAL),
            ("TOPPADDING",      (0, sub_idx), (n - 1, sub_idx), 4),
            ("BOTTOMPADDING",   (0, sub_idx), (n - 1, sub_idx), 4),
            ("GRID",            (0, 1), (n - 1, n_total - 1), 0.3, COLOR_GRID),
            ("VALIGN",          (0, 0), (n - 1, n_total - 1), "MIDDLE"),
            ("ALIGN",           (3, 1), (3, n_total - 1), "RIGHT"),
            ("ALIGN",           (5, 1), (5, n_total - 1), "RIGHT"),
        ]
        for i, row in enumerate(grupo["rows"]):
            row_idx = i + 2
            if row.get("situacao") is False:
                style_cmds.append(("BACKGROUND", (0, row_idx), (n - 1, row_idx), COLOR_ABERTA))
            elif row.get("situacao") is True:
                style_cmds.append(("BACKGROUND", (0, row_idx), (n - 1, row_idx), COLOR_QUITADA))
            elif i % 2 == 1:
                style_cmds.append(("BACKGROUND", (0, row_idx), (n - 1, row_idx), COLOR_ROW_ALT))

        table.setStyle(TableStyle(style_cmds))
        return table

    def _build_total_table(
        self, total_valor: float, total_pago: float, total_registros: int, col_widths: list[float]
    ) -> Table:
        n = self.N_COLS
        row = [self._p("") for _ in range(n)]
        row[0] = self._p(f"TOTAL GERAL  ·  {total_registros} conta(s)", self._style_total)
        row[3] = self._p(_brl(total_valor), self._style_total)
        row[5] = self._p(_brl(total_pago),  self._style_total)

        table = Table([row], colWidths=col_widths)
        table.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (n - 1, 0), COLOR_GROUP_BG),
            ("TOPPADDING",    (0, 0), (n - 1, 0), 5),
            ("BOTTOMPADDING", (0, 0), (n - 1, 0), 5),
            ("LEFTPADDING",   (0, 0), (0, 0), 6),
            ("ALIGN",         (3, 0), (3, 0), "RIGHT"),
            ("ALIGN",         (5, 0), (5, 0), "RIGHT"),
            ("GRID",          (0, 0), (n - 1, 0), 0.3, COLOR_GRID),
            ("VALIGN",        (0, 0), (n - 1, 0), "MIDDLE"),
        ]))
        return table

    def generate(
        self,
        grupos: list[dict],
        total_valor: float,
        total_pago: float,
        total_registros: int,
        grupo_tipo: int,
        data_de: str,
        data_ate: str,
        buf: BytesIO,
    ) -> None:
        col_widths = self._col_widths()
        page_w, page_h = self.pagesize

        periodo_style = ParagraphStyle(
            "Periodo", fontName=FONT_NORMAL, fontSize=8,
            textColor=COLOR_TEXT, leading=10,
        )
        grupo_labels = {1: "Normal", 2: "por Cliente", 3: "por Empresa"}
        periodo = Paragraph(
            f"Período (vencimento): {_fmt_date(data_de)} a {_fmt_date(data_ate)}  ·  "
            f"{total_registros} conta(s)  ·  "
            f"Agrupamento: {grupo_labels.get(grupo_tipo, '')}",
            periodo_style,
        )

        elements = [periodo, Spacer(1, 0.25 * cm)]

        if total_registros == 0:
            elements.append(Paragraph(
                "Nenhuma conta encontrada para o período e filtros selecionados.",
                periodo_style,
            ))
        elif grupo_tipo == 1:
            all_rows = grupos[0]["rows"] if grupos else []
            elements.append(self._build_flat_table(all_rows, col_widths))
            elements.append(Spacer(1, 0.2 * cm))
            elements.append(self._build_total_table(total_valor, total_pago, total_registros, col_widths))
        else:
            for grupo in grupos:
                elements.append(self._build_group_table(grupo, col_widths))
                elements.append(Spacer(1, 0.2 * cm))
            elements.append(self._build_total_table(total_valor, total_pago, total_registros, col_widths))

        frame = Frame(
            x1=MARGIN,
            y1=MARGIN + FOOTER_HEIGHT,
            width=page_w - 2 * MARGIN,
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
