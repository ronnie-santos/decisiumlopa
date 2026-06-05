"""
notas_fiscais_report.py — Relatório de Notas Fiscais Emitidas
Herda BaseReport para layout padrão (cabeçalho, rodapé, logo).
Layout: paisagem A4, agrupado por empresa, colunas: Data | Cliente | Nº NF | Valor NF | ISS | INSS
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

COLOR_GROUP_BG = colors.HexColor("#1E293B")   # slate-800
COLOR_SUBTOTAL = colors.HexColor("#E2E8F0")   # slate-200
COLOR_ISS      = colors.HexColor("#EFF6FF")   # blue-50
COLOR_INSS     = colors.HexColor("#F5F3FF")   # violet-50


def _brl(v: float) -> str:
    neg = v < 0
    s = f"{abs(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"-R$ {s}" if neg else f"R$ {s}"


def _fmt_date(s: str | None) -> str:
    if not s:
        return "—"
    try:
        y, m, d = str(s).split("-")
        return f"{d}/{m}/{y}"
    except Exception:
        return str(s)


class NotasFiscaisReport(BaseReport):
    """
    Relatório de Notas Fiscais Emitidas, agrupado por empresa.
    Colunas: Data | Cliente | Nº NF | Valor NF | ISS | INSS
    """

    COLS = ["Data", "Cliente", "Nº NF", "Valor NF", "ISS", "INSS"]
    N_COLS = len(COLS)

    def __init__(self):
        super().__init__(
            title="RELATÓRIO DE NOTAS FISCAIS EMITIDAS",
            orientation="landscape",
        )
        self._s_cell = ParagraphStyle(
            "NFCell", fontName=FONT_NORMAL, fontSize=7,
            textColor=COLOR_TEXT, leading=9, wordWrap="CJK",
        )
        self._s_hdr = ParagraphStyle(
            "NFHdr", fontName=FONT_BOLD, fontSize=7,
            textColor=COLOR_TEXT, leading=9,
        )
        self._s_group = ParagraphStyle(
            "NFGroup", fontName=FONT_BOLD, fontSize=8,
            textColor=colors.white, leading=10,
        )
        self._s_sub = ParagraphStyle(
            "NFSub", fontName=FONT_BOLD, fontSize=7,
            textColor=COLOR_TEXT, leading=9,
        )
        self._s_total = ParagraphStyle(
            "NFTotal", fontName=FONT_BOLD, fontSize=8,
            textColor=colors.white, leading=10,
        )
        self._s_periodo = ParagraphStyle(
            "NFPeriodo", fontName=FONT_NORMAL, fontSize=8,
            textColor=COLOR_TEXT, leading=10,
        )

    def _col_widths(self) -> list[float]:
        page_w, _ = self.pagesize
        w = page_w - 2 * MARGIN
        return [
            w * 0.08,   # Data
            w * 0.30,   # Cliente
            w * 0.08,   # Nº NF
            w * 0.18,   # Valor NF
            w * 0.18,   # ISS
            w * 0.18,   # INSS
        ]

    def _p(self, text: str, style=None) -> Paragraph:
        style = style or self._s_cell
        return Paragraph(str(text).replace("\n", "<br/>"), style)

    def _row_from(self, row: dict) -> list:
        numero = row.get("numero")
        nf_str = f"#{str(numero).zfill(5)}" if numero else f"ID {row.get('idnota', '—')}"
        iss    = row.get("iss", 0) or 0
        inss   = row.get("inss", 0) or 0
        return [
            self._p(_fmt_date(row.get("data_emissao"))),
            self._p(row.get("cliente_nome") or "—"),
            self._p(nf_str),
            self._p(_brl(row.get("valor_nota", 0) or 0)),
            self._p(_brl(iss) if iss > 0 else "—"),
            self._p(_brl(inss) if inss > 0 else "—"),
        ]

    def _build_group_table(self, grupo: dict, col_widths: list[float]) -> Table:
        n = self.N_COLS
        nome = grupo.get("empresa_fantasia") or grupo.get("empresa_nome") or "Sem empresa"
        count = grupo.get("count", 0)

        row_group = [self._p(f"{nome.upper()}  ·  {count} nota(s)", self._s_group)] + [""] * (n - 1)
        row_cols  = [self._p(h, self._s_hdr) for h in self.COLS]
        data_rows = [self._row_from(r) for r in grupo.get("rows", [])]

        row_sub = [self._p("") for _ in range(n)]
        row_sub[1] = self._p("SUBTOTAL", self._s_sub)
        row_sub[3] = self._p(_brl(grupo.get("subtotal_valor", 0)), self._s_sub)
        row_sub[4] = self._p(_brl(grupo.get("subtotal_iss", 0)) if (grupo.get("subtotal_iss") or 0) > 0 else "—", self._s_sub)
        row_sub[5] = self._p(_brl(grupo.get("subtotal_inss", 0)) if (grupo.get("subtotal_inss") or 0) > 0 else "—", self._s_sub)

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
            ("ALIGN",           (3, 1), (5, n_total - 1), "RIGHT"),
        ]
        for i in range(len(data_rows)):
            row_idx = i + 2
            if i % 2 == 1:
                style_cmds.append(("BACKGROUND", (0, row_idx), (n - 1, row_idx), COLOR_ROW_ALT))

        table.setStyle(TableStyle(style_cmds))
        return table

    def _build_total_table(
        self,
        total_valor: float,
        total_iss: float,
        total_inss: float,
        total_notas: int,
        col_widths: list[float],
    ) -> Table:
        n = self.N_COLS
        row = [self._p("") for _ in range(n)]
        row[1] = self._p(f"TOTAL GERAL  ·  {total_notas} nota(s)", self._s_total)
        row[3] = self._p(_brl(total_valor), self._s_total)
        row[4] = self._p(_brl(total_iss) if total_iss > 0 else "—", self._s_total)
        row[5] = self._p(_brl(total_inss) if total_inss > 0 else "—", self._s_total)

        table = Table([row], colWidths=col_widths)
        table.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (n - 1, 0), COLOR_GROUP_BG),
            ("TOPPADDING",    (0, 0), (n - 1, 0), 5),
            ("BOTTOMPADDING", (0, 0), (n - 1, 0), 5),
            ("LEFTPADDING",   (0, 0), (0, 0), 6),
            ("ALIGN",         (3, 0), (5, 0), "RIGHT"),
            ("GRID",          (0, 0), (n - 1, 0), 0.3, COLOR_GRID),
            ("VALIGN",        (0, 0), (n - 1, 0), "MIDDLE"),
        ]))
        return table

    def generate(
        self,
        grupos: list[dict],
        total_valor: float,
        total_iss: float,
        total_inss: float,
        total_notas: int,
        data_ini: str,
        data_fim: str,
        buf: BytesIO,
    ) -> None:
        col_widths = self._col_widths()
        page_w, page_h = self.pagesize

        periodo = Paragraph(
            f"Período: {_fmt_date(data_ini)} a {_fmt_date(data_fim)}  ·  {total_notas} nota(s)",
            self._s_periodo,
        )
        elements = [periodo, Spacer(1, 0.25 * cm)]

        if total_notas == 0:
            elements.append(Paragraph(
                "Nenhuma nota fiscal encontrada para o período selecionado.",
                self._s_periodo,
            ))
        else:
            for grupo in grupos:
                elements.append(self._build_group_table(grupo, col_widths))
                elements.append(Spacer(1, 0.2 * cm))
            elements.append(self._build_total_table(total_valor, total_iss, total_inss, total_notas, col_widths))

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
