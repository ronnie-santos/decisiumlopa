"""
ordens_report.py — Relatório de Listagem de Ordens de Serviço
Herda BaseReport para layout padrão (cabeçalho, rodapé).
Layout: paisagem A4, com suporte a agrupamento por cliente ou empresa.
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
COLOR_GROUP_BG  = colors.HexColor("#1E293B")   # slate-800 — cabeçalho do grupo
COLOR_SUBTOTAL  = colors.HexColor("#E2E8F0")   # slate-200 — linha de subtotal
COLOR_TOTAL_BG  = colors.HexColor("#111827")   # slate-900 — total geral
COLOR_ABERTA    = colors.HexColor("#DCFCE7")   # green-100 — OS em aberto
COLOR_FATURADA  = colors.HexColor("#F1F5F9")   # slate-100 — OS faturada


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
        return "Faturada"
    elif s is False:
        return "Em Aberto"
    return "—"


# ── Relatório ─────────────────────────────────────────────────────────────────
class OrdensReport(BaseReport):
    """
    Relatório de Ordens de Serviço.
    Layout paisagem A4, com suporte a agrupamento por cliente ou empresa.
    """

    COLS = ["Data", "OS", "Cliente", "Equipamento", "Cidade Serv.", "Horário", "Horas", "KM", "Valor OS", "Situação", "Empresa"]
    N_COLS = len(COLS)

    def __init__(self):
        super().__init__(
            title="RELATÓRIO DE ORDENS DE SERVIÇO",
            orientation="landscape",
        )
        self._style_cell = ParagraphStyle(
            "OrdCell",
            fontName=FONT_NORMAL,
            fontSize=7,
            textColor=COLOR_TEXT,
            leading=9,
            wordWrap="CJK",
        )
        self._style_header = ParagraphStyle(
            "OrdHdr",
            fontName=FONT_BOLD,
            fontSize=7,
            textColor=COLOR_TEXT,
            leading=9,
        )
        self._style_group = ParagraphStyle(
            "OrdGroup",
            fontName=FONT_BOLD,
            fontSize=8,
            textColor=colors.white,
            leading=10,
        )
        self._style_subtotal = ParagraphStyle(
            "OrdSub",
            fontName=FONT_BOLD,
            fontSize=7,
            textColor=COLOR_TEXT,
            leading=9,
        )
        self._style_total = ParagraphStyle(
            "OrdTotal",
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
            w * 0.16,   # Cliente
            w * 0.10,   # Equipamento
            w * 0.10,   # Cidade Serv.
            w * 0.08,   # Horário
            w * 0.05,   # Horas
            w * 0.05,   # KM
            w * 0.09,   # Valor OS
            w * 0.08,   # Situação
            w * 0.17,   # Empresa
        ]

    def _p(self, text: str, style=None) -> Paragraph:
        style = style or self._style_cell
        return Paragraph(str(text).replace("\n", "<br/>"), style)

    def _row_from(self, row: dict) -> list:
        nr_os = row.get("numero_os")
        id_os = row.get("idordem")
        os_str = f"#{str(nr_os).zfill(4)}" if nr_os else (f"ID {id_os}" if id_os else "—")
        horas = row.get("total_horas", 0)
        km    = row.get("km_total", 0)
        v_os  = row.get("valor_os", 0)

        return [
            self._p(_fmt_date(row.get("data"))),
            self._p(os_str),
            self._p(row.get("cliente_nome") or "—"),
            self._p(row.get("equipamento_nome") or "—"),
            self._p(row.get("cidade_servico") or "—"),
            self._p(row.get("horario") or "—"),
            self._p(f"{horas:.1f}" if horas else "—"),
            self._p(str(km) if km else "—"),
            self._p(_brl(v_os) if v_os else "—"),
            self._p(_fmt_situacao(row.get("situacao"))),
            self._p(row.get("empresa_fantasia") or "—"),
        ]

    # ── Tabela plana (grupo=1, sem cabeçalhos de grupo) ───────────────────────
    def _build_flat_table(self, rows: list[dict], col_widths: list[float]) -> Table:
        n = self.N_COLS

        row_cols = [self._p(h, self._style_header) for h in self.COLS]
        data_rows = [self._row_from(r) for r in rows]

        all_rows = [row_cols] + data_rows
        table = Table(all_rows, colWidths=col_widths, repeatRows=1)

        style_cmds = [
            ("BACKGROUND",    (0, 0), (n - 1, 0), COLOR_HEADER_BG),
            ("TOPPADDING",    (0, 0), (n - 1, 0), 3),
            ("BOTTOMPADDING", (0, 0), (n - 1, 0), 3),
            ("TOPPADDING",    (0, 1), (n - 1, -1), 2),
            ("BOTTOMPADDING", (0, 1), (n - 1, -1), 2),
            ("GRID",          (0, 0), (n - 1, -1), 0.3, COLOR_GRID),
            ("VALIGN",        (0, 0), (n - 1, -1), "TOP"),
            ("ALIGN",         (6, 1), (8, -1), "RIGHT"),
        ]

        for i, row in enumerate(rows):
            row_idx = i + 1
            if row.get("situacao") is False:
                style_cmds.append(("BACKGROUND", (0, row_idx), (n - 1, row_idx), COLOR_ABERTA))
            elif i % 2 == 1:
                style_cmds.append(("BACKGROUND", (0, row_idx), (n - 1, row_idx), COLOR_ROW_ALT))

        table.setStyle(TableStyle(style_cmds))
        return table

    # ── Tabela de um grupo (grupo=2 ou 3) ────────────────────────────────────
    def _build_group_table(self, grupo: dict, col_widths: list[float]) -> Table:
        n = self.N_COLS
        nome = grupo["quebra"] or "Sem grupo"

        row_group = [self._p(nome.upper(), self._style_group)] + [""] * (n - 1)
        row_cols  = [self._p(h, self._style_header) for h in self.COLS]
        data_rows = [self._row_from(r) for r in grupo["rows"]]

        # Subtotal
        row_sub = [self._p("") for _ in range(n)]
        row_sub[n - 4] = self._p("SUBTOTAL", self._style_subtotal)
        row_sub[n - 3] = self._p(f"{grupo['subtotal_horas']:.1f}h", self._style_subtotal)
        row_sub[n - 2] = self._p("")
        row_sub[n - 2] = self._p(_brl(grupo["subtotal_valor_os"]), self._style_subtotal)
        row_sub[n - 1] = self._p("")

        all_rows = [row_group, row_cols] + data_rows + [row_sub]
        n_total  = len(all_rows)
        sub_idx  = n_total - 1

        table = Table(all_rows, colWidths=col_widths, repeatRows=0)

        style_cmds = [
            # Grupo header
            ("SPAN",            (0, 0), (n - 1, 0)),
            ("BACKGROUND",      (0, 0), (n - 1, 0), COLOR_GROUP_BG),
            ("TOPPADDING",      (0, 0), (n - 1, 0), 5),
            ("BOTTOMPADDING",   (0, 0), (n - 1, 0), 5),
            ("LEFTPADDING",     (0, 0), (n - 1, 0), 6),
            # Cabeçalho colunas
            ("BACKGROUND",      (0, 1), (n - 1, 1), COLOR_HEADER_BG),
            ("TOPPADDING",      (0, 1), (n - 1, 1), 3),
            ("BOTTOMPADDING",   (0, 1), (n - 1, 1), 3),
            # Dados
            ("TOPPADDING",      (0, 2), (n - 1, sub_idx - 1), 2),
            ("BOTTOMPADDING",   (0, 2), (n - 1, sub_idx - 1), 2),
            # Subtotal
            ("BACKGROUND",      (0, sub_idx), (n - 1, sub_idx), COLOR_SUBTOTAL),
            ("TOPPADDING",      (0, sub_idx), (n - 1, sub_idx), 4),
            ("BOTTOMPADDING",   (0, sub_idx), (n - 1, sub_idx), 4),
            # Grade
            ("GRID",            (0, 1), (n - 1, n_total - 1), 0.3, COLOR_GRID),
            ("VALIGN",          (0, 0), (n - 1, n_total - 1), "MIDDLE"),
            ("ALIGN",           (6, 1), (8, n_total - 1), "RIGHT"),
        ]

        for i, row in enumerate(grupo["rows"]):
            row_idx = i + 2
            if row.get("situacao") is False:
                style_cmds.append(("BACKGROUND", (0, row_idx), (n - 1, row_idx), COLOR_ABERTA))
            elif i % 2 == 1:
                style_cmds.append(("BACKGROUND", (0, row_idx), (n - 1, row_idx), COLOR_ROW_ALT))

        table.setStyle(TableStyle(style_cmds))
        return table

    # ── Tabela de total geral ─────────────────────────────────────────────────
    def _build_total_table(self, total_valor_os: float, total_horas: float, total_registros: int, col_widths: list[float]) -> Table:
        n = self.N_COLS
        row = [self._p("") for _ in range(n)]
        row[0]     = self._p(f"TOTAL GERAL  ·  {total_registros} ordem(ns)", self._style_total)
        row[n - 4] = self._p(f"{total_horas:.1f}h", self._style_total)
        row[n - 2] = self._p(_brl(total_valor_os), self._style_total)

        table = Table([row], colWidths=col_widths)
        table.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (n - 1, 0), COLOR_GROUP_BG),
            ("TOPPADDING",    (0, 0), (n - 1, 0), 5),
            ("BOTTOMPADDING", (0, 0), (n - 1, 0), 5),
            ("LEFTPADDING",   (0, 0), (0, 0), 6),
            ("ALIGN",         (n - 4, 0), (n - 2, 0), "RIGHT"),
            ("GRID",          (0, 0), (n - 1, 0), 0.3, COLOR_GRID),
            ("VALIGN",        (0, 0), (n - 1, 0), "MIDDLE"),
        ]))
        return table

    # ── Método principal ──────────────────────────────────────────────────────
    def generate(
        self,
        grupos: list[dict],
        total_valor_os: float,
        total_horas: float,
        total_registros: int,
        grupo_tipo: int,
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

        grupo_labels = {1: "Normal", 2: "por Cliente", 3: "por Empresa"}
        grupo_label  = grupo_labels.get(grupo_tipo, "")

        periodo = Paragraph(
            f"Período: {_fmt_date(data_de)} a {_fmt_date(data_ate)}  ·  "
            f"{total_registros} ordem(ns)  ·  "
            f"Agrupamento: {grupo_label}",
            periodo_style,
        )

        elements = [periodo, Spacer(1, 0.25 * cm)]

        if total_registros == 0:
            elements.append(Paragraph("Nenhuma ordem encontrada para o período e filtros selecionados.", periodo_style))
        elif grupo_tipo == 1:
            # Tabela plana — todas as ordens em uma única tabela
            all_rows = grupos[0]["rows"] if grupos else []
            elements.append(self._build_flat_table(all_rows, col_widths))
            elements.append(Spacer(1, 0.2 * cm))
            elements.append(self._build_total_table(total_valor_os, total_horas, total_registros, col_widths))
        else:
            # Agrupado — uma tabela por grupo
            for grupo in grupos:
                elements.append(self._build_group_table(grupo, col_widths))
                elements.append(Spacer(1, 0.2 * cm))
            elements.append(self._build_total_table(total_valor_os, total_horas, total_registros, col_widths))

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
