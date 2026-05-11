"""
comissao_report.py — Relatório de Comissão de Funcionários
Herda BaseReport para layout padrão (cabeçalho, rodapé).
Layout: paisagem A4, agrupado por funcionário, com subtotal por grupo e total geral.
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

# ── Cores adicionais ──────────────────────────────────────────────────────────
COLOR_GROUP_BG   = colors.HexColor("#1E293B")   # slate-800 — cabeçalho do grupo
COLOR_GROUP_FG   = colors.white
COLOR_SUBTOTAL   = colors.HexColor("#E2E8F0")   # slate-200 — linha de subtotal
COLOR_TOTAL_BG   = colors.HexColor("#111827")   # slate-900 — linha total geral
COLOR_DESCONTO   = colors.HexColor("#FEF2F2")   # red-50    — linha de desconto
COLOR_NEG        = colors.HexColor("#DC2626")   # red-600
COLOR_POS        = colors.HexColor("#059669")   # emerald-600


# ── Helpers ───────────────────────────────────────────────────────────────────
def _brl(v: float) -> str:
    """Formata float como moeda BRL sem biblioteca externa."""
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
class ComissaoReport(BaseReport):
    """
    Relatório de comissão de funcionários.
    Layout paisagem A4, agrupado por funcionário.
    """

    COLS = ["Data", "OS", "Cliente", "Cidade", "Equipamento", "Empresa", "KM", "Valor OS", "Comissão", "Obs"]
    N_COLS = len(COLS)

    def __init__(self):
        super().__init__(
            title="RELATÓRIO DE COMISSÃO DE FUNCIONÁRIOS",
            orientation="landscape",
        )
        self._style_cell = ParagraphStyle(
            "CommCell",
            fontName=FONT_NORMAL,
            fontSize=7,
            textColor=COLOR_TEXT,
            leading=9,
            wordWrap="CJK",
        )
        self._style_header = ParagraphStyle(
            "CommHdr",
            fontName=FONT_BOLD,
            fontSize=7,
            textColor=COLOR_TEXT,
            leading=9,
        )
        self._style_group = ParagraphStyle(
            "CommGroup",
            fontName=FONT_BOLD,
            fontSize=8,
            textColor=colors.white,
            leading=10,
        )
        self._style_subtotal = ParagraphStyle(
            "CommSub",
            fontName=FONT_BOLD,
            fontSize=7,
            textColor=COLOR_TEXT,
            leading=9,
        )
        self._style_total = ParagraphStyle(
            "CommTotal",
            fontName=FONT_BOLD,
            fontSize=8,
            textColor=colors.white,
            leading=10,
        )

    # ── Larguras das colunas (landscape A4) ───────────────────────────────────
    def _col_widths(self) -> list[float]:
        page_w, _ = self.pagesize
        w = page_w - 2 * MARGIN
        return [
            w * 0.07,   # Data
            w * 0.05,   # OS
            w * 0.18,   # Cliente
            w * 0.11,   # Cidade
            w * 0.11,   # Equipamento
            w * 0.11,   # Empresa
            w * 0.05,   # KM
            w * 0.10,   # Valor OS
            w * 0.10,   # Comissão
            w * 0.12,   # Obs
        ]

    def _p(self, text: str, style=None) -> Paragraph:
        style = style or self._style_cell
        return Paragraph(str(text).replace("\n", "<br/>"), style)

    # ── Tabela de um grupo de funcionário ─────────────────────────────────────
    def _build_group_table(self, grupo: dict, col_widths: list[float]) -> Table:
        n = self.N_COLS
        func_nome = grupo["funcionario_nome"] or f"Funcionário #{grupo['funcionario_id']}"

        # Linha 0: nome do funcionário (span total)
        row_group = [self._p(func_nome.upper(), self._style_group)] + [""] * (n - 1)

        # Linha 1: cabeçalho das colunas
        row_cols = [self._p(h, self._style_header) for h in self.COLS]

        # Linhas de dados
        data_rows = []
        for row in grupo["rows"]:
            nr_os = row.get("numero_os")
            id_os = row.get("idordem")
            os_str = f"#{str(nr_os).zfill(4)}" if nr_os else (f"ID {id_os}" if id_os else "—")
            km = row.get("km_total", 0)
            v_os = row.get("valor_os", 0)
            comissao = row.get("comissao", 0)

            data_rows.append([
                self._p(_fmt_date(row.get("data"))),
                self._p(os_str),
                self._p(row.get("cliente_nome") or "—"),
                self._p(row.get("cidade_servico") or "—"),
                self._p(row.get("equipamento_nome") or "—"),
                self._p(row.get("empresa_fantasia") or "—"),
                self._p(str(int(km)) if km else "—"),
                self._p(_brl(v_os) if v_os else "—"),
                self._p(_brl(comissao)),
                self._p(row.get("observacao") or ""),
            ])

        # Linha de subtotal
        row_subtotal = [self._p("") for _ in range(n)]
        row_subtotal[n - 3] = self._p("SUBTOTAL", self._style_subtotal)
        row_subtotal[n - 2] = self._p(_brl(grupo["subtotal"]), self._style_subtotal)
        row_subtotal[n - 1] = self._p("")

        all_rows = [row_group, row_cols] + data_rows + [row_subtotal]
        n_total = len(all_rows)
        subtotal_idx = n_total - 1

        table = Table(all_rows, colWidths=col_widths, repeatRows=0)

        style_cmds = [
            # ── Grupo header (linha 0) ───────────────────────────────────────
            ("SPAN",            (0, 0), (n - 1, 0)),
            ("BACKGROUND",      (0, 0), (n - 1, 0), COLOR_GROUP_BG),
            ("TOPPADDING",      (0, 0), (n - 1, 0), 5),
            ("BOTTOMPADDING",   (0, 0), (n - 1, 0), 5),
            ("LEFTPADDING",     (0, 0), (n - 1, 0), 6),
            # ── Cabeçalho colunas (linha 1) ──────────────────────────────────
            ("BACKGROUND",      (0, 1), (n - 1, 1), COLOR_HEADER_BG),
            ("TOPPADDING",      (0, 1), (n - 1, 1), 3),
            ("BOTTOMPADDING",   (0, 1), (n - 1, 1), 3),
            # ── Dados (linhas 2 .. subtotal-1) ───────────────────────────────
            ("TOPPADDING",      (0, 2), (n - 1, subtotal_idx - 1), 2),
            ("BOTTOMPADDING",   (0, 2), (n - 1, subtotal_idx - 1), 2),
            # ── Subtotal ─────────────────────────────────────────────────────
            ("BACKGROUND",      (0, subtotal_idx), (n - 1, subtotal_idx), COLOR_SUBTOTAL),
            ("TOPPADDING",      (0, subtotal_idx), (n - 1, subtotal_idx), 4),
            ("BOTTOMPADDING",   (0, subtotal_idx), (n - 1, subtotal_idx), 4),
            # ── Grade geral ──────────────────────────────────────────────────
            ("GRID",            (0, 1), (n - 1, n_total - 1), 0.3, COLOR_GRID),
            ("VALIGN",          (0, 0), (n - 1, n_total - 1), "MIDDLE"),
            # ── Alinhamento direita para valores numéricos ───────────────────
            ("ALIGN",           (6, 1), (8, n_total - 1), "RIGHT"),
        ]

        # Zebra striping nos dados
        for i, row in enumerate(grupo["rows"]):
            row_idx = i + 2  # +2: grupo header + col header
            is_desconto = row.get("tipo") == "desconto"
            if is_desconto:
                style_cmds.append(("BACKGROUND", (0, row_idx), (n - 1, row_idx), COLOR_DESCONTO))
            elif i % 2 == 1:
                style_cmds.append(("BACKGROUND", (0, row_idx), (n - 1, row_idx), COLOR_ROW_ALT))

            # Cor da comissão (col 8)
            comissao = row.get("comissao", 0)
            if comissao < 0:
                style_cmds.append(("TEXTCOLOR", (8, row_idx), (8, row_idx), COLOR_NEG))
            else:
                style_cmds.append(("TEXTCOLOR", (8, row_idx), (8, row_idx), COLOR_POS))

        # Cor do subtotal
        if grupo["subtotal"] < 0:
            style_cmds.append(("TEXTCOLOR", (n - 2, subtotal_idx), (n - 2, subtotal_idx), COLOR_NEG))
        else:
            style_cmds.append(("TEXTCOLOR", (n - 2, subtotal_idx), (n - 2, subtotal_idx), COLOR_POS))

        table.setStyle(TableStyle(style_cmds))
        return table

    # ── Tabela de total geral ─────────────────────────────────────────────────
    def _build_total_table(self, total_geral: float, col_widths: list[float]) -> Table:
        n = self.N_COLS
        row = [self._p("") for _ in range(n)]
        row[n - 3] = self._p("TOTAL GERAL", self._style_total)
        row[n - 2] = self._p(_brl(total_geral), self._style_total)
        row[n - 1] = self._p("")

        table = Table([row], colWidths=col_widths)
        cor_val = COLOR_NEG if total_geral < 0 else COLOR_POS
        table.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (n - 1, 0), COLOR_TOTAL_BG),
            ("TOPPADDING",    (0, 0), (n - 1, 0), 5),
            ("BOTTOMPADDING", (0, 0), (n - 1, 0), 5),
            ("ALIGN",         (n - 3, 0), (n - 2, 0), "RIGHT"),
            ("TEXTCOLOR",     (n - 2, 0), (n - 2, 0), cor_val),
            ("GRID",          (0, 0), (n - 1, 0), 0.3, COLOR_GRID),
            ("VALIGN",        (0, 0), (n - 1, 0), "MIDDLE"),
        ]))
        return table

    # ── Método principal ──────────────────────────────────────────────────────
    def generate(
        self,
        grupos: list[dict],
        total_geral: float,
        data_de: str,
        data_ate: str,
        buf: BytesIO,
    ) -> None:
        """
        Gera o PDF no buffer fornecido.

        Parâmetros
        ----------
        grupos      : lista de grupos retornados pelo endpoint /relatorio/comissao
        total_geral : total consolidado
        data_de     : data inicial (YYYY-MM-DD)
        data_ate    : data final   (YYYY-MM-DD)
        buf         : BytesIO para escrita
        """
        col_widths = self._col_widths()
        page_w, page_h = self.pagesize

        # ── Sub-título com período ────────────────────────────────────────────
        periodo_style = ParagraphStyle(
            "Periodo",
            fontName=FONT_NORMAL,
            fontSize=8,
            textColor=COLOR_TEXT,
            leading=10,
        )
        periodo = Paragraph(
            f"Período: {_fmt_date(data_de)} a {_fmt_date(data_ate)}  ·  "
            f"{sum(len(g['rows']) for g in grupos)} lançamento(s)  ·  "
            f"{len(grupos)} funcionário(s)",
            periodo_style,
        )

        # ── Elementos ─────────────────────────────────────────────────────────
        elements = [periodo, Spacer(1, 0.25 * cm)]

        if not grupos:
            elements.append(Paragraph("Nenhum dado para o período selecionado.", periodo_style))
        else:
            for grupo in grupos:
                elements.append(self._build_group_table(grupo, col_widths))
                elements.append(Spacer(1, 0.2 * cm))
            elements.append(self._build_total_table(total_geral, col_widths))

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
