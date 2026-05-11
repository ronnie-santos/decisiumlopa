"""
compras_produtos_report.py — Relatório de Compras e Produtos
Herda BaseReport para layout padrão (cabeçalho, rodapé).
Layout: paisagem A4, 10 colunas.
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
COLOR_GROUP_BG  = colors.HexColor("#1E293B")   # slate-800
COLOR_TOTAL_BG  = colors.HexColor("#1E293B")   # slate-800
COLOR_ABERTA    = colors.HexColor("#FFFBEB")   # amber-50
COLOR_QUITADA   = colors.HexColor("#F0FDF4")   # green-50


# ── Helpers ───────────────────────────────────────────────────────────────────
def _brl(v: float) -> str:
    neg = v < 0
    s = f"{abs(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"-R$ {s}" if neg else f"R$ {s}"


def _fmt_qty(v: float) -> str:
    if v == int(v):
        return str(int(v))
    return f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


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
        return "Quitado"
    elif s is False:
        return "Aberto"
    return "—"


# ── Relatório ─────────────────────────────────────────────────────────────────
class ComprasProdutosReport(BaseReport):
    """
    Relatório de Compras e Produtos.
    Colunas: Emissão | Status | Nota | Empresa | Fornecedor | Produto/Serviço | Equipamento | Qtd | Vlr Unit | Vlr Total
    """

    COLS = ["Emissão", "Status", "Nota", "Empresa", "Fornecedor", "Produto / Serviço", "Equipamento", "Qtd", "Vlr Unit", "Vlr Total"]
    N_COLS = len(COLS)

    def __init__(self):
        super().__init__(
            title="RELATÓRIO DE COMPRAS E PRODUTOS",
            orientation="landscape",
        )
        self._style_cell = ParagraphStyle(
            "CPCell", fontName=FONT_NORMAL, fontSize=6.5,
            textColor=COLOR_TEXT, leading=8.5, wordWrap="CJK",
        )
        self._style_header = ParagraphStyle(
            "CPHdr", fontName=FONT_BOLD, fontSize=6.5,
            textColor=COLOR_TEXT, leading=8.5,
        )
        self._style_total = ParagraphStyle(
            "CPTotal", fontName=FONT_BOLD, fontSize=7.5,
            textColor=colors.white, leading=10,
        )

    def _col_widths(self) -> list[float]:
        page_w, _ = self.pagesize
        w = page_w - 2 * MARGIN
        return [
            w * 0.07,   # Emissão
            w * 0.06,   # Status
            w * 0.06,   # Nota
            w * 0.13,   # Empresa
            w * 0.14,   # Fornecedor
            w * 0.19,   # Produto/Serviço
            w * 0.14,   # Equipamento
            w * 0.05,   # Qtd
            w * 0.08,   # Vlr Unit
            w * 0.08,   # Vlr Total
        ]

    def _p(self, text: str, style=None) -> Paragraph:
        style = style or self._style_cell
        return Paragraph(str(text).replace("\n", "<br/>"), style)

    def _row_from(self, row: dict) -> list:
        return [
            self._p(_fmt_date(row.get("emissao"))),
            self._p(_fmt_situacao(row.get("situacao"))),
            self._p(row.get("nota") or "—"),
            self._p(row.get("empresa_nome") or "—"),
            self._p(row.get("fornecedor_nome") or "—"),
            self._p(row.get("produto_descricao") or "—"),
            self._p(row.get("equipamento_nome") or "—"),
            self._p(_fmt_qty(row.get("quantidade", 0))),
            self._p(_brl(row.get("valor_unitario", 0))),
            self._p(_brl(row.get("valor_total", 0))),
        ]

    def _build_table(self, rows: list[dict], col_widths: list[float]) -> Table:
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
            ("ALIGN",         (7, 1), (7, -1), "CENTER"),   # Qtd
            ("ALIGN",         (8, 1), (8, -1), "RIGHT"),    # Vlr Unit
            ("ALIGN",         (9, 1), (9, -1), "RIGHT"),    # Vlr Total
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

    def _build_total_table(
        self, total_valor: float, total_registros: int, col_widths: list[float]
    ) -> Table:
        n = self.N_COLS
        row = [self._p("") for _ in range(n)]
        row[0] = self._p(f"TOTAL  ·  {total_registros} item(ns)", self._style_total)
        row[9] = self._p(_brl(total_valor), self._style_total)

        table = Table([row], colWidths=col_widths)
        table.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (n - 1, 0), COLOR_TOTAL_BG),
            ("TOPPADDING",    (0, 0), (n - 1, 0), 5),
            ("BOTTOMPADDING", (0, 0), (n - 1, 0), 5),
            ("LEFTPADDING",   (0, 0), (0, 0), 6),
            ("ALIGN",         (9, 0), (9, 0), "RIGHT"),
            ("GRID",          (0, 0), (n - 1, 0), 0.3, COLOR_GRID),
            ("VALIGN",        (0, 0), (n - 1, 0), "MIDDLE"),
        ]))
        return table

    def generate(
        self,
        rows: list[dict],
        total_valor: float,
        total_registros: int,
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
        periodo = Paragraph(
            f"Período (emissão): {_fmt_date(data_de)} a {_fmt_date(data_ate)}  ·  "
            f"{total_registros} item(ns)  ·  Total: {_brl(total_valor)}",
            periodo_style,
        )

        elements: list = [periodo, Spacer(1, 0.25 * cm)]

        if total_registros == 0:
            elements.append(Paragraph(
                "Nenhum registro encontrado para o período e filtros selecionados.",
                periodo_style,
            ))
        else:
            elements.append(self._build_table(rows, col_widths))
            elements.append(Spacer(1, 0.2 * cm))
            elements.append(self._build_total_table(total_valor, total_registros, col_widths))

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
