"""
dre_report.py — Relatório DRE (Demonstrativo de Resultado do Exercício)
Herda BaseReport. Layout retrato A4, hierárquico por nível de FluxoFinanceiro.
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
    COLOR_GRID,
    COLOR_TEXT,
)

# ── Cores por nível ───────────────────────────────────────────────────────────
COLOR_NIVEL_0_BG = colors.HexColor("#1E293B")   # slate-800  — seção principal
COLOR_NIVEL_0_FG = colors.white
COLOR_NIVEL_1_BG = colors.HexColor("#334155")   # slate-700  — grupo
COLOR_NIVEL_1_FG = colors.white
COLOR_NIVEL_2_BG = colors.HexColor("#F1F5F9")   # slate-100  — subgrupo
COLOR_NIVEL_2_FG = colors.HexColor("#1E293B")
COLOR_NIVEL_3_BG = colors.white                  # branco     — item
COLOR_NIVEL_3_FG = colors.HexColor("#475569")   # slate-600

COLOR_TOTAL_BG  = colors.HexColor("#111827")    # slate-900 — rodapé total
COLOR_POS       = colors.HexColor("#059669")    # emerald-600
COLOR_NEG       = colors.HexColor("#DC2626")    # red-600
COLOR_ZERO      = colors.HexColor("#64748B")    # slate-500


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


# ── Relatório ─────────────────────────────────────────────────────────────────
class DREReport(BaseReport):
    """
    DRE — Demonstrativo de Resultado do Exercício.
    Layout retrato A4 com hierarquia visual por nível.
    """

    def __init__(self):
        super().__init__(
            title="DRE — DEMONSTRATIVO DE RESULTADO DO EXERCÍCIO",
            orientation="portrait",
        )

        # Estilos de parágrafo por nível
        self._s = {
            0: ParagraphStyle("DRE0", fontName=FONT_BOLD,   fontSize=8,  textColor=COLOR_NIVEL_0_FG, leading=10),
            1: ParagraphStyle("DRE1", fontName=FONT_BOLD,   fontSize=8,  textColor=COLOR_NIVEL_1_FG, leading=10),
            2: ParagraphStyle("DRE2", fontName=FONT_BOLD,   fontSize=7,  textColor=COLOR_NIVEL_2_FG, leading=9),
            3: ParagraphStyle("DRE3", fontName=FONT_NORMAL, fontSize=7,  textColor=COLOR_NIVEL_3_FG, leading=9),
        }
        self._s_total = ParagraphStyle("DRETotal", fontName=FONT_BOLD, fontSize=8, textColor=colors.white, leading=10)
        self._s_sub   = ParagraphStyle("DRESub",   fontName=FONT_NORMAL, fontSize=8, textColor=COLOR_TEXT, leading=10)

    # ── Larguras das colunas ──────────────────────────────────────────────────
    def _col_widths(self) -> list[float]:
        page_w, _ = self.pagesize
        w = page_w - 2 * MARGIN
        return [
            w * 0.12,   # Código
            w * 0.66,   # Descrição
            w * 0.22,   # Valor
        ]

    def _p(self, text: str, nivel: int = 3) -> Paragraph:
        style = self._s.get(nivel, self._s[3])
        return Paragraph(str(text).replace("&", "&amp;"), style)

    def _p_total(self, text: str) -> Paragraph:
        return Paragraph(str(text), self._s_total)

    # ── Cor e padding por nível ───────────────────────────────────────────────
    _BG = {0: COLOR_NIVEL_0_BG, 1: COLOR_NIVEL_1_BG, 2: COLOR_NIVEL_2_BG, 3: COLOR_NIVEL_3_BG}
    _LEFT_PAD = {0: 6, 1: 14, 2: 24, 3: 34}

    # ── Tabela principal dos nós ──────────────────────────────────────────────
    def _build_nodes_table(self, nodes: list[dict], col_widths: list[float]) -> Table:
        # Cabeçalho
        hdr_style = ParagraphStyle("DREHdr", fontName=FONT_BOLD, fontSize=7, textColor=COLOR_TEXT, leading=9)
        header = [
            Paragraph("Código", hdr_style),
            Paragraph("Descrição", hdr_style),
            Paragraph("Valor", hdr_style),
        ]
        rows = [header]

        for node in nodes:
            nivel = min(node.get("nivel", 3), 3)
            valor = node.get("valor", 0.0)
            idfluxo = node.get("idfluxo", "")
            descricao = node.get("descricao", "")

            rows.append([
                self._p(idfluxo, nivel),
                self._p(descricao, nivel),
                self._p(_brl(valor), nivel),
            ])

        table = Table(rows, colWidths=col_widths, repeatRows=1)

        style_cmds = [
            # Cabeçalho
            ("BACKGROUND",    (0, 0), (2, 0), COLOR_HEADER_BG),
            ("TOPPADDING",    (0, 0), (2, 0), 4),
            ("BOTTOMPADDING", (0, 0), (2, 0), 4),
            ("LEFTPADDING",   (0, 0), (2, 0), 5),
            ("GRID",          (0, 0), (2, len(rows) - 1), 0.3, COLOR_GRID),
            ("VALIGN",        (0, 0), (2, len(rows) - 1), "MIDDLE"),
            # Alinhamento direita da coluna Valor
            ("ALIGN",         (2, 0), (2, len(rows) - 1), "RIGHT"),
            ("RIGHTPADDING",  (2, 0), (2, len(rows) - 1), 6),
        ]

        for i, node in enumerate(nodes):
            row_idx = i + 1  # +1 pelo cabeçalho
            nivel = min(node.get("nivel", 3), 3)
            valor = node.get("valor", 0.0)
            bg = self._BG[nivel]
            lpad = self._LEFT_PAD[nivel]

            style_cmds += [
                ("BACKGROUND",  (0, row_idx), (2, row_idx), bg),
                ("TOPPADDING",  (0, row_idx), (2, row_idx), 3 if nivel >= 2 else 4),
                ("BOTTOMPADDING", (0, row_idx), (2, row_idx), 3 if nivel >= 2 else 4),
                ("LEFTPADDING", (0, row_idx), (1, row_idx), lpad),
            ]

            # Cor do valor
            if valor > 0:
                style_cmds.append(("TEXTCOLOR", (2, row_idx), (2, row_idx), COLOR_POS))
            elif valor < 0:
                style_cmds.append(("TEXTCOLOR", (2, row_idx), (2, row_idx), COLOR_NEG))
            else:
                style_cmds.append(("TEXTCOLOR", (2, row_idx), (2, row_idx), COLOR_ZERO))

        table.setStyle(TableStyle(style_cmds))
        return table

    # ── Barra de totais ───────────────────────────────────────────────────────
    def _build_total_bar(
        self,
        total_entradas: float,
        total_saidas: float,
        resultado: float,
        col_widths: list[float],
    ) -> Table:
        total_w = sum(col_widths)

        cell_w = total_w / 3

        def cell(label: str, value: float) -> Paragraph:
            cor = "color='#059669'" if value >= 0 else "color='#DC2626'"
            return Paragraph(
                f"<b>{label}</b><br/><font size='9' {cor}><b>{_brl(value)}</b></font>",
                self._s_total,
            )

        row = [
            cell("TOTAL ENTRADAS", total_entradas),
            cell("TOTAL SAÍDAS", -total_saidas),
            cell("RESULTADO FINAL", resultado),
        ]

        table = Table([row], colWidths=[cell_w, cell_w, cell_w])
        table.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (2, 0), COLOR_TOTAL_BG),
            ("TOPPADDING",    (0, 0), (2, 0), 7),
            ("BOTTOMPADDING", (0, 0), (2, 0), 7),
            ("LEFTPADDING",   (0, 0), (2, 0), 8),
            ("RIGHTPADDING",  (0, 0), (2, 0), 8),
            ("ALIGN",         (0, 0), (2, 0), "CENTER"),
            ("VALIGN",        (0, 0), (2, 0), "MIDDLE"),
            ("LINEAFTER",     (0, 0), (1, 0), 0.5, colors.HexColor("#374151")),
        ]))
        return table

    # ── Método principal ──────────────────────────────────────────────────────
    def generate(
        self,
        nodes: list[dict],
        total_entradas: float,
        total_saidas: float,
        resultado: float,
        data_de: str,
        data_ate: str,
        buf: BytesIO,
    ) -> None:
        col_widths = self._col_widths()
        page_w, page_h = self.pagesize

        # Sub-título com período e contagem
        periodo = Paragraph(
            f"Período: {_fmt_date(data_de)} a {_fmt_date(data_ate)}  ·  {len(nodes)} lançamento(s)",
            self._s_sub,
        )

        elements: list = [periodo, Spacer(1, 0.3 * cm)]

        if not nodes:
            elements.append(
                Paragraph("Nenhum lançamento encontrado para o período selecionado.", self._s_sub)
            )
        else:
            elements.append(self._build_nodes_table(nodes, col_widths))
            elements.append(Spacer(1, 0.3 * cm))
            elements.append(self._build_total_bar(total_entradas, total_saidas, resultado, col_widths))

        # Montar documento
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
